// 戰鬥與成長邏輯（不碰 DOM，sim.js 也直接用這支）
(function (G) {
  const D = G.DATA, C = D.CURVE;
  const GROUND = 250, ENEMY_X0 = 470;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const rand = (a, b) => a + Math.random() * (b - a);

  function newSave() {
    return {
      v: 1, stage: 0, maxStage: 0, gold: 0, farming: false, autoUlt: false, autoBoss: true, autoBuy: false,
      heroes: { mi: 1, kui: 1, jie: 0, vivi: 0 }, office: {}, perk: {}, tapLv: 1, loot: [],
      treasures: {}, chests: { wood: 0, gold: 0 },
      stats: { kills: 0, ults: 0, taps: 0, play: 0, bonus: 0, chests: 0 }, quests: {}, seen: {}, cleared: false,
      cheer: { n: 0, calm: 0 }
    };
  }
  // 舊存檔（v1）缺的欄位補上預設值
  function fixSave(s) {
    const base = newSave();
    if (!s) return base;
    const out = Object.assign(base, s, {
      heroes: Object.assign(base.heroes, s.heroes), stats: Object.assign(base.stats, s.stats),
      office: s.office || {}, perk: s.perk || {}, loot: s.loot || [], quests: s.quests || {}, seen: s.seen || {},
      cheer: Object.assign(base.cheer, s.cheer), treasures: s.treasures || {}, chests: Object.assign(base.chests, s.chests)
    });
    // v1.1 以前的頭目戰利品 → 同名神器
    for (const id of out.loot) if (D.TREASURES.some(t => t.id === id) && !out.treasures[id]) out.treasures[id] = 1;
    return out;
  }

  const chapterOf = s => Math.min(Math.floor(s / 10), 4);
  const isBoss = s => s % 10 === 9;
  function stageName(s) {
    if (s >= 50) return { day: '加班', title: `加班第 ${s - 49} 關`, code: `OT-${s - 49}` };
    const ch = D.CHAPTERS[chapterOf(s)];
    return { day: ch.day, title: ch.names[s % 10], code: `${chapterOf(s) + 1}-${s % 10 + 1}` };
  }

  class Game {
    constructor(save) {
      this.s = fixSave(save);
      this.events = [];
      this.heroes = D.ORDER.map(id => ({ id, def: D.HEROES.find(h => h.id === id), hp: 0, max: 1, cd: 0.4, energy: 0, shield: 0, dead: false, x: 0, readyT: 0 }));
      this.buffT = 0;
      this.bonuses = []; this.bonusT = this.s.stats.play < 60 ? D.BONUS.first : rand(...D.BONUS.every);
      this.buffs = { atk: { mul: 1, t: 0 }, aspd: { mul: 1, t: 0 }, gold: { mul: 1, t: 0 } };
      this.combo = 0; this.comboT = 0;
      this.talkT = 3; this.quietT = 0; this.sayQ = [];
      this.autoT = 0;
      this.checkJoin(true);
      this.startStage();
    }
    emit(e) { this.events.push(e); }

    // ---------- 加成 ----------
    office(id) { return this.s.office[id] || 0; }
    perk(id) { return this.s.perk[id] || 0; }
    // 自己買的等級 + 公司福利送的等級（福利不影響價格）
    officeBonus(id) { return (this.office(id) + this.perk(id)) * D.OFFICE.find(o => o.id === id).per; }
    // 寶物加成：每件 fx × (1 + 0.5 × (星數 - 1))，再加上湊齊的套裝（有快取，寶物變動時 _tsVer + 1）
    tSum(k) {
      if (this._tsKey !== this._tsVer || !this._ts) this.calcTreasure();
      return this._ts[k] || 0;
    }
    calcTreasure() {
      const out = {}, T = this.s.treasures;
      for (const t of D.TREASURES) {
        const st = T[t.id] || 0; if (!st) continue;
        const m = 1 + D.CHEST.starMul * (st - 1);
        for (const k in t.fx) out[k] = (out[k] || 0) + t.fx[k] * m;
      }
      for (const set of D.SETS) if (set.items.every(id => T[id])) for (const k in set.fx) out[k] = (out[k] || 0) + set.fx[k];
      this._ts = out; this._tsKey = this._tsVer;
    }
    lootSum(k) { return this.tSum(k); }
    setsDone() { return D.SETS.filter(set => set.items.every(id => this.s.treasures[id])); }
    treasureCount() { return Object.keys(this.s.treasures).filter(id => this.s.treasures[id] > 0).length; }
    rank(lv) { let r = 0; C.rankAt.forEach((a, i) => { if (lv >= a && a > 0) r = i; }); return r; }
    // 同事打氣：打輸或第一次過關打太久就 +1 層（攻擊、血量、薪水都加），之後順利過關慢慢退掉
    cheerN() { return this.s.cheer.n || 0; }
    cheerMul() { return 1 + this.cheerN() * D.CHEER.per; }
    addCheer(why, k = 1) {
      const c = this.s.cheer; c.calm = 0;
      if (c.n >= D.CHEER.max) return;
      c.n = Math.min(D.CHEER.max, c.n + k);
      this.emit({ type: 'cheer', n: c.n, why, mul: this.cheerMul() });
      this.refreshHp();
    }
    atkMul() { return (1 + this.officeBonus('coffee') + this.tSum('atk')) * this.cheerMul(); }
    hpMul() { return (1 + this.officeBonus('chair') + this.tSum('hp')) * this.cheerMul(); }
    goldMul() {
      let m = 1 + this.officeBonus('bonus') + (this.s.heroes.vivi > 0 ? 0.25 : 0) + this.tSum('gold');
      if (this.s.stage >= 50) m += this.tSum('ot');
      return m * (1 + this.cheerN() * D.CHEER.gold);
    }
    aspdBase() { return 1 + this.officeBonus('keyboard') + this.tSum('aspd'); }
    chargeMul() { return 1 + this.officeBonus('drink') + this.tSum('charge'); }
    viviMul() { return 1 + 0.8 * (1 + this.tSum('viviBuff')); }
    bossTime() { return C.bossTime + this.tSum('time'); }
    buffMul(k) { return this.buffs[k].t > 0 ? this.buffs[k].mul : 1; }
    // 戰鬥中暫時的攻擊倍率（畫大餅、外送）
    fightAtkMul() { return (this.buffT > 0 ? this.viviMul() : 1) * this.buffMul('atk'); }
    // 前輩帶新人：等級比全隊最高低的員工，能力用「自己 + (最高 - 自己) × mentor」的等級計算（升職仍看自己的等級）
    topLv() { return Math.max(...D.ORDER.map(id => this.s.heroes[id])); }
    effLv(id) { const lv = this.s.heroes[id], top = this.topLv(); return lv + Math.max(0, top - lv) * C.mentor; }
    heroAtk(id) {
      const lv = this.s.heroes[id], def = D.HEROES.find(h => h.id === id);
      const own = id === 'kui' ? this.tSum('kuiAtk') : id === 'jie' ? this.tSum('jieAtk') : 0;
      return C.heroAtk(def.atk, this.effLv(id)) * Math.pow(C.rankMul, this.rank(lv)) * this.atkMul() * (1 + own);
    }
    heroHp(id) {
      const lv = this.s.heroes[id], def = D.HEROES.find(h => h.id === id);
      return C.heroHp(def.hp, this.effLv(id)) * Math.pow(C.rankMul, this.rank(lv)) * this.hpMul() * (1 + (id === 'mi' ? this.tSum('miHp') : 0));
    }
    heroCost(id, n = 1) {
      const def = D.HEROES.find(h => h.id === id); let lv = this.s.heroes[id], c = 0;
      for (let i = 0; i < n; i++) c += C.heroCost(def.cost, lv + i);
      return c;
    }
    maxAffordable(costFn) { let n = 0, c = 0; while (n < 200) { const k = costFn(n + 1); if (k > this.s.gold) break; n++; c = k; } return [n, c]; }
    officeCost(o) { return Math.ceil(o.base * Math.pow(o.grow, this.office(o.id))); }
    tapDmg() { return C.tapDmg(this.s.tapLv) * this.atkMul() * (1 + this.tSum('tap')); }
    comboMul() { return Math.min(D.COMBO.max, 1 + Math.max(0, this.combo - 1) * D.COMBO.per); }
    teamDps() {
      return this.heroes.filter(h => this.s.heroes[h.id] > 0).reduce((a, h) => a + this.heroAtk(h.id) * h.def.aspd * (h.id === 'jie' ? 1 + (0.25 + this.tSum('crit')) * 1.5 : h.id === 'kui' ? 1.3 : 1), 0) * this.aspdBase();
    }

    // ---------- 購買 ----------
    buyHero(id, n = 1) {
      const c = this.heroCost(id, n);
      if (this.s.heroes[id] < 1 || c > this.s.gold) return false;
      const r0 = this.rank(this.s.heroes[id]);
      this.s.gold -= c; this.s.heroes[id] += n;
      this.refreshHp();
      const r1 = this.rank(this.s.heroes[id]);
      this.emit({ type: 'levelup', id, rankUp: r1 > r0 ? r1 : 0 });
      return true;
    }
    buyOffice(id) {
      const o = D.OFFICE.find(x => x.id === id), c = this.officeCost(o);
      if (c > this.s.gold || this.office(id) >= o.max || chapterOf(this.s.maxStage) < o.unlock) return false;
      this.s.gold -= c; this.s.office[id] = this.office(id) + 1;
      this.refreshHp();
      this.emit({ type: 'buy' }); return true;
    }
    buyTap() { const c = C.tapCost(this.s.tapLv); if (c > this.s.gold) return false; this.s.gold -= c; this.s.tapLv++; this.emit({ type: 'buy' }); return true; }
    refreshHp() { this.heroes.forEach(h => { if (this.s.heroes[h.id] > 0) { const old = h.max; h.max = this.heroHp(h.id); if (!h.dead) h.hp += h.max - old; } }); }

    // 最划算的升級：各項花費乘上權重後挑最便宜的（升級均勻分散最有效率）
    // opts.office = false 不考慮辦公室；opts.tapW 點擊升級的權重（不太點的人調高）
    bestBuy(opts = {}) {
      const c = [];
      for (const id of D.ORDER) {
        const lv = this.s.heroes[id]; if (lv < 1) continue;
        const toRank = C.rankAt.find(a => a > lv), near = toRank && toRank - lv <= 2;
        c.push({ kind: 'hero', id, cost: this.heroCost(id), w: (id === 'mi' ? 0.9 : 1) * (near ? 0.6 : 1), fn: () => this.buyHero(id) });
      }
      if (opts.office !== false) for (const o of D.OFFICE) {
        if (chapterOf(this.s.maxStage) >= o.unlock && this.office(o.id) < o.max) c.push({ kind: 'office', id: o.id, cost: this.officeCost(o), w: 1.2, fn: () => this.buyOffice(o.id) });
      }
      if (opts.tap !== false) c.push({ kind: 'tap', id: 'tap', cost: C.tapCost(this.s.tapLv), w: opts.tapW || 1.5, fn: () => this.buyTap() });
      c.sort((a, b) => a.cost * a.w - b.cost * b.w);
      return c[0] || null;
    }
    // 買一次最划算的升級；買不起回傳 false（ui「一鍵升級」用）
    buyBest(opts) {
      const b = this.bestBuy(opts);
      if (!b || b.cost > this.s.gold || !b.fn()) return false;
      return { kind: b.kind, id: b.id };
    }

    // ---------- 任務 ----------
    questProg(q) {
      const s = this.s;
      switch (q.type) {
        case 'kills': return [s.stats.kills, q.n];
        case 'lv': return [s.heroes[q.hero], q.n];
        case 'ults': return [s.stats.ults, q.n];
        case 'taps': return [s.stats.taps, q.n];
        case 'bonus': return [s.stats.bonus || 0, q.n];
        case 'office': return [Object.values(s.office).reduce((a, b) => a + b, 0), q.n];
        case 'stage': return [Math.min(s.maxStage, q.n), q.n];
        case 'rank': return [D.ORDER.filter(id => this.rank(s.heroes[id]) >= 1).length, q.n];
        case 'rank2': return [D.ORDER.filter(id => this.rank(s.heroes[id]) >= 2).length, q.n];
        case 'lvsum': return [D.ORDER.reduce((a, id) => a + s.heroes[id], 0), q.n];
        case 'chests': return [s.stats.chests || 0, q.n];
        case 'treasures': return [this.treasureCount(), q.n];
        case 'sets': return [this.setsDone().length, q.n];
      }
      return [0, 1];
    }
    questDone(q) { const [c, n] = this.questProg(q); return c >= n; }
    claimQuest(id) {
      const q = D.QUESTS.find(x => x.id === id);
      if (!q || this.s.quests[id] || !this.questDone(q)) return false;
      this.s.quests[id] = 1; this.s.gold += q.gold;
      this.emit({ type: 'quest', q, gold: q.gold });
      return true;
    }

    // ---------- 關卡 ----------
    checkJoin(silent) {
      D.HEROES.forEach(hd => {
        if (hd.joinAt && this.s.maxStage >= hd.joinAt && this.s.heroes[hd.id] === 0) {
          this.s.heroes[hd.id] = 1;
          if (!silent) { this.emit({ type: 'join', id: hd.id }); this.say(this.heroes.find(h => h.id === hd.id), pick(hd.talk.start), 1.2, true); }
        }
      });
    }
    startStage() {
      const s = this.s.stage;
      this.wave = 0; this.waveCount = isBoss(s) ? 1 : (s >= 20 ? 4 : 3);
      this.enemies = []; this.shots = []; this.spawnQ = [];
      this.phase = 'walk'; this.phaseT = 0.9;
      this.bossT = 0; this.buffT = 0; this.stageT = 0;
      this.heroes.forEach(h => {
        const on = this.s.heroes[h.id] > 0;
        h.on = on; h.x = h.def.x; h.dead = !on; h.max = on ? this.heroHp(h.id) : 1; h.hp = h.max; h.shield = 0; h.cd = 0.3 + Math.random() * 0.4; h.readyT = 0;
      });
      this.emit({ type: 'stage', s });
    }
    makeEnemy(k, s, hpScale, x, slot) {
      const t = D.ENEMIES[k];
      const hp = (s >= 50 ? C.enemyHp(s) * Math.pow(1.02, s - 50) : C.enemyHp(s)) * t.hp * hpScale;
      return {
        k, t, boss: !!t.boss, hp, max: hp, atk: C.enemyAtk(s) * t.atk, shield: 0, shieldMax: 0,
        x, y: GROUND, slot, cd: 0.8 + Math.random() * 0.6, stun: 0, dead: false, uid: Math.random()
      };
    }
    spawnWave() {
      const s = this.s.stage, ch = s >= 50 ? null : D.CHAPTERS[chapterOf(s)];
      const pool = ch ? ch.pool : Object.keys(D.ENEMIES).filter(k => !D.ENEMIES[k].boss);
      const list = [];
      if (isBoss(s)) {
        const bossId = ch ? ch.boss : ['b_client', 'b_meeting', 'b_report', 'b_final', 'b_vivi'][Math.floor((s - 50) / 10) % 5];
        list.push(bossId, pool[0], pool[1]);
      } else {
        const n = [3, 3, 4, 4][this.wave] + (s >= 10 ? 1 : 0) + (s >= 30 ? 1 : 0);
        for (let i = 0; i < n; i++) list.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      const eliteI = !isBoss(s) && s >= D.ELITE.from && Math.random() < D.ELITE.chance ? Math.floor(Math.random() * list.length) : -1;
      list.forEach((k, i) => {
        const e = this.makeEnemy(k, s, i === eliteI ? D.ELITE.hp : 1, ENEMY_X0 + (D.ENEMIES[k].boss ? 30 : 0) + i * 34 + Math.random() * 16, i);
        if (e.boss) { e.skillI = 0; e.castT = D.BOSS_SKILL.first; e.cast = null; e.phase = 1; }
        if (i === eliteI) { e.elite = true; e.atk *= D.ELITE.atk; }
        this.enemies.push(e);
      });
      if (isBoss(s)) this.bossT = this.bossTime();
      this.phase = 'fight';
      this.emit({ type: 'wave', wave: this.wave, boss: isBoss(s) });
      // 碎碎念：頭目登場一定講；一般關卡開打偶爾講
      const boss = this.enemies.find(e => e.boss);
      if (boss) {
        if (boss.t.appear) this.say(boss, pick(boss.t.appear), 0.6, true);
        const h = this.randHero(); if (h) this.say(h, pick(h.def.talk.boss), 2.4, true);
      } else if (this.wave === 0 && Math.random() < 0.3) { const h = this.randHero(); if (h) this.say(h, pick(h.def.talk.start)); }
    }
    alive() { return this.enemies.filter(e => !e.dead); }
    target() { let t = null; for (const e of this.enemies) if (!e.dead && e.x < 490 && (!t || e.x < t.x)) t = e; return t; }
    frontHero() {
      const mi = this.heroes[0]; if (mi.on && !mi.dead) return mi;
      return this.heroes.find(h => h.on && !h.dead);
    }
    randHero(not) { const a = this.heroes.filter(h => h.on && !h.dead && h !== not); return a.length ? pick(a) : null; }

    // src：'tap'、英雄 id、'splash'、'jie-ult'、'kui-ult'
    damage(e, dmg, src, crit, extra) {
      if (e.dead) return;
      if (e.boss) dmg *= 1 + this.tSum('boss');
      let absorbed = 0;
      if (e.shield > 0) {
        // 護盾：點擊 ×3、大招全額，一般攻擊只削 30%；打破後剩下的傷害才扣血
        const eff = src === 'tap' ? 3 : (src === 'jie-ult' || src === 'kui-ult') ? 1 : 0.3;
        absorbed = Math.min(e.shield, dmg * eff);
        e.shield -= absorbed;
        dmg = Math.max(0, dmg - absorbed / eff);
        if (e.shield <= 0.5) { e.shield = 0; this.emit({ type: 'shieldBreak', e }); const h = this.randHero(); if (h && Math.random() < 0.6) this.say(h, pick(['破了！', '甲方妥協了！', '這次不改了！']), 0.3); }
      }
      e.hp -= dmg;
      const ev = { type: 'hit', e, dmg: dmg + absorbed, crit, src };
      if (absorbed) ev.shield = absorbed;
      if (extra) Object.assign(ev, extra);
      this.emit(ev);
      if (e.boss && e.phase === 1 && e.hp > 0 && e.hp <= e.max * 0.5 && e.t.skills2) this.bossPhase(e);
      if (e.hp <= 0) {
        e.dead = true; e.cast = null;
        const g = Math.ceil(C.gold(this.s.stage) * (e.boss ? 12 : e.elite ? D.ELITE.gold : e.minion ? 0.5 : 1) * this.goldMul() * this.buffMul('gold'));
        this.s.gold += g; this.s.stats.kills++;
        this.emit({ type: 'kill', e, gold: g });
        this.rollChest(e);
      }
    }
    // 頭目血量剩一半：變身，換第二套招式、攻擊變強、很快放招
    bossPhase(e) {
      e.phase = 2; e.atk *= 1.3; e.skillI = 0;
      if (!e.cast) e.castT = Math.min(e.castT, 1.2);
      this.emit({ type: 'bossPhase', e });
      if (e.t.phase2) this.say(e, e.t.phase2, 0, true);
      const h = this.randHero(); if (h) this.say(h, pick(['它變身了！', '小心，要來真的了！', '血剩一半，再加把勁！', '這才是本體嗎……']), 1.6, true);
    }

    // ---------- 寶箱與寶物 ----------
    rollChest(e) {
      let kind = null, n = 1;
      if (e.boss) { kind = 'gold'; n = D.CHEST.boss; }
      else if (!e.minion) {
        const p = (e.elite ? D.CHEST.elite : D.CHEST.drop) * (1 + this.tSum('drop'));
        if (Math.random() < p) kind = e.elite && Math.random() < 0.25 ? 'gold' : 'wood';
      }
      if (!kind) return;
      this.s.chests[kind] = (this.s.chests[kind] || 0) + n;
      this.emit({ type: 'chest', e, kind, n });
    }
    chestCount() { return (this.s.chests.wood || 0) + (this.s.chests.gold || 0); }
    // 拿到一件寶物：新的、升星，或滿星換薪水
    grant(id, src) {
      const t = D.TREASURES.find(x => x.id === id); if (!t) return null;
      const T = this.s.treasures, st = T[id] || 0;
      const r = { type: 'treasure', t, src, isNew: !st, star: st, gold: 0 };
      if (st >= D.CHEST.maxStar) { r.gold = Math.ceil(C.gold(Math.min(this.s.maxStage, 60)) * 25 * (t.rar + 1)); this.s.gold += r.gold; r.maxed = true; }
      else { T[id] = st + 1; r.star = st + 1; this._tsVer = (this._tsVer || 0) + 1; this.refreshHp(); }
      if (r.isNew) { const done = this.setsDone().find(set => set.items.includes(id)); if (done) r.setDone = done; }
      this.emit(r);
      return r;
    }
    // 開一個寶箱（kind 不給就先開金箱）
    openChest(kind) {
      const c = this.s.chests;
      kind = kind || (c.gold > 0 ? 'gold' : 'wood');
      if (!(c[kind] > 0)) return null;
      c[kind]--; this.s.stats.chests = (this.s.stats.chests || 0) + 1;
      const w = D.CHEST.kinds[kind].w, tot = w.reduce((a, b) => a + b, 0);
      let x = Math.random() * tot, rar = 0;
      for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) { rar = i; break; } }
      const pool = D.TREASURES.filter(t => t.rar === rar);
      const open = pool.filter(t => (this.s.treasures[t.id] || 0) < D.CHEST.maxStar);   // 先給還沒滿星的
      return this.grant(pick(open.length ? open : pool).id, kind);
    }

    heroAttack(h) {
      const t = this.target(); if (!t) return;
      let dmg = this.heroAtk(h.id) * this.fightAtkMul(), crit = false;
      if (h.id === 'jie' && Math.random() < 0.25 + this.tSum('crit')) { dmg *= 2.5; crit = true; }
      this.shots.push({ h, t, x: h.x + 24, y: GROUND - 46, tx: t.x, ty: t.y - 40, life: 0, dur: 0.28, dmg, crit, kind: h.def.shot });
      this.emit({ type: 'shoot', h });
      h.energy = Math.min(100, h.energy + 12 * this.chargeMul());
    }

    canUlt(h) { return h.on && !h.dead && h.energy >= 100 && this.phase === 'fight' && this.alive().length > 0; }
    ult(id, auto) {
      const h = this.heroes.find(x => x.id === id);
      if (!this.canUlt(h)) return false;
      h.energy = 0; h.readyT = 0; this.s.stats.ults++;
      const atk = this.heroAtk(id) * this.fightAtkMul();
      this.emit({ type: 'ult', h, auto: !!auto });
      if (Math.random() < 0.3) this.say(h, pick(h.def.talk.ult), 0.2);
      if (id === 'mi') {
        const sh = h.max * 0.4 * (1 + this.tSum('miShield'));
        this.heroes.forEach(x => { if (x.on && !x.dead) x.shield = Math.max(x.shield, sh); });
        this.alive().forEach(e => e.stun = e.boss ? 1 : 2.5); // 頭目只暈 1 秒，而且照樣放技能
      } else if (id === 'jie') {
        const t = this.alive().sort((a, b) => b.hp + b.shield - a.hp - a.shield)[0];
        if (t) this.damage(t, atk * 15, 'jie-ult', true);
      } else if (id === 'kui') {
        this.alive().forEach(e => this.damage(e, atk * 4.5, 'kui-ult', false));
      } else if (id === 'vivi') {
        this.buffT = 8;
        const g = Math.ceil(C.gold(this.s.stage) * 5 * this.goldMul());
        this.s.gold += g; this.emit({ type: 'goldrain', gold: g });
      }
      return true;
    }

    // 點擊：先看有沒有點到外送，再打敵人（點到的那隻，沒點到就打最前面的）
    tap(wx, wy) {
      const hasXY = typeof wx === 'number' && typeof wy === 'number';
      if (hasXY) {
        const r = D.BONUS.r;
        const b = this.bonuses.find(b => !b.gone && (b.x - wx) ** 2 + (b.y - wy) ** 2 < r * r);
        if (b) return { kind: 'bonus', b: this.collectBonus(b) };
      }
      if (this.phase !== 'fight') return null;
      let t = null;
      if (hasXY) {
        let best = 1e9;
        for (const e of this.enemies) {
          if (e.dead || e.x > 490) continue;
          const half = e.boss ? 56 : 36, top = e.boss ? 150 : 90;
          if (Math.abs(e.x - wx) < half && wy > e.y - top && wy < e.y + 16) { const d = Math.abs(e.x - wx); if (d < best) { best = d; t = e; } }
        }
      }
      t = t || this.target() || this.alive()[0];
      if (!t) return null;
      this.s.stats.taps++;
      this.combo = this.comboT > 0 ? this.combo + 1 : 1;
      this.comboT = D.COMBO.window;
      this.damage(t, this.tapDmg() * this.comboMul() * this.buffMul('atk'), 'tap', false, { combo: this.combo });
      return { kind: 'hit', e: t };
    }

    // ---------- 外送驚喜 ----------
    spawnBonus() {
      const ks = Object.keys(D.BONUS.kinds), tot = ks.reduce((a, k) => a + D.BONUS.kinds[k].w, 0);
      let r = Math.random() * tot, kind = ks[0];
      for (const k of ks) { r -= D.BONUS.kinds[k].w; if (r <= 0) { kind = k; break; } }
      // 第一次一定是便當（最好懂：一大筆薪水）
      if (!this.s.stats.bonus && !this.bonuses.length) kind = 'bento';
      const b = { uid: Math.random(), kind, x: 520, y: 30, t: 0, life: D.BONUS.life, tx: rand(170, 380), ty: rand(70, 140), gone: false };
      this.bonuses.push(b);
      this.emit({ type: 'bonusSpawn', b });
    }
    moveBonus(b, dt) {
      b.t += dt;
      const k = Math.min(1, b.t / 0.7), ease = 1 - (1 - k) * (1 - k);
      b.x = 520 + (b.tx - 520) * ease - Math.max(0, b.t - 0.7) * 6;
      b.y = 30 + (b.ty - 30) * ease + Math.sin(b.t * 3.2) * 6;
    }
    collectBonus(b) {
      const kd = D.BONUS.kinds[b.kind];
      b.gone = true; this.bonuses = this.bonuses.filter(x => x !== b);
      const gold = Math.ceil(C.gold(this.s.stage) * kd.gold * this.goldMul() * (1 + this.tSum('bonus')));
      this.s.gold += gold; this.s.stats.bonus = (this.s.stats.bonus || 0) + 1;
      const buff = kd.buff ? Object.assign({}, kd.buff) : null;
      if (buff) { const cur = this.buffs[buff.kind]; cur.mul = buff.mul; cur.t = Math.max(cur.t, buff.dur); }
      this.emit({ type: 'bonus', b, gold, buff });
      if (Math.random() < 0.6) { const h = this.randHero(); if (h) this.say(h, pick(h.def.talk.bonus), 0.3); }
      return b;
    }

    // ---------- 碎碎念 ----------
    // delay 秒後說；force 不管間隔一定說（頭目登場、加入）
    say(who, text, delay = 0, force = false) {
      if (!who || !text) return;
      if (!force && (this.talkT > 0 || this.sayQ.length)) return;
      this.sayQ.push({ who, text, t: delay });
      this.sayQ.sort((a, b) => a.t - b.t);
      this.talkT = D.TALK.gap;
    }
    updateTalk(dt) {
      this.talkT -= dt; this.quietT += dt;
      for (const q of this.sayQ) q.t -= dt;
      while (this.sayQ.length && this.sayQ[0].t <= 0) {
        const q = this.sayQ.shift();
        if (q.who.dead && !q.who.def) continue; // 敵人死了就不說
        this.emit({ type: 'say', who: q.who, text: q.text });
        this.quietT = 0;
      }
      if (this.phase === 'fight' && this.quietT > D.TALK.idle && this.talkT <= 0) {
        this.quietT = 0;
        const h = this.randHero(); if (h && Math.random() < 0.7) this.say(h, pick(h.def.talk.idle));
      }
    }

    // ---------- 頭目技能 ----------
    updateBoss(e, dt) {
      const sk = e.phase === 2 && e.t.skills2 ? e.t.skills2 : e.t.skills; if (!sk || !sk.length) return false;
      if (e.shield > 0 && (e.shieldT -= dt) <= 0) { e.shield = 0; this.emit({ type: 'shieldBreak', e, timeout: true }); }
      if (e.cast) {
        e.cast.t -= dt;
        if (e.cast.t <= 0) { const skill = e.cast.skill; e.cast = null; this.bossHit(e, skill); e.castT = D.BOSS_SKILL.every * (e.phase === 2 ? 0.75 : 1); }
        return true; // 施法中不普攻
      }
      e.castT -= dt;
      if (e.castT <= 0) {
        const skill = sk[e.skillI++ % sk.length];
        e.cast = { skill, t: skill.delay };
        this.emit({ type: 'bossCast', e, skill });
        if (skill.line) this.say(e, skill.line, 0, true);
        return true;
      }
      return false;
    }
    bossHit(e, skill) {
      this.emit({ type: 'bossHit', e, skill });
      if (skill.kind === 'aoe') {
        for (const h of this.heroes) if (h.on && !h.dead) this.hurtHero(h, Math.max(e.atk * skill.power, h.max * (skill.pct || 0)), e);
      } else if (skill.kind === 'shield') {
        e.shieldMax = e.max * skill.power; e.shield = e.shieldMax; e.shieldT = skill.dur || 7;
      } else if (skill.kind === 'summon') {
        const s = this.s.stage;
        const pool = s < 50 ? D.CHAPTERS[chapterOf(s)].pool : [skill.minion];
        for (let i = 0; i < (skill.n || 3); i++) {
          const m = this.makeEnemy(skill.minion || pick(pool), s, skill.power || 0.5, e.x - 6 + i * 4, i);
          m.minion = true; m.cd = 1.2 + i * 0.3;
          this.spawnQ.push(m);
        }
      }
    }

    // 公司福利：第一次通過關卡，公司幫每個已解鎖的辦公室設備免費升 n 級（不影響購買價格）
    givePerk(s) {
      if (s >= 50) return;
      const ids = D.OFFICE.filter(o => chapterOf(this.s.maxStage) >= o.unlock).map(o => o.id);
      if (!ids.length) return;
      ids.forEach(id => { this.s.perk[id] = this.perk(id) + D.PERK.n; });
      this.refreshHp();
      this.emit({ type: 'perk', ids, n: D.PERK.n });
    }

    challengeBoss() {
      if (!this.s.farming) return;
      this.s.farming = false; this.s.stage = this.s.maxStage; this.startStage();
    }

    stageCleared() {
      const s = this.s.stage;
      this.emit({ type: 'clear', s, boss: isBoss(s) });
      if (isBoss(s)) {
        // 頭目專屬神器：主線第一次打倒取得；加班模式第一次打倒輪回來的頭目時升星
        const bossId = s < 50 ? D.CHAPTERS[chapterOf(s)].boss : ['b_client', 'b_meeting', 'b_report', 'b_final', 'b_vivi'][Math.floor((s - 50) / 10) % 5];
        const art = D.TREASURES.find(t => t.boss === bossId);
        if (art && s === this.s.maxStage && (s >= 50 || !this.s.treasures[art.id])) this.grant(art.id, 'boss');
      }
      if (s === this.s.maxStage) {
        this.s.maxStage++;
        const c = this.s.cheer;
        this.givePerk(s);
        if (this.stageT > D.CHEER.slow && s < 50) this.addCheer('slow');
        else if (c.n > 0 && ++c.calm >= D.CHEER.calm) { c.calm = 0; c.n--; this.emit({ type: 'cheer', n: c.n, why: 'calm', mul: this.cheerMul() }); }
        if (s === 49) { this.s.cleared = true; this.emit({ type: 'ending' }); }
        if (this.s.maxStage === 10 && !this.s.autoUlt) this.s.autoUlt = true; // 打贏 Vivi 解鎖自動大招，預設打開
      }
      this.checkJoin(false);
      if (this.s.farming) {
        this.farmClears = (this.farmClears || 0) + 1;
        if (this.s.autoBoss && this.farmClears >= 2) { this.farmClears = 0; this.s.farming = false; this.s.stage = this.s.maxStage; }
      } else this.s.stage = this.s.maxStage;
      this.startStage();
    }
    stageFailed(reason) {
      const ms = this.s.maxStage;
      const b = this.enemies.find(e => e.boss && !e.dead);
      this.emit({ type: 'fail', s: this.s.stage, reason, left: b ? Math.max(0, b.hp / b.max) : null }); // left：頭目剩幾成血
      this.addCheer('fail', D.CHEER.fail);
      this.s.farming = true; this.farmClears = 0;
      this.s.stage = Math.max(0, this.s.maxStage - 1);
      this.startStage();
      const h = this.randHero();
      if (h) this.say(h, pick(['沒關係，我們先去練功！', '下次一定可以！', '先回去喝杯咖啡再來', '大家打起精神！']), 1, true);
    }

    // ---------- 主迴圈 ----------
    update(dt) {
      this.s.stats.play += dt;
      // 不分階段都會跑的計時：外送、增益、連擊、碎碎念、自動升級
      for (const k in this.buffs) if (this.buffs[k].t > 0) this.buffs[k].t -= dt;
      if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
      for (const b of this.bonuses) {
        this.moveBonus(b, dt);
        if (b.t >= b.life) { b.gone = true; this.emit({ type: 'bonusGone', b }); }
      }
      if (this.bonuses.length) this.bonuses = this.bonuses.filter(b => !b.gone);
      this.bonusT -= dt;
      if (this.bonusT <= 0) {
        if (this.phase === 'fight' && !this.bonuses.length) { this.spawnBonus(); this.bonusT = rand(...D.BONUS.every); }
        else this.bonusT = 1;
      }
      this.updateTalk(dt);
      this.autoT += dt;
      if (this.autoT >= 1) {
        this.autoT = 0;
        if (this.s.autoBuy && this.s.maxStage >= D.AUTOBUY_AT) {
          for (let i = 0; i < 10; i++) if (!this.buyBest({ tapW: 3 })) break;
          if (this.chestCount() && this.phase === 'fight') { const r = this.openChest(); if (r) r.auto = true; }
        }
      }

      if (this.phase === 'walk') {
        this.phaseT -= dt;
        if (this.phaseT <= 0) this.spawnWave();
        return;
      }
      if (this.phase !== 'fight') return;
      this.stageT += dt;
      if (this.buffT > 0) this.buffT -= dt;
      const aspdMul = this.aspdBase() * (this.buffT > 0 ? 1.4 : 1) * this.buffMul('aspd');

      // 英雄
      for (const h of this.heroes) {
        if (!h.on || h.dead) continue;
        h.cd -= dt * aspdMul;
        if (h.cd <= 0 && this.target()) { this.heroAttack(h); h.cd = 1 / h.def.aspd; }
        if (this.canUlt(h)) {
          h.readyT += dt;
          if (this.s.autoUlt || h.readyT >= D.ULT_WAIT) this.ult(h.id, true);
        } else h.readyT = 0;
      }
      // 飛行物
      for (const p of this.shots) {
        p.life += dt;
        if (p.life >= p.dur && !p.done) {
          p.done = true;
          if (!p.t.dead) this.damage(p.t, p.dmg, p.h.id, p.crit);
          if (p.kind === 'paint') this.alive().filter(e => e !== p.t && Math.abs(e.x - p.t.x) < 60).forEach(e => this.damage(e, p.dmg * 0.4, 'splash', false));
        }
      }
      this.shots = this.shots.filter(p => !p.done);

      // 敵人
      const front = this.frontHero();
      let slotN = 0;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (e.stun > 0) { e.stun -= dt; if (e.boss) this.updateBoss(e, dt); continue; }
        const stopX = (front ? front.x : 200) + 58 + slotN * 34 + (e.boss ? 56 : 0);
        slotN++;
        if (e.x > stopX) { e.x = Math.max(stopX, e.x - e.t.spd * dt * 2.6); e.walking = true; }
        else e.walking = false;
        if (e.boss && this.updateBoss(e, dt)) continue;
        if (e.walking) continue;
        e.cd -= dt;
        if (e.cd <= 0 && front) {
          e.cd = e.boss ? 1.3 : 1.5;
          this.hurtHero(front, e.atk, e);
        }
      }
      // 召喚的小怪放在頭目前面，先被打到
      if (this.spawnQ.length) { this.enemies.unshift(...this.spawnQ); this.spawnQ.length = 0; }
      if (this.bossT > 0) {
        this.bossT -= dt;
        if (this.bossT <= 0) return this.stageFailed('time');
      }
      if (!this.heroes.some(h => h.on && !h.dead)) return this.stageFailed('dead');
      if (this.alive().length === 0) {
        this.wave++;
        if (this.wave >= this.waveCount) return this.stageCleared();
        this.heroes.forEach(h => { if (h.on && !h.dead) h.hp = Math.min(h.max, h.hp + h.max * 0.3); });
        this.phase = 'walk'; this.phaseT = 0.8; this.shots = [];
      }
    }
    hurtHero(h, dmg, e) {
      if (h.shield > 0) { const a = Math.min(h.shield, dmg); h.shield -= a; dmg -= a; }
      h.hp -= dmg;
      if (h.id === 'mi') h.energy = Math.min(100, h.energy + 4 * this.chargeMul());
      this.emit({ type: 'hurt', h, dmg, e });
      if (h.hp <= 0) {
        h.hp = 0; h.dead = true; this.emit({ type: 'down', h });
        if (Math.random() < 0.7) this.say(h, pick(h.def.talk.down), 0.1, true);
      }
    }
  }

  G.Engine = { Game, newSave, fixSave, stageName, chapterOf, isBoss, GROUND };
})(typeof window !== 'undefined' ? window : globalThis);
