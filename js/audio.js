// 合成音效與背景音樂（WebAudio，不用音檔）。iPhone 要在點擊時 unlock()
(function (G) {
  let ac = null, master = null, sfxBus = null, musicGain = null, delayIn = null, noiseBuf = null;
  let muted = false, musicOn = true, musicTimer = null, step = 0, nextT = 0;
  try { muted = localStorage.getItem('oi-mute') === '1'; musicOn = localStorage.getItem('oi-music') !== '0'; } catch (e) {}
  const MASTER = 0.55, MUSIC = 0.13;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      master = ac.createGain(); master.gain.value = muted ? 0 : MASTER;
      master.connect(comp); comp.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      musicGain = ac.createGain(); musicGain.gain.value = musicOn ? MUSIC : 0; musicGain.connect(master);
      // 旋律用的回音
      delayIn = ac.createGain(); delayIn.gain.value = 0.22;
      const dl = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter();
      dl.delayTime.value = 0.38; fb.gain.value = 0.28; lp.type = 'lowpass'; lp.frequency.value = 2200;
      delayIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musicGain);
      // 共用白噪音（不要每次打擊都 new buffer）
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      startMusic();
      document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });
    }
    if (ac.state === 'suspended' && !document.hidden) ac.resume();
  }

  // 一個音：f 頻率、d 長度、可加滑音、濾波、起音時間
  function tone(f, d, type = 'square', vol = 0.15, when = 0, slide = 0, dest, o2) {
    if (!ac) return;
    const t = (o2 && o2.at) || ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
    const atk = (o2 && o2.atk) || 0.004;
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    let out = o;
    if (o2 && o2.lp) { const f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o2.lp; o.connect(f2); out = f2; }
    out.connect(g); g.connect(dest || sfxBus);
    if (o2 && o2.send) g.connect(o2.send);
    o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, vol = 0.12, freq = 1200, type = 'highpass', when = 0, sweep = 0, dest, at) {
    if (!ac) return;
    const t = at || ac.currentTime + when, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + d);
    if (type === 'bandpass') f.Q.value = 1.4;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus);
    s.start(t, Math.random() * 0.5, d + 0.02);
  }
  const lastT = {};
  const gate = (k, ms) => { const n = performance.now(); if (n - (lastT[k] || 0) < ms) return false; lastT[k] = n; return true; };
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];

  const SFX = {
    hit() { if (gate('hit', 45)) noise(0.05, 0.07, 1800, 'bandpass'); },
    crit() { if (!gate('crit', 60)) return; noise(0.12, 0.14, 2500, 'lowpass'); tone(880, 0.12, 'square', 0.05, 0, -400, null, { lp: 3000 }); tone(150, 0.14, 'sine', 0.22, 0, -90); },
    tap(combo = 0) {
      if (!gate('tap', 25)) return;
      const f = mtof(72 + PENTA[Math.min(PENTA.length - 1, combo)]);
      tone(f, 0.07, 'triangle', 0.09); tone(f * 2, 0.025, 'square', 0.02, 0, 0, null, { lp: 4000 });
      if (combo >= 10 && combo % 5 === 0) { tone(f * 1.5, 0.1, 'triangle', 0.05, 0.04); }
    },
    coin() { if (!gate('coin', 70)) return; tone(1320, 0.06, 'square', 0.035, 0, 0, null, { lp: 4500 }); tone(1760, 0.12, 'square', 0.035, 0.05, 0, null, { lp: 4500 }); },
    kill() { if (!gate('kill', 50)) return; tone(320, 0.12, 'triangle', 0.08, 0, -170); noise(0.06, 0.04, 900, 'bandpass'); },
    buy() { if (!gate('buy', 60)) return; tone(660, 0.06, 'square', 0.045, 0, 0, null, { lp: 3500 }); tone(990, 0.09, 'square', 0.045, 0.05, 0, null, { lp: 3500 }); },
    tab() { if (gate('tab', 40)) tone(900, 0.04, 'sine', 0.05); },
    levelup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.045, i * 0.06, 0, null, { lp: 4000 })); },
    fanfare() {
      if (!gate('fan', 400)) return;
      [[523, 659, 784], [587, 740, 880], [784, 988, 1175]].forEach((c, i) => c.forEach(f => tone(f, i === 2 ? 0.45 : 0.12, 'square', 0.03, i * 0.11, 0, null, { lp: 3200 })));
      [1568, 2093, 2637].forEach((f, i) => tone(f, 0.18, 'triangle', 0.035, 0.33 + i * 0.05));
    },
    ult() { tone(200, 0.5, 'sawtooth', 0.07, 0, 800, null, { lp: 2400 }); noise(0.45, 0.08, 400, 'bandpass', 0, 2600); tone(110, 0.3, 'sine', 0.2, 0, -50); },
    boss() { [0, 0.25, 0.5].forEach(w => { tone(220, 0.22, 'sawtooth', 0.08, w, -60, null, { lp: 1600 }); tone(110, 0.25, 'sine', 0.18, w, -40); }); },
    warn() { if (!gate('warn', 500)) return; [0, 0.16, 0.32, 0.48].forEach((w, i) => tone(i % 2 ? 660 : 880, 0.14, 'square', 0.05, w, 0, null, { lp: 2500 })); },
    bossHit() { if (!gate('bh', 150)) return; tone(95, 0.4, 'sine', 0.3, 0, -55); noise(0.3, 0.12, 700, 'lowpass'); },
    shield() { if (!gate('sh', 200)) return; [2400, 1800, 3000].forEach((f, i) => tone(f, 0.12, 'triangle', 0.05, i * 0.03)); noise(0.18, 0.08, 4000, 'highpass'); },
    whoosh() { if (gate('wh', 300)) noise(0.45, 0.05, 400, 'bandpass', 0, 2400); },
    bonus() {
      [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.12, 'triangle', 0.07, i * 0.045));
      tone(2637, 0.25, 'sine', 0.04, 0.2);
      noise(0.2, 0.03, 6000, 'highpass', 0.05);
    },
    clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'square', 0.05, i * 0.08, 0, null, { lp: 3500 })); },
    fail() { [392, 330, 262].forEach((f, i) => tone(f, 0.28, 'triangle', 0.09, i * 0.18)); },
    hurt() { if (gate('hurt', 80)) tone(160, 0.08, 'square', 0.04, 0, -60, null, { lp: 1500 }); },
    down() { tone(330, 0.35, 'triangle', 0.08, 0, -220); },
    join() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.09, i * 0.09)); }
  };

  // ---------- 背景音樂：輕快辦公室小調（8 小節循環，鼓＋貝斯＋和弦＋旋律）----------
  const STEP = 0.19;   // 一個八分音符
  const CH = [
    { r: 48, n: [60, 64, 67] }, { r: 45, n: [57, 60, 64] }, { r: 41, n: [57, 60, 65] }, { r: 43, n: [55, 59, 62] },
    { r: 48, n: [60, 64, 67] }, { r: 45, n: [57, 60, 64] }, { r: 50, n: [57, 62, 65] }, { r: 43, n: [55, 59, 62] }
  ];
  const _ = null;
  const MEL = [
    4, _, 7, _, 9, 7, 4, _,   0, _, 4, _, 2, 0, -3, _,
    5, _, 9, _, 7, 5, 2, _,   2, 4, 7, _, -1, _, 2, _,
    4, _, 7, _, 12, _, 11, 9, 7, _, 4, _, 9, _, 7, 4,
    5, 4, 2, _, 5, _, 9, _,   7, _, _, _, 2, _, -1, _
  ];
  function schedule(i, t) {
    const bar = Math.floor(i / 8) % 8, s = i % 8, c = CH[bar], loop = Math.floor(i / 64);
    // 鼓
    if (s === 0 || s === 4) tone(140, 0.16, 'sine', 0.55, 0, -95, musicGain, { at: t });
    if (s === 2 || s === 6) noise(0.09, 0.12, 1800, 'bandpass', 0, 0, musicGain, t);
    if (s % 2 === 1) noise(0.03, 0.05, 7000, 'highpass', 0, 0, musicGain, t);
    // 貝斯
    const bn = s === 0 ? c.r : s === 3 ? c.r + 12 : s === 4 ? c.r + 7 : s === 6 ? c.r + 12 : null;
    if (bn) tone(mtof(bn), 0.22, 'triangle', 0.42, 0, 0, musicGain, { at: t, lp: 900 });
    // 反拍和弦
    if (s === 2 || s === 6) c.n.forEach(m => tone(mtof(m), 0.1, 'square', 0.05, 0, 0, musicGain, { at: t, lp: 1600 }));
    // 旋律（第二輪高八度、比較亮）
    const m = MEL[i % 64];
    if (m !== null) tone(mtof(72 + m + (loop % 2 ? 12 : 0)), 0.17, 'triangle', loop % 2 ? 0.13 : 0.2, 0, 0, musicGain, { at: t, send: delayIn, atk: 0.008 });
  }
  function startMusic() {
    if (musicTimer) return;
    nextT = ac.currentTime + 0.1;
    musicTimer = setInterval(() => {
      if (!ac || ac.state !== 'running' || !musicOn || muted) return;
      if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;   // 剛恢復，避免一次補很多拍
      while (nextT < ac.currentTime + 0.18) { schedule(step, nextT); step++; nextT += STEP; }
    }, 50);
  }
  function setMute(m) {
    muted = m; try { localStorage.setItem('oi-mute', m ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(m ? 0 : MASTER, ac.currentTime, 0.02);
  }
  function setMusic(on) {
    musicOn = on; try { localStorage.setItem('oi-music', on ? '1' : '0'); } catch (e) {}
    if (musicGain) musicGain.gain.setTargetAtTime(on ? MUSIC : 0, ac.currentTime, 0.05);
  }

  G.Audio = {
    unlock, setMute, setMusic,
    play: (k, arg) => { if (ac && !muted && SFX[k] && ac.state === 'running') SFX[k](arg); },
    get muted() { return muted; }, get music() { return musicOn; }
  };
})(window);
