// 平衡模擬：
//   node tools/sim.js                 全部玩家模型各跑 3 次，印通關時間表
//   node tools/sim.js normal [分鐘]    只跑一種模型，印詳細進度
//   node tools/sim.js 1.5 [分鐘]       舊用法：一般玩家但每秒點擊數改成 1.5
//   node tools/sim.js all 4 normal,newbie  只跑指定模型、各 4 次（環境變數 OVR='{"team":"fill"}' 可覆寫所有模型）；單一模型可加第 4 個參數 JSON 覆寫，例如 '{"tps":3}'；CASTLOG=1 印頭目技能
// 玩家模型見下方 MODELS；新手模型要在 35～45 分鐘內通關、前三章不反覆失敗。
// v1.3：有 js/roster.js 就用真名冊，沒有就產生 96 位假同事；各模型的 team：'auto' 每次招募後 autoTeam、'fill' 只補空位（保守）
const vm = require('vm'), fs = require('fs'), path = require('path');
function load() {
  const ctx = { Math, console }; ctx.globalThis = ctx; vm.createContext(ctx);
  const roster = path.join(__dirname, '../js/roster.js');
  if (fs.existsSync(roster)) vm.runInContext(fs.readFileSync(roster, 'utf8'), ctx);
  if (!ctx.ROSTER || !ctx.ROSTER.length) ctx.ROSTER = fakeRoster();
  for (const f of ['data.js', 'engine.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), ctx);
  return ctx;
}
// 名冊還沒寫好時的假資料：N34 R28 SR20 SSR10 UR4，部門、職業輪流
function fakeRoster() {
  const rars = [].concat(...[34, 28, 20, 10, 4].map((n, r) => Array(n).fill(r)));
  const depts = ['design', 'cs', 'eng', 'sales', 'admin'], roles = ['tank', 'dps', 'aoe', 'crit', 'support', 'healer'];
  return rars.map((rar, i) => ({ id: 'h' + String(i + 1).padStart(3, '0'), name: '假同事' + (i + 1), job: '同事', dept: depts[i % 5], rar, role: roles[(i * 7) % 6], skill: '大招', line: '……' }));
}
const { Engine, DATA } = load();

// tps：每秒點擊；burst：點擊集中成連擊（一次連點 n 下）；buyEvery：幾秒打開面板買一次；
// buy：'best' 照 engine 的划算順序、'one' 只升級小葵、'noOffice' 不買辦公室；ult：'manual' 頭像亮了 react 秒後點、'never' 從不手動點；
// autoUlt / autoBuy：解鎖後會不會打開開關；catch：外送驚喜點到機率；quest：幾秒看一次任務
const MODELS = {
  pro:      { name: '積極玩家', team: 'auto', tps: 4, burst: 8, buyEvery: 1, buy: 'best', ult: 'manual', react: 0.3, autoUlt: true, autoBuy: false, catch: 0.95, quest: 10 },
  normal:   { team: 'auto', name: '一般玩家', tps: 1.5, burst: 4, buyEvery: 4, buy: 'best', ult: 'manual', react: 1.5, autoUlt: true, autoBuy: false, catch: 0.6, quest: 30 },
  lazyTap:  { team: 'auto', name: '很少點（0.3/秒）', tps: 0.3, burst: 1, buyEvery: 5, buy: 'best', ult: 'manual', react: 3, autoUlt: true, autoBuy: false, catch: 0.3, quest: 60 },
  slowBuy:  { team: 'auto', name: '每 20 秒升級一次', tps: 1, burst: 3, buyEvery: 20, buy: 'best', ult: 'manual', react: 2, autoUlt: true, autoBuy: false, catch: 0.5, quest: 60 },
  oneHero:  { team: 'auto', name: '只升級小葵', tps: 1, burst: 3, buyEvery: 5, buy: 'one', ult: 'manual', react: 2, autoUlt: true, autoBuy: false, catch: 0.5, quest: 60 },
  noOffice: { team: 'auto', name: '從不買辦公室', tps: 1, burst: 3, buyEvery: 5, buy: 'noOffice', ult: 'manual', react: 2, autoUlt: true, autoBuy: false, catch: 0.5, quest: 60 },
  noUlt:    { team: 'auto', name: '從不手動放大招', tps: 1, burst: 3, buyEvery: 5, buy: 'best', ult: 'never', autoUlt: false, autoBuy: false, catch: 0.5, quest: 60 },
  idle:     { team: 'engine', name: '放著不管（只開自動）', tps: 0.1, burst: 1, buyEvery: 60, buy: 'best', ult: 'never', autoUlt: true, autoBuy: true, catch: 0.1, quest: 300 },
  newbie:   { team: 'fill', name: '新手綜合（少點、慢買、不放招、不買辦公室）', tps: 0.3, burst: 1, buyEvery: 20, buy: 'noOffice', ult: 'never', autoUlt: false, autoBuy: false, catch: 0.3, quest: 120 }
};

function buyOnce(g, m) {
  if (m.buy === 'one') return g.buyHero('kui');
  const b = g.bestBuy(m.buy === 'noOffice' ? { office: false } : {});
  return b ? b.fn() : false;
}

function run(m, minutes, verbose) {
  const g = new Engine.Game();
  const dt = 0.05; let t = 0, tapAcc = 0, buyT = 0, questT = 0, fails = 0, failCh = [0, 0, 0, 0, 0];
  let burstLeft = 0, burstT = 0, idleT = 0, maxIdle = 0, maxIdleAt = 0, lastProg = 0, stuck = 0;
  const reach = { 0: 0 }, first = {}, readyT = {}; let r10 = 0, r30 = 0;
  const mark = (k) => { if (first[k] === undefined) first[k] = t; };
  let bonusN = 0, bonusGot = 0, says = 0, casts = 0, bossStart = 0; const bossDur = [];
  const own = {}, ownAt = n => { for (let i = n; i > 0 && own[i] === undefined; i--) own[i] = t; };   // 收集到 n 位的時間
  let pulls = 0, resumeGot = 0; const rarGot = [0, 0, 0, 0, 0];
  while (t < minutes * 60) {
    g.update(dt); t += dt;
    // 點擊：tps 平均，但集中成一串連點
    tapAcc += dt * m.tps;
    if (burstLeft <= 0 && tapAcc >= m.burst) { burstLeft = m.burst; tapAcc -= m.burst; }
    if (burstLeft > 0) { burstT -= dt; if (burstT <= 0) { burstT = 0.15; burstLeft--; const e = g.target && g.target(); g.tap(e ? e.x : undefined, e ? e.y - 30 : undefined); } }
    // 外送驚喜
    for (const b of g.bonuses || []) {
      if (b.simTried) continue;
      if (b.t > 0.8) { b.simTried = true; if (Math.random() < m.catch) { g.tap(b.x, b.y); } }
    }
    // 大招
    for (const h of g.heroes) {
      if (g.canUlt(h)) { readyT[h.id] = (readyT[h.id] || 0) + dt; if (m.ult === 'manual' && readyT[h.id] >= m.react) g.ult(h.id); }
      else readyT[h.id] = 0;
    }
    if (g.s.maxStage >= 10 && m.autoUlt && !g.s.autoUlt) { g.s.autoUlt = true; mark('autoUlt'); }
    if (g.s.maxStage >= (DATA.AUTOBUY_AT || 5) && m.autoBuy && !g.s.autoBuy) { g.s.autoBuy = true; mark('autoBuy'); }
    // 購買
    buyT += dt;
    if (buyT >= m.buyEvery) {
      buyT = 0;
      if (!m.autoBuy || !g.s.autoBuy) {
        while (g.chestCount && g.chestCount()) g.openChest();
        // 招募：湊滿十連才抽；auto 抽完重新編隊、fill 只讓新同事補空位（engine 會自己補）
        if (m.team !== 'engine') while (g.canRecruit(10)) { g.recruit(10); if (m.team === 'auto') g.autoTeam(true, true); }
        if (m.team === 'auto') g.autoTeam(true, true);
      }
      for (let k = 0; k < 300; k++) if (!buyOnce(g, m)) break;
    }
    // 任務
    questT += dt;
    if (questT >= m.quest) {
      questT = 0;
      for (const q of DATA.QUESTS) if (!g.s.quests[q.id] && g.questDone && g.questDone(q)) g.claimQuest(q.id);
    }
    for (const e of g.events) {
      if (e.type === 'fail') { fails++; if (e.s < 50) failCh[Math.floor(e.s / 10)]++; if (verbose) console.log(`  失敗 ${Engine.stageName(e.s).code} ${e.reason} ${(t / 60).toFixed(1)} 分  頭目剩 ${e.left === null ? '-' : Math.round(e.left * 100) + '%'}  打氣 ${g.cheerN()} 層`); }
      if (e.type === 'levelup' || e.type === 'buy') { mark('firstBuy'); if (e.rankUp) mark('rank'); }
      if (e.type === 'join') mark('join_' + e.id);
      if (e.type === 'loot') mark('loot');
      if (e.type === 'bonusSpawn') { bonusN++; mark('bonus'); }
      if (e.type === 'bonus') bonusGot++;
      if (e.type === 'say') says++;
      if (e.type === 'bossCast') { casts++; if (verbose && process.env.CASTLOG) console.log('   技能', e.skill.name, (t / 60).toFixed(1)); }
      if (e.type === 'ult') mark('ult');
      if (e.type === 'recruit') { mark('recruit'); pulls += e.results.length; e.results.forEach(r => { if (r.isNew) rarGot[r.rar]++; }); }
      if (e.type === 'resume') resumeGot += e.n;
      if (e.type === 'wave' && e.boss) bossStart = t;
      if (e.type === 'clear' && e.boss && e.s < 50) bossDur.push(Engine.stageName(e.s).code + ' ' + (t - bossStart).toFixed(0) + 's');
    }
    g.events.length = 0;
    ownAt(g.ownedCount());
    if (t <= 600) r10 = g.ownedCount(); if (t <= 1800) r30 = g.ownedCount();
    // 卡死偵測：30 秒內沒有擊殺、沒有波次前進
    const prog = g.s.stats.kills + g.wave * 1000 + g.s.stage * 1e6 + Math.round(g.alive().reduce((a, e) => a + e.hp + e.shield, 0));
    if (prog !== lastProg) { lastProg = prog; idleT = 0; } else { idleT += dt; if (idleT > maxIdle) { maxIdle = idleT; maxIdleAt = t; } if (idleT > 30) { stuck++; idleT = 0; if (verbose) console.log('  !! 30 秒沒有進展', g.phase, g.s.stage, g.alive().length); } }
    const ms = g.s.maxStage;
    if (reach[ms] === undefined) {
      reach[ms] = t;
      if (verbose && ms % 10 === 0) console.log(`通過 ${ms} 關  ${(t / 60).toFixed(1)} 分  失敗 ${fails}  隊伍 ${g.s.team.map(id => `${g.heroDef(id).name}${DATA.HRAR[g.heroDef(id).rar].key}★${g.star(id)}Lv${g.s.heroes[id]}`).join(' ')}  同事 ${g.ownedCount()} 位  履歷 ${g.s.resume}  辦公室 ${JSON.stringify(g.s.office)} 點擊Lv${g.s.tapLv} 打氣${g.cheerN()}`);
    }
    if (ms >= 50 && !verbose && t >= 1800) break;
  }
  return { g, t, bossDur, fails, failCh, reach, first, maxIdle, maxIdleAt, stuck, bonusN, bonusGot, says, casts, r10, r30, own, pulls, resumeGot, rarGot };
}

const fmtT = s => s === undefined ? '—' : (s < 60 ? s.toFixed(0) + '秒' : (s / 60).toFixed(1) + '分');
const arg = process.argv[2];
if (arg && MODELS[arg] || (arg && !isNaN(+arg))) {
  const m = Object.assign({}, MODELS[arg] || Object.assign({}, MODELS.normal, { tps: +arg }), process.argv[4] ? JSON.parse(process.argv[4]) : {});
  const r = run(m, +(process.argv[3] || 45), true);
  console.log(`${m.name}：最終 ${r.g.s.maxStage} 關 ${fmtT(r.reach[50])} 通關  失敗 ${r.fails}（各章 ${r.failCh.join('/')}）`);
  console.log('第一次：', Object.entries(r.first).map(([k, v]) => k + ' ' + fmtT(v)).join('、'));
  console.log('頭目戰（過關那次）：', r.bossDur.join('、'));
  console.log(`同事：前 10 分鐘 ${r.r10} 位、30 分鐘 ${r.r30} 位、最後 ${r.g.ownedCount()} 位（含原本四人）  抽 ${r.pulls} 次、拿到履歷 ${r.resumeGot}  新同事稀有度 N/R/SR/SSR/UR ${r.rarGot.join('/')}`);
  console.log('收集節奏：', [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100].filter(n => r.own[n] !== undefined).map(n => `${n} 位@${fmtT(r.own[n])}`).join('  '));
  console.log(`外送 ${r.bonusGot}/${r.bonusN}  碎碎念 ${r.says} 句（平均 ${(r.t / Math.max(1, r.says)).toFixed(0)} 秒一句）  頭目技能 ${r.casts} 次  最長無進展 ${r.maxIdle.toFixed(1)} 秒`);
  const rows = []; for (let i = 1; i <= r.g.s.maxStage; i++) if (r.reach[i] !== undefined) rows.push(`${Engine.stageName(i - 1).code}:${(r.reach[i] - r.reach[i - 1]).toFixed(0)}s`);
  console.log(rows.join(' '));
} else {
  const N = +(process.argv[3] || 3), minutes = 60, only = process.argv[4] ? process.argv[4].split(',') : null;
  console.log('模型'.padEnd(26), '通過1-10  1-20   1-30   1-40   通關     失敗(各章)   同事@10分/30分  前5分鐘新東西');
  for (const [k, m] of Object.entries(MODELS)) {
    if (only && !only.includes(k)) continue;
    const rs = []; for (let i = 0; i < N; i++) rs.push(run(Object.assign({}, m, process.env.OVR ? JSON.parse(process.env.OVR) : {}), minutes, false));
    const avg = st => { const v = rs.map(r => r.reach[st]).filter(x => x !== undefined); return v.length === rs.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined; };
    const fc = [0, 1, 2, 3, 4].map(i => (rs.reduce((a, r) => a + r.failCh[i], 0) / N).toFixed(1).replace('.0', ''));
    const early = Object.entries(rs[0].first).filter(([, v]) => v < 300).map(([k2, v]) => k2 + '@' + fmtT(v)).join(' ');
    const end = avg(50) === undefined ? `${Math.round(rs.reduce((a, r) => a + r.g.s.maxStage, 0) / N)}關未通` : fmtT(avg(50));
    const col = `${(rs.reduce((a, r) => a + r.r10, 0) / N).toFixed(0)}/${(rs.reduce((a, r) => a + r.r30, 0) / N).toFixed(0)}`;
    console.log(`${k.padEnd(9)}${m.name.slice(0, 10).padEnd(12, '　')}`, [10, 20, 30, 40].map(s => fmtT(avg(s)).padEnd(6)).join(' '), end.padEnd(8), fc.join('/').padEnd(12), col.padEnd(14), early, rs.some(r => r.stuck) ? ' !!卡死' : '');
  }
}
