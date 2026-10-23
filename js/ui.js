// 介面、主迴圈、存檔、劇情
// 效能原則：DOM 只在值變了才寫（setText/setHTML/cls… 都有快取），不在迴圈裡讀版面（getBoundingClientRect/offsetWidth）
(function (G) {
  const D = G.DATA, E = G.Engine;
  const $ = s => document.querySelector(s);
  const KEY = 'office-idle-v1';
  G.VERSION = 'v1.3.4';   // 改版時一起改 index.html 的 #verTxt 與 ?v=
  const HERO = {}; D.HEROES.forEach(h => { HERO[h.id] = h; });   // 原本四人（劇情、升職造型用）
  const AUTOBUY_AT = D.AUTOBUY_AT || 5;

  // ---------- v1.3 同事（100 位）：名冊、稀有度、部門；B 的欄位還沒有時用預設值 ----------
  const HRAR0 = [{ name: '普通', key: 'N', color: '#9aa4b2' }, { name: '稀有', key: 'R', color: '#3d9bff' }, { name: '史詩', key: 'SR', color: '#b26bff' }, { name: '傳說', key: 'SSR', color: '#ffb020' }, { name: '神話', key: 'UR', color: '#ff4fd8' }];
  const HR = HRAR0.map((r, i) => Object.assign({}, r, D.HRAR && D.HRAR[i]));
  const DEPT_KEYS = ['design', 'cs', 'eng', 'sales', 'admin'];
  const DEPT0 = { design: { name: '設計部', color: '#e0954a' }, cs: { name: '客服部', color: '#6d8fd6' }, eng: { name: '工程部', color: '#3fae8f' }, sales: { name: '業務部', color: '#ec5f9e' }, admin: { name: '行政部', color: '#8d7a63' } };
  const DEPT = {}; DEPT_KEYS.forEach(k => { DEPT[k] = Object.assign({}, DEPT0[k], D.DEPTS && D.DEPTS[k]); });
  const LEGACY_DEPT = { mi: 'cs', jie: 'design', kui: 'design', vivi: 'admin' };
  const ROLE0 = { tank: '坦克', dps: '單體輸出', aoe: '範圍輸出', crit: '爆擊', support: '輔助', healer: '治療' };
  let ALL = [], AH = {};
  function refreshAll() { ALL = (D.ALLHEROES || D.HEROES.concat(G.ROSTER || [])).slice(); AH = {}; ALL.forEach(h => { AH[h.id] = h; }); }
  refreshAll();
  // 同一人的不同版本（主題版 def.base＝本尊 id）不能同時上場
  const baseOf = id => game.baseOf ? game.baseOf(id) : (AH[id] && AH[id].base) || id;
  const sameBase = (a, b) => game.sameBase ? game.sameBase(a, b) : baseOf(a) === baseOf(b);
  const themeTag = h => h.theme ? `<span class="rtagI thm">✦ ${h.theme}</span>` : '';
  const hdef = id => AH[id] || (game && game.heroDef && game.heroDef(id)) || HERO[id] || { id, name: id };
  const rarOf = h => h.rar != null ? h.rar : HERO[h.id] ? 1 : 0;
  const deptOf = h => DEPT[h.dept] ? h.dept : LEGACY_DEPT[h.id] || 'admin';
  const roleName = h => (D.ROLES && D.ROLES[h.role] && D.ROLES[h.role].name) || ROLE0[h.role] || h.role || '';
  const skillOf = h => typeof h.skill === 'string' ? { name: h.skill, desc: '' } : h.skill || { name: '', desc: '' };
  const lineOf = h => h.line || (h.lines && h.lines[0]) || '';
  const owned = id => (game.s.heroes[id] || 0) >= 1;
  const starOf = id => (game.s.stars && game.s.stars[id]) || (owned(id) ? 1 : 0);
  const teamIds = () => Array.isArray(game.s.team) ? game.s.team.filter(id => AH[id] || HERO[id]) : game.heroes.map(h => h.id).filter(owned);
  const teamSize = () => game.teamSize ? game.teamSize() : 4;
  const MAX_SLOTS = 5;
  // 圖片：沒圖時換成部門色剪影（img 用 data-fb，背景圖墊部門色）
  const svgURI = s => 'data:image/svg+xml,' + encodeURIComponent(s);
  const silFace = c => svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="27" r="13" fill="${c}"/><path d="M8 64c0-15 10-24 24-24s24 9 24 24z" fill="${c}"/></svg>`);
  const silBody = c => svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 150"><g fill="${c}" fill-opacity=".85" stroke="#fff" stroke-opacity=".7" stroke-width="2"><circle cx="40" cy="30" r="25"/><path d="M12 149V84c0-17 12-28 28-28s28 11 28 28v65z"/></g><text x="40" y="40" font-size="30" font-weight="900" text-anchor="middle" fill="#fff" fill-opacity=".9" font-family="sans-serif">?</text></svg>`);
  const RES_SVG = svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48"><rect x="3" y="2" width="34" height="44" rx="4" fill="#fff" stroke="#c9a77a" stroke-width="2"/><rect x="8" y="8" width="10" height="12" rx="2" fill="#ffb04d"/><path d="M22 10h10M22 16h8M8 27h24M8 33h24M8 39h16" stroke="#b39672" stroke-width="2.5" stroke-linecap="round"/></svg>');
  const FB = { res: RES_SVG };
  const faceURL = id => `art/hero/face/${id}.webp`;
  function bodyURL(id) {
    if (HERO[id]) return `art/char/${game.rank(game.s.heroes[id] || 0) >= 2 ? 'pro_' : ''}${id}.webp`;
    return `art/hero/${id}.webp`;
  }
  // 頭像 HTML：原本四人從站姿圖裁頭（有升職造型），其他用頭像圖
  function faceHTML(id, c = 'fc') {
    if (HERO[id]) return `<i class="${c} crop" style="${faceStyle(id, 200)}"></i>`;
    const col = DEPT[deptOf(hdef(id))].color;
    return `<img class="${c}" src="${faceURL(id)}" data-fb="${silFace(col)}" loading="lazy" decoding="async" alt="" draggable="false">`;
  }
  function bodyHTML(id, c = 'bd') {
    const col = DEPT[deptOf(hdef(id))].color;
    return `<img class="${c}" src="${bodyURL(id)}" data-fb="${HERO[id] ? '' : faceURL(id) + '|'}${silBody(col)}" decoding="async" alt="" draggable="false">`;
  }
  function fixBroken(root) {
    (root || document).querySelectorAll('img[data-fb]').forEach(im => { if (im.complete && !im.naturalWidth) nextFb(im); });
  }
  // data-fb 可以用 | 串好幾個備案，一個失敗換下一個
  function nextFb(t) {
    const L = t.dataset.fb.split('|'), i = t._fb || 0;
    if (i >= L.length) return;
    t._fb = i + 1; t.src = FB[L[i]] || L[i];
  }
  document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.dataset.fb) nextFb(t); }, true);
  // 全身圖沒好、退到頭像時：縮成卡片，不要放大成一團糊
  document.addEventListener('load', e => { const t = e.target; if (t && t.tagName === 'IMG' && t._fb && !t.src.startsWith('data:') && /\b(bd|cutImg)\b/.test(t.className) && t.naturalWidth && t.naturalWidth <= 200 && t.naturalHeight <= 200) t.classList.add('tiny'); }, true);
  // 解鎖：engine 有 unlocked(key) 就用；沒有就看 D.UNLOCKS 的 at
  const unlockOf = key => (D.UNLOCKS || []).find(u => u.key === key);
  function isUnlocked(key) {
    if (game.unlocked) return !!game.unlocked(key);
    if (key === 'recruit' && game.recruitOpen) return game.recruitOpen();
    if (game.s.unlocked && game.s.unlocked[key]) return true;
    const u = unlockOf(key); return u ? game.s.maxStage >= u.at : key === 'recruit' ? typeof game.recruit === 'function' : true;
  }
  const unlockAtText = u => u ? `通過 ${E.stageName(Math.max(0, u.at - 1)).code} 解鎖` : '之後解鎖';
  // 第 n 個隊伍格（n＝4、5）的解鎖條件
  function slotUnlock(n) {
    const L = (D.UNLOCKS || []).filter(u => /slot|team/i.test(u.key));
    return L.find(u => String(u.key).includes(String(n))) || L.sort((a, b) => a.at - b.at)[n - 4] || null;
  }
  // 這一章的怪怕哪些部門
  let weakNow = [], weakSet = new Set();
  function calcWeak() {
    let a = [];
    if (game.weakDepts) a = game.weakDepts() || [];
    else if (game.stageWeak) {
      const sw = game.stageWeak() || {}, w = sw.w || {};
      a = Object.keys(w).filter(k => w[k] > 0).sort((x, y) => w[y] - w[x]);
      if (sw.boss) a = [sw.boss].concat(a.filter(k => k !== sw.boss));
    } else {
      const s = game.s, ch = Math.min(D.CHAPTERS.length - 1, E.chapterOf(s.stage)), C = D.CHAPTERS[ch];
      const ks = E.isBoss(s.stage) ? [C.boss] : C.pool;
      ks.forEach(k => { const w = D.ENEMIES[k] && D.ENEMIES[k].weak; if (w && !a.includes(w)) a.push(w); });
    }
    if (a.join() !== weakNow.join()) { weakNow = a.slice(); weakSet = new Set(a); }
  }
  const weakText = () => weakNow.map(k => `<b style="color:${DEPT[k] ? DEPT[k].color : ''}">${DEPT[k] ? DEPT[k].name : k}</b>`).join('、');

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
    if (!FACE[id]) return `background-image:url(${faceURL(id)});background-size:cover;background-position:center;background-color:${DEPT[deptOf(hdef(id))].color}`;
    const g = game, pro = g && g.rank(g.s.heroes[id] || 0) >= 2;
    const [fx, fy] = FACE[id];
    return `background-image:url(art/char/${pro ? 'pro_' : ''}${id}.webp);background-size:${size}% auto;background-position:${fx}% ${fy}%`;
  }

  // ---------- 寶物 ----------
  const TRE = {}; D.TREASURES.forEach(t => { TRE[t.id] = t; });
  const itemImg = id => `art/item/${id}.webp`;
  function fxText(fx, mul = 1) {
    return Object.entries(fx).map(([k, v]) => {
      const [nm, u] = D.FX_TEXT[k] || [k, '%'];
      return u === '秒' ? `${nm} +${Math.round(v * mul)} 秒` : `${nm} +${Math.round(v * mul * 100)}%`;
    }).join('、');
  }
  const starMul = st => 1 + D.CHEST.starMul * (Math.max(1, st) - 1);
  const stars = (st, max = D.CHEST.maxStar) => '★'.repeat(st) + '<i>' + '★'.repeat(Math.max(0, max - st)) + '</i>';

  // ---------- 存檔 ----------
  function loadSave() {
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return null;
      const sv = JSON.parse(raw);                 // 不先 fixSave：engine 要靠原始存檔判斷「v1.2 舊存檔」補發履歷
      return sv && typeof sv === 'object' ? sv : null;
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
  function celebrate(icon, title, sub, face, img) {
    if (cbQ.length >= 3) cbQ.shift();
    cbQ.push({ icon, title, sub, face, img });
  }
  function showCelebrate() {
    const c = cbQ.shift(), el = $('#celebrate');
    if (!c) return;
    const ic = el.querySelector('.ic');
    ic.classList.remove('face', 'item');
    if (c.face) { ic.textContent = ''; ic.setAttribute('style', faceStyle(c.face, 200)); ic.classList.add('face'); }
    else if (c.img) { ic.textContent = ''; ic.setAttribute('style', `background-image:url(${c.img})`); ic.classList.add('item'); }
    else { ic.removeAttribute('style'); ic.textContent = c.icon; }
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
    const chN = game.chestCount();
    hide(top.btnChest, !chN); if (chN) { setText(top.chestN, String(chN)); cls(top.btnChest, 'gold', s.chests.gold > 0); }
    const cn = game.cheerN ? game.cheerN() : 0;
    hide(top.cheer, !cn); if (cn) setText(top.cheer, '📣×' + (+game.cheerMul().toFixed(1)));
    // 解鎖自動升級（D.UNLOCKS 有 autobuy 的話交給 unlock 事件）
    if (s.maxStage >= AUTOBUY_AT && !seen('tut_autobuy') && !unlockOf('autobuy')) { mark('tut_autobuy'); celebrate('🤖', '解鎖「自動升級」', '打開後薪水會自動花在最划算的地方'); }
    // 履歷與下一個目標
    const rcOn = isUnlocked('recruit');
    hide(top.resBox, !rcOn && !(s.resume > 0));
    setText(top.resume, G.fmt(s.resume || 0));
    calcWeak();
    goalT -= 0.1;
    if (goalT <= 0) {
      goalT = 0.5;
      const g = game.nextGoal ? game.nextGoal() : null;
      hide(top.goal, !g);
      if (g) {
        setText(top.goalTx, g.text + (g.need > 1 ? `（${G.fmt(Math.min(g.cur, g.need))}/${G.fmt(g.need)}）` : ''));
        bar(top.goalBar, g.need ? g.cur / g.need : 0);
      }
    }
    // 新手提示泡泡
    let ht = '';
    if (paused) ht = '';
    else if (rcOn && !seen('tut_recruit') && tab !== 'hero' && canRc(1)) ht = '📄 可以招募新同事了！點下方「同事」';
    else if (game.bonuses && game.bonuses.length && !seen('tut_bonus')) ht = '🛵 外送來了！快點它拿獎勵';
    else if (chN && !seen('tut_open')) ht = '🎁 拿到寶箱了！點下方「寶箱」打開';
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
  // 下方隊伍卡：只放上場的人（game.heroes），隊伍變了才重建
  let team = [], teamKey = '';
  function buildTeam() {
    const box = $('#team'), hs = game.heroes;
    teamKey = hs.map(h => h.id).join(',');
    box.style.gridTemplateColumns = `repeat(${hs.length || 1}, minmax(0, ${hs.length >= 5 ? 1000 : 88}px))`;
    box.classList.toggle('n5', hs.length >= 5);
    box.innerHTML = hs.map(h => {
      const d = hdef(h.id), col = d.color || DEPT[deptOf(d)].color;
      return `<div class="hc" data-id="${h.id}" style="--c:${col};--rc:${HR[rarOf(d)].color}"><div class="ring"><div class="face"></div></div><span class="lv"></span><span class="wk">剋</span><div class="nm">${d.name}</div><div class="hp"><i></i></div></div>`;
    }).join('');
    team = [...box.querySelectorAll('.hc')].map((el, i) => ({ el, h: hs[i], id: hs[i].id, dept: deptOf(hdef(hs[i].id)), ring: el.querySelector('.ring'), face: el.querySelector('.face'), hp: el.querySelector('.hp i'), lv: el.querySelector('.lv') }));
  }
  function tapTeam(id) {
    G.Audio.unlock();
    if (game.ult(id)) return;
    const d = hdef(id);
    if (!owned(id)) toast(`${d.name}：通過 ${E.stageName((d.joinAt || 1) - 1).code} 後加入`);
    else { const h = game.heroes.find(x => x.id === id); if (h && !h.dead && h.energy < 100) toast(`${d.name}的大招還在充能（${Math.floor(h.energy)}%）`); }
  }
  function updateTeam() {
    const s = game.s;
    if (game.heroes.map(h => h.id).join(',') !== teamKey || (team[0] && team[0].h !== game.heroes[0])) buildTeam();
    const firstReady = s.stats.ults < 1 && !s.autoUlt && !paused ? (game.heroes.find(h => game.canUlt(h)) || {}).id : null;
    for (const t of team) {
      const id = t.id, h = t.h, lv = s.heroes[id] || 0;
      cls(t.el, 'locked', lv === 0);
      cls(t.el, 'dead', h.on && h.dead);
      cls(t.el, 'ready', game.canUlt(h));
      cls(t.el, 'point', id === firstReady);
      cls(t.el, 'weak', weakSet.has(t.dept));
      css(t.ring, '--e', String(lv ? Math.floor(h.energy) : 0));
      bar(t.hp, lv ? h.hp / h.max : 0);
      setText(t.lv, lv ? 'Lv' + lv : '🔒');
      const st = faceStyle(id); if (t.face._st !== st) { t.face._st = st; t.face.setAttribute('style', st); }
    }
  }

  // ---------- 最划算的升級（一鍵升級用；engine 有 buyBest 就用 engine 的）----------
  function power() {
    const g = game, s = g.s;
    let hp = 0; teamIds().forEach(id => { if (s.heroes[id] > 0) hp += g.heroHp(id); });
    return Math.log(g.teamDps() + g.tapDmg() * 0.5 + 1) + 0.45 * Math.log(hp + 1) + 0.35 * Math.log(g.goldMul());
  }
  function bestBuy() {
    const g = game, s = g.s, base = power(); let best = null;
    const consider = (kind, id, cost, apply, undo) => {
      if (cost > s.gold) return;
      apply(); const v = (power() - base) / cost; undo();
      if (!best || v > best.v) best = { kind, id, v, cost };
    };
    teamIds().forEach(id => { if (s.heroes[id] > 0) consider('hero', id, g.heroCost(id), () => s.heroes[id]++, () => s.heroes[id]--); });
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
    return teamIds().some(id => s.heroes[id] > 0 && game.heroCost(id) <= s.gold) || officeAffordable() || D.CURVE.tapCost(s.tapLv) <= s.gold;
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
      const name = b.kind === 'hero' ? hdef(b.id).name : b.kind === 'office' ? D.OFFICE.find(o => o.id === b.id).name : '催稿力';
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
      const ids = teamIds(); builtKey = ids.join(',');
      ids.forEach(id => {
        const h = hdef(id), sk = skillOf(h), R0 = HR[rarOf(h)];
        const el = document.createElement('div'); el.className = 'row'; el.dataset.id = id;
        el.innerHTML = `<div class="pic" style="--rc:${R0.color}"><span class="lv"></span></div><div class="info"><div class="t">${h.name}<small class="rk"></small></div><div class="d st"></div>${h.ranks ? '<div class="prog rank"><i></i></div>' : ''}<div class="skill">⚡ ${sk.name}${sk.desc ? '：' + sk.desc : ''}${h.passive ? '<br>✦ ' + h.passive : ''}</div></div><button class="buy"></button>`;
        if (!HERO[id]) el.querySelector('.pic').innerHTML = faceHTML(id) + '<span class="lv"></span>';
        p.appendChild(el);
        rows.push(Object.assign(rowRefs(el), { kind: 'hero', id, def: h }));
        el.querySelector('.pic').onclick = () => heroInfo(id);
        holdButton(el.querySelector('.buy'), () => { const n = heroBuyCount(id); const ok = game.buyHero(id, n); if (ok) { G.Audio.play('buy'); mark('tut_buy'); } updatePanel(); return ok; });
      });
      p.insertAdjacentHTML('beforeend', `<button class="toHero" id="toHero">👥 這裡只列上場的同事・到「同事」換人 ›</button>`);
      $('#toHero').onclick = () => switchTab('hero');
      const el = document.createElement('div'); el.className = 'row'; el.dataset.id = 'tap';
      el.innerHTML = `<div class="emoji">👆</div><div class="info"><div class="t">催稿力<small>就是你</small></div><div class="d st"></div></div><button class="buy"></button>`;
      p.appendChild(el);
      rows.push(Object.assign(rowRefs(el), { kind: 'tap', id: 'tap' }));
      holdButton(el.querySelector('.buy'), () => { const ok = game.buyTap(); if (ok) G.Audio.play('buy'); updatePanel(); return ok; });
    } else if (tab === 'hero') {
      buildHeroTab(p);
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
      const T = game.s.treasures, own = game.treasureCount(), sets = game.setsDone();
      const chN = game.chestCount();
      p.insertAdjacentHTML('beforeend', `<div class="chestBar"><div class="cb1"><b>🎁 寶箱</b><span>木箱 ${game.s.chests.wood || 0}・金箱 ${game.s.chests.gold || 0}</span></div><button class="buy ${chN ? 'can' : ''}" id="tOpen" ${chN ? '' : 'disabled'}>${chN ? '打開寶箱' : '打怪會掉寶箱'}</button></div>`);
      const tot = game._ts || {}; game.tSum('atk');
      const sum = fxText(Object.fromEntries(Object.entries(game._ts || {}).filter(([, v]) => v > 0)));
      p.insertAdjacentHTML('beforeend', `<div class="tip">已收集 <b>${own} / ${D.TREASURES.length}</b> 種寶物・重複拿到會升星（最多 ★${D.CHEST.maxStar}）<br>${sum ? '目前加成：' + sum : '寶物是永久加成，越收越強！'}</div>`);
      p.insertAdjacentHTML('beforeend', `<div class="secT">套裝（三件湊齊再加成）</div><div class="sets">${D.SETS.map(set => {
        const n = set.items.filter(id => T[id]).length, done = n === set.items.length;
        return `<div class="set ${done ? 'done' : ''}"><div class="si">${set.items.map(id => `<i class="${T[id] ? '' : 'no'}" style="background-image:url(${itemImg(id)})"></i>`).join('')}</div><b>${set.name}</b><small>${done ? '✅ ' : n + '/3・'}${set.desc}</small></div>`;
      }).join('')}</div>`);
      [3, 2, 1, 0].forEach(rar => {
        const R0 = D.RARITY[rar], list = D.TREASURES.filter(t => t.rar === rar);
        p.insertAdjacentHTML('beforeend', `<div class="secT" style="color:${R0.color}">${R0.name}${rar === 3 ? '（打倒頭目取得）' : ''}</div><div class="tgrid">${list.map(t => {
          const st = T[t.id] || 0;
          return `<button class="titem r${rar} ${st ? '' : 'no'}" data-t="${t.id}"><i style="background-image:url(${itemImg(t.id)})"></i><span>${st ? t.name : '？？？'}</span><em>${st ? stars(st) : ''}</em></button>`;
        }).join('')}</div>`);
      });
      p.querySelectorAll('.titem').forEach(b => b.onclick = () => treasureInfo(b.dataset.t));
      const ob = $('#tOpen'); if (ob) ob.onclick = () => openChestUI();
      p.insertAdjacentHTML('beforeend', `<div class="secT">上班紀錄</div><div class="tip">上班時間 ${Math.floor(game.s.stats.play / 60)} 分鐘・打倒 ${G.fmt(game.s.stats.kills)} 個工作怪・大招 ${game.s.stats.ults} 次・催稿 ${G.fmt(game.s.stats.taps)} 次・開寶箱 ${game.s.stats.chests || 0} 個・最遠 ${E.stageName(game.s.maxStage).code}</div>`);
    }
    p.scrollTop = keep;
    updatePanel();
  }
  let builtKey = '';
  function switchTab(t) {
    if (t === tab) return;
    G.Audio.play('tab');
    tab = t; $('#tabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.tab === t)); buildPanel();
  }

  // ---------- 同事分頁：招募、編隊、圖鑑 ----------
  const HV = {};                                   // 目前同事分頁的 DOM 參考
  const hf = { dept: 'all', rar: -1, own: false };  // 圖鑑篩選
  function heroTabKey() { return [teamIds().join(','), teamSize(), ALL.filter(h => owned(h.id)).length, isUnlocked('recruit'), weakNow.join()].join('|'); }
  function pityRows() {
    if (game.pityInfo) return game.pityInfo() || [];
    const p = game.s.pity, R = D.RECRUIT || {};
    if (p == null) return [];
    if (typeof p === 'number') return [{ name: 'SSR', cur: p, need: R.pitySSR || 30 }];
    return [{ name: 'SSR', cur: p.ssr || 0, need: R.pitySSR || 30 }, { name: 'UR', cur: p.ur || 0, need: R.pityUR || 90 }];
  }
  const rcCost = n => game.recruitCost ? game.recruitCost(n) : n;
  const canRc = n => isUnlocked('recruit') && (game.canRecruit ? game.canRecruit(n) : (game.s.resume || 0) >= rcCost(n));
  function buildHeroTab(p) {
    const s = game.s, rcOn = isUnlocked('recruit');
    builtKey = heroTabKey();
    // 招募
    if (rcOn) {
      p.insertAdjacentHTML('beforeend', `<div class="rcBar"><div class="rc1"><b><img class="resIc" src="art/ui/resume.webp" data-fb="res" alt="">履歷 <span id="hvRes"></span></b><small id="hvPity"></small></div>
        <div class="rcBtns"><button class="rcb" id="hvRc1"></button><button class="rcb ten" id="hvRc10"></button></div></div>`);
      $('#hvRc1').onclick = () => runRecruit(1);
      $('#hvRc10').onclick = () => runRecruit(10);
    } else {
      const u = unlockOf('recruit');
      p.insertAdjacentHTML('beforeend', `<div class="rcBar lock"><div class="rc1"><b>🔒 招募新同事</b><small>${unlockAtText(u)}・打怪會撿到履歷</small></div><div class="rcLockIc">📨</div></div>`);
    }
    // 編隊
    const ids = teamIds(), size = teamSize();
    p.insertAdjacentHTML('beforeend', `<div class="secT flex"><span>上場隊伍 <small>${ids.length}/${size}</small></span><button class="miniBtn" id="hvAuto">🤖 自動編隊</button></div>
      ${deptBonusHTML()}
      ${weakNow.length ? `<div class="weakTip">這章的怪怕：${weakText()}<small>對應部門的同事打它傷害 +50%</small></div>` : ''}
      <div class="slots">${Array.from({ length: MAX_SLOTS }, (_, i) => {
        if (i >= size) { const u = slotUnlock(i + 1); return `<button class="slot lock" data-slot="${i}"><span>🔒</span><small>${u ? unlockAtText(u).replace('解鎖', '') + '<br>解鎖' : '之後解鎖'}</small></button>`; }
        const id = ids[i];
        if (!id) return `<button class="slot empty" data-slot="${i}"><span>＋</span><small>點我選人</small></button>`;
        const d = hdef(id);
        return `<button class="slot r${rarOf(d)} ${weakSet.has(deptOf(d)) ? 'wk' : ''}" data-slot="${i}" style="--rc:${HR[rarOf(d)].color}">${faceHTML(id)}<b>${d.name}</b><small>Lv ${s.heroes[id] || 0}</small></button>`;
      }).join('')}</div>`);
    $('#hvAuto').onclick = autoTeam;
    // 圖鑑
    const own = ALL.filter(h => owned(h.id)).length;
    p.insertAdjacentHTML('beforeend', `<div class="secT flex"><span>同事圖鑑 <b class="cnt">${own} / ${ALL.length}</b></span><label class="ownT"><input type="checkbox" id="hvOwn" ${hf.own ? 'checked' : ''}>只看已有</label></div>
      <div class="depts">${['all'].concat(DEPT_KEYS).map(k => {
        const L = k === 'all' ? ALL : ALL.filter(h => deptOf(h) === k), n = L.filter(h => owned(h.id)).length, d = DEPT[k];
        return `<button class="dchip ${hf.dept === k ? 'on' : ''}" data-dept="${k}" style="--dc:${d ? d.color : '#7b5cff'}"><b>${d ? d.name : '全部'}</b><small>${n}/${L.length}</small><i style="transform:scaleX(${L.length ? (n / L.length).toFixed(3) : 0})"></i></button>`;
      }).join('')}</div>
      <div class="seg rseg">${[-1, 0, 1, 2, 3, 4].map(r => `<button data-rar="${r}" class="${hf.rar === r ? 'on' : ''}" style="${r >= 0 ? '--rc:' + HR[r].color : ''}">${r < 0 ? '全部' : HR[r].key}</button>`).join('')}</div>
      <div class="hgrid" id="hvGrid"></div>`);
    p.querySelectorAll('.dchip').forEach(b => b.onclick = () => { hf.dept = b.dataset.dept; p.querySelectorAll('.dchip').forEach(x => x.classList.toggle('on', x === b)); G.Audio.play('tab'); fillGrid(); });
    p.querySelectorAll('.rseg button').forEach(b => b.onclick = () => { hf.rar = +b.dataset.rar; p.querySelectorAll('.rseg button').forEach(x => x.classList.toggle('on', x === b)); G.Audio.play('tab'); fillGrid(); });
    $('#hvOwn').onchange = e => { hf.own = e.target.checked; G.Audio.play('tab'); fillGrid(); };
    p.querySelectorAll('.slot').forEach(b => b.onclick = () => pickSlot(+b.dataset.slot));
    Object.assign(HV, { res: $('#hvRes'), pity: $('#hvPity'), rc1: $('#hvRc1'), rc10: $('#hvRc10'), grid: $('#hvGrid') });
    fillGrid();
  }
  function deptBonusHTML() {
    const db = game.deptBonus ? game.deptBonus() : null;
    if (db && db.dept && DEPT[db.dept]) return `<div class="dbTip">🤝 ${DEPT[db.dept].name} ${db.n} 人同隊：全隊攻擊 <b>+${Math.round(db.add * 100)}%</b></div>`;
    if (isUnlocked('dept') && D.DEPT_BONUS) return `<div class="dbTip off">🤝 同部門 3 人以上上場，全隊攻擊加成</div>`;
    return '';
  }
  function fillGrid() {
    const g = HV.grid; if (!g) return;
    const inTeam = new Set(teamIds());
    const L = ALL.filter(h => (hf.dept === 'all' || deptOf(h) === hf.dept) && (hf.rar < 0 || rarOf(h) === hf.rar) && (!hf.own || owned(h.id)))
      .sort((a, b) => rarOf(b) - rarOf(a) || DEPT_KEYS.indexOf(deptOf(a)) - DEPT_KEYS.indexOf(deptOf(b)));
    g.innerHTML = L.length ? L.map(h => {
      const id = h.id, o = owned(id), r = rarOf(h), st = starOf(id);
      return `<button class="hcell r${r} ${o ? '' : 'no'} ${inTeam.has(id) ? 'on' : ''}" data-h="${id}" style="--rc:${HR[r].color};--dc:${DEPT[deptOf(h)].color}"><span class="fw">${faceHTML(id)}<em class="rk">${HR[r].key}</em>${h.theme ? '<em class="th">✦</em>' : ''}${inTeam.has(id) ? '<u>上場</u>' : o && weakSet.has(deptOf(h)) ? '<u class="w">剋</u>' : ''}</span><b>${h.name}</b><small>${o ? '★'.repeat(st) : '？？？'}</small></button>`;
    }).join('') : '<p class="empty">這個條件還沒有同事</p>';
    g.querySelectorAll('.hcell').forEach(b => b.onclick = () => heroInfo(b.dataset.h));
    fixBroken(g);
  }
  function updateHeroTab() {
    if (!HV.res || !HV.res.isConnected) return;
    const s = game.s;
    setText(HV.res, G.fmt(s.resume || 0));
    setText(HV.pity, pityRows().map(r => `${r.name} 保底 ${Math.min(r.cur, r.need)}/${r.need}`).join('・'));
    [[HV.rc1, 1, '單抽'], [HV.rc10, 10, '十連']].forEach(([b, n, t]) => {
      const c = rcCost(n), ok = canRc(n);
      setHTML(b, `${t}<small>${c > 0 ? '📄 ' + c : '免費！'}</small>${n === 10 ? '<em>SR 以上保證</em>' : ''}`);
      cls(b, 'can', ok); cls(b, 'point', ok && !seen('tut_recruit') && (n === 10 || !canRc(10)));
    });
  }

  // ---------- 編隊 ----------
  function flushEvents() { for (const e of game.events) handle(e); game.events.length = 0; }
  function applyTeam(ids) {
    if (typeof game.setTeam !== 'function') { toast('編隊功能還在準備中'); return false; }
    game.setTeam(ids); flushEvents();
    G.Audio.play('join');
    afterTeam();
    return true;
  }
  function afterTeam() { if (G.Render.ensureHero) teamIds().forEach(id => G.Render.ensureHero(id)); updateTeam(); if (tab === 'hero' || tab === 'staff') buildPanel(); }
  function autoTeam() {
    G.Audio.unlock();
    if (typeof game.autoTeam !== 'function') { toast('自動編隊還在準備中'); return; }
    const before = teamIds().join(',');
    game.autoTeam(); flushEvents();
    const now = teamIds().join(',');
    G.Audio.play(now !== before ? 'join' : 'tab');
    toast(now !== before ? '🤖 自動編隊完成：照戰力和這章的弱點排好了' : '🤖 目前就是最好的隊伍了', 'good');
    afterTeam();
  }
  function closeModal() { $('#modal').hidden = true; paused = storyQ.length > 0; }
  // 點隊伍格：從已擁有的同事裡選
  function pickSlot(i) {
    G.Audio.unlock();
    const size = teamSize();
    if (i >= size) { const u = slotUnlock(i + 1); toast(`🔒 第 ${i + 1} 個隊伍格：${u ? unlockAtText(u) : '之後解鎖'}`); return; }
    const ids = teamIds(), cur = ids[i];
    const L = ALL.filter(h => owned(h.id)).sort((a, b) => (weakSet.has(deptOf(b)) - weakSet.has(deptOf(a))) || rarOf(b) - rarOf(a) || (game.s.heroes[b.id] || 0) - (game.s.heroes[a.id] || 0));
    const btns = [['取消', false]];
    if (cur && ids.length > 1) btns.unshift(['讓 ' + hdef(cur).name + ' 下場', false, () => applyTeam(ids.filter(x => x !== cur))]);
    modal(`<h2>${cur ? '換掉「' + hdef(cur).name + '」' : '選一位上場'}</h2>${weakNow.length ? `<p class="small">這章的怪怕：${weakText()}（標「剋」的打它 +50%）</p>` : ''}
      <div class="pkgrid">${L.map(h => {
        const id = h.id, r = rarOf(h), j = ids.indexOf(id);
        const alt = j < 0 && ids.find(x => x !== cur && sameBase(x, id));
        return `<button class="pk r${r} ${j >= 0 ? 'on' : ''}" data-h="${id}" style="--rc:${HR[r].color}"><span class="fw">${faceHTML(id)}${weakSet.has(deptOf(h)) ? '<u class="w">剋</u>' : ''}${j >= 0 ? '<u>上場</u>' : alt ? '<u class="alt">換版本</u>' : ''}</span><b>${h.name}</b><small>${HR[r].key}・Lv ${game.s.heroes[id] || 0}</small></button>`;
      }).join('')}</div>`, btns);
    const box = $('#modal .box');
    fixBroken(box);
    box.querySelectorAll('.pk').forEach(b => b.onclick = () => {
      const id = b.dataset.h, n = ids.slice(), j = n.indexOf(id);
      closeModal();
      if (id === cur) return;
      if (i < n.length) { if (j >= 0) n[j] = cur; n[i] = id; }
      else { if (j >= 0) n.splice(j, 1); n.push(id); }
      const k = n.findIndex(x => x !== id && sameBase(x, id));   // 本尊／其他版本已在隊上：讓它下場
      if (k >= 0) { toast(`同一個人只能上場一位，「${hdef(n[k]).name}」先下場`); n.splice(k, 1); }
      applyTeam(n);
    });
  }
  function teamAdd(id) {
    const ids = teamIds();
    if (ids.includes(id)) return;
    const alt = ids.find(x => sameBase(x, id));
    if (alt) { toast(`「${hdef(alt).name}」換成「${hdef(id).name}」`); applyTeam(ids.map(x => x === alt ? id : x)); return; }
    if (ids.length < teamSize()) { applyTeam(ids.concat(id)); return; }
    modal(`<h2>隊伍滿了，換下誰？</h2><p class="small">讓「${hdef(id).name}」上場</p><div class="pkgrid">${ids.map(x => {
      const h = hdef(x), r = rarOf(h);
      return `<button class="pk r${r}" data-h="${x}" style="--rc:${HR[r].color}"><span class="fw">${faceHTML(x)}</span><b>${h.name}</b><small>Lv ${game.s.heroes[x] || 0}</small></button>`;
    }).join('')}</div>`, [['取消', false]]);
    const box = $('#modal .box'); fixBroken(box);
    box.querySelectorAll('.pk').forEach(b => b.onclick = () => { closeModal(); applyTeam(ids.map(x => x === b.dataset.h ? id : x)); });
  }
  function teamRemove(id) {
    const ids = teamIds();
    if (ids.length <= 1) { toast('至少要留一位同事上場'); return; }
    applyTeam(ids.filter(x => x !== id));
  }
  // 同事詳細
  function heroInfo(id) {
    G.Audio.play('tab');
    const h = hdef(id), o = owned(id), r = rarOf(h), R0 = HR[r], dk = deptOf(h), dp = DEPT[dk], sk = skillOf(h), st = starOf(id);
    const inTeam = teamIds().includes(id), lv = game.s.heroes[id] || 0;
    let ab = '';
    if (o) {
      try { ab = `Lv ${lv}・攻擊 <b>${G.fmt(game.heroAtk(id))}</b>・血量 <b>${G.fmt(game.heroHp(id))}</b>`; } catch (er) { ab = 'Lv ' + lv; }
    }
    const roleDesc = (D.ROLES && D.ROLES[h.role] && D.ROLES[h.role].desc) || '';
    modal(`<div class="hinfo r${r} ${o ? '' : 'no'}" style="--rc:${R0.color};--dc:${dp.color}"><div class="hrays"></div>${bodyHTML(id)}${weakSet.has(dk) && o ? '<u class="w">剋</u>' : ''}</div>
      <h2>${h.name}</h2><p class="tstar">${o ? stars(st, 5) : ''}</p>
      <p class="tags"><span class="rtagI" style="background:${R0.color}">${R0.key} ${R0.name}</span><span class="rtagI" style="background:${dp.color}">${dp.name}</span><span class="jtag">${h.job || ''}${h.role ? '・' + roleName(h) : ''}</span>${themeTag(h)}</p>
      ${o ? `<div class="hsk"><b>⚡ ${sk.name}</b>${sk.desc ? '<br>' + sk.desc : ''}${h.passive ? '<br>✦ ' + h.passive : ''}${roleDesc ? `<br><small>${roleName(h)}：${roleDesc}</small>` : ''}</div>
        <p class="lore">「${lineOf(h)}」</p><p class="small">${ab}${st < 5 ? '<br>再抽到一次會升星，能力提升' : '<br>已滿星！'}</p>`
        : `<div class="hsk">大招與口頭禪：招募後揭曉</div><p class="small">${h.joinAt && HERO[id] ? `通過 ${E.stageName(h.joinAt - 1).code} 後加入` : '用履歷招募有機會遇到'}</p>`}`,
      o ? (inTeam ? [['下場', false, () => teamRemove(id)], ['關閉', true]] : [['⬆ 上場', true, () => teamAdd(id)], ['關閉', false]]) : [['關閉', true]]);
    fixBroken($('#modal .box'));
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
    if (paused) return null;
    if (!seen('tut_recruit') && tab !== 'hero' && canRc(1)) return 'tab:hero';
    if (s.autoBuy) return null;
    if (!seen('tut_buy')) {
      const id = teamIds().find(x => s.heroes[x] > 0 && game.heroCost(x) <= s.gold);
      if (id) return tab === 'staff' ? 'hero:' + id : 'tab:staff';
    }
    if (s.farming && anyAffordable() && !seen('tut_one')) return tab === 'staff' ? 'one' : 'tab:staff';
    return null;
  }

  function updatePanel() {
    const s = game.s, tt = tutTarget();
    if (tab === 'staff' && teamIds().join(',') !== builtKey) { buildPanel(); return; }
    if (tab === 'hero') { if (heroTabKey() !== builtKey) { buildPanel(); return; } updateHeroTab(); }
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
        const id = r.id, h = r.def, lv = s.heroes[id] || 0, rks = h.ranks;
        cls(r.el, 'lock', lv === 0);
        if (HERO[id]) { const st = faceStyle(id, 200); if (r.pic._st !== st) { r.pic._st = st; r.pic.setAttribute('style', st + ';--rc:' + HR[rarOf(h)].color); } }
        setText(r.lv, lv ? 'Lv ' + lv : '未加入');
        const rk = lv ? game.rank(lv) : 0;
        setText(r.rk, rks ? rks[rk] : HR[rarOf(h)].key + '・' + roleName(h) + (starOf(id) ? '・' + '★'.repeat(starOf(id)) : ''));
        const nextRank = rks ? D.CURVE.rankAt.find(a => a > lv) : null, prevRank = D.CURVE.rankAt[rk] || 1;
        let stx = `攻擊 <b>${G.fmt(game.heroAtk(id))}</b>・血量 <b>${G.fmt(game.heroHp(id))}</b>`;
        if (rks) stx += nextRank ? `<br>Lv ${nextRank} 升職：${rks[rk + 1]}` : '<br>已到最高職位';
        setHTML(r.st, lv ? stx : h.joinAt ? `通過 ${E.stageName(h.joinAt - 1).code} 後加入` : '還沒招募到');
        if (r.prog) bar(r.prog, lv && nextRank ? (lv - prevRank) / (nextRank - prevRank) : lv ? 1 : 0);
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
        setText(r.st, `${G.fmt(Math.min(c, n))} / ${G.fmt(n)}・獎勵 ${[q.gold ? '💰' + G.fmt(q.gold) : '', q.resume ? '📄 履歷 ×' + q.resume : ''].filter(Boolean).join(' ')}`);
        bar(r.prog, c / n);
        setText(r.b, done ? '已領' : '領取'); dis(r.b, done || c < n); cls(r.b, 'can', !done && c >= n);
      }
    }
    // 分頁紅點
    const auto = !!s.autoBuy;
    hide(tabs.staffDot, auto || tab === 'staff' || !teamIds().some(id => s.heroes[id] > 0 && game.heroCost(id) <= s.gold));
    hide(tabs.heroDot, tab === 'hero' || !canRc(seen('tut_recruit') ? 10 : 1));
    hide(tabs.officeDot, auto || tab === 'office' || !officeAffordable());
    hide(tabs.questDot, tab === 'quest' || !questReady());
    hide(tabs.lootDot, tab === 'loot' || !game.chestCount());
    cls(tabs.staff, 'point', tt === 'tab:staff');
    cls(tabs.hero, 'point', tt === 'tab:hero');
  }
  const tabs = {};

  // ---------- 寶物詳情 ----------
  function treasureInfo(id) {
    const t = TRE[id], st = game.s.treasures[id] || 0, R0 = D.RARITY[t.rar];
    if (!st) { toast(t.rar === 3 ? `🔒 打倒「${D.ENEMIES[t.boss].name}」取得` : '🔒 還沒拿到，打怪掉的寶箱有機會開到'); return; }
    const set = D.SETS.find(x => x.items.includes(id));
    modal(`<div class="tinfo r${t.rar}"><i style="background-image:url(${itemImg(id)})"></i></div><h2>${t.name}</h2><p class="tstar">${stars(st)}</p>
      <p><span class="rtagI" style="background:${R0.color}">${R0.name}</span></p><p><b>${fxText(t.fx, starMul(st))}</b></p>
      ${st < D.CHEST.maxStar ? `<p class="small">下一星：${fxText(t.fx, starMul(st + 1))}</p>` : '<p class="small">已滿星！再拿到會換成薪水</p>'}
      <p class="lore">「${t.lore}」</p>${set ? `<p class="small">套裝「${set.name}」：${set.desc}</p>` : ''}`, [['關閉', true]]);
  }

  // ---------- 開寶箱 ----------
  const CU = {};
  let cuBusy = false;
  function openChestUI() {
    G.Audio.unlock();
    if (!game.chestCount()) { toast('目前沒有寶箱，打怪會掉喔！'); return; }
    mark('tut_open');
    paused = true;
    CU.el.hidden = false; CU.list.hidden = true; CU.reveal.hidden = true; CU.stage.hidden = false;
    nextChest();
  }
  function nextChest() {
    const c = game.s.chests, kind = c.gold > 0 ? 'gold' : 'wood';
    CU.kind = kind;
    CU.chest.style.backgroundImage = `url(art/item/chest_${kind}.webp)`;
    CU.chest.className = 'chestImg idle ' + kind;
    CU.reveal.hidden = true; CU.stage.className = 'cstage';
    setText(CU.info, `${D.CHEST.kinds[kind].name}・剩 ${game.chestCount()} 個寶箱`);
    CU.open.textContent = '打開'; CU.open.disabled = false;
    CU.all.hidden = game.chestCount() < 2;
  }
  function revealOne() {
    if (cuBusy) return;
    if (!CU.reveal.hidden) { if (game.chestCount()) nextChest(); else closeChestUI(); return; }
    cuBusy = true;
    CU.chest.className = 'chestImg shake ' + CU.kind;
    G.Audio.play('whoosh');
    setTimeout(() => {
      const r = game.openChest(CU.kind);
      for (const e of game.events) handle(e); game.events.length = 0;
      cuBusy = false;
      if (!r) { closeChestUI(); return; }
      showReveal(r);
    }, 650);
  }
  function showReveal(r) {
    const t = r.t, R0 = D.RARITY[t.rar];
    CU.chest.className = 'chestImg open ' + CU.kind;
    CU.stage.className = 'cstage r' + t.rar;
    CU.reveal.hidden = false;
    CU.rimg.style.backgroundImage = `url(${itemImg(t.id)})`;
    CU.rtag.textContent = r.maxed ? '已滿星' : r.isNew ? 'NEW！' : '升星！';
    CU.rtag.style.background = r.maxed ? '#8a7461' : r.isNew ? '#ff3d6e' : R0.color;
    CU.rname.textContent = `${R0.name}・${t.name}`; CU.rname.style.color = R0.color;
    CU.rstar.innerHTML = stars(r.star);
    CU.rfx.textContent = r.maxed ? `換成薪水 +${G.fmt(r.gold)}` : fxText(t.fx, starMul(r.star)) + (r.setDone ? `　🎉 套裝「${r.setDone.name}」完成！` : '');
    CU.rlore.textContent = `「${t.lore}」`;
    G.Audio.play(t.rar >= 2 ? 'fanfare' : t.rar === 1 ? 'levelup' : 'bonus');
    if (t.rar >= 2) confetti(CU.stage);
    const left = game.chestCount();
    CU.open.textContent = left ? `再開一個（剩 ${left}）` : '收下';
    CU.all.hidden = left < 2;
    setText(CU.info, left ? '點任意處開下一個' : '點任意處收下');
  }
  function openAll() {
    if (cuBusy) return;
    const res = [];
    for (let i = 0; i < 200 && game.chestCount(); i++) { const r = game.openChest(); if (r) res.push(r); }
    for (const e of game.events) handle(e); game.events.length = 0;
    CU.stage.hidden = true; CU.list.hidden = false;
    const best = Math.max(...res.map(r => r.t.rar));
    CU.list.innerHTML = res.sort((a, b) => b.t.rar - a.t.rar).map(r => `<div class="li r${r.t.rar}"><i style="background-image:url(${itemImg(r.t.id)})"></i><span>${r.t.name}</span><em>${r.maxed ? '💰' : r.isNew ? 'NEW' : '★' + r.star}</em></div>`).join('');
    setText(CU.info, `打開了 ${res.length} 個寶箱`);
    CU.open.textContent = '收下'; CU.all.hidden = true;
    G.Audio.play(best >= 2 ? 'fanfare' : 'levelup');
    if (best >= 2) confetti(CU.el.querySelector('.cbox'));
  }
  function closeChestUI() {
    CU.el.hidden = true; paused = storyQ.length > 0 || !$('#modal').hidden;
    if (tab === 'loot') buildPanel();
  }

  // ---------- 招募演出：信封飛出 → 蓄光 → 爆開 →（SSR/UR 全身登場）→ 結果 ----------
  const RC = {};
  let rcBusy = false, rcSkip = false, rcWake = null, rcN = 1;
  const rcWait = ms => new Promise(res => {
    if (rcSkip) return res();
    const t = setTimeout(() => { rcWake = null; res(); }, ms);
    rcWake = () => { clearTimeout(t); rcWake = null; res(); };
  });
  const rarR = r => r.rar != null ? r.rar : rarOf(r.def || hdef(r.id));
  function rcTag(r) { return r.maxed ? '滿星換薪水' : r.isNew ? 'NEW!' : '★' + (r.star || 1) + ' 升星'; }
  function rcCard(r) {
    const id = r.id, h = r.def || hdef(id), rr = rarR(r);
    return `<div class="rcc r${rr}" style="--rc:${HR[rr].color}"><div class="bk"><i></i></div><div class="fr"><span class="fw">${faceHTML(id)}<em class="rk">${HR[rr].key}</em></span><b>${h.name}</b><small class="${r.isNew ? 'new' : ''}">${rcTag(r)}</small></div></div>`;
  }
  async function runRecruit(n) {
    G.Audio.unlock();
    if (rcBusy) return;
    if (!isUnlocked('recruit') || typeof game.recruit !== 'function') { toast('🔒 ' + unlockAtText(unlockOf('recruit')) + '招募'); return; }
    if (!canRc(n)) { const need = rcCost(n) - (game.s.resume || 0); toast(`📄 履歷不夠${need > 0 ? '，還差 ' + need + ' 張' : ''}！打怪、打頭目都會掉履歷`); return; }
    rcBusy = true;
    let res;
    try { res = game.recruit(n); flushEvents(); } catch (er) { console.error(er); }
    if (!res || !res.length) { rcBusy = false; toast('招募失敗，再試一次'); return; }
    mark('tut_recruit');
    rcN = n; rcSkip = false; paused = true;
    const best = Math.max(...res.map(rarR)), A = G.Audio;
    RC.el.hidden = false; RC.el.className = 'overlay b' + best;
    RC.one.hidden = true; RC.grid.hidden = true; RC.cut.hidden = true; RC.btns.hidden = true; RC.skip.hidden = false;
    setText(RC.info, n === 10 ? '十連招募' : '招募中…');
    // 1. 信封飛進來（封蠟顏色偷偷透露最高稀有度）
    RC.env.hidden = false; RC.env.className = 'rcEnv fly s' + Math.min(best, 4);
    RC.stage.className = 'rcStage';
    A.play('envelope');
    await rcWait(1000);
    // 2. 蓄光
    RC.env.className = 'rcEnv charge s' + Math.min(best, 4);
    if (best >= 3) A.play('roll');
    await rcWait(best >= 3 ? 1400 : 700);
    // 3. 爆開
    RC.env.hidden = true; RC.stage.className = 'rcStage r' + best;
    rcFlash(best);
    A.play('rcGlow', best);
    if (n === 1) {
      const r = res[0];
      if (rarR(r) >= 3 && !rcSkip) await cutIn(r);
      rcShowOne(r);
    } else {
      RC.grid.innerHTML = res.map(rcCard).join(''); RC.grid.hidden = false; fixBroken(RC.grid);
      const cards = RC.grid.children;
      await rcWait(350);
      for (let i = 0; i < res.length; i++) {
        const r = res[i], rr = rarR(r);
        if (rr >= 3 && !rcSkip) await cutIn(r);
        cards[i].classList.add('open');
        if (!rcSkip) { A.play('flip', rr); await rcWait(rr >= 2 ? 260 : 150); }
      }
      for (const c of cards) c.classList.add('open');
      const nw = res.filter(r => r.isNew).length;
      setText(RC.info, `新同事 ${nw} 位・升星 ${res.length - nw} 位`);
    }
    if (best >= 2) confetti(RC.stage);
    RC.skip.hidden = true; RC.cut.hidden = true;
    rcButtons();
    rcBusy = false;
    if (tab === 'hero') buildPanel();
  }
  function rcFlash(best) {
    const f = RC.flash; f.className = 'rcFlash'; void f.offsetWidth; f.className = 'rcFlash go s' + best;   // 只在演出時讀一次版面
    if (best >= 3 && navigator.vibrate) try { navigator.vibrate(best >= 4 ? [40, 50, 80] : 40); } catch (er) {}
  }
  function rcShowOne(r) {
    const id = r.id, h = r.def || hdef(id), rr = rarR(r), R0 = HR[rr];
    RC.one.innerHTML = `<div class="oneArt">${bodyHTML(id)}</div><span class="rtag ${r.isNew ? 'new' : ''}">${rcTag(r)}</span><b class="rname" style="color:${R0.color}">${R0.key}・${h.name}</b><div class="rstar">${stars(r.star || 1, 5)}</div><p class="rjob">${DEPT[deptOf(h)].name}・${h.job || ''}</p><p class="rlore">「${lineOf(h)}」</p>`;
    RC.one.hidden = false; fixBroken(RC.one);
    setText(RC.info, '');
  }
  // SSR／UR 全身登場＋台詞（點一下繼續）
  async function cutIn(r) {
    const id = r.id, h = r.def || hdef(id), rr = rarR(r), R0 = HR[rr];
    RC.cut.className = 'rcCut r' + rr;
    RC.cut.innerHTML = `<div class="cutRays"></div><div class="cutBand"></div>${bodyHTML(id, 'cutImg')}<div class="cutTx"><span class="cutTag" style="background:${R0.color}">${R0.key} ${R0.name}</span>${r.isNew ? '<span class="cutNew">NEW</span>' : ''}${h.theme ? `<span class="cutThm">✦ ${h.theme}</span>` : ''}<b class="cutName">${h.name}</b><small>${DEPT[deptOf(h)].name}・${h.job || ''}</small></div><p class="cutLine">「${lineOf(h)}」</p><span class="cutNext">點一下繼續 ▶</span>`;
    RC.cut.hidden = false; fixBroken(RC.cut);
    G.Audio.play(rr >= 4 ? 'urIn' : 'ssrIn');
    rcFlash(rr);
    confetti(RC.cut);
    await rcWait(rr >= 4 ? 4200 : 3200);
    RC.cut.hidden = true;
  }
  function rcButtons() {
    const c = rcCost(rcN);
    RC.again.innerHTML = `再${rcN === 10 ? '十連' : '抽一次'}<small>${c > 0 ? '📄 ' + c : '免費'}・剩 ${G.fmt(game.s.resume || 0)}</small>`;
    RC.again.disabled = !canRc(rcN);
    RC.btns.hidden = false;
  }
  function closeRecruit() {
    if (rcBusy) return;
    RC.el.hidden = true; paused = storyQ.length > 0 || !$('#modal').hidden;
    if (tab === 'hero' || tab === 'staff') buildPanel();
  }

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
      <ul class="howto">${cheerLi}<li>大家會<b>回到上一關自動練功</b>賺薪水，不會掉任何東西</li><li>${can ? '你現在的薪水<b>可以升級</b>，按下面「一鍵升級」就好' : '多打幾隻怪，薪水夠了就升級'}</li>${weakNow.length && !teamIds().some(id => weakSet.has(deptOf(hdef(id)))) ? `<li>這裡的怪怕 ${weakText()}，到「同事」換人<b>傷害 +50%</b></li>` : `<li>${E.chapterOf(s.maxStage) >= 1 ? '辦公室的<b>咖啡機、椅子</b>是全隊加成' : '點畫面<b>催稿</b>、放<b>大招</b>可以打得更快'}</li>`}<li>練功過兩關會<b>自動再挑戰</b>，也可以按「挑戰頭目」</li></ul>`,
      can ? [['⚡ 一鍵升級', true, () => { mark('tut_one'); oneClick(); }], ['知道了', false]] : [['知道了', true]]);
  }

  // ---------- 事件處理 ----------
  const BONUS = { bento: ['🍱', '便當'], coffee: ['☕', '咖啡'], boba: ['🧋', '珍奶'] };
  const BUFF = { atk: '全隊攻擊', aspd: '全隊攻速', gold: '薪水' };
  function handle(e) {
    rnd.onEvent(e);
    const A = G.Audio;
    switch (e.type) {
      case 'hit': if (e.weak) A.play('weak'); if (e.crit) A.play('crit'); else if (e.src !== 'tap') A.play('hit'); break;
      case 'heal': A.play('heal'); break;
      case 'recruit': {
        buildPanelSoon();
        if (rcBusy || !e.results || !e.results.length) break;
        const L = e.results, best = L.reduce((a, r) => rarR(r) > rarR(a) ? r : a, L[0]), nw = L.filter(r => r.isNew).length;
        if (rarR(best) >= 3) celebrate('', `${e.auto ? '自動招募：' : ''}${HR[rarR(best)].key}「${hdef(best.id).name}」${best.isNew ? '加入！' : '升星！'}`, `「${lineOf(hdef(best.id))}」`, best.id);
        else if (!e.auto) toast(`📨 招募 ${L.length} 次：${nw ? '新同事 ' + nw + ' 位' : '全部升星'}${rarR(best) >= 2 ? '（有 SR！）' : ''}`, 'good');
        else {                                                  // 自動招募：15 秒最多一則
          autoRc.n += L.length; autoRc.nw += nw;
          const now = performance.now();
          if (now - autoRc.t > 15000) { toast(`🤖 自動招募 ${autoRc.n} 次${autoRc.nw ? '：新同事 ' + autoRc.nw + ' 位' : ''}`, 'good'); autoRc.t = now; autoRc.n = autoRc.nw = 0; }
        }
        break;
      }
      case 'resume':
        if (e.why === 'gift') { mark('tut_resume'); toast(`🎁 老員工福利：補發 ${e.n} 份履歷，到「同事」招募新同事！`, 'bonus'); }
        resumeGain(e.n || 1);
        break;
      case 'teamChange': teamKey = ''; buildPanelSoon(); break;
      case 'unlock': {
        const u = e.u || {}, k = String(u.key || '');
        if (/auto.?buy/i.test(k)) mark('tut_autobuy');
        A.play('unlock');
        if (e.gift) { celebrate('📨', 'v1.3 新功能：招募同事！', '100 位同事等你收集，到「同事」分頁看看'); buildPanelSoon(); break; }
        celebrate('🔓', `解鎖「${u.text || k}」`, UNLOCK_SUB[k] || (/slot|team/i.test(k) ? '隊伍可以多帶一位同事了！' : ''));
        buildPanelSoon();
        break;
      }
      case 'kill': A.play(e.e.boss ? 'clear' : 'kill'); setTimeout(() => A.play('coin'), 350); break;
      case 'hurt': A.play('hurt'); break;
      case 'down': A.play('down'); break;
      case 'ult': A.play('ult'); break;
      case 'levelup':
        mark('tut_buy');
        if (e.rankUp && hdef(e.id).ranks) {
          const h = hdef(e.id);
          A.play('levelup');
          celebrate('', `${h.name} 升職！`, `「${h.ranks[e.rankUp]}」${e.rankUp === 2 ? '・換上新造型！' : '・能力大幅提升'}`, e.id);
          buildPanelSoon();
        }
        break;
      case 'stage': {
        const ch = E.chapterOf(e.s);
        if (e.s < 50 && e.s % 10 === 0 && !game.s.farming) story('intro' + ch);
        if (e.s < 50 && e.s % 10 === 4 && !game.s.farming) story('mid' + ch);
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
      case 'quest': {
        A.play('coin');
        const rs = e.resume || (e.q && e.q.resume) || 0;
        toast('📋 任務完成！' + [e.gold ? '薪水 +' + G.fmt(e.gold) : '', rs ? '履歷 +' + rs : ''].filter(Boolean).join('・'), 'good');
        break;
      }
      case 'shieldBreak': A.play(e.timeout ? 'hurt' : 'shield'); break;
      case 'chest':
        A.play('coin');
        if (!seen('tut_chest')) story('tut_chest');
        break;
      case 'treasure':
        if (e.src === 'boss') { celebrate('', `神器「${e.t.name}」${e.isNew ? '' : '升星！'}`, fxText(e.t.fx, starMul(e.star)), null, itemImg(e.t.id)); buildPanelSoon(); }
        else if (e.auto) { toast(`🎁 自動開箱：${e.t.name} ${e.maxed ? '（換薪水）' : e.isNew ? 'NEW！' : '★' + e.star}`, e.t.rar >= 2 ? 'bonus' : 'good'); }
        if (e.setDone && e.src !== 'boss' && !e.auto) {} else if (e.setDone) celebrate('🧩', `套裝「${e.setDone.name}」完成！`, e.setDone.desc);
        break;
      case 'bossPhase': A.play('boss'); if (navigator.vibrate) try { navigator.vibrate([30, 40, 30]); } catch (er) {} break;
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
  let rebuildT = 0; function buildPanelSoon() { if (tab === 'loot' || tab === 'hero' || tab === 'staff') rebuildT = 0.05; }
  const autoRc = { n: 0, nw: 0, t: -1e9 };
  const UNLOCK_SUB = { recruit: '用履歷招募新同事！到「同事」分頁看看', autobuy: '打開後薪水會自動花在最划算的地方' };
  // 掉履歷：不洗版，只跳頂部數字與小小 +N
  let resAcc = 0, resT = 0;
  function resumeGain(n) {
    resAcc += n;
    G.Audio.play('paper');
    if (!seen('tut_resume')) { mark('tut_resume'); toast('📄 撿到履歷！可以拿來招募新同事', 'good'); }
    if (resT > 0) { setText(top.resPlus, '+' + resAcc); return; }
    resT = 1.2;
    setText(top.resPlus, '+' + resAcc);
    top.resPlus.classList.remove('go'); void top.resPlus.offsetWidth; top.resPlus.classList.add('go');
  }   // 其他分頁 updatePanel 會自己更新

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
  // ---------- 主畫面圖示（四款可挑；iPhone 讀 apple-touch-icon、Android 讀 manifest）----------
  const ICONS = [['kui', '小葵'], ['mi', '小米'], ['jie', '阿傑'], ['vivi', 'Vivi']];
  function iconChoice() { try { const v = localStorage.getItem('oi-icon'); return ICONS.some(i => i[0] === v) ? v : 'kui'; } catch (e) { return 'kui'; } }
  function applyIcon(id) {
    const abs = p => new URL(p, location.href).href;
    $('#appleIcon').setAttribute('href', `art/icon/${id}-180.png`);
    $('#favicon').setAttribute('href', `art/icon/${id}-64.png`);
    const man = {
      name: '不想上班！放置辦公室', short_name: '不想上班', start_url: abs('./'), scope: abs('./'), display: 'standalone', orientation: 'portrait',
      background_color: '#1d1730', theme_color: '#1d1730',
      icons: [{ src: abs(`art/icon/${id}-192.png`), sizes: '192x192', type: 'image/png' }, { src: abs(`art/icon/${id}-512.png`), sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: abs(`art/icon/${id}-512.png`), sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
    };
    try { $('#manifest').setAttribute('href', URL.createObjectURL(new Blob([JSON.stringify(man)], { type: 'application/manifest+json' }))); } catch (e) {}
  }
  function iconPicker() {
    const cur = iconChoice(), ios = /iPhone|iPad|iPod/.test(navigator.userAgent), standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    const onTitle = !$('#title').hidden;
    modal(`<h2>📲 主畫面圖示</h2><p>挑一個喜歡的，再把遊戲加到手機主畫面，就能像 App 一樣全螢幕玩。</p>
      <div class="iconPick">${ICONS.map(([id, n]) => `<button type="button" data-icon="${id}" class="${id === cur ? 'on' : ''}"><img src="art/icon/${id}-180.png" alt="${n}">${n}</button>`).join('')}</div>
      <div class="a2hs">${standalone ? '你已經是從主畫面打開的了。想換圖示：先把主畫面上的舊圖示刪掉，挑好新的再加一次。'
        : ios ? 'iPhone：用 <b>Safari</b> 打開這一頁，按下方的 <b>分享</b> 按鈕 → <b>加入主畫面</b>。'
        : 'Android：Chrome 右上角 <b>⋮</b> → <b>加到主畫面</b>（或「安裝應用程式」）。<br>iPhone：Safari 的 <b>分享</b> → <b>加入主畫面</b>。'}</div>`,
      [['好', true, () => { if (onTitle) paused = true; }]]);
    $('#modal').querySelectorAll('.iconPick button').forEach(b => b.onclick = () => {
      try { localStorage.setItem('oi-icon', b.dataset.icon); } catch (e) {}
      applyIcon(b.dataset.icon); G.Audio.play('tab');
      $('#modal').querySelectorAll('.iconPick button').forEach(x => x.classList.toggle('on', x === b));
    });
  }
  // ---------- 桌面版鍵盤：空白鍵催稿、1～5 放大招、Enter 繼續、Esc 關閉 ----------
  function onKey(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key, vis = s => { const el = $(s); return el && !el.hidden; };
    if (vis('#title') && !vis('#modal')) { if (k === 'Enter' || k === ' ') { e.preventDefault(); $('#btnStart').click(); } return; }
    if (vis('#story')) { if (k === ' ' || k === 'Enter') { e.preventDefault(); nextLine(); } else if (k === 'Escape') skipStory(); return; }
    if (k === 'Escape') {
      for (const sel of ['#rcSkip', '#rcOk', '#cClose']) { const b = $(sel); if (b && b.offsetParent) { b.click(); return; } }
      if (vis('#modal')) { const b = $('#modal').querySelector('.btns button.pri') || $('#modal').querySelector('.btns button'); if (b) b.click(); }
      return;
    }
    if (paused) return;
    if (k === ' ') {
      e.preventDefault(); G.Audio.unlock();
      const t = game.target && game.target(); if (!t) return;
      const y = t.y - 40, r = game.tap(t.x, y); rnd.tapFx(t.x, y); if (r) G.Audio.play('tap', game.combo || 0);
    } else if (/^[1-5]$/.test(k)) {
      const id = (game.s.team || [])[+k - 1]; if (id) game.ult(id);
    }
  }

  // 離線準備進度：數這一版快取裡有幾個檔案
  async function offlineStatus() {
    try {
      if (!('caches' in window) || !navigator.serviceWorker || !navigator.serviceWorker.controller) return '第一次打開後會在背景下載，下次打開就能離線玩';
      const c = await caches.open('office-idle-' + G.VERSION), n = (await c.keys()).length;
      return n >= 280 ? '已準備好，沒有網路也能玩' : `下載中（${n} 個檔案），請在有網路時多開一下`;
    } catch (e) { return '這個瀏覽器不支援離線遊玩'; }
  }
  function settings() {
    const A = G.Audio;
    setTimeout(() => offlineStatus().then(t => { const el = $('#offTx'); if (el) el.textContent = '✈️ 離線遊玩：' + t; }), 0);
    modal(`<h2>設定</h2><p>進度會自動存在這台裝置的瀏覽器裡。</p><p>目前版本：<b>${G.VERSION}</b></p><p id="offTx" class="small">✈️ 離線遊玩：檢查中…</p>`, [
      [A.muted ? '🔊 開啟聲音' : '🔇 關閉聲音', false, () => A.setMute(!A.muted)],
      [A.music ? '🎵 關閉音樂' : '🎵 開啟音樂', false, () => A.setMusic(!A.music)],
      ['📲 主畫面圖示', false, iconPicker],
      ['重新開始', false, () => modal('<h2>確定要重新開始？</h2><p>所有進度都會清除，無法復原。</p>', [['取消', true], ['清除進度', false, () => { resetting = true; localStorage.removeItem(KEY); location.reload(); }]])],
      ['關閉', true]
    ]);
  }

  // ---------- 主迴圈 ----------
  let last = 0, saveT = 0, topT = 0, panelT = 0, goalT = 0;
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
    if (resT > 0) { resT -= dt; if (resT <= 0) resAcc = 0; }
    saveT -= dt; if (saveT <= 0) { saveT = 3; save(); }
  }

  async function boot() {
    const saved = loadSave();
    game = G.__game = new E.Game(saved);
    refreshAll();
    const bootEv = game.events.filter(e => e.gift || e.why === 'gift');   // 舊存檔補發履歷：開始上班後再提示
    game.events.length = 0;
    goldShown = game.s.gold;
    rnd = new G.Render.Renderer($('#cv'), game);
    Object.assign(top, { day: $('#stDay'), code: $('#stCode'), name: $('#stName'), waves: $('#waves'), gold: $('#gold'), goldBox: $('#goldBox'), btnBoss: $('#btnBoss'), dps: $('#dps'), autoWrap: $('#autoWrap'), autoBuyWrap: $('#autoBuyWrap'), autoUlt: $('#autoUlt'), autoBuy: $('#autoBuy'), hint: $('#hint'), btnChest: $('#btnChest'), chestN: $('#chestN'), cheer: $('#cheer'), buff: { gold: $('#bfGold'), aspd: $('#bfAspd'), atk: $('#bfAtk') }, resBox: $('#resBox'), resume: $('#resume'), resPlus: $('#resPlus'), goal: $('#goal'), goalTx: $('#goalTx'), goalBar: $('#goalBar') });
    Object.assign(tabs, { staffDot: $('#staffDot'), officeDot: $('#officeDot'), questDot: $('#questDot'), lootDot: $('#lootDot'), staff: $('#tabs [data-tab="staff"]'), heroDot: $('#heroDot'), hero: $('#tabs [data-tab="hero"]') });
    Object.assign(RC, { el: $('#rcUI'), stage: $('#rcUI .rcStage'), env: $('#rcUI .rcEnv'), one: $('#rcUI .rcOne'), grid: $('#rcUI .rcGrid'), cut: $('#rcUI .rcCut'), flash: $('#rcUI .rcFlash'), info: $('#rcUI .rcInfo'), btns: $('#rcUI .btns'), again: $('#rcAgain'), skip: $('#rcSkip') });
    RC.el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; if (rcWake) { G.Audio.play('tab'); rcWake(); } });
    RC.skip.addEventListener('pointerdown', e => { e.stopPropagation(); rcSkip = true; RC.cut.hidden = true; if (rcWake) rcWake(); });
    RC.again.onclick = () => { if (!rcBusy) runRecruit(rcN); };
    $('#rcOk').onclick = closeRecruit;
    $('#resBox').onclick = () => { if (isUnlocked('recruit')) switchTab('hero'); else toast('📄 履歷：' + unlockAtText(unlockOf('recruit')) + '招募後可以用'); };
    $('#team').addEventListener('pointerdown', e => { const el = e.target.closest('.hc'); if (el) tapTeam(el.dataset.id); });
    fixBroken();
    // 擋兩指放大、雙擊放大、Ctrl＋滾輪、長按選單
    ['gesturestart', 'gesturechange'].forEach(k => document.addEventListener(k, e => e.preventDefault(), { passive: false }));
    document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
    addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', e => e.preventDefault());
    Object.assign(CU, { el: $('#chestUI'), stage: $('#chestUI .cstage'), chest: $('#chestUI .chestImg'), reveal: $('#chestUI .reveal'), rimg: $('#chestUI .rimg'), rtag: $('#chestUI .rtag'), rname: $('#chestUI .rname'), rstar: $('#chestUI .rstar'), rfx: $('#chestUI .rfx'), rlore: $('#chestUI .rlore'), list: $('#chestUI .clist'), info: $('#chestUI .cinfo'), open: $('#cOpen'), all: $('#cAll') });
    CU.open.onclick = () => { if (!CU.list.hidden) { closeChestUI(); return; } revealOne(); };
    // 點畫面任何地方（按鈕以外）：還沒開就開、開完就下一個或收下
    CU.el.addEventListener('click', e => {
      if (e.target.closest('button') || cuBusy) return;
      if (!CU.list.hidden) { closeChestUI(); return; }
      revealOne();
    });
    CU.all.onclick = openAll;
    $('#cClose').onclick = closeChestUI;
    $('#btnChest').onclick = openChestUI;
    buildTeam(); buildPanel();
    $('#tabs').addEventListener('click', e => {
      const b = e.target.closest('button'); if (b) switchTab(b.dataset.tab);
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
    applyIcon(iconChoice());
    // 離線遊玩：註冊 Service Worker（第一次打開後在背景把遊戲檔案存到手機）
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
    $('#btnA2hs').onclick = e => { e.stopPropagation(); G.Audio.unlock(); iconPicker(); };
    addEventListener('keydown', onKey);
    G.__reset = () => { resetting = true; localStorage.removeItem(KEY); location.reload(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    addEventListener('pagehide', save);
    paused = true;
    let ready = false, want = false;
    const btn = $('#btnStart'), label = saved && saved.stats && saved.stats.play > 5 ? '繼續上班' : '開始上班';
    btn.textContent = label;
    const start = () => {
      $('#title').hidden = true; paused = false;
      game.startStage(); game.events.length = 0;
      if (game.s.stage === 0) story('intro0');
      bootEv.forEach(handle); bootEv.length = 0;
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
