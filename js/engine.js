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
      stats: { kills: 0, ults: 0, taps: 0, play: 0, bonus: 0, chests: 0, pulls: 0 }, quests: {}, seen: {}, cleared: false,
      cheer: { n: 0, calm: 0 },
      // v1.3 同事收集：team 上場、stars 星數、resume 履歷、pity 保底計數、unlocked 已解鎖的階梯
      team: ['mi', 'kui'], stars: { mi: 1, kui: 1 }, resume: 0, pity: { ssr: 0, ur: 0 }, unlocked: {}
    };
  }
  // 舊存檔（v1）缺的欄位補上預設值
  function fixSave(s) {
    const base = newSave();
    if (!s) return base;
    const out = Object.assign(base, s, {
      heroes: Object.assign(base.heroes, s.heroes), stats: Object.assign(base.stats, s.stats),
      office: s.office || {}, perk: s.perk || {}, loot: s.loot || [], quests: s.quests || {}, seen: s.seen || {},
      cheer: Object.assign(base.cheer, s.cheer), treasures: s.treasures || {}, chests: Object.assign(base.chests, s.chests),
      stars: Object.assign({}, s.stars), pity: Object.assign(base.pity, s.pity), unlocked: Object.assign({}, s.unlocked),
      resume: s.resume || 0
    });
    // v1.1 以前的頭目戰利品 → 同名神器
    for (const id of out.loot) if (D.TREASURES.some(t => t.id === id) && !out.treasures[id]) out.treasures[id] = 1;
    // v1.2 以前：沒有 team → 已加入的原本四人上場；已經過的解鎖不再跳通知
    for (const id in out.heroes) if (out.heroes[id] > 0 && !out.stars[id]) out.stars[id] = 1;
    const team = Array.isArray(s.team) ? s.team : D.ORDER;
    out.team = team.filter((id, i) => out.heroes[id] > 0 && team.indexOf(id) === i);
    if (!out.team.length) out.team = D.ORDER.filter(id => out.heroes[id] > 0);
    if (!Array.isArray(s.team)) for (const u of D.UNLOCKS) if (u.at <= out.maxStage) out.unlocked[u.key] = 1;
    return out;
  }

  const chapterOf = s => Math.min(Math.floor(s / 10), 4);
  const BOSS_ROT = ['b_client', 'b_meeting', 'b_report', 'b_final', 'b_vivi'];   // 加班模式頭目輪替
  const SCARE_MUL = (D.THEME && D.THEME[3] && D.THEME[3].scare) ? D.THEME[3].scare.mul : 1.25;
  const isBoss = s => s % 10 === 9;
  function stageName(s) {
    if (s >= 50) return { day: '加班', title: `加班第 ${s - 49} 關`, code: `OT-${s - 49}` };
    const ch = D.CHAPTERS[chapterOf(s)];
    return { day: ch.day, title: ch.names[s % 10], code: `${chapterOf(s) + 1}-${s % 10 + 1}` };
  }

  class Game {
    constructor(save) {
      if (D.syncRoster) D.syncRoster();
      const old = !!save && !Array.isArray(save.team);
      this.s = fixSave(save);
      this.events = [];
      this.heroes = [];
      this.buffT = 0; this.buffAtk = 1; this.buffAspd = 1;
      this.bonuses = []; this.bonusT = this.s.stats.play < 60 ? D.BONUS.first : rand(...D.BONUS.every);
      this.buffs = { atk: { mul: 1, t: 0 }, aspd: { mul: 1, t: 0 }, gold: { mul: 1, t: 0 } };
      this.combo = 0; this.comboT = 0;
      this.talkT = 3; this.quietT = 0; this.sayQ = [];
      this.autoT = 0;
      this.checkJoin(true);
      this.checkUnlocks(true);
      this.buildTeam();
      // 舊存檔第一次進 v1.3：招募已經開放的話，補發履歷（10 份 + 已過關數）
      if (old && this.s.maxStage >= D.RECRUIT.unlock) {
        this.giveResume(D.RECRUIT.first + Math.min(this.s.maxStage, 50), null, 'gift');
        this.emit({ type: 'unlock', u: D.UNLOCKS.find(u => u.key === 'recruit'), gift: true });
      }
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
    // 能力用的職級：前輩帶新人補完的等級也算（升職事件、造型仍看自己的等級）
    powRank(id) { return this.rank(Math.floor(this.effLv(id) + 1e-6)); }
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
    // 增益職業大招的攻擊加成（Vivi 是畫大餅，吃寶物加成）
    supportBuff(def) { return (def.base || def.id) === 'vivi' ? 0.8 * (1 + this.tSum('viviBuff')) * D.HRAR[def.rar].mul : D.SUPPORT.buff[def.rar]; }
    bossTime() { return C.bossTime + this.tSum('time'); }
    buffMul(k) { return this.buffs[k].t > 0 ? this.buffs[k].mul : 1; }
    // 戰鬥中暫時的攻擊倍率（畫大餅、外送）
    fightAtkMul() { return (this.buffT > 0 ? this.buffAtk : 1) * this.buffMul('atk'); }

    // ---------- 同事 ----------
    heroDef(id) { return D.HERO_BY[id] || null; }
    // 本尊：主題版本（def.base）算同一個人，招牌機制與寶物加成照本尊；同一個人只能一個版本上場
    baseOf(id) { const d = D.HERO_BY[id]; return (d && d.base) || id; }
    sameBase(a, b) { return this.baseOf(a) === this.baseOf(b); }
    // 去掉同一個人的第二個版本（保留先出現的）
    uniqBase(ids) { const seen = {}, out = []; for (const id of ids) { const b = this.baseOf(id); if (!seen[b]) { seen[b] = 1; out.push(id); } } return out; }
    owned(id) { return this.s.heroes[id] > 0; }
    ownedIds() { return Object.keys(this.s.heroes).filter(id => this.s.heroes[id] > 0 && D.HERO_BY[id]); }
    ownedCount() { return this.ownedIds().length; }
    star(id) { return this.s.stars[id] || (this.owned(id) ? 1 : 0); }
    starMul(id) { return 1 + D.RECRUIT.starMul * (Math.max(1, this.star(id)) - 1); }
    // 前輩帶新人：等級比最高等同事低的人，能力用「自己 + (最高 - 自己) × mentor」的等級計算（升職仍看自己的等級）
    topLv() { if (this._top == null) { let m = 1; for (const id in this.s.heroes) if (this.s.heroes[id] > m) m = this.s.heroes[id]; this._top = m; } return this._top; }
    effLv(id) { const lv = Math.max(1, this.s.heroes[id] || 0), top = this.topLv(); return lv + Math.max(0, top - lv) * C.mentor; }
    // 不含隊伍加成（同部門、增益光環）的攻擊；heroAtk 再乘上目前隊伍的加成
    baseAtk(id) {
      const lv = Math.max(1, this.s.heroes[id] || 0), def = this.heroDef(id);
      const b = this.baseOf(id), own = b === 'kui' ? this.tSum('kuiAtk') : b === 'jie' ? this.tSum('jieAtk') : 0;
      return C.heroAtk(def.atk, this.effLv(id)) * Math.pow(C.rankMul, this.powRank(id)) * this.atkMul() * (1 + own) * this.starMul(id);
    }
    heroAtk(id) { return this.baseAtk(id) * this.teamMul(); }
    heroHp(id) {
      const lv = Math.max(1, this.s.heroes[id] || 0), def = this.heroDef(id);
      return C.heroHp(def.hp, this.effLv(id)) * Math.pow(C.rankMul, this.powRank(id)) * this.hpMul() * (1 + (this.baseOf(id) === 'mi' ? this.tSum('miHp') : 0)) * this.starMul(id);
    }
    // 職業對輸出的期望倍率（爆擊、濺射）
    roleDps(def) { return def.role === 'crit' ? 1 + (0.25 + this.tSum('crit')) * 1.5 : def.role === 'aoe' ? 1.3 : 1; }
    heroCost(id, n = 1) {
      const def = this.heroDef(id); if (!def) return Infinity;
      let lv = Math.max(1, this.s.heroes[id] || 0), c = 0; const top = this.topLv();
      // 前輩帶新人：比最高等同事低的等級，升級打折（新同事換上場很快就跟得上）
      for (let i = 0; i < n; i++) c += Math.ceil(C.heroCost(def.cost, lv + i) * (lv + i < top ? C.mentorCost : 1));
      return c;
    }
    maxAffordable(costFn) { let n = 0, c = 0; while (n < 200) { const k = costFn(n + 1); if (k > this.s.gold) break; n++; c = k; } return [n, c]; }
    officeCost(o) { return Math.ceil(o.base * Math.pow(o.grow, this.office(o.id))); }
    tapDmg() { return C.tapDmg(this.s.tapLv) * this.atkMul() * (1 + this.tSum('tap')); }
    comboMul() { return Math.min(D.COMBO.max, 1 + Math.max(0, this.combo - 1) * D.COMBO.per); }
    teamDps() {
      return this.heroes.reduce((a, h) => a + this.heroAtk(h.id) * h.def.aspd * this.roleDps(h.def), 0) * this.aspdBase();
    }

    // ---------- 隊伍 ----------
    teamSize() { let n = 3; for (const t of D.TEAM.slots) if (this.s.maxStage >= t.at) n = t.n; return n; }
    slotOrder(id) { const d = this.heroDef(id), li = D.ORDER.indexOf(this.baseOf(id)); return D.ROLES[d.role].order * 100 + (li >= 0 ? li : 10) * 5 - d.rar; }
    // 依 s.team 重建 game.heroes（還在隊上的人保留血量、充能；新上場的滿血）
    buildTeam() {
      const old = this.heroes || [], size = this.teamSize();
      let ids = this.uniqBase(this.s.team.filter(id => this.owned(id) && this.heroDef(id))).slice(0, size);
      if (!ids.length) ids = D.ORDER.filter(id => this.owned(id)).slice(0, size);   // 名冊沒載到之類的意外：至少原本四人上場
      ids.sort((a, b) => this.slotOrder(a) - this.slotOrder(b));
      this.s.team = ids.slice();
      const X = D.TEAM.x[Math.max(3, Math.min(5, ids.length))];
      this.calcTeam();
      this.heroes = ids.map((id, i) => {
        let h = old.find(o => o.id === id); const fresh = !h;
        if (fresh) h = { id, hp: 0, max: 1, cd: 0.3 + Math.random() * 0.4, energy: 0, shield: 0, dead: false, readyT: 0 };
        h.def = this.heroDef(id); h.slot = i; h.x = X[i]; h.on = true;
        if (fresh) { h.max = this.heroHp(id); h.hp = h.max; }
        return h;
      });
      this.refreshHp();
    }
    teamChanged() { this.buildTeam(); this.emit({ type: 'teamChange', team: this.s.team.slice() }); }
    // 換隊伍：ids 依序取已擁有的人，最多 teamSize() 人；站位自動依職業排
    setTeam(ids) {
      const size = this.teamSize(), out = [];
      for (const id of ids || []) if (this.owned(id) && this.heroDef(id) && !out.some(x => this.sameBase(x, id)) && out.length < size) out.push(id);
      if (!out.length) return false;
      const same = out.length === this.s.team.length && out.every(id => this.s.team.includes(id));
      this.s.team = out.sort((a, b) => this.slotOrder(a) - this.slotOrder(b));
      if (!same) this.teamChanged();
      return true;
    }
    // 同部門 3 人以上上場的加成
    deptBonus(team = this.s.team) {
      if (this.s.maxStage < D.DEPT_BONUS.at) return null;
      const c = {}; let best = null;
      for (const id of team) { const d = this.heroDef(id); if (!d) continue; c[d.dept] = (c[d.dept] || 0) + 1; if (!best || c[d.dept] > c[best]) best = d.dept; }
      const n = best ? c[best] : 0;
      return n >= 3 ? { dept: best, n, add: D.DEPT_BONUS.add[Math.min(5, n)] } : null;
    }
    calcTeam() {
      const db = this.deptBonus();
      let aura = 0;
      for (const id of this.s.team) { const d = this.heroDef(id); if (d && d.role === 'support' && this.baseOf(id) !== 'vivi') aura += D.SUPPORT.aura[d.rar]; }
      this._dept = db; this._teamMul = (1 + (db ? db.add : 0)) * (1 + aura);
    }
    teamMul() { return this._teamMul || 1; }
    // 某關的敵人弱點分布：{ w: { 部門: 比例 }, boss: 頭目弱點或 null }
    stageWeak(s = this.s.stage) {
      const ch = s >= 50 ? null : D.CHAPTERS[chapterOf(s)];
      const pool = ch ? ch.pool : Object.keys(D.ENEMIES).filter(k => !D.ENEMIES[k].boss);
      const w = {}, add = (k, x) => { const d = D.ENEMIES[k].weak; if (d) w[d] = (w[d] || 0) + x; };
      let boss = null;
      if (isBoss(s)) {
        const bid = ch ? ch.boss : BOSS_ROT[Math.floor((s - 50) / 10) % 5];
        boss = D.ENEMIES[bid].weak || null;
        add(bid, 0.75); add(pool[0], 0.125); add(pool[1], 0.125);
      } else pool.forEach(k => add(k, 1 / pool.length));
      return { w, boss };
    }
    // 自動編隊用的單人估值（不含隊伍加成）。potential：當作已經補到最高等級來估（自動升級會幫他補等）
    heroVals(id, wk, potential) {
      const d = this.heroDef(id), weak = 1 + (D.WEAK - 1) * ((wk && wk[d.dept]) || 0);
      const lv0 = this.s.heroes[id], top = this.topLv();
      if (potential && lv0 < top) this.s.heroes[id] = top;
      const atk = this.baseAtk(id), hp = this.heroHp(id);
      this.s.heroes[id] = lv0;
      return {
        id, role: d.role, dept: d.dept, hp,
        off: atk * d.aspd * this.roleDps(d) * weak * (d.role === 'healer' ? 0.6 : 1),
        buff: d.role === 'support' ? this.supportBuff(d) : 0,
        aura: d.role === 'support' && this.baseOf(id) !== 'vivi' ? D.SUPPORT.aura[d.rar] : 0
      };
    }
    // 隊伍估分：輸出 × √(耐打度)；有坦克、治療耐打度加成，增益與同部門加成乘在輸出上
    teamScore(vals) {
      let off = 0, hp = 0, tank = 0, heal = 0, buff = 0, aura = 0; const dc = {};
      for (const v of vals) {
        off += v.off; hp += v.hp; aura += v.aura; buff = Math.max(buff, v.buff);
        if (v.role === 'tank') tank++; if (v.role === 'healer') heal++;
        dc[v.dept] = (dc[v.dept] || 0) + 1;
      }
      const dn = Math.max(0, ...Object.values(dc));
      const dAdd = this.s.maxStage >= D.DEPT_BONUS.at && dn >= 3 ? D.DEPT_BONUS.add[Math.min(5, dn)] : 0;
      off *= (1 + dAdd) * (1 + aura) * (1 + 0.35 * buff);
      const def = hp * (tank ? 1.3 : 0.75) * (heal ? 1.5 : 1);
      return off * Math.sqrt(def);
    }
    teamPower(team = this.s.team) {
      const v = team.filter(id => this.owned(id) && this.heroDef(id)).map(id => this.heroVals(id, null));
      return v.length ? Math.round(this.teamScore(v) / 10) : 0;
    }
    // 自動編隊：照戰力、這關的部門弱點、職業平衡挑人（貪婪挑 + 換人改良）。apply = false 只回傳不換
    // sticky = true（自動升級每關呼叫的那種）：新隊伍要明顯比較強才換；玩家按「自動編隊」不加這個，一定換成最佳
    autoTeam(apply = true, sticky = false) {
      const wk = this.stageWeak(this.s.stage).w;
      const ids = this.ownedIds(), V = {};
      for (const id of ids) V[id] = this.heroVals(id, wk);
      const size = Math.min(this.teamSize(), new Set(ids.map(id => this.baseOf(id))).size), sc = t => this.teamScore(t.map(id => V[id]));
      const team = [];
      while (team.length < size) {
        let best = null, bs = -1;
        for (const id of ids) if (!team.some(t => this.sameBase(t, id))) { const x = sc(team.concat(id)); if (x > bs) { bs = x; best = id; } }
        if (!best) break;
        team.push(best);
      }
      for (let pass = 0; pass < 3; pass++) {
        let cur = sc(team), better = false;
        for (let i = 0; i < team.length; i++) for (const id of ids) {
          if (team.some((t, j) => j !== i && this.sameBase(t, id)) || team[i] === id) continue;
          const t2 = team.slice(); t2[i] = id; const x = sc(t2);
          if (x > cur * 1.001) { team[i] = id; cur = x; better = true; }
        }
        if (!better) break;
      }
      // 換人要明顯比較強才換（新上場的人要花錢補等級，換來換去反而浪費）
      if (apply) {
        const now = this.s.team.filter(id => V[id]);
        if (!sticky || now.length < size || sc(team) > sc(now) * D.TEAM.swapGain) this.setTeam(team);
      }
      return team;
    }
    // 隊伍有空位就把板凳上最適合的人補上去（新同事、新格子、新加入）
    fillTeam() {
      const size = this.teamSize(); let added = false;
      const wk = this.stageWeak(this.s.stage).w;
      while (this.s.team.length < size) {
        const bench = this.ownedIds().filter(id => !this.s.team.some(t => this.sameBase(t, id)));
        if (!bench.length) break;
        const cur = this.s.team.filter(id => this.heroDef(id)).map(id => this.heroVals(id, wk));
        let best = null, bs = -1;
        for (const id of bench) { const x = this.teamScore(cur.concat(this.heroVals(id, wk))); if (x > bs) { bs = x; best = id; } }
        this.s.team.push(best); added = true;
      }
      if (added) this.teamChanged();
      return added;
    }

    // ---------- 招募 ----------
    unlocked(key) { const u = D.UNLOCKS.find(x => x.key === key); return !!this.s.unlocked[key] || (!!u && this.s.maxStage >= u.at); }
    recruitOpen() { return !!this.s.unlocked.recruit || this.s.maxStage >= D.RECRUIT.unlock; }
    recruitCost(n = 1) { return n >= 10 ? D.RECRUIT.ten : 1; }
    canRecruit(n = 1) { return this.recruitOpen() && this.s.resume >= this.recruitCost(n); }
    giveResume(n, e, why) { if (!n) return; this.s.resume += n; this.emit({ type: 'resume', n, e: e || null, why }); }
    rollRar(forceSR) {
      const P = this.s.pity, R = D.RECRUIT, H = D.HRAR;
      P.ssr++; P.ur++;
      let rar = 0;
      if (P.ur >= R.pityUR) rar = 4;
      else if (P.ssr >= R.pitySSR) rar = Math.random() < H[4].rate / (H[3].rate + H[4].rate) ? 4 : 3;
      else { let x = Math.random() * H.reduce((a, h) => a + h.rate, 0); for (let i = H.length - 1; i >= 0; i--) { x -= H[i].rate; if (x <= 0) { rar = i; break; } } }
      if (forceSR && rar < 2) rar = 2;
      if (rar >= 3) P.ssr = 0;
      if (rar >= 4) P.ur = 0;
      return rar;
    }
    // 原本四人（和他們的主題版本）還沒加入前不會被抽到；該稀有度沒人時往下找、再往上找
    pickHero(rar) {
      const ok = h => (!h.legacy || this.owned(h.id)) && (!h.base || this.owned(h.base));
      const order = [rar]; for (let i = rar - 1; i >= 0; i--) order.push(i); for (let i = rar + 1; i < 5; i++) order.push(i);
      for (const r of order) {
        const pool = D.ALLHEROES.filter(h => h.rar === r && ok(h));
        if (!pool.length) continue;
        const w = pool.map(h => this.owned(h.id) ? 1 : D.RECRUIT.newW), tot = w.reduce((a, b) => a + b, 0);
        let x = Math.random() * tot;
        for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x <= 0) return pool[i]; }
        return pool[pool.length - 1];
      }
      return null;
    }
    grantHero(def) {
      const id = def.id, R = D.RECRUIT, st = this.star(id);
      const r = { id, def, rar: def.rar, isNew: !this.owned(id), star: 1 };
      if (r.isNew) { this.s.heroes[id] = 1; this.s.stars[id] = 1; }
      else if (st < R.maxStar) { this.s.stars[id] = st + 1; r.star = st + 1; r.starUp = true; }
      else {
        r.star = st; r.maxed = true;
        r.gold = Math.ceil(C.gold(Math.min(this.s.maxStage, 60)) * R.maxGold * (def.rar + 1)); this.s.gold += r.gold;
        r.resume = R.maxResume[def.rar] || 0; this.s.resume += r.resume;
      }
      return r;
    }
    // n = 1 或 10。回傳 [{ id, def, isNew, star, rar, starUp?, maxed?, gold?, resume? }]，履歷不夠回傳 null
    recruit(n = 1, auto) {
      n = n >= 10 ? 10 : 1;
      if (!this.canRecruit(n)) return null;
      this.s.resume -= this.recruitCost(n); this.s.stats.pulls = (this.s.stats.pulls || 0) + n;
      const results = []; let sr = false;
      for (let i = 0; i < n; i++) {
        const rar = this.rollRar(n >= 10 && i === n - 1 && !sr);
        if (rar >= 2) sr = true;
        const def = this.pickHero(rar); if (def) results.push(this.grantHero(def));
      }
      this._top = null;
      this.refreshHp();
      this.emit({ type: 'recruit', results, auto: !!auto });
      if (results.some(r => r.isNew)) this.fillTeam();
      if (results.some(r => r.starUp)) this.calcTeam();
      return results;
    }

    // ---------- 解鎖階梯與下一個目標 ----------
    checkUnlocks(silent) {
      let any = false;
      for (const u of D.UNLOCKS) {
        if (u.at > this.s.maxStage || this.s.unlocked[u.key]) continue;
        this.s.unlocked[u.key] = 1; any = true;
        if (silent) continue;
        this.emit({ type: 'unlock', u });
        if (u.key === 'recruit') this.giveResume(D.RECRUIT.first, null, 'unlock');
      }
      if (any && !silent) { this.calcTeam(); this.fillTeam(); }
    }
    // { text, cur, need, kind: 'stage' | 'heroes' }：解鎖階梯在 5 關內就顯示它，不然顯示收集目標
    nextGoal() {
      const ms = this.s.maxStage, u = D.UNLOCKS.find(x => x.at > ms);
      const stageGoal = u && { text: `通過 ${stageName(u.at - 1).code}：${D.UNLOCKS.filter(x => x.at === u.at).map(x => x.text).join('、')}`, cur: ms, need: u.at, kind: 'stage', key: u.key };
      const n = this.ownedCount(), c = this.recruitOpen() && D.COLLECT.find(x => x > n);
      const colGoal = c && { text: `收集 ${c} 位同事`, cur: n, need: c, kind: 'heroes' };
      if (stageGoal && (u.at - ms <= 5 || !colGoal)) return stageGoal;
      if (colGoal) return colGoal;
      return { text: `加班模式：挑戰 ${stageName(ms).code}`, cur: ms, need: ms + 1, kind: 'stage' };
    }

    // ---------- 購買 ----------
    buyHero(id, n = 1) {
      const c = this.heroCost(id, n);
      if (!(this.s.heroes[id] >= 1) || !this.heroDef(id) || c > this.s.gold) return false;
      const r0 = this.rank(this.s.heroes[id]);
      this.s.gold -= c; this.s.heroes[id] += n; this._top = null;
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
    refreshHp() { this.heroes.forEach(h => { const old = h.max; h.max = this.heroHp(h.id); if (!h.dead) h.hp = Math.max(1, h.hp + h.max - old); }); }

    // 最划算的升級：各項花費乘上權重後挑最便宜的（升級均勻分散最有效率）
    // opts.office = false 不考慮辦公室；opts.tapW 點擊升級的權重（不太點的人調高）
    bestBuy(opts = {}) {
      const c = [];
      for (const h of this.heroes) {
        const id = h.id, lv = this.s.heroes[id]; if (!(lv >= 1)) continue;
        const toRank = C.rankAt.find(a => a > lv), near = toRank && toRank - lv <= 2;
        c.push({ kind: 'hero', id, cost: this.heroCost(id), w: (h.def.role === 'tank' ? 0.9 : 1) * (near ? 0.6 : 1), fn: () => this.buyHero(id) });
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
        case 'lv': return [s.heroes[q.hero] || 0, q.n];
        case 'ults': return [s.stats.ults, q.n];
        case 'taps': return [s.stats.taps, q.n];
        case 'bonus': return [s.stats.bonus || 0, q.n];
        case 'office': return [Object.values(s.office).reduce((a, b) => a + b, 0), q.n];
        case 'stage': return [Math.min(s.maxStage, q.n), q.n];
        case 'rank': return [this.ownedIds().filter(id => this.rank(s.heroes[id]) >= 1).length, q.n];
        case 'rank2': return [this.ownedIds().filter(id => this.rank(s.heroes[id]) >= 2).length, q.n];
        case 'lvsum': return [s.team.reduce((a, id) => a + (s.heroes[id] || 0), 0), q.n];
        case 'pulls': return [s.stats.pulls || 0, q.n];
        case 'heroes': return [this.ownedCount(), q.n];
        case 'star': return [Math.max(0, ...this.ownedIds().map(id => this.star(id))), q.n];
        case 'dept': { const c = {}; s.team.forEach(id => { const d = this.heroDef(id); if (d) c[d.dept] = (c[d.dept] || 0) + 1; }); return [Math.max(0, ...Object.values(c)), q.n]; }
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
      this.s.quests[id] = 1; this.s.gold += q.gold || 0;
      if (q.resume) this.s.resume += q.resume;
      this.emit({ type: 'quest', q, gold: q.gold || 0, resume: q.resume || 0 });
      return true;
    }

    // ---------- 關卡 ----------
    checkJoin(silent) {
      D.HEROES.forEach(hd => {
        if (hd.joinAt && this.s.maxStage >= hd.joinAt && !(this.s.heroes[hd.id] > 0)) {
          this.s.heroes[hd.id] = 1; this.s.stars[hd.id] = this.s.stars[hd.id] || 1; this._top = null;
          if (this.s.team.length < this.teamSize() && !this.s.team.includes(hd.id)) this.s.team.push(hd.id);
          if (!silent) {
            this.teamChanged();
            this.emit({ type: 'join', id: hd.id });
            this.say(this.heroes.find(h => h.id === hd.id), pick(hd.talk.start), 1.2, true);
          }
        }
      });
    }
    startStage() {
      const s = this.s.stage;
      this.wave = 0; this.waveCount = isBoss(s) ? 1 : (s >= 20 ? 4 : 3);
      this.enemies = []; this.shots = []; this.spawnQ = [];
      this.phase = 'walk'; this.phaseT = 0.9;
      this.bossT = 0; this.buffT = 0; this.stageT = 0;
      if (this.s.autoBuy && this.s.maxStage >= D.AUTOBUY_AT) this.autoTeam(true, true);   // 自動編隊：每關照弱點重排
      const X = D.TEAM.x[Math.max(3, Math.min(5, this.heroes.length))];
      this.heroes.forEach((h, i) => {
        h.on = true; h.slot = i; h.x = X[i]; h.dead = false; h.max = this.heroHp(h.id); h.hp = h.max; h.shield = 0; h.cd = 0.3 + Math.random() * 0.4; h.readyT = 0;
      });
      this.emit({ type: 'stage', s });
    }
    makeEnemy(k, s, hpScale, x, slot) {
      const t = D.ENEMIES[k];
      const hp = (s >= 50 ? C.enemyHp(s) * Math.pow(1.02, s - 50) : C.enemyHp(s)) * t.hp * hpScale * (t.boss ? C.bossHp(Math.min(s, 49)) : C.mobHp(Math.min(s, 49)));
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
        const bossId = ch ? ch.boss : BOSS_ROT[Math.floor((s - 50) / 10) % 5];
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
    // 敵人攻擊的對象：活著的坦克優先，再來是站最前面的人
    frontHero() {
      let f = null;
      for (const h of this.heroes) {
        if (!h.on || h.dead) continue;
        const t = h.def.role === 'tank', ft = f && f.def.role === 'tank';
        if (!f || (t && !ft) || (t === ft && h.x > f.x)) f = h;
      }
      return f;
    }
    randHero(not) { const a = this.heroes.filter(h => h.on && !h.dead && h !== not); return a.length ? pick(a) : null; }

    // src：'tap'、英雄 id、'splash'、大招 '<英雄 id>-ult'（extra.ult = true）
    // h：出手的同事（算部門弱點、單體職業破盾）
    damage(e, dmg, src, crit, extra, h) {
      if (e.dead) return;
      if (e.boss) dmg *= 1 + this.tSum('boss');
      let absorbed = 0, weak = false;
      if (h && e.t.weak && e.t.weak === h.def.dept) { dmg *= D.WEAK; weak = true; }
      if (e.scare > 0) dmg *= SCARE_MUL;
      if (e.shield > 0) {
        // 護盾：點擊 ×3、大招全額，一般攻擊只削 30%（單體職業 60%）；打破後剩下的傷害才扣血
        const eff = src === 'tap' ? 3 : (extra && extra.ult) ? 1 : h && h.def.role === 'dps' ? 0.6 : 0.3;
        absorbed = Math.min(e.shield, dmg * eff);
        e.shield -= absorbed;
        dmg = Math.max(0, dmg - absorbed / eff);
        if (e.shield <= 0.5) { e.shield = 0; this.emit({ type: 'shieldBreak', e }); const h = this.randHero(); if (h && Math.random() < 0.6) this.say(h, pick(['破了！', '甲方妥協了！', '這次不改了！']), 0.3); }
      }
      e.hp -= dmg;
      const ev = { type: 'hit', e, dmg: dmg + absorbed, crit, src };
      if (absorbed) ev.shield = absorbed;
      if (weak) ev.weak = true;
      if (h) { ev.h = h; ev.shot = h.def.shot; }
      if (extra) Object.assign(ev, extra);
      this.emit(ev);
      if (e.boss && e.phase === 1 && e.hp > 0 && e.hp <= e.max * 0.5 && e.t.skills2) this.bossPhase(e);
      if (e.hp <= 0) {
        e.dead = true; e.cast = null;
        const g = Math.ceil(C.gold(this.s.stage) * (e.boss ? 12 : e.elite ? D.ELITE.gold : e.minion ? 0.5 : 1) * this.goldMul() * this.buffMul('gold'));
        this.s.gold += g; this.s.stats.kills++;
        this.emit({ type: 'kill', e, gold: g });
        this.rollChest(e);
        this.rollResume(e);
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
    // 履歷掉落（招募開放後才掉）
    rollResume(e) {
      if (!this.recruitOpen()) return;
      const R = D.RECRUIT.drop;
      const n = e.boss ? R.boss : e.minion ? 0 : Math.random() < (e.elite ? R.elite : R.kill) * (this.s.stage >= 50 ? R.ot : 1) ? 1 : 0;
      if (n) this.giveResume(n, e, 'drop');
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
      if (this.recruitOpen() && Math.random() < (D.RECRUIT.drop[kind] || 0)) this.giveResume(1, null, 'chest');
      const w = D.CHEST.kinds[kind].w, tot = w.reduce((a, b) => a + b, 0);
      let x = Math.random() * tot, rar = 0;
      for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) { rar = i; break; } }
      const pool = D.TREASURES.filter(t => t.rar === rar);
      const open = pool.filter(t => (this.s.treasures[t.id] || 0) < D.CHEST.maxStar);   // 先給還沒滿星的
      return this.grant(pick(open.length ? open : pool).id, kind);
    }

    // 普攻目標：打得到的敵人裡，優先挑自己部門剋得到的（最前面那隻），沒有就打最前面
    heroTarget(h) {
      let t = null, w = null; const d = h.def.dept;
      for (const e of this.enemies) {
        if (e.dead || e.x >= 490) continue;
        if (!t || e.x < t.x) t = e;
        if (e.t.weak === d && (!w || e.x < w.x)) w = e;
      }
      return w || t;
    }
    heroAttack(h) {
      const t = this.heroTarget(h); if (!t) return;
      let dmg = this.heroAtk(h.id) * this.fightAtkMul(), crit = false;
      if (h.def.role === 'crit' && Math.random() < 0.25 + this.tSum('crit')) { dmg *= 2.5; crit = true; }
      this.shots.push({ h, t, x: h.x + 24, y: GROUND - 46, tx: t.x, ty: t.y - 40, life: 0, dur: 0.28, dmg, crit, kind: h.def.shot });
      this.emit({ type: 'shoot', h });
      h.energy = Math.min(100, h.energy + 12 * this.chargeMul());
      if (h.def.role === 'healer') {
        // 治療：順便幫血量比例最低的同事回血
        let low = null;
        for (const x of this.heroes) if (x.on && !x.dead && x.hp < x.max && (!low || x.hp / x.max < low.hp / low.max)) low = x;
        if (low) this.heal(low, h.max * D.HEAL.hit, h);
      }
    }
    heal(x, amount, from, revive) {
      if (revive) { x.dead = false; x.hp = 0; }
      const a = Math.min(x.max - x.hp, amount);
      if (a <= 0 && !revive) return;
      x.hp += a;
      this.emit({ type: 'heal', h: x, amount: a, from: from || null, revive: !!revive });
    }

    canUlt(h) { return h.on && !h.dead && h.energy >= 100 && this.phase === 'fight' && this.alive().length > 0; }
    ult(id, auto) {
      const h = this.heroes.find(x => x.id === id);
      if (!h || !this.canUlt(h)) return false;
      h.energy = 0; h.readyT = 0; this.s.stats.ults++;
      const atk = this.heroAtk(id) * this.fightAtkMul();
      this.emit({ type: 'ult', h, auto: !!auto });
      if (Math.random() < 0.3) this.say(h, pick(h.def.talk.ult), 0.2);
      const role = h.def.role, src = id + '-ult', X = { ult: true };
      if (role === 'tank') {
        const sh = h.max * 0.4 * (1 + (this.baseOf(id) === 'mi' ? this.tSum('miShield') : 0));
        this.heroes.forEach(x => { if (x.on && !x.dead) x.shield = Math.max(x.shield, sh); });
        this.alive().forEach(e => e.stun = e.boss ? 1 : 2.5); // 頭目只暈 1 秒，而且照樣放技能
      } else if (role === 'crit') {
        const t = this.alive().sort((a, b) => b.hp + b.shield - a.hp - a.shield)[0];
        if (t) this.damage(t, atk * 15, src, true, X, h);
      } else if (role === 'aoe') {
        this.alive().forEach(e => this.damage(e, atk * 4.5, src, false, X, h));
      } else if (role === 'dps') {
        const t = this.target() || this.alive()[0];
        if (t) this.damage(t, atk * 10, src, false, X, h);
      } else if (role === 'support') {
        const k = this.supportBuff(h.def), on = this.buffT > 0;
        this.buffAtk = Math.max(on ? this.buffAtk : 1, 1 + k);
        const vivi = this.baseOf(id) === 'vivi';
        this.buffAspd = Math.max(on ? this.buffAspd : 1, vivi ? 1.4 : 1 + 0.5 * k);
        this.buffT = 8;
        if (vivi) {
          const g = Math.ceil(C.gold(this.s.stage) * 5 * this.goldMul());
          this.s.gold += g; this.emit({ type: 'goldrain', gold: g });
        }
      } else if (role === 'healer') {
        for (const x of this.heroes) {
          if (!x.on) continue;
          if (x.dead) this.heal(x, x.max * D.HEAL.revive, h, true);
          else this.heal(x, x.max * D.HEAL.ult, h);
        }
      }
      // 主題版本的小特色（萬聖節嚇一跳、尾牙撒紅包）
      const th = h.def.base && D.THEME[h.def.rar];
      if (th && th.scare) this.alive().forEach(e => { e.scare = th.scare.dur; if (!e.boss) e.stun = Math.max(e.stun, th.scare.stun); });
      if (th && th.party) {
        const g = Math.ceil(C.gold(this.s.stage) * th.party.gold * this.goldMul());
        this.s.gold += g; this.emit({ type: 'goldrain', gold: g, h });
        this.heroes.forEach(x => { if (x !== h && x.on && !x.dead) x.energy = Math.min(100, x.energy + th.party.energy); });
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
        const bossId = s < 50 ? D.CHAPTERS[chapterOf(s)].boss : BOSS_ROT[Math.floor((s - 50) / 10) % 5];
        const art = D.TREASURES.find(t => t.boss === bossId);
        if (art && s === this.s.maxStage && (s >= 50 || !this.s.treasures[art.id])) this.grant(art.id, 'boss');
      }
      if (s === this.s.maxStage) {
        this.s.maxStage++;
        const c = this.s.cheer;
        this.checkJoin(false);      // 先讓原本四人加入（Vivi 要拿到第 5 格），再解鎖、補空位
        this.checkUnlocks(false);
        const RD = D.RECRUIT.drop;
        if (this.recruitOpen() && (isBoss(s) || s >= RD.firstFrom)) this.giveResume(isBoss(s) ? RD.firstBoss : RD.first, null, 'first');
        this.givePerk(s);
        if (this.stageT > D.CHEER.slow && s < 50) this.addCheer('slow');
        else if (c.n > 0 && ++c.calm >= D.CHEER.calm) { c.calm = 0; c.n--; this.emit({ type: 'cheer', n: c.n, why: 'calm', mul: this.cheerMul() }); }
        if (s === 49) { this.s.cleared = true; this.emit({ type: 'ending' }); }
        if (this.s.maxStage === 10 && !this.s.autoUlt) this.s.autoUlt = true; // 打贏 Vivi 解鎖自動大招，預設打開
      }
      this.checkJoin(false);
      if (this.s.farming) {
        this.farmClears = (this.farmClears || 0) + 1;
        if (this.s.autoBoss && this.farmClears >= D.BOSS_RETRY) { this.farmClears = 0; this.s.farming = false; this.s.stage = this.s.maxStage; }
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
          // 自動招募（湊滿十連才抽）＋自動編隊
          if (this.canRecruit(10) && this.phase === 'fight') { this.recruit(10, true); this.autoTeam(true, true); }
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
      const aspdMul = this.aspdBase() * (this.buffT > 0 ? this.buffAspd : 1) * this.buffMul('aspd');

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
          if (!p.t.dead) this.damage(p.t, p.dmg, p.h.id, p.crit, null, p.h);
          if (p.h.def.role === 'aoe') this.alive().filter(e => e !== p.t && Math.abs(e.x - p.t.x) < 60).forEach(e => this.damage(e, p.dmg * 0.4, 'splash', false, null, p.h));
        }
      }
      this.shots = this.shots.filter(p => !p.done);

      // 敵人
      const front = this.frontHero();
      let slotN = 0;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (e.scare > 0) e.scare -= dt;
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
      if (h.def.role === 'tank') h.energy = Math.min(100, h.energy + 4 * this.chargeMul());
      this.emit({ type: 'hurt', h, dmg, e });
      if (h.hp <= 0) {
        h.hp = 0; h.dead = true; this.emit({ type: 'down', h });
        if (Math.random() < 0.7) this.say(h, pick(h.def.talk.down), 0.1, true);
      }
    }
  }

  G.Engine = { Game, newSave, fixSave, stageName, chapterOf, isBoss, GROUND, BOSS_ROT };
})(typeof window !== 'undefined' ? window : globalThis);
