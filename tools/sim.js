// 平衡模擬：node tools/sim.js [每秒點擊數=1.5] [跑幾分鐘=45]
// 策略：自動大招、每 0.5 秒把錢花在「最便宜」的升級上（接近一般玩家）
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = { Math, console }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['data.js', 'engine.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), ctx);
const { Engine, DATA } = ctx;
const tps = +(process.argv[2] || 1.5), minutes = +(process.argv[3] || 45);
const g = new Engine.Game(); g.s.autoUlt = true;
const dt = 0.05; let t = 0, tapAcc = 0, buyAcc = 0, fails = 0;
const reach = {}; let lastLog = 0;
function cheapest() {
  const c = [];
  for (const id of DATA.ORDER) if (g.s.heroes[id] > 0) c.push([g.heroCost(id), () => g.buyHero(id)]);
  for (const o of DATA.OFFICE) if (Engine.chapterOf(g.s.maxStage) >= o.unlock && g.office(o.id) < o.max) c.push([g.officeCost(o) * 1.2, () => g.buyOffice(o.id)]);
  c.push([DATA.CURVE.tapCost(g.s.tapLv) * 1.5, () => g.buyTap()]);
  c.sort((a, b) => a[0] - b[0]); return c[0];
}
while (t < minutes * 60) {
  g.update(dt); t += dt;
  tapAcc += dt * tps; while (tapAcc >= 1) { g.tap(); tapAcc--; }
  buyAcc += dt; if (buyAcc > 0.5) { buyAcc = 0; for (let k = 0; k < 50; k++) { const b = cheapest(); if (!b || !b[1]()) break; } }
  for (const e of g.events) if (e.type === 'fail') { fails++; console.log('  失敗', e.s, e.reason, (t/60).toFixed(1)); }
  g.events.length = 0;
  const m = g.s.maxStage;
  if (!reach[m]) { reach[m] = t; }
  if (m % 10 === 0 && m > lastLog) { lastLog = m; const lv = DATA.ORDER.map(id => id + g.s.heroes[id]).join(' ');
    console.log(`通過 ${m} 關  ${(t / 60).toFixed(1)} 分  失敗累計 ${fails}  ${lv}  辦公室 ${JSON.stringify(g.s.office)} 點擊Lv${g.s.tapLv}`); }
}
console.log('最終', g.s.maxStage, '關', (t / 60).toFixed(1), '分');
// 每關耗時
const rows = []; for (let i = 1; i <= g.s.maxStage; i++) if (reach[i] && reach[i - 1] !== undefined) rows.push(`${i}:${(reach[i] - reach[i - 1]).toFixed(0)}s`);
console.log(rows.join(' '));
