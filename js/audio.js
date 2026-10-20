// 合成音效與背景音樂（WebAudio，不用音檔）。iPhone 要在點擊時 unlock()
(function (G) {
  let ac = null, master = null, musicGain = null, muted = false, musicTimer = null, step = 0;
  try { muted = localStorage.getItem('oi-mute') === '1'; } catch (e) {}

  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
      musicGain = ac.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      startMusic();
    }
    if (ac.state === 'suspended') ac.resume();
  }
  function tone(f, d, type = 'square', vol = 0.15, when = 0, slide = 0, dest) {
    if (!ac) return;
    const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(d, vol = 0.12, hp = 1200) {
    if (!ac) return;
    const t = ac.currentTime, b = ac.createBuffer(1, ac.sampleRate * d, ac.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = b; s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  let lastHit = 0;
  const SFX = {
    hit() { const n = performance.now(); if (n - lastHit < 45) return; lastHit = n; noise(0.05, 0.06, 2000); },
    crit() { noise(0.12, 0.14, 800); tone(880, 0.12, 'square', 0.06, 0, -400); },
    tap() { tone(520 + Math.random() * 120, 0.05, 'triangle', 0.08); },
    coin() { tone(1320, 0.06, 'square', 0.04); tone(1760, 0.1, 'square', 0.04, 0.05); },
    kill() { tone(300, 0.1, 'triangle', 0.08, 0, -150); },
    buy() { tone(660, 0.06, 'square', 0.06); tone(990, 0.08, 'square', 0.06, 0.05); },
    levelup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.06, i * 0.06)); },
    ult() { tone(200, 0.5, 'sawtooth', 0.08, 0, 800); noise(0.4, 0.08, 400); },
    boss() { [0, 0.25, 0.5].forEach(w => tone(220, 0.2, 'sawtooth', 0.09, w, -60)); },
    clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'square', 0.07, i * 0.08)); },
    fail() { [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'triangle', 0.09, i * 0.18)); },
    hurt() { tone(160, 0.08, 'square', 0.05, 0, -60); },
    join() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.09, i * 0.09)); }
  };

  // 背景音樂：輕快的辦公室小調（C 大調 4 和弦循環）
  const CH = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
  const MEL = [0, 2, 4, 2, 5, 4, 2, 0, 1, 2, 4, 5, 4, 2, 1, -1];
  const SCALE = [523, 587, 659, 698, 784, 880, 988];
  function startMusic() {
    if (musicTimer) return;
    musicTimer = setInterval(() => {
      if (!ac || ac.state !== 'running') return;
      const bar = Math.floor(step / 8) % 4, c = CH[bar];
      if (step % 8 === 0) tone(c[0] / 2, 0.5, 'triangle', 0.5, 0, 0, musicGain);
      if (step % 2 === 0) tone(c[(step / 2) % 3], 0.12, 'square', 0.12, 0, 0, musicGain);
      const m = MEL[step % 16]; if (m >= 0 && step % 2 === 1) tone(SCALE[m] * (bar === 3 ? 0.89 : 1), 0.18, 'triangle', 0.22, 0, 0, musicGain);
      if (step % 4 === 2) { const n = ac.createBufferSource(); } // 留空拍
      step++;
    }, 170);
  }
  function setMute(m) { muted = m; try { localStorage.setItem('oi-mute', m ? '1' : '0'); } catch (e) {} if (master) master.gain.value = m ? 0 : 0.5; }

  G.Audio = { unlock, play: k => { if (ac && !muted && SFX[k]) SFX[k](); }, setMute, get muted() { return muted; } };
})(window);
