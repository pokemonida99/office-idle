// 介面、主迴圈、存檔、劇情
// 效能原則：DOM 只在值變了才寫（setText/setHTML/cls… 都有快取），不在迴圈裡讀版面（getBoundingClientRect/offsetWidth）
(function (G) {
  const D = G.DATA, E = G.Engine;
  const $ = s => document.querySelector(s);
  const KEY = 'office-idle-v1';
  G.VERSION = 'v1.1.1';   // 改版時一起改 index.html 的 #verTxt 與 ?v=
  const HERO = {}; D.HEROES.forEach(h => { HERO[h.id] = h; });
  const AUTOBUY_AT = D.AUTOBUY_AT || 5;

  // ---------- 數字格式 ----------
  const UNITS = ['', 'K', 'M', 'B', 'T'];
  G.fmt = n => {
    n = Math.floor(n);
    if (n < 1000) return String(n);
    let i = 0, v = n; while (v >= 1000 && i < 60) { v /= 1000; i++; }
    const u = i < UNITS.length ? UNITS[i] : String.fromCharCode(97 + Math.floor((i - 5) / 26)) + String.fromCharCode(97 + (i - 5) % 26);
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v)) + u;
  };

  // ---------- 有快取的 DOM 寫入 ----------
  function setText(el, v) { if (el._t !== v) { el._t = v; el.textContent = v; } }
  function setHTML(el, v) { if (el._h !== v) { el._h = v; el.innerHTML = v; } }
  function cls(el, c, on) { on = !!on; const k = '_c' + c; if (el[k] !== on) { el[k] = on; el.classList.toggle(c, on); } }
  function hide(el, h) { h = !!h; if (el._hd !== h) { el._hd = h; el.hidden = h; } }
  function dis(el, d) { d = !!d; if (el._ds !== d) { el._ds = d; el.disabled = d; } }
  function css(el, k, v) { const kk = '_s' + k; if (el[kk] !== v) { el[kk] = v; el.style.setProperty(k, v); } }
  function attr(el, k, v) { const kk = '_a' + k; if (el[kk] !== v) { el[kk] = v; el.setAttribute(k, v); } }
  const bar = (el, f) => css(el, 'transform', `scaleX(${Math.max(0, Math.min(1, f)).toFixed(3)})`);

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
  const seen = k => !!game.s.seen[k];
  const mark = k => { game.s.seen[k] = 1; };

  // ---------- 劇情 ----------
  function story(key, after) {
    if (!D.STORY[key] || game.s.seen[key]) { after && after(); return; }
    game.s.seen[key] = 1;
    storyQ.push({ key, lines: D.STORY[key].slice(), after });
    if (storyQ.length === 1) nextLine();
  }
  function nextLine() {
    const cur = storyQ[0];
    if (!cur) { $('#story').hidden = true; paused = !$('#modal').hidden; return; }
    paused = true;
    const line = cur.lines.shift();
    if (!line) { storyQ.shift(); cur.after && cur.after(); return nextLine(); }
    const [who, text] = line, dlg = $('#story .dlg');
    $('#story').hidden = false;
    const hero = HERO[who];
    dlg.classList.toggle('sys', who === 'sys');
    dlg.classList.toggle('hasFace', !!hero);
    const face = $('#story .face');
    if (hero) { const pro = game.rank(game.s.heroes[who] || 0) >= 2; face.style.backgroundImage = `url(art/char/${pro ? 'pro_' : ''}${who}.webp)`; face.hidden = false; } else face.hidden = true;
    $('#story .name').textContent = hero ? hero.name : '';
    $('#story .name').hidden = !hero;
    const tx = $('#story .text'); tx.textContent = text;
    tx.animate && tx.animate([{ opacity: 0.4, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 160, easing: 'ease-out' });
  }
  function skipStory() {
    const cur = storyQ[0]; if (!cur) return;
    cur.lines.length = 0; nextLine();
  }

  // ---------- toast（同時最多 2 則，相同內容不重複）----------
  function toast(t, kind) {
    const box = $('#toasts');
    for (const el of box.children) if (el._msg === t) return;
    while (box.children.length >= 2) box.firstChild.remove();
    const el = document.createElement('div'); el.className = 'toast' + (kind ? ' ' + kind : ''); el.textContent = t; el._msg = t;
    box.appendChild(el); setTimeout(() => el.remove(), 2800);
  }

  // ---------- 慶祝橫幅（升職、戰利品、打倒頭目；排隊播，不擋操作）----------
  const cbQ = []; let cbT = 0;
  function celebrate(icon, title, sub, face) {
    if (cbQ.length >= 3) cbQ.shift();
    cbQ.push({ icon, title, sub, face });
  }
  function showCelebrate() {
    const c = cbQ.shift(), el = $('#celebrate');
    if (!c) return;
    const ic = el.querySelector('.ic');
    if (c.face) { ic.textContent = ''; ic.setAttribute('style', faceStyle(c.face, 200)); ic.classList.add('face'); }
    else { ic.removeAttribute('style'); ic.classList.remove('face'); ic.textContent = c.icon; }
    el.querySelector('b').textContent = c.title;
    el.querySelector('small').textContent = c.sub || '';
    el.hidden = false;
    const cb = el.querySelector('.cb');
    cb.classList.remove('go'); requestAnimationFrame(() => cb.classList.add('go'));
    confetti(el);
    cbT = 2.1;
    G.Audio.play('fanfare');
  }
  function confetti(host) {
    host.querySelectorAll('.cf').forEach(x => x.remove());
    const cols = ['#ffd23f', '#ff5d8f', '#4fc3f7', '#7ee081', '#ff8a3d'];
    for (let i = 0; i < 16; i++) {
      const p = document.createElement('i'); p.className = 'cf';
      p.style.cssText = `left:${10 + Math.random() * 80}%;background:${cols[i % 5]};--dx:${(Math.random() - 0.5) * 120}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 0.25}s;animation-duration:${1.2 + Math.random() * 0.6}s`;
      host.appendChild(p);
    }
  }

  // ---------- 頂部與隊伍 ----------
  const top = {};
  let goldShown = 0, bumpT = 0;
  function updateGold(dt) {
    const g = game.s.gold;
    if (g < goldShown) goldShown = g;                       // 花錢：立刻扣
    else if (g > goldShown) {
      const before = goldShown;
      goldShown += (g - goldShown) * Math.min(1, dt * 9) + 0.5;
      if (goldShown > g) goldShown = g;
      if (bumpT <= 0 && Math.floor(goldShown) > Math.floor(before) && top.goldBox.animate) {
        bumpT = 0.4;
        top.goldBox.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
      }
    }
    bumpT -= dt;
    setText(top.gold, G.fmt(goldShown));
  }
  function updateTop() {
    const s = game.s, n = E.stageName(s.stage), boss = E.isBoss(s.stage);
    setText(top.day, n.day); setText(top.code, n.code); setText(top.name, (s.farming ? '練功中・' : '') + n.title);
    css(top.day, '--d', String(Math.min(4, E.chapterOf(s.stage))));
    const wk = boss ? 'boss' : game.waveCount + ':' + game.wave;
    if (top.waves._k !== wk) {
      top.waves._k = wk;
      top.waves.innerHTML = boss ? '<i class="boss">BOSS</i>' : Array.from({ length: game.waveCount }, (_, i) => `<i class="${i < game.wave ? 'done' : i === game.wave ? 'cur' : ''}"></i>`).join('');
    }
    hide(top.btnBoss, !s.farming);
    hide(top.dps, s.farming);
    hide(top.autoWrap, s.maxStage < 10);
    hide(top.autoBuyWrap, s.maxStage < AUTOBUY_AT);
    if (top.autoUlt.checked !== !!s.autoUlt) top.autoUlt.checked = !!s.autoUlt;
    if (top.autoBuy.checked !== !!s.autoBuy) top.autoBuy.checked = !!s.autoBuy;
    if (!s.farming) setText(top.dps, '團隊輸出 ' + G.fmt(game.teamDps()) + '/秒');
    const cn = game.cheerN ? game.cheerN() : 0;
    hide(top.cheer, !cn); if (cn) setText(top.cheer, '📣×' + (+game.cheerMul().toFixed(1)));
    // 解鎖自動升級
    if (s.maxStage >= AUTOBUY_AT && !seen('tut_autobuy')) { mark('tut_autobuy'); celebrate('🤖', '解鎖「自動升級」', '打開後薪水會自動花在最划算的地方'); }
    // 新手提示泡泡
    let ht = '';
    if (paused) ht = '';
    else if (game.bonuses && game.bonuses.length && !seen('tut_bonus')) ht = '🛵 外送來了！快點它拿獎勵';
    else if (s.stats.taps < 8 && s.stats.play < 90 && game.phase === 'fight') ht = '👆 點怪物「催稿」一起打！';
    else if (game.heroes.some(h => game.canUlt(h)) && s.stats.ults < 2 && !s.autoUlt) ht = '⚡ 頭像亮了！點頭像放大招';
    hide(top.hint, !ht); if (ht) setText(top.hint, ht);
    // 外送增益倒數（每秒才變一次字）
    if (game.buffs) for (const k of ['gold', 'aspd', 'atk']) {
      const b = game.buffs[k], el = top.buff[k], on = b && b.t > 0;
      hide(el, !on); if (on) setText(el, BUFF_IC[k] + Math.ceil(b.t));
    }
  }
  const BUFF_IC = { gold: '🍱', aspd: '☕', atk: '🧋' };
  const team = {};
  function buildTeam() {
    $('#team').innerHTML = D.ORDER.map(id => {
      const h = HERO[id];
      return `<div class="hc" data-id="${id}" style="--c:${h.color}"><div class="ring"><div class="face"></div></div><span class="lv"></span><div class="nm">${h.name}</div><div class="hp"><i></i></div></div>`;
    }).join('');
    $('#team').querySelectorAll('.hc').forEach(el => {
      const id = el.dataset.id;
      team[id] = { el, ring: el.querySelector('.ring'), face: el.querySelector('.face'), hp: el.querySelector('.hp i'), lv: el.querySelector('.lv') };
      el.addEventListener('pointerdown', () => {
        G.Audio.unlock();
        if (game.ult(id)) return;
        if (game.s.heroes[id] === 0) toast(`${HERO[id].name}：通過 ${E.stageName(HERO[id].joinAt - 1).code} 後加入`);
        else { const h = game.heroes.find(x => x.id === id); if (h && !h.dead && h.energy < 100) toast(`${HERO[id].name}的大招還在充能（${Math.floor(h.energy)}%）`); }
      });
    });
  }
  function updateTeam() {
    const s = game.s;
    const firstReady = s.stats.ults < 1 && !s.autoUlt && !paused ? D.ORDER.find(id => game.canUlt(game.heroes.find(x => x.id === id))) : null;
    D.ORDER.forEach(id => {
      const t = team[id], h = game.heroes.find(x => x.id === id), lv = s.heroes[id];
      const ready = game.canUlt(h);
      cls(t.el, 'locked', lv === 0);
      cls(t.el, 'dead', h.on && h.dead);
      cls(t.el, 'ready', ready);
      cls(t.el, 'point', id === firstReady);
      css(t.ring, '--e', String(lv ? Math.floor(h.energy) : 0));
      bar(t.hp, lv ? h.hp / h.max : 0);
      setText(t.lv, lv ? 'Lv' + lv : '🔒');
      const st = faceStyle(id); if (t.face._st !== st) { t.face._st = st; t.face.setAttribute('style', st); }
    });
  }

  // ---------- 最划算的升級（一鍵升級用；engine 有 buyBest 就用 engine 的）----------
  function power() {
    const g = game, s = g.s;
    let hp = 0; D.ORDER.forEach(id => { if (s.heroes[id] > 0) hp += g.heroHp(id); });
    return Math.log(g.teamDps() + g.tapDmg() * 0.5 + 1) + 0.45 * Math.log(hp + 1) + 0.35 * Math.log(g.goldMul());
  }
  function bestBuy() {
    const g = game, s = g.s, base = power(); let best = null;
    const consider = (kind, id, cost, apply, undo) => {
      if (cost > s.gold) return;
      apply(); const v = (power() - base) / cost; undo();
      if (!best || v > best.v) best = { kind, id, v, cost };
    };
    D.ORDER.forEach(id => { if (s.heroes[id] > 0) consider('hero', id, g.heroCost(id), () => s.heroes[id]++, () => s.heroes[id]--); });
    D.OFFICE.forEach(o => {
      if (g.office(o.id) >= o.max || E.chapterOf(s.maxStage) < o.unlock) return;
      const lv = g.office(o.id);
      consider('office', o.id, g.officeCost(o), () => { s.office[o.id] = lv + 1; }, () => { if (lv) s.office[o.id] = lv; else delete s.office[o.id]; });
    });
    consider('tap', 'tap', D.CURVE.tapCost(s.tapLv), () => s.tapLv++, () => s.tapLv--);
    return best;
  }
  function buyBestOnce() {
    if (typeof game.buyBest === 'function') return game.buyBest({ tapW: 3 });
    const b = bestBuy(); if (!b) return null;
    const ok = b.kind === 'hero' ? game.buyHero(b.id, 1) : b.kind === 'office' ? game.buyOffice(b.id) : game.buyTap();
    return ok ? b : null;
  }
  function anyAffordable() {
    const s = game.s;
    return D.ORDER.some(id => s.heroes[id] > 0 && game.heroCost(id) <= s.gold) || officeAffordable() || D.CURVE.tapCost(s.tapLv) <= s.gold;
  }
  function officeAffordable() {
    const s = game.s, ch = E.chapterOf(s.maxStage);
    return D.OFFICE.some(o => ch >= o.unlock && game.office(o.id) < o.max && game.officeCost(o) <= s.gold);
  }
  function oneClick() {
    G.Audio.unlock();
    const cnt = {}; let n = 0;
    for (; n < 600; n++) {
      const b = buyBestOnce(); if (!b) break;
      const name = b.kind === 'hero' ? HERO[b.id].name : b.kind === 'office' ? D.OFFICE.find(o => o.id === b.id).name : '催稿力';
      cnt[name] = (cnt[name] || 0) + 1;
    }
    if (!n) { toast('薪水不夠，先打幾隻怪賺錢吧！'); return 0; }
    mark('tut_buy');
    G.Audio.play('buy');
    const ent = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
    toast('⚡ 一鍵升級：' + ent.slice(0, 3).map(([k, v]) => `${k} +${v}`).join('、') + (ent.length > 3 ? ' 等' : ''), 'good');
    updatePanel(); updateTeam();
    return n;
  }

  // ---------- 面板 ----------
  function holdButton(btn, fn) {
    let t1, t2;
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    btn.addEventListener('pointerdown', e => { G.Audio.unlock(); stop(); if (!fn()) return; t1 = setTimeout(() => { t2 = setInterval(() => { if (!fn()) stop(); }, 90); }, 380); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(k => btn.addEventListener(k, stop));
  }
  function heroBuyCount(id) {
    if (buyN === 'max') return Math.max(1, game.maxAffordable(n => game.heroCost(id, n))[0]);
    return buyN;
  }
  let rows = [];   // 目前分頁的列：{ id, kind, el, ... 參考 }
  function rowRefs(el) { return { el, st: el.querySelector('.st'), b: el.querySelector('.buy'), lv: el.querySelector('.lv'), rk: el.querySelector('.rk'), pic: el.querySelector('.pic'), prog: el.querySelector('.prog i'), lvT: el.querySelector('.lvT') }; }
  let builtTab = '';
  function buildPanel() {
    const p = $('#panel'), keep = builtTab === tab ? p.scrollTop : 0;
    p.innerHTML = ''; rows = []; builtTab = tab;
    if (tab === 'staff') {
      p.insertAdjacentHTML('beforeend', `<div class="tip" id="staffTip"></div><div class="tools"><div class="seg">${[1, 10, 'max'].map(n => `<button data-n="${n}" class="${buyN == n ? 'on' : ''}">${n === 'max' ? '最多' : '×' + n}</button>`).join('')}</div><button class="oneclick" id="btnOne">⚡ 一鍵升級</button></div>`);
      p.querySelectorAll('.seg button').forEach(b => b.onclick = () => { buyN = b.dataset.n === 'max' ? 'max' : +b.dataset.n; p.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b)); updatePanel(); });
      $('#btnOne').onclick = oneClick;
      D.ORDER.forEach(id => {
        const h = HERO[id];
        const el = document.createElement('div'); el.className = 'row'; el.dataset.id = id;
        el.innerHTML = `<div class="pic"><span class="lv"></span></div><div class="info"><div class="t">${h.name}<small class="rk"></small></div><div class="d st"></div><div class="prog rank"><i></i></div><div class="skill">⚡ ${h.skill.name}：${h.skill.desc}<br>✦ ${h.passive}</div></div><button class="buy"></button>`;
        p.appendChild(el);
        rows.push(Object.assign(rowRefs(el), { kind: 'hero', id }));
        holdButton(el.querySelector('.buy'), () => { const n = heroBuyCount(id); const ok = game.buyHero(id, n); if (ok) { G.Audio.play('buy'); mark('tut_buy'); } updatePanel(); return ok; });
      });
      const el = document.createElement('div'); el.className = 'row'; el.dataset.id = 'tap';
      el.innerHTML = `<div class="emoji">👆</div><div class="info"><div class="t">催稿力<small>就是你</small></div><div class="d st"></div></div><button class="buy"></button>`;
      p.appendChild(el);
      rows.push(Object.assign(rowRefs(el), { kind: 'tap', id: 'tap' }));
      holdButton(el.querySelector('.buy'), () => { const ok = game.buyTap(); if (ok) G.Audio.play('buy'); updatePanel(); return ok; });
    } else if (tab === 'office') {
      p.insertAdjacentHTML('beforeend', `<div class="tip">辦公室升級是全隊永久加成，越後面的日子解鎖越多設備。</div>`);
      D.OFFICE.forEach(o => {
        const el = document.createElement('div'); el.className = 'row'; el.dataset.id = o.id;
        el.innerHTML = `<div class="emoji">${o.icon}</div><div class="info"><div class="t">${o.name}<small class="lvT"></small></div><div class="d st"></div><div class="prog"><i></i></div></div><button class="buy"></button>`;
        p.appendChild(el);
        rows.push(Object.assign(rowRefs(el), { kind: 'office', id: o.id, o }));
        holdButton(el.querySelector('.buy'), () => { const ok = game.buyOffice(o.id); if (ok) { G.Audio.play('buy'); mark('tut_buy'); } updatePanel(); return ok; });
      });
    } else if (tab === 'quest') {
      p.insertAdjacentHTML('beforeend', `<div class="tip">任務沒有時間限制，達成就能領薪水。</div>`);
      D.QUESTS.forEach(q => {
        const el = document.createElement('div'); el.className = 'row'; el.dataset.id = q.id;
        el.innerHTML = `<div class="emoji">📋</div><div class="info"><div class="t">${q.text}</div><div class="d st"></div><div class="prog"><i></i></div></div><button class="buy claim"></button>`;
        p.appendChild(el);
        rows.push(Object.assign(rowRefs(el), { kind: 'quest', id: q.id, q }));
        el.querySelector('.buy').onclick = () => {
          if (game.claimQuest) { game.claimQuest(q.id); updatePanel(); return; }
          const [c, n] = questProg(q);
          if (c >= n && !game.s.quests[q.id]) { game.s.quests[q.id] = 1; game.s.gold += q.gold; G.Audio.play('coin'); toast(`📋 任務完成！薪水 +${G.fmt(q.gold)}`, 'good'); updatePanel(); }
        };
      });
    } else if (tab === 'loot') {
      p.insertAdjacentHTML('beforeend', `<div class="secT">頭目戰利品（永久加成）</div><div class="lootGrid">${D.LOOT.map(l => `<div class="loot ${game.s.loot.includes(l.id) ? '' : 'no'}"><div class="ic">${l.icon}</div><b>${game.s.loot.includes(l.id) ? l.name : '？？？'}</b>${game.s.loot.includes(l.id) ? l.desc : '打倒 ' + D.ENEMIES[l.boss].name + ' 取得'}</div>`).join('')}</div>`);
      p.insertAdjacentHTML('beforeend', `<div class="secT">員工名冊</div>` + D.HEROES.map(h => {
        const lv = game.s.heroes[h.id], r = lv ? game.rank(lv) : 0;
        return `<div class="card"><img src="art/char/${lv && r >= 2 ? 'pro_' : ''}${h.id}.webp" alt="${h.name}" style="${lv ? '' : 'filter:brightness(0) opacity(.35)'}"><div><b>${h.name}</b>　<small>${h.job}・${h.role}</small><div class="d">${lv ? `目前職位：<b>${h.ranks[r]}</b><br>升職路線：${h.ranks.join(' → ')}<br>口頭禪：「${h.lines[Math.floor(Math.random() * h.lines.length)]}」` : '尚未加入'}</div></div></div>`;
      }).join(''));
      p.insertAdjacentHTML('beforeend', `<div class="secT">上班紀錄</div><div class="tip">上班時間 ${Math.floor(game.s.stats.play / 60)} 分鐘・打倒 ${G.fmt(game.s.stats.kills)} 個工作怪・大招 ${game.s.stats.ults} 次・催稿 ${G.fmt(game.s.stats.taps)} 次・最遠 ${E.stageName(game.s.maxStage).code}</div>`);
    }
    p.scrollTop = keep;
    updatePanel();
  }
  function questProg(q) {
    if (game.questProg) return game.questProg(q);
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

  // 新手手指要指哪裡：'tab:staff' 或某一列的按鈕
  function tutTarget() {
    const s = game.s;
    if (s.autoBuy || paused) return null;
    if (!seen('tut_buy')) {
      const id = D.ORDER.find(x => s.heroes[x] > 0 && game.heroCost(x) <= s.gold);
      if (id) return tab === 'staff' ? 'hero:' + id : 'tab:staff';
    }
    if (s.farming && anyAffordable() && !seen('tut_one')) return tab === 'staff' ? 'one' : 'tab:staff';
    return null;
  }

  function updatePanel() {
    const s = game.s, tt = tutTarget();
    if (tab === 'staff') {
      const tip = $('#staffTip');
      if (tip) {
        setText(tip, s.farming ? '💡 頭目太強了！按「一鍵升級」把薪水花完，大家會自動再挑戰頭目。'
          : s.maxStage < 3 ? '💡 打怪賺薪水，薪水夠就幫大家升級！按住按鈕可以連續升級。'
          : s.maxStage >= AUTOBUY_AT && !s.autoBuy ? '💡 懶得選？打開上面的「自動升級」，薪水會自動花在最划算的地方。'
          : `💡 Lv ${D.CURVE.rankAt[1]}、${D.CURVE.rankAt[2]}、${D.CURVE.rankAt[3]} 會升職，能力大幅提升；第二次升職會換新造型！`);
        cls(tip, 'warn', s.farming);
      }
      const one = $('#btnOne');
      if (one) { const can = anyAffordable(); cls(one, 'can', can); cls(one, 'point', tt === 'one'); }
    }
    for (const r of rows) {
      if (r.kind === 'hero') {
        const id = r.id, h = HERO[id], lv = s.heroes[id];
        cls(r.el, 'lock', lv === 0);
        const st = faceStyle(id, 200); if (r.pic._st !== st) { r.pic._st = st; r.pic.setAttribute('style', st); }
        setText(r.lv, lv ? 'Lv ' + lv : '未加入');
        const rk = lv ? game.rank(lv) : 0;
        setText(r.rk, h.ranks[rk]);
        const nextRank = D.CURVE.rankAt.find(a => a > lv), prevRank = D.CURVE.rankAt[rk] || 1;
        setHTML(r.st, lv ? `攻擊 <b>${G.fmt(game.heroAtk(id))}</b>・血量 <b>${G.fmt(game.heroHp(id))}</b>${nextRank ? `<br>Lv ${nextRank} 升職：${h.ranks[rk + 1]}` : '<br>已到最高職位'}` : `通過 ${E.stageName(h.joinAt - 1).code} 後加入`);
        bar(r.prog, lv && nextRank ? (lv - prevRank) / (nextRank - prevRank) : lv ? 1 : 0);
        if (lv) {
          const n = heroBuyCount(id), c = game.heroCost(id, n), up = nextRank && lv + n >= nextRank;
          setHTML(r.b, `${up ? '<em>升職！</em>' : ''}升級${n > 1 ? ' ×' + n : ''}<small>💰${G.fmt(c)}</small>`);
          dis(r.b, c > s.gold); cls(r.b, 'can', c <= s.gold); cls(r.b, 'up', up);
        } else { setHTML(r.b, '🔒'); dis(r.b, true); cls(r.b, 'can', false); cls(r.b, 'up', false); }
        cls(r.b, 'point', tt === 'hero:' + id);
      } else if (r.kind === 'tap') {
        const c = D.CURVE.tapCost(s.tapLv);
        setHTML(r.st, `Lv ${s.tapLv}・每次點擊傷害 <b>${G.fmt(game.tapDmg())}</b>`);
        setHTML(r.b, `升級<small>💰${G.fmt(c)}</small>`); dis(r.b, c > s.gold); cls(r.b, 'can', c <= s.gold);
      } else if (r.kind === 'office') {
        const o = r.o, lv = game.office(o.id), locked = E.chapterOf(s.maxStage) < o.unlock, max = lv >= o.max;
        cls(r.el, 'lock', locked);
        const pk = game.perk ? game.perk(o.id) : 0, tot = game.officeBonus ? game.officeBonus(o.id) : lv * o.per;
        setText(r.lvT, locked ? '' : `Lv ${lv}/${o.max}${pk ? `（福利 +${pk}）` : ''}`);
        setHTML(r.st, locked ? `${D.CHAPTERS[o.unlock].day}解鎖` : `${o.desc}・目前 <b>+${Math.round(tot * 100)}%</b>`);
        bar(r.prog, lv / o.max);
        const c = game.officeCost(o);
        if (locked) { setHTML(r.b, '🔒'); dis(r.b, true); cls(r.b, 'can', false); }
        else if (max) { setHTML(r.b, '已滿級'); dis(r.b, true); cls(r.b, 'can', false); }
        else { setHTML(r.b, `升級<small>💰${G.fmt(c)}</small>`); dis(r.b, c > s.gold); cls(r.b, 'can', c <= s.gold); }
      } else if (r.kind === 'quest') {
        const q = r.q, [c, n] = questProg(q), done = !!s.quests[q.id];
        cls(r.el, 'done', done);
        setText(r.st, `${G.fmt(Math.min(c, n))} / ${G.fmt(n)}・獎勵 💰${G.fmt(q.gold)}`);
        bar(r.prog, c / n);
        setText(r.b, done ? '已領' : '領取'); dis(r.b, done || c < n); cls(r.b, 'can', !done && c >= n);
      }
    }
    // 分頁紅點
    const auto = !!s.autoBuy;
    hide(tabs.staffDot, auto || tab === 'staff' || !D.ORDER.some(id => s.heroes[id] > 0 && game.heroCost(id) <= s.gold));
    hide(tabs.officeDot, auto || tab === 'office' || !officeAffordable());
    hide(tabs.questDot, tab === 'quest' || !questReady());
    cls(tabs.staff, 'point', tt === 'tab:staff');
  }
  const tabs = {};

  // ---------- 打不過頭目 ----------
  function failSheet(e) {
    const s = game.s, boss = E.isBoss(e.s), key = 'fail_' + e.s, cnt = (s.seen[key] || 0) + 1;
    s.seen[key] = cnt;
    const name = boss ? D.ENEMIES[e.s < 50 ? D.CHAPTERS[E.chapterOf(e.s)].boss : 'b_vivi'].name : '這一關';
    if (cnt > 2) { const cn = game.cheerN ? game.cheerN() : 0; toast(`💪 回去練功！${cn ? '同事打氣 ×' + (+game.cheerMul().toFixed(1)) + '，' : ''}升級後會自動再挑戰`); return; }
    const close = boss && e.left != null && e.left < 0.25 ? `差一點點！頭目只剩 <b>${Math.max(1, Math.round(e.left * 100))}%</b> 血。` : '';
    const why = close + (e.reason === 'time' ? `${boss ? '頭目戰限時 ' + Math.round(D.CURVE.bossTime + game.lootSum('time')) + ' 秒，' : ''}時間到還沒打完。` : '大家都被打倒了。');
    const can = anyAffordable(), cn = game.cheerN ? game.cheerN() : 0;
    const cheerLi = cn ? `<li>📣 同事幫你打氣：全隊攻擊、血量 <b>×${(+game.cheerMul().toFixed(1))}</b></li>` : '';
    modal(`<div class="sheetIc">😵</div><h2>打不贏${boss ? '「' + name + '」' : '了'}…</h2><p>${why}</p>
      <ul class="howto">${cheerLi}<li>大家會<b>回到上一關自動練功</b>賺薪水，不會掉任何東西</li><li>${can ? '你現在的薪水<b>可以升級</b>，按下面「一鍵升級」就好' : '多打幾隻怪，薪水夠了就升級'}</li><li>${E.chapterOf(s.maxStage) >= 1 ? '辦公室的<b>咖啡機、椅子</b>是全隊加成' : '點畫面<b>催稿</b>、放<b>大招</b>可以打得更快'}</li><li>練功過兩關會<b>自動再挑戰</b>，也可以按「挑戰頭目」</li></ul>`,
      can ? [['⚡ 一鍵升級', true, () => { mark('tut_one'); oneClick(); }], ['知道了', false]] : [['知道了', true]]);
  }

  // ---------- 事件處理 ----------
  const BONUS = { bento: ['🍱', '便當'], coffee: ['☕', '咖啡'], boba: ['🧋', '珍奶'] };
  const BUFF = { atk: '全隊攻擊', aspd: '全隊攻速', gold: '薪水' };
  function handle(e) {
    rnd.onEvent(e);
    const A = G.Audio;
    switch (e.type) {
      case 'hit': if (e.crit) A.play('crit'); else if (e.src !== 'tap') A.play('hit'); break;
      case 'kill': A.play(e.e.boss ? 'clear' : 'kill'); setTimeout(() => A.play('coin'), 350); break;
      case 'hurt': A.play('hurt'); break;
      case 'down': A.play('down'); break;
      case 'ult': A.play('ult'); break;
      case 'levelup':
        mark('tut_buy');
        if (e.rankUp) {
          const h = HERO[e.id];
          A.play('levelup');
          celebrate('', `${h.name} 升職！`, `「${h.ranks[e.rankUp]}」${e.rankUp === 2 ? '・換上新造型！' : '・能力大幅提升'}`, e.id);
          buildPanelSoon();
        }
        break;
      case 'stage': {
        const ch = E.chapterOf(e.s);
        if (e.s < 50 && e.s % 10 === 0 && !game.s.farming) story('intro' + ch);
        break;
      }
      case 'wave': if (e.boss) { A.play('boss'); const s = game.s.stage; if (s < 50) story('boss_' + D.CHAPTERS[E.chapterOf(s)].boss); } break;
      case 'clear':
        if (e.boss) celebrate('🏆', '打倒頭目！', E.stageName(e.s).title);
        if (e.boss && e.s < 50) story('win_' + D.CHAPTERS[E.chapterOf(e.s)].boss, e.s === 49 ? ending : null);
        break;
      case 'fail': A.play('fail'); pendingFail = e; break;
      case 'cheer':
        if (e.why === 'calm') break;
        if (e.why === 'fail' && pendingFail) break;            // 失敗說明裡會寫
        toast(`📣 同事幫你打氣！全隊能力 ×${(+e.mul.toFixed(1))}`, 'good');
        break;
      case 'perk': {
        const o = D.OFFICE.find(x => x.id === e.id);
        if (o && (game.s.seen.tut_perk || 0) < 2) { game.s.seen.tut_perk = (game.s.seen.tut_perk || 0) + 1; toast(`🎁 公司福利：${o.icon} ${o.name}免費升一級！`, 'good'); }
        break;
      }
      case 'quest': A.play('coin'); toast(`📋 任務完成！薪水 +${G.fmt(e.gold)}`, 'good'); break;
      case 'shieldBreak': A.play(e.timeout ? 'hurt' : 'shield'); break;
      case 'loot': celebrate(e.loot.icon, `取得「${e.loot.name}」`, e.loot.desc); break;
      case 'join': A.play('join'); if (e.id === 'jie') story('join_jie'); buildPanelSoon(); break;
      case 'goldrain': rnd.nums.push({ x: 240, y: 70, v: e.gold, t: 0, crit: true, gold: true }); A.play('coin'); break;
      case 'bonusSpawn': A.play('whoosh'); break;
      case 'bonus': {
        mark('tut_bonus');
        A.play('bonus');
        const kind = e.b && e.b.kind, kd = D.BONUS && D.BONUS.kinds && D.BONUS.kinds[kind];
        const ic = (BONUS[kind] || ['🎁'])[0], nm = kd ? kd.name : (BONUS[kind] || [, '外送'])[1];
        const parts = [];
        if (e.gold) parts.push('薪水 +' + G.fmt(e.gold));
        if (e.buff) parts.push(`${kd && kd.text ? kd.text : (BUFF[e.buff.kind] || '能力') + ' ×' + e.buff.mul} ${Math.round(e.buff.dur)} 秒`);
        toast(`${ic} ${nm}到了！${parts.join('・')}`, 'bonus');
        if (navigator.vibrate) try { navigator.vibrate(15); } catch (er) {}
        break;
      }
      case 'bossCast': A.play('warn'); break;
      case 'bossHit': A.play('bossHit'); break;
    }
  }
  let pendingFail = null;
  let rebuildT = 0; function buildPanelSoon() { if (tab === 'loot') rebuildT = 0.05; }   // 其他分頁 updatePanel 會自己更新

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
    box.querySelectorAll('.btns button').forEach(b => b.onclick = () => { G.Audio.play('tap'); m.hidden = true; paused = storyQ.length > 0; const f = btns[+b.dataset.i][2]; f && f(); });
  }
  function settings() {
    const A = G.Audio;
    modal(`<h2>設定</h2><p>進度會自動存在這台裝置的瀏覽器裡。</p><p>目前版本：<b>${G.VERSION}</b></p>`, [
      [A.muted ? '🔊 開啟聲音' : '🔇 關閉聲音', false, () => A.setMute(!A.muted)],
      [A.music ? '🎵 關閉音樂' : '🎵 開啟音樂', false, () => A.setMusic(!A.music)],
      ['重新開始', false, () => modal('<h2>確定要重新開始？</h2><p>所有進度都會清除，無法復原。</p>', [['取消', true], ['清除進度', false, () => { resetting = true; localStorage.removeItem(KEY); location.reload(); }]])],
      ['關閉', true]
    ]);
  }

  // ---------- 主迴圈 ----------
  let last = 0, saveT = 0, topT = 0, panelT = 0;
  // 幀率低時切成小步，遊戲仍照實際時間推進
  function step(dt) {
    for (let left = dt; left > 1e-4 && !paused; left -= 0.05) {
      game.update(Math.min(0.05, left));
      for (const e of game.events) handle(e);
      game.events.length = 0;
      if (pendingFail) { const f = pendingFail; failSheet(f); pendingFail = null; }
    }
  }
  G.__step = sec => { for (let i = 0; i < sec / 0.5; i++) step(0.5); };
  let errN = 0;
  function frame(ts) {
    requestAnimationFrame(frame);           // 先排下一幀：這一幀就算出錯，遊戲也不會整個停住
    try { tick(ts); } catch (err) { if (errN++ < 5) console.error('frame error', err); }
  }
  function tick(ts) {
    const dt = Math.min(0.5, (ts - last) / 1000 || 0.016); last = ts;
    try { step(dt); } catch (err) { game.events.length = 0; if (errN++ < 5) console.error('step error', err); }
    try { rnd.draw(paused ? 0 : Math.min(dt, 0.1)); } catch (err) { if (errN++ < 5) console.error('draw error', err); try { rnd.ctx.setTransform(1, 0, 0, 1, 0, 0); rnd.ctx.globalAlpha = 1; } catch (e) {} }
    updateGold(dt);
    topT -= dt; if (topT <= 0) { topT = 0.1; updateTop(); updateTeam(); }
    panelT -= dt; if (panelT <= 0) { panelT = 0.25; updatePanel(); }
    if (cbT > 0) { cbT -= dt; if (cbT <= 0) $('#celebrate').hidden = true; }
    else if (cbQ.length && !paused) showCelebrate();      // 劇情、對話框期間先排隊
    if (rebuildT > 0) { rebuildT -= dt; if (rebuildT <= 0) buildPanel(); }
    saveT -= dt; if (saveT <= 0) { saveT = 3; save(); }
  }

  async function boot() {
    const saved = loadSave();
    game = G.__game = new E.Game(saved);
    game.events.length = 0;
    goldShown = game.s.gold;
    rnd = new G.Render.Renderer($('#cv'), game);
    Object.assign(top, { day: $('#stDay'), code: $('#stCode'), name: $('#stName'), waves: $('#waves'), gold: $('#gold'), goldBox: $('#goldBox'), btnBoss: $('#btnBoss'), dps: $('#dps'), autoWrap: $('#autoWrap'), autoBuyWrap: $('#autoBuyWrap'), autoUlt: $('#autoUlt'), autoBuy: $('#autoBuy'), hint: $('#hint'), cheer: $('#cheer'), buff: { gold: $('#bfGold'), aspd: $('#bfAspd'), atk: $('#bfAtk') } });
    Object.assign(tabs, { staffDot: $('#staffDot'), officeDot: $('#officeDot'), questDot: $('#questDot'), staff: $('#tabs [data-tab="staff"]') });
    buildTeam(); buildPanel();
    $('#tabs').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.dataset.tab === tab) return;
      G.Audio.play('tab');
      tab = b.dataset.tab; $('#tabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); buildPanel();
    });
    $('#cv').addEventListener('pointerdown', e => {
      G.Audio.unlock(); if (paused) return;
      const [x, y] = rnd.toWorld(e.clientX, e.clientY);
      const r = game.tap(x, y);
      rnd.tapFx(x, y);
      if (r && r.kind === 'bonus') {}                       // bonus 事件會播音效
      else if (r) G.Audio.play('tap', game.combo || 0);
    });
    $('#story').addEventListener('pointerdown', () => { G.Audio.play('tap'); nextLine(); });
    $('#btnSkip').addEventListener('pointerdown', e => { e.stopPropagation(); G.Audio.play('tap'); skipStory(); });
    $('#btnBoss').onclick = () => { G.Audio.unlock(); game.challengeBoss(); };
    $('#autoUlt').onchange = e => { game.s.autoUlt = e.target.checked; };
    $('#autoBuy').onchange = e => { game.s.autoBuy = e.target.checked; G.Audio.play('tab'); if (e.target.checked) toast('🤖 自動升級開啟：薪水會自動花在最划算的地方'); updatePanel(); };
    $('#btnSet').onclick = settings;
    $('#cheer').onclick = () => toast(`📣 同事打氣中：攻擊、血量 ×${(+game.cheerMul().toFixed(1))}，順利過幾關後會慢慢退掉`);
    G.__reset = () => { resetting = true; localStorage.removeItem(KEY); location.reload(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    addEventListener('pagehide', save);
    paused = true;
    let ready = false, want = false;
    const btn = $('#btnStart'), label = saved && saved.stats.play > 5 ? '繼續上班' : '開始上班';
    btn.textContent = label;
    const start = () => {
      $('#title').hidden = true; paused = false;
      game.startStage(); game.events.length = 0;
      if (game.s.stage === 0) story('intro0');
    };
    btn.onclick = () => {
      G.Audio.unlock(); G.Audio.play('tab');
      if (ready) start(); else { want = true; btn.classList.add('wait'); }
    };
    // 載入進度：一張一張交給 Render.load，算完成比例
    const list = G.Render.assets(); let done = 0;
    const lb = $('#loadBar'), setP = () => { const f = list.length ? done / list.length : 1; lb.style.transform = `scaleX(${f})`; if (want) btn.textContent = `載入中 ${Math.round(f * 100)}%`; };
    setP();
    await Promise.all(list.map(it => G.Render.load([it]).then(() => { done++; setP(); })));
    ready = true;
    $('#load').classList.add('ok');
    btn.textContent = label; btn.classList.remove('wait');
    requestAnimationFrame(frame);
    if (want) start();
  }
  boot();
})(window);
