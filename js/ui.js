// 介面、主迴圈、存檔、劇情
(function (G) {
  const D = G.DATA, E = G.Engine;
  const $ = s => document.querySelector(s);
  const KEY = 'office-idle-v1';

  // ---------- 數字格式 ----------
  const UNITS = ['', 'K', 'M', 'B', 'T'];
  G.fmt = n => {
    n = Math.floor(n);
    if (n < 1000) return String(n);
    let i = 0, v = n; while (v >= 1000 && i < 60) { v /= 1000; i++; }
    const u = i < UNITS.length ? UNITS[i] : String.fromCharCode(97 + Math.floor((i - 5) / 26)) + String.fromCharCode(97 + (i - 5) % 26);
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v)) + u;
  };

  // 頭像（從站姿圖裁頭）
  const FACE = { kui: [52, 17], mi: [56, 13], jie: [47, 12], vivi: [46, 8] };
  function faceStyle(id, size = 220) {
    const g = game, pro = g && g.rank(g.s.heroes[id] || 0) >= 2;
    const [fx, fy] = FACE[id];
    return `background-image:url(art/char/${pro ? 'pro_' : ''}${id}.webp);background-size:${size}% auto;background-position:${fx}% ${fy}%`;
  }

  // ---------- 存檔 ----------
  function loadSave() {
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return null;
      const s = JSON.parse(raw), base = E.newSave();
      return Object.assign(base, s, { heroes: Object.assign(base.heroes, s.heroes), stats: Object.assign(base.stats, s.stats) });
    } catch (e) { return null; }
  }
  let resetting = false;
  function save() { if (resetting) return; try { localStorage.setItem(KEY, JSON.stringify(game.s)); } catch (e) {} }

  let game, rnd, paused = false, tab = 'staff', buyN = 1;
  const storyQ = [];

  // ---------- 劇情 ----------
  function story(key, after) {
    if (!D.STORY[key] || game.s.seen[key]) { after && after(); return; }
    game.s.seen[key] = 1;
    storyQ.push({ key, lines: D.STORY[key].slice(), after });
    if (storyQ.length === 1) nextLine();
  }
  function nextLine() {
    const cur = storyQ[0];
    if (!cur) { $('#story').hidden = true; paused = false; return; }
    paused = true;
    const line = cur.lines.shift();
    if (!line) { storyQ.shift(); cur.after && cur.after(); return nextLine(); }
    const [who, text] = line, dlg = $('#story .dlg');
    $('#story').hidden = false;
    const hero = D.HEROES.find(h => h.id === who);
    dlg.classList.toggle('sys', who === 'sys');
    dlg.classList.toggle('hasFace', !!hero);
    const face = $('#story .face');
    if (hero) { const pro = game.rank(game.s.heroes[who] || 0) >= 2; face.style.backgroundImage = `url(art/char/${pro ? 'pro_' : ''}${who}.webp)`; face.hidden = false; } else face.hidden = true;
    $('#story .name').textContent = hero ? hero.name : '';
    $('#story .name').hidden = !hero;
    $('#story .text').textContent = text;
  }

  // ---------- toast ----------
  function toast(t) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = t;
    $('#toasts').appendChild(el); setTimeout(() => el.remove(), 3000);
  }

  // ---------- 頂部與隊伍 ----------
  let lastGold = 0;
  function updateTop() {
    const s = game.s, n = E.stageName(s.stage);
    $('#stDay').textContent = n.day; $('#stCode').textContent = n.code; $('#stName').textContent = (s.farming ? '練功中・' : '') + n.title;
    const gEl = $('#gold'); gEl.textContent = G.fmt(s.gold);
    if (s.gold > lastGold + 0.5) { gEl.parentNode.classList.remove('bump'); void gEl.offsetWidth; gEl.parentNode.classList.add('bump'); }
    lastGold = s.gold;
    const w = $('#waves'); const boss = E.isBoss(s.stage);
    const html = boss ? '<i class="boss"></i>' : Array.from({ length: game.waveCount }, (_, i) => `<i class="${i < game.wave ? 'done' : ''}"></i>`).join('');
    if (w.innerHTML !== html) w.innerHTML = html;
    $('#btnBoss').hidden = !s.farming;
    $('#autoWrap').hidden = s.maxStage < 10;
    $('#autoUlt').checked = s.autoUlt;
    $('#dps').textContent = '團隊輸出 ' + G.fmt(game.teamDps()) + '/秒';
    // 新手提示
    const hint = $('#hint');
    let ht = '';
    if (s.stats.taps < 8 && s.stats.play < 90 && game.phase === 'fight') ht = '👆 點畫面「催稿」一起打怪！';
    else if (game.heroes.some(h => game.canUlt(h)) && s.stats.ults < 2 && !s.autoUlt) ht = '⚡ 頭像亮了！點頭像放大招';
    if (paused) ht = '';
    hint.hidden = !ht; if (ht) hint.textContent = ht;
  }
  function buildTeam() {
    $('#team').innerHTML = D.ORDER.map(id => {
      const h = D.HEROES.find(x => x.id === id);
      return `<div class="hc" data-id="${id}" style="--c:${h.color};--e:0"><div class="ring"><div class="face"></div></div><div class="nm">${h.name}</div><div class="hp"><i></i></div></div>`;
    }).join('');
    $('#team').querySelectorAll('.hc').forEach(el => el.addEventListener('pointerdown', () => {
      G.Audio.unlock();
      if (game.ult(el.dataset.id)) {} else if (game.s.heroes[el.dataset.id] === 0) toast(`${D.HEROES.find(h => h.id === el.dataset.id).name}：通過 ${E.stageName(D.HEROES.find(h => h.id === el.dataset.id).joinAt - 1).code} 後加入`);
    }));
  }
  function updateTeam() {
    D.ORDER.forEach(id => {
      const el = $(`.hc[data-id="${id}"]`), h = game.heroes.find(x => x.id === id), lv = game.s.heroes[id];
      el.classList.toggle('locked', lv === 0);
      el.classList.toggle('dead', h.on && h.dead);
      el.classList.toggle('ready', game.canUlt(h));
      el.style.setProperty('--e', lv ? Math.floor(h.energy) : 0);
      el.querySelector('.hp i').style.width = (lv ? Math.max(0, h.hp / h.max) * 100 : 0) + '%';
      const f = el.querySelector('.face'), st = faceStyle(id);
      if (f.dataset.st !== st) { f.dataset.st = st; f.setAttribute('style', st); }
    });
  }

  // ---------- 面板 ----------
  function holdButton(btn, fn) {
    let t1, t2;
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    btn.addEventListener('pointerdown', e => { G.Audio.unlock(); fn(); t1 = setTimeout(() => { t2 = setInterval(() => { if (!fn()) stop(); }, 90); }, 380); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(k => btn.addEventListener(k, stop));
  }
  function heroBuyCount(id) {
    if (buyN === 'max') return Math.max(1, game.maxAffordable(n => game.heroCost(id, n))[0]);
    return buyN;
  }
  function buildPanel() {
    const p = $('#panel'); p.innerHTML = ''; p.scrollTop = 0;
    if (tab === 'staff') {
      p.insertAdjacentHTML('beforeend', `<div class="tip" id="staffTip"></div><div class="seg">${[1, 10, 'max'].map(n => `<button data-n="${n}" class="${buyN == n ? 'on' : ''}">${n === 'max' ? '最多' : '×' + n}</button>`).join('')}</div>`);
      p.querySelectorAll('.seg button').forEach(b => b.onclick = () => { buyN = b.dataset.n === 'max' ? 'max' : +b.dataset.n; buildPanel(); });
      D.ORDER.forEach(id => {
        const h = D.HEROES.find(x => x.id === id);
        const row = document.createElement('div'); row.className = 'row'; row.dataset.id = id;
        row.innerHTML = `<div class="pic"><span class="lv"></span></div><div class="info"><div class="t">${h.name}<small class="rk"></small></div><div class="d st"></div><div class="skill">⚡ ${h.skill.name}：${h.skill.desc}<br>✦ ${h.passive}</div></div><button class="buy"></button>`;
        p.appendChild(row);
        holdButton(row.querySelector('.buy'), () => { const n = heroBuyCount(id); const ok = game.buyHero(id, n); if (ok) G.Audio.play('buy'); updatePanel(); return ok; });
      });
      const tr = document.createElement('div'); tr.className = 'row'; tr.dataset.id = 'tap';
      tr.innerHTML = `<div class="emoji">👆</div><div class="info"><div class="t">催稿力<small>就是你</small></div><div class="d st"></div></div><button class="buy"></button>`;
      p.appendChild(tr);
      holdButton(tr.querySelector('.buy'), () => { const ok = game.buyTap(); if (ok) G.Audio.play('buy'); updatePanel(); return ok; });
    } else if (tab === 'office') {
      p.insertAdjacentHTML('beforeend', `<div class="tip">辦公室升級是全隊永久加成，越後面的日子解鎖越多設備。</div>`);
      D.OFFICE.forEach(o => {
        const row = document.createElement('div'); row.className = 'row'; row.dataset.id = o.id;
        row.innerHTML = `<div class="emoji">${o.icon}</div><div class="info"><div class="t">${o.name}<small class="lvT"></small></div><div class="d st"></div></div><button class="buy"></button>`;
        p.appendChild(row);
        holdButton(row.querySelector('.buy'), () => { const ok = game.buyOffice(o.id); if (ok) G.Audio.play('buy'); updatePanel(); return ok; });
      });
    } else if (tab === 'quest') {
      p.insertAdjacentHTML('beforeend', `<div class="tip">任務沒有時間限制，達成就能領薪水。</div>`);
      D.QUESTS.forEach(q => {
        const row = document.createElement('div'); row.className = 'row'; row.dataset.id = q.id;
        row.innerHTML = `<div class="emoji">📋</div><div class="info"><div class="t">${q.text}</div><div class="d st"></div><div class="prog"><i></i></div></div><button class="buy claim"></button>`;
        p.appendChild(row);
        row.querySelector('.buy').onclick = () => { const [c, n] = questProg(q); if (c >= n && !game.s.quests[q.id]) { game.s.quests[q.id] = 1; game.s.gold += q.gold; G.Audio.play('coin'); toast(`任務完成！薪水 +${G.fmt(q.gold)}`); updatePanel(); } };
      });
    } else if (tab === 'loot') {
      p.insertAdjacentHTML('beforeend', `<div class="secT">頭目戰利品（永久加成）</div><div class="lootGrid">${D.LOOT.map(l => `<div class="loot ${game.s.loot.includes(l.id) ? '' : 'no'}"><div class="ic">${l.icon}</div><b>${game.s.loot.includes(l.id) ? l.name : '？？？'}</b>${game.s.loot.includes(l.id) ? l.desc : '打倒 ' + D.ENEMIES[l.boss].name + ' 取得'}</div>`).join('')}</div>`);
      p.insertAdjacentHTML('beforeend', `<div class="secT">員工名冊</div>` + D.HEROES.map(h => {
        const lv = game.s.heroes[h.id], r = lv ? game.rank(lv) : 0;
        return `<div class="card"><img src="art/char/${lv && r >= 2 ? 'pro_' : ''}${h.id}.webp" alt="${h.name}" style="${lv ? '' : 'filter:brightness(0) opacity(.35)'}"><div><b>${h.name}</b>　<small>${h.job}・${h.role}</small><div class="d">${lv ? `目前職位：<b>${h.ranks[r]}</b><br>升職路線：${h.ranks.join(' → ')}<br>口頭禪：「${h.lines[Math.floor(Math.random() * h.lines.length)]}」` : '尚未加入'}</div></div></div>`;
      }).join(''));
      p.insertAdjacentHTML('beforeend', `<div class="secT">上班紀錄</div><div class="tip">上班時間 ${Math.floor(game.s.stats.play / 60)} 分鐘・打倒 ${G.fmt(game.s.stats.kills)} 個工作怪・大招 ${game.s.stats.ults} 次・催稿 ${G.fmt(game.s.stats.taps)} 次・最遠 ${E.stageName(game.s.maxStage).code}</div>`);
    }
    updatePanel();
  }
  function questProg(q) {
    const s = game.s;
    switch (q.type) {
      case 'kills': return [s.stats.kills, q.n];
      case 'lv': return [s.heroes[q.hero], q.n];
      case 'ults': return [s.stats.ults, q.n];
      case 'taps': return [s.stats.taps, q.n];
      case 'office': return [Object.values(s.office).reduce((a, b) => a + b, 0), q.n];
      case 'stage': return [Math.min(s.maxStage, q.n), q.n];
      case 'rank': return [D.ORDER.filter(id => game.rank(s.heroes[id]) >= 1).length, q.n];
      case 'rank2': return [D.ORDER.filter(id => game.rank(s.heroes[id]) >= 2).length, q.n];
      case 'lvsum': return [D.ORDER.reduce((a, id) => a + s.heroes[id], 0), q.n];
    }
    return [0, 1];
  }
  function questReady() { return D.QUESTS.some(q => { const [c, n] = questProg(q); return c >= n && !game.s.quests[q.id]; }); }

  function updatePanel() {
    const p = $('#panel'), s = game.s;
    if (tab === 'staff') {
      const tip = $('#staffTip');
      if (tip) {
        const next = D.ORDER.find(id => s.heroes[id] > 0 && game.heroCost(id) <= s.gold);
        tip.textContent = s.maxStage < 3 ? '💡 打怪賺薪水，薪水夠就幫大家升級！按住按鈕可以連續升級。'
          : s.farming ? '💡 頭目太強了？升級員工或辦公室後，再按「再次挑戰頭目」。'
          : `💡 Lv ${D.CURVE.rankAt[1]}、${D.CURVE.rankAt[2]}、${D.CURVE.rankAt[3]} 會升職，能力大幅提升；第二次升職會換新造型！`;
      }
      D.ORDER.forEach(id => {
        const row = p.querySelector(`.row[data-id="${id}"]`); if (!row) return;
        const h = D.HEROES.find(x => x.id === id), lv = s.heroes[id];
        row.classList.toggle('lock', lv === 0);
        const pic = row.querySelector('.pic'), st = faceStyle(id, 200);
        if (pic.dataset.st !== st) { pic.dataset.st = st; pic.setAttribute('style', st); }
        row.querySelector('.lv').textContent = lv ? 'Lv ' + lv : '未加入';
        const r = lv ? game.rank(lv) : 0;
        row.querySelector('.rk').textContent = h.ranks[r];
        const nextRank = D.CURVE.rankAt.find(a => a > lv);
        row.querySelector('.st').innerHTML = lv ? `攻擊 <b>${G.fmt(game.heroAtk(id))}</b>・血量 <b>${G.fmt(game.heroHp(id))}</b>${nextRank ? `<br>Lv ${nextRank} 升職：${h.ranks[r + 1]}` : '<br>已到最高職位'}` : `通過 ${E.stageName(h.joinAt - 1).code} 後加入`;
        const b = row.querySelector('.buy');
        if (lv) { const n = heroBuyCount(id), c = game.heroCost(id, n); b.innerHTML = `升級${n > 1 ? ' ×' + n : ''}<small>💰${G.fmt(c)}</small>`; b.disabled = c > s.gold; }
        else { b.innerHTML = '🔒'; b.disabled = true; }
      });
      const tr = p.querySelector('.row[data-id="tap"]');
      if (tr) { const c = D.CURVE.tapCost(s.tapLv); tr.querySelector('.st').innerHTML = `Lv ${s.tapLv}・每次點擊傷害 <b>${G.fmt(game.tapDmg())}</b>`; const b = tr.querySelector('.buy'); b.innerHTML = `升級<small>💰${G.fmt(c)}</small>`; b.disabled = c > s.gold; }
    } else if (tab === 'office') {
      D.OFFICE.forEach(o => {
        const row = p.querySelector(`.row[data-id="${o.id}"]`); if (!row) return;
        const lv = game.office(o.id), locked = E.chapterOf(s.maxStage) < o.unlock, max = lv >= o.max;
        row.classList.toggle('lock', locked);
        row.querySelector('.lvT').textContent = locked ? '' : `Lv ${lv}/${o.max}`;
        row.querySelector('.st').innerHTML = locked ? `${D.CHAPTERS[o.unlock].day}解鎖` : `${o.desc}・目前 <b>+${Math.round(lv * o.per * 100)}%</b>`;
        const b = row.querySelector('.buy'), c = game.officeCost(o);
        if (locked) { b.innerHTML = '🔒'; b.disabled = true; } else if (max) { b.innerHTML = '已滿級'; b.disabled = true; }
        else { b.innerHTML = `升級<small>💰${G.fmt(c)}</small>`; b.disabled = c > s.gold; }
      });
    } else if (tab === 'quest') {
      D.QUESTS.forEach(q => {
        const row = p.querySelector(`.row[data-id="${q.id}"]`); if (!row) return;
        const [c, n] = questProg(q), done = !!s.quests[q.id];
        row.classList.toggle('done', done);
        row.querySelector('.st').textContent = `${G.fmt(Math.min(c, n))} / ${G.fmt(n)}・獎勵 💰${G.fmt(q.gold)}`;
        row.querySelector('.prog i').style.width = Math.min(100, c / n * 100) + '%';
        const b = row.querySelector('.buy'); b.textContent = done ? '已領' : '領取'; b.disabled = done || c < n;
      });
    }
    $('#questDot').hidden = !questReady();
  }

  // ---------- 事件處理 ----------
  function handle(e) {
    rnd.onEvent(e);
    const A = G.Audio;
    switch (e.type) {
      case 'hit': if (e.crit) A.play('crit'); else if (e.src !== 'tap') A.play('hit'); break;
      case 'kill': A.play(e.e.boss ? 'clear' : 'kill'); setTimeout(() => A.play('coin'), 350); break;
      case 'hurt': A.play('hurt'); break;
      case 'ult': A.play('ult'); break;
      case 'levelup':
        if (e.rankUp) { const h = D.HEROES.find(x => x.id === e.id); A.play('levelup'); toast(`🎉 ${h.name} 升職為「${h.ranks[e.rankUp]}」！${e.rankUp === 2 ? '換上新造型！' : ''}`); buildPanelSoon(); }
        break;
      case 'stage': {
        const ch = E.chapterOf(e.s);
        if (e.s < 50 && e.s % 10 === 0 && !game.s.farming) story('intro' + ch);
        break;
      }
      case 'wave': if (e.boss) { A.play('boss'); const s = game.s.stage; if (s < 50) story('boss_' + D.CHAPTERS[E.chapterOf(s)].boss); } break;
      case 'clear': if (e.boss && e.s < 50) story('win_' + D.CHAPTERS[E.chapterOf(e.s)].boss, e.s === 49 ? ending : null); break;
      case 'fail': A.play('fail'); break;
      case 'loot': toast(`🏆 取得戰利品「${e.loot.name}」：${e.loot.desc}`); break;
      case 'join': A.play('join'); if (e.id === 'jie') story('join_jie'); buildPanelSoon(); break;
      case 'goldrain': rnd.nums.push({ x: 240, y: 70, v: e.gold, t: 0, crit: true, gold: true }); A.play('coin'); break;
    }
  }
  let rebuildT = 0; function buildPanelSoon() { rebuildT = 0.05; }

  function ending() {
    const s = game.s;
    modal(`<h2>🎉 週五 18:00 準時下班！</h2><p>小葵、小米、阿傑和 Vivi 老闆打倒了「下班前的新需求」。這一週辛苦了！</p>
      <div class="stat"><div>上班時間<b>${Math.round(s.stats.play / 60)} 分</b></div><div>打倒工作怪<b>${G.fmt(s.stats.kills)}</b></div><div>大招<b>${s.stats.ults} 次</b></div><div>催稿<b>${G.fmt(s.stats.taps)} 次</b></div></div>
      <p>接下來是「加班模式」，關卡無限延伸，想玩多久就玩多久。</p>`, [['繼續加班', true]]);
  }
  function modal(html, btns) {
    paused = true;
    const m = $('#modal'), box = m.querySelector('.box');
    box.innerHTML = html + `<div class="btns">${btns.map(([t, pri], i) => `<button data-i="${i}" class="${pri ? 'pri' : ''}">${t}</button>`).join('')}</div>`;
    m.hidden = false;
    box.querySelectorAll('.btns button').forEach(b => b.onclick = () => { m.hidden = true; paused = storyQ.length > 0; const f = btns[+b.dataset.i][2]; f && f(); });
  }
  function settings() {
    modal(`<h2>設定</h2><p>進度會自動存在這台裝置的瀏覽器裡。</p>`, [
      [G.Audio.muted ? '🔊 開啟聲音' : '🔇 關閉聲音', false, () => G.Audio.setMute(!G.Audio.muted)],
      ['重新開始', false, () => modal('<h2>確定要重新開始？</h2><p>所有進度都會清除，無法復原。</p>', [['取消', true], ['清除進度', false, () => { resetting = true; localStorage.removeItem(KEY); location.reload(); }]])],
      ['關閉', true]
    ]);
  }

  // ---------- 主迴圈 ----------
  let last = 0, saveT = 0, uiT = 0;
  // 幀率低時切成小步，遊戲仍照實際時間推進
  function step(dt) {
    for (let left = dt; left > 1e-4 && !paused; left -= 0.05) {
      game.update(Math.min(0.05, left));
      for (const e of game.events) handle(e);
      game.events.length = 0;
    }
  }
  G.__step = sec => { for (let i = 0; i < sec / 0.5; i++) step(0.5); };
  function frame(ts) {
    const dt = Math.min(0.5, (ts - last) / 1000 || 0.016); last = ts;
    step(dt);
    rnd.draw(paused ? 0 : Math.min(dt, 0.1));
    uiT -= dt; if (uiT <= 0) { uiT = 0.12; updateTop(); updateTeam(); updatePanel(); }
    if (rebuildT > 0) { rebuildT -= dt; if (rebuildT <= 0) buildPanel(); }
    saveT -= dt; if (saveT <= 0) { saveT = 3; save(); }
    requestAnimationFrame(frame);
  }

  async function boot() {
    const saved = loadSave();
    game = G.__game = new E.Game(saved);
    game.events.length = 0;
    rnd = new G.Render.Renderer($('#cv'), game);
    buildTeam(); buildPanel();
    $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.tab; $('#tabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); buildPanel(); });
    $('#cv').addEventListener('pointerdown', e => {
      G.Audio.unlock(); if (paused) return;
      const [x, y] = rnd.toWorld(e.clientX, e.clientY);
      const t = game.tap(); rnd.tapFx(x, y); if (t) G.Audio.play('tap');
    });
    $('#story').addEventListener('pointerdown', () => { G.Audio.play('tap'); nextLine(); });
    $('#btnBoss').onclick = () => { game.challengeBoss(); };
    $('#autoUlt').onchange = e => { game.s.autoUlt = e.target.checked; };
    $('#btnSet').onclick = settings;
    G.__reset = () => { resetting = true; localStorage.removeItem(KEY); location.reload(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    addEventListener('pagehide', save);
    paused = true;
    let ready = false, want = false;
    const start = () => {
      $('#title').hidden = true; paused = false;
      game.startStage(); game.events.length = 0;
      if (game.s.stage === 0) story('intro0');
    };
    if (saved && saved.stats.play > 5) $('#btnStart').textContent = '繼續上班';
    $('#btnStart').onclick = () => {
      G.Audio.unlock();
      if (ready) start(); else { want = true; $('#btnStart').textContent = '載入中…'; }
    };
    await G.Render.load(G.Render.assets());
    ready = true;
    requestAnimationFrame(frame);
    if (want) start();
  }
  boot();
})(window);
