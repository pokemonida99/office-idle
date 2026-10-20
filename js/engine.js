// 戰鬥與成長邏輯（不碰 DOM，sim.js 也直接用這支）
(function (G) {
  const D = G.DATA, C = D.CURVE;
  const GROUND = 250, ENEMY_X0 = 470;

  function newSave() {
    return {
      v: 1, stage: 0, maxStage: 0, gold: 0, farming: false, autoUlt: false, autoBoss: true,
      heroes: { mi: 1, kui: 1, jie: 0, vivi: 0 }, office: {}, tapLv: 1, loot: [],
      stats: { kills: 0, ults: 0, taps: 0, play: 0 }, quests: {}, seen: {}, cleared: false
    };
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
      this.s = save || newSave();
      this.events = [];
      this.heroes = D.ORDER.map(id => ({ id, def: D.HEROES.find(h => h.id === id), hp: 0, max: 1, cd: 0.4, energy: 0, shield: 0, dead: false, x: 0 }));
      this.buffT = 0;
      this.startStage();
    }
    emit(e) { this.events.push(e); }

    // ---------- 加成 ----------
    office(id) { return this.s.office[id] || 0; }
    lootSum(k) { return this.s.loot.reduce((a, id) => a + (D.LOOT.find(l => l.id === id)[k] || 0), 0); }
    rank(lv) { let r = 0; C.rankAt.forEach((a, i) => { if (lv >= a && a > 0) r = i; }); return r; }
    atkMul() { return 1 + this.office('coffee') * 0.12 + this.lootSum('atk'); }
    hpMul() { return 1 + this.office('chair') * 0.15 + this.lootSum('hp'); }
    goldMul() {
      let m = 1 + this.office('bonus') * 0.15 + (this.s.heroes.vivi > 0 ? 0.25 : 0);
      m += this.s.loot.filter(id => id !== 'badge').reduce((a, id) => a + (D.LOOT.find(l => l.id === id).gold || 0), 0);
      if (this.s.stage >= 50 && this.s.loot.includes('badge')) m += 0.5;
      return m;
    }
    heroAtk(id) {
      const lv = this.s.heroes[id], def = D.HEROES.find(h => h.id === id);
      return C.heroAtk(def.atk, lv) * Math.pow(C.rankMul, this.rank(lv)) * this.atkMul();
    }
    heroHp(id) {
      const lv = this.s.heroes[id], def = D.HEROES.find(h => h.id === id);
      return C.heroHp(def.hp, lv) * Math.pow(C.rankMul, this.rank(lv)) * this.hpMul();
    }
    heroCost(id, n = 1) {
      const def = D.HEROES.find(h => h.id === id); let lv = this.s.heroes[id], c = 0;
      for (let i = 0; i < n; i++) c += C.heroCost(def.cost, lv + i);
      return c;
    }
    maxAffordable(costFn) { let n = 0, c = 0; while (n < 200) { const k = costFn(n + 1); if (k > this.s.gold) break; n++; c = k; } return [n, c]; }
    officeCost(o) { return Math.ceil(o.base * Math.pow(o.grow, this.office(o.id))); }
    tapDmg() { return C.tapDmg(this.s.tapLv) * this.atkMul(); }
    teamDps() {
      return this.heroes.filter(h => this.s.heroes[h.id] > 0).reduce((a, h) => a + this.heroAtk(h.id) * h.def.aspd * (h.id === 'jie' ? 1.375 : h.id === 'kui' ? 1.3 : 1), 0) * (1 + this.office('keyboard') * 0.05);
    }

    // ---------- 購買 ----------
    buyHero(id, n = 1) {
      const c = this.heroCost(id, n);
      if (this.s.heroes[id] < 1 || c > this.s.gold) return false;
      const r0 = this.rank(this.s.heroes[id]);
      this.s.gold -= c; this.s.heroes[id] += n;
      const h = this.heroes.find(x => x.id === id), old = h.max;
      h.max = this.heroHp(id); if (!h.dead) h.hp += h.max - old;
      const r1 = this.rank(this.s.heroes[id]);
      this.emit({ type: 'levelup', id, rankUp: r1 > r0 ? r1 : 0 });
      return true;
    }
    buyOffice(id) {
      const o = D.OFFICE.find(x => x.id === id), c = this.officeCost(o);
      if (c > this.s.gold || this.office(id) >= o.max || chapterOf(this.s.maxStage) < o.unlock) return false;
      this.s.gold -= c; this.s.office[id] = this.office(id) + 1;
      this.heroes.forEach(h => { if (this.s.heroes[h.id] > 0) { const old = h.max; h.max = this.heroHp(h.id); if (!h.dead) h.hp += h.max - old; } });
      this.emit({ type: 'buy' }); return true;
    }
    buyTap() { const c = C.tapCost(this.s.tapLv); if (c > this.s.gold) return false; this.s.gold -= c; this.s.tapLv++; this.emit({ type: 'buy' }); return true; }

    // ---------- 關卡 ----------
    startStage() {
      const s = this.s.stage;
      this.wave = 0; this.waveCount = isBoss(s) ? 1 : (s >= 20 ? 4 : 3);
      this.enemies = []; this.shots = [];
      this.phase = 'walk'; this.phaseT = 0.9;
      this.bossT = 0; this.buffT = 0;
      this.heroes.forEach(h => {
        const on = this.s.heroes[h.id] > 0;
        h.on = on; h.x = h.def.x; h.dead = !on; h.max = on ? this.heroHp(h.id) : 1; h.hp = h.max; h.shield = 0; h.cd = 0.3 + Math.random() * 0.4;
      });
      this.emit({ type: 'stage', s });
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
      const hpS = s >= 50 ? C.enemyHp(s) * Math.pow(1.02, s - 50) : C.enemyHp(s);
      list.forEach((k, i) => {
        const t = D.ENEMIES[k];
        const hp = hpS * t.hp;
        this.enemies.push({
          k, t, boss: !!t.boss, hp, max: hp, atk: C.enemyAtk(s) * t.atk,
          x: ENEMY_X0 + (t.boss ? 30 : 0) + i * 34 + Math.random() * 16, y: GROUND, slot: i,
          cd: 0.8 + Math.random() * 0.6, stun: 0, dead: false, uid: Math.random()
        });
      });
      if (isBoss(s)) this.bossT = C.bossTime + this.lootSum('time');
      this.phase = 'fight';
      this.emit({ type: 'wave', wave: this.wave, boss: isBoss(s) });
    }
    alive() { return this.enemies.filter(e => !e.dead); }
    target() { let t = null; for (const e of this.enemies) if (!e.dead && e.x < 490 && (!t || e.x < t.x)) t = e; return t; }
    frontHero() {
      const mi = this.heroes[0]; if (mi.on && !mi.dead) return mi;
      return this.heroes.find(h => h.on && !h.dead);
    }

    damage(e, dmg, src, crit) {
      if (e.dead) return;
      e.hp -= dmg;
      this.emit({ type: 'hit', e, dmg, crit, src });
      if (e.hp <= 0) {
        e.dead = true;
        const g = Math.ceil(C.gold(this.s.stage) * (e.boss ? 12 : 1) * this.goldMul());
        this.s.gold += g; this.s.stats.kills++;
        this.emit({ type: 'kill', e, gold: g });
      }
    }

    heroAttack(h) {
      const t = this.target(); if (!t) return;
      let dmg = this.heroAtk(h.id) * (this.buffT > 0 ? 1.8 : 1), crit = false;
      if (h.id === 'jie' && Math.random() < 0.25) { dmg *= 2.5; crit = true; }
      this.shots.push({ h, t, x: h.x + 24, y: GROUND - 46, tx: t.x, ty: t.y - 40, life: 0, dur: 0.28, dmg, crit, kind: h.def.shot });
      this.emit({ type: 'shoot', h });
      h.energy = Math.min(100, h.energy + 12 * (1 + this.office('drink') * 0.1));
    }

    canUlt(h) { return h.on && !h.dead && h.energy >= 100 && this.phase === 'fight' && this.alive().length > 0; }
    ult(id) {
      const h = this.heroes.find(x => x.id === id);
      if (!this.canUlt(h)) return false;
      h.energy = 0; this.s.stats.ults++;
      const atk = this.heroAtk(id) * (this.buffT > 0 ? 1.8 : 1);
      this.emit({ type: 'ult', h });
      if (id === 'mi') {
        this.heroes.forEach(x => { if (x.on && !x.dead) x.shield = Math.max(x.shield, h.max * 0.4); });
        this.alive().forEach(e => e.stun = 2.5);
      } else if (id === 'jie') {
        const t = this.alive().sort((a, b) => b.hp - a.hp)[0];
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

    tap() {
      this.s.stats.taps++;
      const t = this.target() || this.alive()[0];
      if (!t || this.phase !== 'fight') return null;
      this.damage(t, this.tapDmg(), 'tap', false);
      return t;
    }

    challengeBoss() {
      if (!this.s.farming) return;
      this.s.farming = false; this.s.stage = this.s.maxStage; this.startStage();
    }

    stageCleared() {
      const s = this.s.stage;
      this.emit({ type: 'clear', s, boss: isBoss(s) });
      if (isBoss(s) && s < 50) {
        const ch = D.CHAPTERS[chapterOf(s)];
        const loot = D.LOOT.find(l => l.boss === ch.boss);
        if (loot && !this.s.loot.includes(loot.id)) { this.s.loot.push(loot.id); this.emit({ type: 'loot', loot }); }
      }
      if (s === this.s.maxStage) {
        this.s.maxStage++;
        if (s === 49) { this.s.cleared = true; this.emit({ type: 'ending' }); }
      }
      // 新角色加入
      D.HEROES.forEach(hd => { if (hd.joinAt && this.s.maxStage >= hd.joinAt && this.s.heroes[hd.id] === 0) { this.s.heroes[hd.id] = 1; this.emit({ type: 'join', id: hd.id }); } });
      if (this.s.farming) {
        this.farmClears = (this.farmClears || 0) + 1;
        if (this.s.autoBoss && this.farmClears >= 2) { this.farmClears = 0; this.s.farming = false; this.s.stage = this.s.maxStage; }
      } else this.s.stage = this.s.maxStage;
      this.startStage();
    }
    stageFailed(reason) {
      this.emit({ type: 'fail', s: this.s.stage, reason });
      this.s.farming = true; this.farmClears = 0;
      this.s.stage = Math.max(0, this.s.maxStage - 1);
      this.startStage();
    }

    // ---------- 主迴圈 ----------
    update(dt) {
      this.s.stats.play += dt;
      if (this.phase === 'walk') {
        this.phaseT -= dt;
        if (this.phaseT <= 0) this.spawnWave();
        return;
      }
      if (this.phase !== 'fight') return;
      if (this.buffT > 0) this.buffT -= dt;
      const aspdMul = (1 + this.office('keyboard') * 0.05) * (this.buffT > 0 ? 1.4 : 1);

      // 英雄
      for (const h of this.heroes) {
        if (!h.on || h.dead) continue;
        h.cd -= dt * aspdMul;
        if (h.cd <= 0 && this.target()) { this.heroAttack(h); h.cd = 1 / h.def.aspd; }
        if (this.s.autoUlt && this.canUlt(h)) this.ult(h.id);
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
        if (e.stun > 0) { e.stun -= dt; continue; }
        const stopX = (front ? front.x : 200) + 58 + slotN * 34 + (e.boss ? 56 : 0);
        slotN++;
        if (e.x > stopX) { e.x = Math.max(stopX, e.x - e.t.spd * dt * 2.6); e.walking = true; continue; }
        e.walking = false;
        e.cd -= dt;
        if (e.cd <= 0 && front) {
          e.cd = e.boss ? 1.3 : 1.5;
          this.hurtHero(front, e.atk, e);
        }
      }
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
      if (h.id === 'mi') h.energy = Math.min(100, h.energy + 4 * (1 + this.office('drink') * 0.1));
      this.emit({ type: 'hurt', h, dmg, e });
      if (h.hp <= 0) { h.hp = 0; h.dead = true; this.emit({ type: 'down', h }); }
    }
  }

  G.Engine = { Game, newSave, stageName, chapterOf, isBoss, GROUND };
})(typeof window !== 'undefined' ? window : globalThis);
