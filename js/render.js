// 戰鬥畫面：canvas 繪製角色、敵人、特效。動作全部用程式做（呼吸、衝刺、受擊閃白、倒地）
(function (G) {
  const W = 480, H = 300, GROUND = G.Engine.GROUND;
  const D = G.DATA;
  const IMG = {};
  const SIL = new Map();     // 白色剪影（受擊閃白用）

  const HERO_H = 132, ENEMY_H = 88, BOSS_H = 172;
  // 攻擊姿勢圖：角色身體中心在圖寬的比例、高度倍率
  const DY = { mi: 4, jie: -16, kui: 8, vivi: -14 };   // 前後排錯開
  const ATK = { kui: { ax: 0.17, h: 0.98 }, mi: { ax: 0.27, h: 1 }, jie: { ax: 0.42, h: 0.94 }, vivi: { ax: 0.33, h: 1 } };

  function load(list) {
    return Promise.all(list.map(([k, src]) => new Promise(res => {
      const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => res(); im.src = src;
    })));
  }
  function assets() {
    const l = [];
    D.ORDER.forEach(id => { l.push([id, `art/char/${id}.webp`], ['atk_' + id, `art/char/atk_${id}.webp`], ['pro_' + id, `art/char/pro_${id}.webp`]); });
    Object.keys(D.ENEMIES).forEach(k => { const t = D.ENEMIES[k]; if (!t.img) l.push([k, t.boss ? `art/enemy/${k}.webp` : `art/enemy/${k.slice(2)}.webp`]); });
    for (let i = 1; i <= 5; i++) l.push(['bg' + i, `art/bg/bg${i}.webp`]);
    return l;
  }
  function silhouette(im) {
    if (SIL.has(im)) return SIL.get(im);
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    SIL.set(im, c); return c;
  }

  class Renderer {
    constructor(canvas, game) {
      this.cv = canvas; this.ctx = canvas.getContext('2d'); this.g = game;
      this.fx = []; this.nums = []; this.parts = []; this.anim = new Map();
      this.bgX = 0; this.shake = 0; this.cutin = null; this.flash = 0; this.t = 0; this.banner = null;
      this.resize(); addEventListener('resize', () => this.resize());
    }
    resize() {
      const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.width * H / W * dpr);
      this.scale = this.cv.width / W;
    }
    toWorld(cx, cy) { const r = this.cv.getBoundingClientRect(); return [(cx - r.left) / r.width * W, (cy - r.top) / r.height * H]; }
    A(o) { let a = this.anim.get(o); if (!a) { a = { atk: 0, hit: 0, lunge: 0, die: 0, spawn: 0.35, phase: Math.random() * 6 }; this.anim.set(o, a); } return a; }

    // ---------- 事件 → 特效 ----------
    onEvent(e) {
      const g = this.g;
      switch (e.type) {
        case 'shoot': { const a = this.A(e.h); a.atk = 0.32; a.lunge = 0.2; break; }
        case 'hit': {
          const a = this.A(e.e); a.hit = e.e.boss ? 0.06 : 0.09;
          const big = e.crit || e.src === 'jie-ult';
          this.nums.push({ x: e.e.x + (Math.random() - 0.5) * 16, y: e.e.y - (e.e.boss ? BOSS_H : ENEMY_H) * 0.8, v: e.dmg, t: 0, crit: big, tap: e.src === 'tap' });
          if (e.src === 'tap') this.burst(e.e.x - 10, e.e.y - 34, '#fff3a0', 5, 60);
          if (e.src === 'jie') this.fx.push({ k: 'slash', x: e.e.x, y: e.e.y - 34, t: 0, d: 0.22, crit: e.crit });
          if (e.src === 'kui' || e.src === 'splash') this.burst(e.e.x, e.e.y - 34, ['#ff5d8f', '#ffd23f', '#4fc3f7', '#7ee081'][Math.floor(Math.random() * 4)], e.src === 'kui' ? 7 : 3, 80);
          if (e.src === 'mi') this.fx.push({ k: 'ring', x: e.e.x, y: e.e.y - 34, t: 0, d: 0.3, c: '#9fd3ff' });
          if (e.src === 'vivi') this.burst(e.e.x, e.e.y - 34, '#7bd389', 4, 70, 'bill');
          if (e.crit) this.shake = Math.max(this.shake, 3);
          break;
        }
        case 'kill': {
          const a = this.A(e.e); a.die = 0.001;
          this.burst(e.e.x, e.e.y - 30, '#fff', e.e.boss ? 30 : 10, e.e.boss ? 200 : 120, 'paper');
          for (let i = 0; i < (e.e.boss ? 12 : 3); i++) this.parts.push({ k: 'coin', x: e.e.x, y: e.e.y - 30, vx: (Math.random() - 0.5) * 120, vy: -120 - Math.random() * 80, t: 0, d: 0.9 + Math.random() * 0.3 });
          if (e.e.boss) { this.shake = 10; this.flash = 0.4; }
          break;
        }
        case 'hurt': { const a = this.A(e.h); a.hit = 0.14; const ea = this.A(e.e); ea.lunge = 0.22;
          this.nums.push({ x: e.h.x, y: GROUND - HERO_H * 0.9, v: e.dmg, t: 0, hurt: true }); break; }
        case 'down': this.A(e.h).die = 0.001; break;
        case 'ult': {
          const h = e.h; this.cutin = { id: h.id, name: h.def.skill.name, t: 0, color: h.def.color };
          this.flash = 0.25;
          if (h.id === 'kui') this.g.alive().forEach((en, i) => setTimeout(() => this.burst(en.x, en.y - 30, ['#ff5d8f', '#ffd23f', '#4fc3f7', '#7ee081', '#b28dff'][i % 5], 22, 170), 120 * i));
          if (h.id === 'mi') this.fx.push({ k: 'bigring', x: h.x, y: GROUND - 50, t: 0, d: 0.8 });
          if (h.id === 'jie') { this.fx.push({ k: 'bigslash', t: 0, d: 0.45 }); this.shake = 12; }
          if (h.id === 'vivi') for (let i = 0; i < 40; i++) this.parts.push({ k: 'bill', x: Math.random() * W, y: -20 - Math.random() * 120, vx: (Math.random() - 0.5) * 30, vy: 60 + Math.random() * 60, rot: Math.random() * 6, t: 0, d: 2.6 });
          break;
        }
        case 'stage': this.anim.clear(); break;
        case 'wave': if (e.boss) this.banner = { text: 'BOSS 來襲！', t: 0, d: 1.6, c: '#ff4d6d' }; break;
        case 'clear': if (e.boss) this.banner = { text: '頭目擊破！', t: 0, d: 1.6, c: '#ffd23f' }; break;
        case 'fail': this.banner = { text: e.reason === 'time' ? '時間到…先回去練功' : '全員累倒…先回去練功', t: 0, d: 2, c: '#9aa7ff' }; break;
        case 'levelup': if (e.rankUp) { const h = g.heroes.find(x => x.id === e.id); this.fx.push({ k: 'rankup', x: h.x, y: GROUND - 60, t: 0, d: 1.2 }); } break;
      }
    }
    tapFx(x, y) { this.fx.push({ k: 'tap', x, y, t: 0, d: 0.35 }); this.burst(x, y, '#ffe17a', 4, 50); }
    burst(x, y, c, n, sp, kind = 'dot') {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.8);
        this.parts.push({ k: kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, c: Array.isArray(c) ? c[i % c.length] : c, t: 0, d: 0.5 + Math.random() * 0.4, r: 2 + Math.random() * 3, rot: Math.random() * 6 });
      }
    }

    // ---------- 繪製 ----------
    draw(dt) {
      this.t += dt;
      const g = this.g, x = this.ctx, s = this.scale;
      x.setTransform(s, 0, 0, s, 0, 0);
      let sx = 0, sy = 0;
      if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; this.shake = Math.max(0, this.shake - dt * 30); }
      x.translate(sx, sy);
      this.drawBg(dt);

      // 影子 + 角色（由後往前）
      const heroes = g.heroes.filter(h => h.on);
      for (const h of heroes.slice().sort((a, b) => DY[a.id] - DY[b.id])) this.drawHero(h, dt);
      const ens = g.enemies.slice().sort((a, b) => b.x - a.x);
      for (const e of ens) this.drawEnemy(e, dt);

      // 飛行物
      for (const p of g.shots) this.drawShot(p);
      this.drawFx(dt);
      this.drawParts(dt);
      this.drawNums(dt);
      x.setTransform(s, 0, 0, s, 0, 0);
      this.drawHud(dt);
      if (this.cutin) this.drawCutin(dt);
      if (this.banner) this.drawBanner(dt);
      if (this.flash > 0) { x.fillStyle = `rgba(255,255,255,${this.flash})`; x.fillRect(0, 0, W, H); this.flash = Math.max(0, this.flash - dt * 1.5); }
    }
    drawBg(dt) {
      const g = this.g, x = this.ctx;
      const s = g.s.stage, bgk = s >= 50 ? 'bg' + (Math.floor((s - 50) / 10) % 5 + 1) : D.CHAPTERS[G.Engine.chapterOf(s)].bg;
      const im = IMG[bgk];
      if (g.phase === 'walk') this.bgX += dt * 90;
      if (!im) { x.fillStyle = '#ccd'; x.fillRect(0, 0, W, H); return; }
      const bh = H, bw = im.width * bh / im.height;
      const off = this.bgX % bw;
      x.drawImage(im, -off, 0, bw, bh); x.drawImage(im, -off + bw, 0, bw, bh);
      // 讓前景角色清楚：底部稍微壓暗
      const gr = x.createLinearGradient(0, H * 0.55, 0, H);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
      x.fillStyle = gr; x.fillRect(0, H * 0.55, W, H * 0.45);
    }
    shadow(cx, w) { this.shadowAt(cx, GROUND, w); }
    shadowAt(cx, y, w) { const x = this.ctx; x.fillStyle = 'rgba(0,0,0,0.22)'; x.beginPath(); x.ellipse(cx, y + 1, w, w * 0.22, 0, 0, Math.PI * 2); x.fill(); }

    sprite(im, cx, footY, h, opt = {}) {
      if (!im) return;
      const x = this.ctx, w = im.width * h / im.height, ax = opt.ax ?? 0.5;
      x.save(); x.translate(cx, footY);
      if (opt.rot) x.rotate(opt.rot);
      x.scale((opt.flip ? -1 : 1) * (opt.sx || 1), opt.sy || 1);
      if (opt.alpha != null) x.globalAlpha = opt.alpha;
      if (opt.grey) x.filter = 'grayscale(1) brightness(0.8)';
      x.drawImage(im, -w * ax, -h, w, h);
      x.filter = 'none';
      if (opt.white) { x.globalAlpha = opt.white; x.drawImage(silhouette(im), -w * ax, -h, w, h); }
      if (opt.red) { x.globalAlpha = opt.red; x.globalCompositeOperation = 'source-atop'; }
      x.restore();
    }

    drawHero(h, dt) {
      const g = this.g, a = this.A(h);
      a.atk = Math.max(0, a.atk - dt); a.hit = Math.max(0, a.hit - dt); a.lunge = Math.max(0, a.lunge - dt);
      const walking = g.phase === 'walk';
      const t = this.t + a.phase;
      let cx = h.x + (a.lunge > 0 ? Math.sin(a.lunge / 0.2 * Math.PI) * 7 : 0) - (a.hit > 0 ? 3 : 0);
      let foot = GROUND + DY[h.id], sy = 1 + Math.sin(t * 3) * 0.018, sx = 1 - Math.sin(t * 3) * 0.012, rot = 0;
      if (walking) { foot -= Math.abs(Math.sin(t * 9)) * 4; rot = Math.sin(t * 9) * 0.04; }
      const rank = g.rank(g.s.heroes[h.id]);
      const pro = rank >= 2 && IMG['pro_' + h.id];
      this.shadowAt(h.x, GROUND + DY[h.id], 22);
      if (h.dead) {
        a.die = Math.min(1, (a.die || 0) + dt * 3);
        this.sprite(pro ? IMG['pro_' + h.id] : IMG[h.id], cx - a.die * 10, foot, HERO_H, { rot: -a.die * 1.35, grey: true, alpha: 0.85 });
        this.ctx.font = 'bold 10px sans-serif'; this.ctx.fillStyle = '#fff'; this.ctx.textAlign = 'center';
        this.ctx.fillText('💤', h.x - 18, foot - 26 + Math.sin(this.t * 3) * 3);
        return;
      }
      if (g.buffT > 0) { const x = this.ctx; x.save(); x.globalAlpha = 0.35 + Math.sin(this.t * 10) * 0.1; x.fillStyle = '#ffd23f'; x.beginPath(); x.ellipse(h.x, foot - 4, 28, 8, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
      const useAtk = a.atk > 0 && !pro && IMG['atk_' + h.id];
      if (useAtk) {
        const k = ATK[h.id];
        this.sprite(IMG['atk_' + h.id], cx, foot, HERO_H * k.h, { ax: k.ax, white: a.hit > 0 ? 0.7 : 0 });
      } else {
        const pop = a.atk > 0 ? 1 + Math.sin(a.atk / 0.32 * Math.PI) * 0.06 : 1;
        this.sprite(pro ? IMG['pro_' + h.id] : IMG[h.id], cx, foot, HERO_H, { sx: sx * pop, sy: sy * (2 - pop), rot, white: a.hit > 0 ? 0.7 : 0 });
      }
      if (h.shield > 0) { const x = this.ctx; x.save(); x.strokeStyle = 'rgba(140,200,255,0.9)'; x.fillStyle = 'rgba(140,200,255,0.18)'; x.lineWidth = 2; x.beginPath(); x.ellipse(h.x, foot - HERO_H * 0.48, 30, HERO_H * 0.56, 0, 0, Math.PI * 2); x.fill(); x.stroke(); x.restore(); }
      // 小血條
      this.bar(h.x - 18, foot + 6, 36, 4, h.hp / h.max, '#5ee07a');
    }
    drawEnemy(e, dt) {
      const a = this.A(e);
      a.hit = Math.max(0, a.hit - dt); a.lunge = Math.max(0, a.lunge - dt); a.spawn = Math.max(0, a.spawn - dt);
      const t = this.t + a.phase, H0 = e.boss ? BOSS_H : ENEMY_H;
      const im = e.t.img ? IMG[e.t.img] : IMG[e.k];
      if (e.dead) {
        if (a.die <= 0) return;
        a.die += dt * 2.5; if (a.die > 1) { a.die = 0; return; }
        this.sprite(im, e.x + a.die * 30, e.y - a.die * 20, H0 * (1 - a.die * 0.4), { flip: !!e.t.img, alpha: 1 - a.die, white: 0.8, rot: a.die * 1.2 });
        return;
      }
      let cx = e.x - (a.lunge > 0 ? Math.sin(a.lunge / 0.22 * Math.PI) * 14 : 0) + (a.hit > 0 ? 3 : 0);
      let foot = e.y, sy = 1, sx = 1;
      if (e.walking) { foot -= Math.abs(Math.sin(t * 8)) * 6; sy = 1 + Math.sin(t * 16) * 0.04; }
      else { sy = 1 + Math.sin(t * 3.5) * 0.03; sx = 1 - Math.sin(t * 3.5) * 0.02; }
      const sp = a.spawn > 0 ? 1 - a.spawn / 0.35 : 1;
      this.shadow(e.x, e.boss ? 42 : 22);
      if (e.boss) { const x = this.ctx; x.save(); x.globalAlpha = 0.25 + Math.sin(this.t * 4) * 0.1; x.fillStyle = '#ff3d6e'; x.beginPath(); x.ellipse(e.x, foot - H0 * 0.45, H0 * 0.42, H0 * 0.55, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
      this.sprite(im, cx, foot, H0 * sp, { sx, sy, flip: !!e.t.img, white: a.hit > 0 ? (e.boss ? 0.3 : 0.5) : 0 });
      if (e.stun > 0) { const x = this.ctx; x.font = 'bold 9px sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = '#335'; x.lineWidth = 3; x.strokeText('請稍候…', e.x, foot - H0 - 4); x.fillText('請稍候…', e.x, foot - H0 - 4); }
      if (!e.boss) this.bar(e.x - 16, foot + 6, 32, 3, e.hp / e.max, '#ff6b6b');
    }
    bar(x0, y0, w, h, p, c) { const x = this.ctx; x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(x0 - 1, y0 - 1, w + 2, h + 2); x.fillStyle = c; x.fillRect(x0, y0, w * Math.max(0, Math.min(1, p)), h); }

    drawShot(p) {
      const x = this.ctx, k = Math.min(1, p.life / p.dur);
      const px = p.x + (p.tx - p.x) * k, py = p.y + (p.ty - p.y) * k - Math.sin(k * Math.PI) * 26;
      x.save();
      if (p.kind === 'paint') { x.fillStyle = ['#ff5d8f', '#ffd23f', '#4fc3f7', '#7ee081'][Math.floor(p.life * 30) % 4]; x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); x.globalAlpha = 0.4; x.beginPath(); x.arc(px - 6, py + 2, 3, 0, 7); x.fill(); }
      else if (p.kind === 'wave') { x.strokeStyle = '#9fd3ff'; x.lineWidth = 2.5; for (let i = 0; i < 3; i++) { x.globalAlpha = 1 - i * 0.3; x.beginPath(); x.arc(px - i * 7, py, 6 + i * 2, -0.9, 0.9); x.stroke(); } }
      else if (p.kind === 'money') { x.translate(px, py); x.rotate(p.life * 14); x.fillStyle = '#7bd389'; x.fillRect(-6, -3.5, 12, 7); x.strokeStyle = '#2f8f4e'; x.lineWidth = 1; x.strokeRect(-6, -3.5, 12, 7); }
      else if (p.kind === 'slash') { x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 3; x.beginPath(); x.moveTo(px - 10, py); x.lineTo(px + 6, py); x.stroke(); }
      x.restore();
    }
    drawFx(dt) {
      const x = this.ctx;
      for (const f of this.fx) {
        f.t += dt; const k = f.t / f.d;
        x.save();
        if (f.k === 'slash') { x.strokeStyle = f.crit ? '#ffe066' : '#fff'; x.lineWidth = f.crit ? 5 : 3; x.globalAlpha = 1 - k; x.beginPath(); x.arc(f.x - 6, f.y + 6, 24, -2.4 + k * 0.6, -0.4 + k * 0.6); x.stroke(); }
        else if (f.k === 'ring') { x.strokeStyle = f.c; x.lineWidth = 2; x.globalAlpha = 1 - k; x.beginPath(); x.arc(f.x, f.y, 6 + k * 18, 0, 7); x.stroke(); }
        else if (f.k === 'bigring') { x.strokeStyle = '#9fd3ff'; x.lineWidth = 4; x.globalAlpha = 1 - k; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(f.x, f.y, (k * 400 - i * 40), -1, 1); x.stroke(); } }
        else if (f.k === 'bigslash') { x.strokeStyle = '#fff'; x.lineWidth = 10 * (1 - k); x.shadowColor = '#ffd23f'; x.shadowBlur = 20; x.beginPath(); x.moveTo(-20, 230 - k * 40); x.lineTo(W + 20, 90 + k * 40); x.stroke(); }
        else if (f.k === 'tap') { x.strokeStyle = '#fff3a0'; x.lineWidth = 3; x.globalAlpha = 1 - k; x.beginPath(); x.arc(f.x, f.y, 4 + k * 16, 0, 7); x.stroke(); x.font = 'bold 12px sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = '#a0522d'; x.lineWidth = 3; x.strokeText('催！', f.x, f.y - 10 - k * 14); x.fillText('催！', f.x, f.y - 10 - k * 14); }
        else if (f.k === 'rankup') { x.globalAlpha = 1 - k * k; x.fillStyle = '#ffd23f'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; x.strokeStyle = '#7a3e00'; x.lineWidth = 3; x.strokeText('升職！', f.x, f.y - k * 30); x.fillText('升職！', f.x, f.y - k * 30); x.strokeStyle = '#ffd23f'; x.lineWidth = 3; x.beginPath(); x.arc(f.x, f.y + 20, k * 50, 0, 7); x.stroke(); }
        x.restore();
      }
      this.fx = this.fx.filter(f => f.t < f.d);
    }
    drawParts(dt) {
      const x = this.ctx;
      for (const p of this.parts) {
        p.t += dt;
        if (p.k === 'coin') { // 先彈起，再飛向左上角薪水
          const k = p.t / p.d;
          if (k < 0.45) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; }
          else { p.x += (12 - p.x) * dt * 7; p.y += (-10 - p.y) * dt * 7; }
          x.fillStyle = '#ffcc33'; x.strokeStyle = '#b8860b'; x.lineWidth = 1; x.beginPath(); x.arc(p.x, p.y, 3.5, 0, 7); x.fill(); x.stroke();
          continue;
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.k === 'bill') { p.rot += dt * 4; x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.fillStyle = '#7bd389'; x.fillRect(-7, -4, 14, 8); x.fillStyle = '#2f8f4e'; x.fillRect(-2, -2, 4, 4); x.restore(); continue; }
        p.vy += 300 * dt;
        x.globalAlpha = Math.max(0, 1 - p.t / p.d);
        if (p.k === 'paper') { x.save(); x.translate(p.x, p.y); x.rotate(p.rot + p.t * 8); x.fillStyle = Math.random() < 0.5 ? '#fff' : '#ffe9a8'; x.fillRect(-3, -2, 6, 4); x.restore(); }
        else { x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill(); }
        x.globalAlpha = 1;
      }
      this.parts = this.parts.filter(p => p.t < p.d && p.y < H + 40);
    }
    drawNums(dt) {
      const x = this.ctx;
      x.textAlign = 'center';
      for (const n of this.nums) {
        n.t += dt; const k = n.t / 0.8;
        const y = n.y - k * 22, sc = n.crit ? 1 + Math.max(0, 0.25 - n.t) * 3 : 1;
        x.globalAlpha = Math.min(1, 2 - k * 2);
        x.font = `900 ${Math.round((n.crit ? 15 : n.tap ? 9 : 10) * sc)}px sans-serif`;
        x.lineWidth = 3; x.strokeStyle = n.hurt ? '#5a0010' : '#2a1a00';
        x.fillStyle = n.hurt ? '#ff6b6b' : n.crit ? '#ffd23f' : n.tap ? '#fff7c2' : '#fff';
        const s = (n.crit ? '爆擊 ' : '') + G.fmt(n.v);
        x.strokeText(s, n.x, y); x.fillText(s, n.x, y);
      }
      x.globalAlpha = 1;
      this.nums = this.nums.filter(n => n.t < 0.8);
      if (this.nums.length > 60) this.nums.splice(0, this.nums.length - 60);
    }
    drawHud() {
      const g = this.g, x = this.ctx;
      const boss = g.enemies.find(e => e.boss && !e.dead);
      if (boss) {
        x.fillStyle = 'rgba(20,10,30,0.7)'; x.fillRect(90, 8, 300, 26);
        x.font = 'bold 10px sans-serif'; x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText(boss.t.name, 96, 19);
        x.textAlign = 'right'; x.fillStyle = g.bossT < 8 ? '#ff6b6b' : '#ffd23f'; x.fillText('⏱ ' + Math.max(0, g.bossT).toFixed(1) + 's', 384, 19);
        this.bar(96, 23, 288, 6, boss.hp / boss.max, '#ff3d6e');
      }
    }
    drawCutin(dt) {
      const c = this.cutin, x = this.ctx; c.t += dt;
      const d = 1.0, k = c.t / d;
      if (k >= 1) { this.cutin = null; return; }
      const ease = k < 0.2 ? k / 0.2 : k > 0.8 ? (1 - k) / 0.2 : 1;
      x.save();
      x.globalAlpha = 0.55 * ease; x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      x.globalAlpha = ease;
      x.fillStyle = c.color; x.beginPath(); x.moveTo(0, 95); x.lineTo(W, 75); x.lineTo(W, 175); x.lineTo(0, 195); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 8; i++) x.fillRect(((c.t * 900 + i * 70) % (W + 80)) - 40, 85 + i * 12, 40, 2);
      const g = this.g, h = g.heroes.find(q => q.id === c.id), pro = g.rank(g.s.heroes[c.id]) >= 2;
      const im = pro ? IMG['pro_' + c.id] : IMG['atk_' + c.id] || IMG[c.id];
      const px = -60 + Math.min(1, k * 5) * 200 + k * 30;
      if (im) this.sprite(im, px, 205, 150, { ax: pro ? 0.5 : (ATK[c.id]?.ax ?? 0.5) });
      x.textAlign = 'right'; x.font = '900 22px sans-serif'; x.lineWidth = 5; x.strokeStyle = '#1a0f2e'; x.fillStyle = '#fff';
      const tx = W - 20 - (1 - Math.min(1, k * 5)) * 120;
      x.strokeText(c.name, tx, 140); x.fillText(c.name, tx, 140);
      x.font = 'bold 11px sans-serif'; x.fillStyle = '#ffe9a8'; x.strokeText(h.def.name, tx, 160); x.fillText(h.def.name, tx, 160);
      x.restore();
    }
    drawBanner(dt) {
      const b = this.banner, x = this.ctx; b.t += dt; const k = b.t / b.d;
      if (k >= 1) { this.banner = null; return; }
      const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
      x.save(); x.globalAlpha = a;
      x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(0, 120, W, 44);
      x.font = '900 24px sans-serif'; x.textAlign = 'center'; x.lineWidth = 5; x.strokeStyle = '#1a0f2e'; x.fillStyle = b.c;
      const sc = 1 + Math.max(0, 0.15 - b.t) * 3;
      x.translate(W / 2, 151); x.scale(sc, sc); x.strokeText(b.text, 0, 0); x.fillText(b.text, 0, 0);
      x.restore();
    }
  }

  G.Render = { Renderer, load, assets, IMG, W, H };
})(window);
