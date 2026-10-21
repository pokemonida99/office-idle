// 戰鬥畫面：canvas 繪製角色、敵人、特效。動作全部用程式做（呼吸、蓄力、衝刺、受擊擊退、閃白、倒地）
// 效能：所有圖片依 dpr 預先縮好放進 offscreen canvas（含白色剪影、灰階版），背景連同壓暗漸層一起快取；
// 每幀不建立漸層、不用 filter / shadowBlur；粒子、數字、特效都有上限。
(function (G) {
  // 半徑算出負數時 canvas 會丟錯（v1.0 小米大招就是這樣讓整個畫面卡死），一律夾到 0
  const CP = CanvasRenderingContext2D.prototype;
  if (!CP.__safeArc) {
    const arc = CP.arc, ell = CP.ellipse; CP.__safeArc = true;
    CP.arc = function (x, y, r, a0, a1, ccw) { return arc.call(this, x, y, r > 0 ? r : 0, a0, a1, ccw); };
    CP.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, rot, a0, a1, ccw); };
  }
  const W = 480, H = 300, GROUND = G.Engine.GROUND;
  const D = G.DATA;
  const IMG = {};

  const HERO_H = 132, ENEMY_H = 88, BOSS_H = 172, BONUS_H = 46;
  // 攻擊姿勢圖：角色身體中心在圖寬的比例、高度倍率
  const DY = { mi: 4, jie: -16, kui: 8, vivi: -14 };   // 前後排錯開
  const ATK = { kui: { ax: 0.17, h: 0.98 }, mi: { ax: 0.27, h: 1 }, jie: { ax: 0.42, h: 0.94 }, vivi: { ax: 0.33, h: 1 } };
  const MAX_PARTS = 240, MAX_NUMS = 40, MAX_FX = 60;
  const FONT = 'system-ui, -apple-system, "PingFang TC", "Noto Sans TC", sans-serif';
  const PAINT = ['#ff5d8f', '#ffd23f', '#4fc3f7', '#7ee081', '#b28dff'];
  const PAPER = ['#ffffff', '#fff4c2', '#e3f2ff', '#ffe3ee', '#ffffff'];
  const BONUS_EMOJI = { bento: '🍱', coffee: '☕', boba: '🧋' };
  const BUFF_TXT = { atk: '攻擊 UP！', aspd: '手速 UP！', gold: '薪水 UP！' };
  const SHOW_FPS = typeof location !== 'undefined' && /[?&]fps/.test(location.search);

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
    Object.keys(BONUS_EMOJI).forEach(k => l.push(['bonus_' + k, `art/ui/bonus_${k}.webp`]));
    return l;
  }

  // ---------- 小工具 ----------
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const easeOutBack = k => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const easeOutBounce = k => {
    if (k < 1 / 2.75) return 7.5625 * k * k;
    if (k < 2 / 2.75) return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
    if (k < 2.5 / 2.75) return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
    return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const enemyH = e => e.boss ? BOSS_H : e.minion ? ENEMY_H * 0.8 : ENEMY_H;   // 頭目召喚的小怪畫小一點
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function rrect(x, x0, y0, w, h, r) {
    x.beginPath(); x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
    x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath();
  }
  // 彈簧（受擊擊退、落地彈性）：x'' = -w²x - 2ζw x'，切小步確保穩定
  function spring(a, k, v, w, z, dt) {
    while (dt > 1e-5) { const h = Math.min(dt, 1 / 120); a[v] += (-w * w * a[k] - 2 * z * w * a[v]) * h; a[k] += a[v] * h; dt -= h; }
  }
  // 柔邊陰影、光暈：一次畫好，之後只縮放貼上
  const SHADOW = (() => {
    const c = canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(20,10,30,0.55)'); g.addColorStop(0.55, 'rgba(20,10,30,0.32)'); g.addColorStop(1, 'rgba(20,10,30,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c;
  })();
  const GLOWS = new Map();
  function glow(color) {
    let c = GLOWS.get(color); if (c) return c;
    c = canvas(128, 128); const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); GLOWS.set(color, c); return c;
  }

  // 依目前 dpr 縮好的圖：n 原圖、w 白色剪影、g 灰階
  class SpriteCache {
    constructor() { this.m = new Map(); this.s = 0; }
    reset(s) { this.s = s; this.m.clear(); }
    get(im, h, kind) {
      let per = this.m.get(im); if (!per) this.m.set(im, per = new Map());
      const key = kind + Math.round(h * 4);
      let c = per.get(key);
      if (!c) { c = this.build(im, h, kind, per); per.set(key, c); }
      return c;
    }
    build(im, h, kind, per) {
      const s = this.s, ww = im.width * h / im.height;
      let c;
      if (kind === 'n') {
        c = canvas(ww * s, h * s); const x = c.getContext('2d');
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        // 縮很多時分兩步縮，邊緣比較不會鋸齒
        if (im.height > h * s * 2.2) { const m = canvas(im.width / 2, im.height / 2); const mx = m.getContext('2d'); mx.imageSmoothingQuality = 'high'; mx.drawImage(im, 0, 0, m.width, m.height); x.drawImage(m, 0, 0, c.width, c.height); }
        else x.drawImage(im, 0, 0, c.width, c.height);
      } else {
        const base = this.get(im, h, 'n');
        c = canvas(base.width, base.height); const x = c.getContext('2d'); x.drawImage(base, 0, 0);
        if (kind === 'w') { x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
        else {
          try {
            const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
            for (let i = 0; i < p.length; i += 4) { const l = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) * 0.8; p[i] = l; p[i + 1] = l; p[i + 2] = l * 1.05; }
            x.putImageData(d, 0, 0);
          } catch (e) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(90,90,110,0.6)'; x.fillRect(0, 0, c.width, c.height); }
        }
      }
      c.ww = ww; return c;
    }
  }
  // 文字預先畫成小圖（數字、泡泡、表情符號），之後每幀只貼圖
  function textCanvas(str, size, fill, stroke, lw, s, up = 1, weight = '900') {
    const k = s * up, font = `${weight} ${size * k}px ${FONT}`;
    const m = TXT.ctx; m.font = font;
    const pad = (lw || 0) * k + 2, tw = m.measureText(str).width;
    const c = canvas(tw + pad * 2, size * k * 1.35 + pad * 2), x = c.getContext('2d');
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    if (stroke) { x.lineWidth = lw * k; x.strokeStyle = stroke; x.strokeText(str, c.width / 2, c.height / 2); }
    x.fillStyle = fill; x.fillText(str, c.width / 2, c.height / 2);
    c.ww = c.width / k; c.wh = c.height / k; return c;
  }
  const TXT = { get ctx() { return this._c || (this._c = canvas(4, 4).getContext('2d')); } };
  const NOBREAK = '，。！？、…）」』,.!?~～';
  function bubbleCanvas(text, s) {
    const fs = 9.5, maxW = 116, pad = 5.5, lh = fs * 1.32, m = TXT.ctx;
    m.font = `bold ${fs * s}px ${FONT}`;
    const lines = []; let line = '';
    for (const ch of String(text)) {
      if (line && m.measureText(line + ch).width > maxW * s && !NOBREAK.includes(ch)) { lines.push(line); line = ch; }
      else line += ch;
    }
    if (line) lines.push(line);
    if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].slice(0, -1) + '…'; }
    const tw = Math.max(...lines.map(l => m.measureText(l).width)) / s;
    const bw = tw + pad * 2, bh = lines.length * lh + pad * 2 - 2;
    const c = canvas((bw + 3) * s, (bh + 3) * s), x = c.getContext('2d');
    x.scale(s, s); x.translate(1.5, 1.5);
    rrect(x, 0, 0, bw, bh, 7); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 1.5; x.strokeStyle = '#2a1f3d'; x.stroke();
    x.font = `bold ${fs}px ${FONT}`; x.fillStyle = '#2a1f3d'; x.textBaseline = 'middle'; x.textAlign = 'center';
    lines.forEach((l, i) => x.fillText(l, bw / 2, pad + lh * (i + 0.5) - 1));
    c.ww = bw + 3; c.wh = bh + 3; return c;
  }

  class Renderer {
    constructor(canvas, game) {
      this.cv = canvas; this.ctx = canvas.getContext('2d'); this.g = game;
      this.fx = []; this.nums = []; this.parts = []; this.anim = new Map(); this.later = []; this.says = [];
      this.bgX = 0; this.bgV = 0; this.cutin = null; this.flash = 0; this.flashC = '255,255,255'; this.t = 0; this.rt = 0; this.banner = null;
      this.trauma = 0; this.ox = 0; this.oy = 0; this.stop = 0; this.lastStop = -1;
      this.cast = null; this.combo = null; this.lastTap = [300, 180]; this.bossTrail = 1; this.ms = 0;
      this.sc = new SpriteCache(); this.bgc = new Map(); this.gly = new Map();
      this.scale = 0; this.resize();
      addEventListener('resize', () => this.resize());
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.resize()).observe(canvas);
    }
    resize() {
      const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      const w = Math.round(r.width * dpr), h = Math.round(r.width * H / W * dpr);
      if (w === this.cv.width && h === this.cv.height && this.scale) return;
      this.cv.width = w; this.cv.height = h;
      this.scale = this.cv.width / W;
      this.sc.reset(this.scale); this.bgc.clear(); this.gly.clear();
      this.says.forEach(b => b.c = null); this.nums.forEach(n => n.c = null);
    }
    toWorld(cx, cy) { const r = this.cv.getBoundingClientRect(); return [(cx - r.left) / r.width * W, (cy - r.top) / r.height * H]; }
    A(o) {
      let a = this.anim.get(o);
      if (!a) { a = { atk: 0, hit: 0, lunge: 0, die: 0, spawn: 0.3, phase: Math.random() * 6, kb: 0, kbv: 0, sq: 0, sqv: 0, age: 0 }; this.anim.set(o, a); }
      return a;
    }
    glyph(str, size, fill, stroke, lw, up) {
      const key = str + '|' + size + fill + stroke + lw + up;
      let c = this.gly.get(key);
      if (!c) { if (this.gly.size > 300) this.gly.clear(); c = textCanvas(str, size, fill, stroke, lw, this.scale, up); this.gly.set(key, c); }
      return c;
    }
    blit(c, x0, y0, k = 1) { const w = c.ww * k, h = (c.wh || c.height / this.scale) * k; this.ctx.drawImage(c, x0 - w / 2, y0 - h / 2, w, h); }
    // 世界座標 + 鏡頭震動；tf() 直接設矩陣，省掉 save/restore
    base() { const s = this.scale; this.ctx.setTransform(s, 0, 0, s, this.ox * s, this.oy * s); }
    tf(x0, y0, rot, sx, sy) {
      const s = this.scale, c = Math.cos(rot), n = Math.sin(rot);
      this.ctx.setTransform(s * c * sx, s * n * sx, -s * n * sy, s * c * sy, (x0 + this.ox) * s, (y0 + this.oy) * s);
    }
    addShake(v) { this.trauma = Math.min(1, this.trauma + v); }
    // 小的停頓（點擊、一般擊殺）至少隔 0.25 秒才再觸發，連點時不會一直卡卡的
    hitStop(sec) { if (sec < 0.07 && this.rt - this.lastStop < 0.25) return; this.stop = Math.max(this.stop, sec); this.lastStop = this.rt; }
    addFx(f) { if (this.fx.length >= MAX_FX) this.fx.shift(); f.t = 0; this.fx.push(f); }
    addNum(n) { n.t = 0; this.nums.push(n); if (this.nums.length > MAX_NUMS) this.nums.splice(0, this.nums.length - MAX_NUMS); }
    // 對話泡泡指向的頭部位置；倒地的英雄頭在左下
    headPos(o) {
      if (o.def) return o.dead ? [o.x - 52, GROUND + (DY[o.id] || 0) - 46] : [o.x, GROUND + (DY[o.id] || 0) - HERO_H + 6];
      return [o.x || 0, (o.y || GROUND) - enemyH(o) + 2];
    }

    // ---------- 事件 → 特效 ----------
    onEvent(e) {
      const g = this.g;
      switch (e.type) {
        case 'shoot': { const a = this.A(e.h); a.atk = 0.32; a.lunge = 0.2; a.sqv -= 3; break; }
        case 'hit': {
          const en = e.e, a = this.A(en), boss = en.boss, H0 = enemyH(en);
          const tap = e.src === 'tap', big = e.crit || e.src === 'jie-ult';
          a.hit = boss ? 0.07 : 0.1;
          a.kbv += (boss ? 0.35 : 1) * (big ? 360 : tap ? 200 : e.src === 'kui-ult' ? 240 : 110);
          a.sqv += big ? 5 : 2.5;
          this.addNum({ x: en.x + rand(-10, 10), y: en.y - H0 * 0.8, v: e.dmg, crit: big, tap, shield: !!e.shield });
          if (e.shield) this.burst(en.x - 8, en.y - H0 * 0.5, '#bfe9ff', 3, 80, 'star');
          if (tap) {
            this.burst(en.x - 10, en.y - 34, '#fff3a0', 5, 70, 'star');
            this.hitStop(0.025);
            this.tapCombo(e.combo ?? g.combo);
          }
          if (e.src === 'jie') this.addFx({ k: 'slash', x: en.x, y: en.y - 34, d: 0.22, crit: e.crit });
          if (e.src === 'kui' || e.src === 'splash') this.burst(en.x, en.y - 34, PAINT[Math.floor(Math.random() * 4)], e.src === 'kui' ? 7 : 3, 80);
          if (e.src === 'mi') this.addFx({ k: 'ring', x: en.x, y: en.y - 34, d: 0.3, c: '#9fd3ff' });
          if (e.src === 'vivi') this.burst(en.x, en.y - 34, '#7bd389', 4, 70, 'bill');
          if (big) { this.addShake(e.src === 'jie-ult' ? 0.55 : 0.28); this.hitStop(e.src === 'jie-ult' ? 0.09 : 0.055); this.burst(en.x, en.y - 40, '#ffe066', 8, 150, 'star'); }
          break;
        }
        case 'kill': {
          const en = e.e, a = this.A(en), boss = en.boss, cy = en.y - (boss ? 70 : 34);
          a.die = 0.001;
          this.addFx({ k: 'poof', x: en.x, y: cy, d: 0.4, r: boss ? 70 : 34 });
          this.paper(en.x, cy, boss ? 46 : 14, boss ? 1.6 : 1);
          this.burst(en.x, cy, ['#fff', '#ffe066'], boss ? 14 : 5, boss ? 220 : 150, 'star');
          for (let i = 0; i < (boss ? 12 : 3); i++) this.parts.push({ k: 'coin', x: en.x, y: cy, vx: rand(-60, 60), vy: rand(-200, -120), t: 0, d: rand(0.9, 1.2) });
          this.hitStop(boss ? 0.16 : 0.045);
          if (boss) { this.addShake(0.8); this.flash = 0.45; this.flashC = '255,255,255'; if (this.cast && this.cast.e === en) this.cast = null; }
          else this.addShake(0.08);
          break;
        }
        case 'hurt': {
          const a = this.A(e.h); a.hit = 0.14; a.kbv -= 120; a.sqv += 2;
          if (e.e) { const ea = this.A(e.e); ea.lunge = 0.22; ea.sqv -= 3; }
          this.addNum({ x: e.h.x, y: GROUND - HERO_H * 0.9, v: e.dmg, hurt: true });
          this.addShake(0.06);
          break;
        }
        case 'down': this.A(e.h).die = 0.001; this.addShake(0.2); break;
        case 'ult': {
          const h = e.h; this.cutin = { id: h.id, name: h.def.skill.name, t: 0, color: h.def.color };
          this.flash = 0.25; this.flashC = '255,255,255';
          if (h.id === 'kui') g.alive().forEach((en, i) => this.later.push({ t: 0.12 * i + 0.05, fn: () => { this.burst(en.x, en.y - 30, PAINT, 22, 170); this.addShake(0.12); } }));
          if (h.id === 'mi') this.addFx({ k: 'bigring', x: h.x, y: GROUND - 50, d: 0.8 });
          if (h.id === 'jie') { this.addFx({ k: 'bigslash', d: 0.45 }); this.addShake(0.5); }
          if (h.id === 'vivi') for (let i = 0; i < 40; i++) this.parts.push({ k: 'bill', x: Math.random() * W, y: -20 - Math.random() * 120, vx: rand(-15, 15), vy: rand(60, 120), rot: Math.random() * 6, t: 0, d: 2.6 });
          this.capParts();
          break;
        }
        case 'stage': this.anim.clear(); this.says.length = 0; this.cast = null; this.combo = null; this.later.length = 0; this.fx = this.fx.filter(f => f.k === 'rankup'); break;
        case 'wave':
          if (e.boss) this.banner = { text: 'BOSS 來襲！', t: 0, d: 1.6, c: '#ff4d6d' };
          g.heroes.forEach(h => { if (h.on && !h.dead) this.A(h).sqv += 4; });   // 停下時落地彈一下
          break;
        case 'clear': if (e.boss) this.banner = { text: '頭目擊破！', t: 0, d: 1.6, c: '#ffd23f' }; break;
        case 'fail': this.banner = { text: e.reason === 'time' ? '時間到…先回去練功' : '全員累倒…先回去練功', t: 0, d: 2, c: '#9aa7ff' }; break;
        case 'levelup': if (e.rankUp) { const h = g.heroes.find(x => x.id === e.id); this.addFx({ k: 'rankup', x: h.x, y: GROUND - 60, d: 1.2 }); this.burst(h.x, GROUND - 70, ['#ffd23f', '#fff'], 14, 140, 'star'); } break;
        // ---- v1.1 新事件 ----
        case 'bonusSpawn': this.burst(e.b.x, e.b.y, ['#fff', '#ffe066'], 8, 90, 'star'); break;
        case 'bonus': {
          const b = e.b;
          this.addFx({ k: 'bonusPop', x: b.x, y: b.y, kind: b.kind, d: 0.45 });
          this.addFx({ k: 'ringC', x: b.x, y: b.y, d: 0.4, c: '#ffe066', r: 40 });
          this.burst(b.x, b.y, ['#ffe066', '#fff', '#ff9ec7'], 14, 170, 'star');
          for (let i = 0; i < 6; i++) this.parts.push({ k: 'coin', x: b.x, y: b.y, vx: rand(-80, 80), vy: rand(-200, -100), t: 0, d: rand(0.9, 1.2) });
          if (e.gold) this.addNum({ x: b.x, y: b.y - 22, v: e.gold, crit: true, gold: true });
          if (e.buff && BUFF_TXT[e.buff.kind]) this.addFx({ k: 'label', x: b.x, y: b.y - 40, d: 1.3, text: BUFF_TXT[e.buff.kind] + (e.buff.dur ? ` ${Math.round(e.buff.dur)}秒` : ''), c: '#7ef0ff' });
          this.hitStop(0.04); this.flash = Math.max(this.flash, 0.12); this.flashC = '255,240,200';
          this.capParts();
          break;
        }
        case 'shieldBreak': {
          const en = e.e, H0 = enemyH(en), cy = en.y - H0 * 0.47;
          this.addFx({ k: 'ringC', x: en.x, y: cy, d: 0.4, c: '#bfe9ff', r: H0 * 0.6 });
          for (let i = 0; i < (en.boss ? 18 : 8); i++) { const a = Math.random() * 6.28, v = rand(80, 200); this.parts.push({ k: 'shard', x: en.x + Math.cos(a) * H0 * 0.3, y: cy + Math.sin(a) * H0 * 0.35, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, d: rand(0.5, 0.8), r: rand(3, 6), rot: Math.random() * 6, c: i % 2 ? '#bfe9ff' : '#ffffff' }); }
          if (!e.timeout) { this.hitStop(0.06); this.addShake(0.3); this.addFx({ k: 'label', x: en.x, y: en.y - H0 - 6, d: 1, text: '護盾破了！', c: '#bfe9ff' }); }
          this.capParts();
          break;
        }
        case 'bonusGone': this.addFx({ k: 'bonusGone', x: e.b.x, y: e.b.y, kind: e.b.kind, d: 0.5 }); break;
        case 'say': {
          if (!e.who || !e.text) break;
          const i = this.says.findIndex(b => b.who === e.who); if (i >= 0) this.says.splice(i, 1);
          while (this.says.length >= 2) this.says.shift();
          this.says.push({ who: e.who, text: e.text, t: 0, d: 2.1, c: null });
          break;
        }
        case 'bossCast': {
          const sk = e.skill || {};
          this.cast = { e: e.e, skill: sk, t: 0, d: Math.max(0.3, sk.delay || 2) };
          this.addFx({ k: 'ringC', x: e.e.x, y: e.e.y - BOSS_H * 0.5, d: 0.5, c: '#ff4d6d', r: 90 });
          break;
        }
        case 'bossHit': {
          const sk = e.skill || {}, en = e.e; this.cast = null;
          if (sk.kind === 'aoe') {
            this.addFx({ k: 'shock', x: en.x, d: 0.6 });
            g.heroes.forEach(h => { if (h.on && !h.dead) { const a = this.A(h); a.kbv -= 160; a.hit = 0.12; this.burst(h.x, GROUND - 50, ['#ff6b6b', '#ffb36b'], 6, 120); } });
            this.flash = 0.3; this.flashC = '255,60,80'; this.addShake(0.6); this.hitStop(0.08);
          } else if (sk.kind === 'summon') {
            for (let i = 0; i < 3; i++) this.puff(en.x - 34 + i * 34, GROUND - 20, 9);
            this.addShake(0.25);
          } else if (sk.kind === 'shield') {
            this.addFx({ k: 'ringC', x: en.x, y: en.y - BOSS_H * 0.5, d: 0.5, c: '#8fd8ff', r: 110 });
            this.burst(en.x, en.y - BOSS_H * 0.5, ['#bfe9ff', '#fff'], 16, 160, 'star');
          } else { this.flash = 0.2; this.flashC = '255,60,80'; this.addShake(0.4); }
          this.capParts();
          break;
        }
      }
    }
    tapFx(x, y) {
      this.lastTap = [x, y];
      this.addFx({ k: 'tap', x, y, d: 0.35 }); this.burst(x, y, '#ffe17a', 4, 50);
    }
    tapCombo(n) {
      const c = this.combo;
      if (n == null) n = c && this.rt - c.last < 0.7 ? c.n + 1 : 1;   // engine 還沒給 combo 時自己數
      if (n < 2) { if (c) c.n = n; else this.combo = { n, last: this.rt, pop: 0, x: this.lastTap[0], y: this.lastTap[1] }; return; }
      this.combo = { n, last: this.rt, pop: 0.18, x: this.lastTap[0], y: this.lastTap[1], c: c && c.n === n ? c.c : null };
    }
    burst(x, y, c, n, sp, kind = 'dot') {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.8);
        this.parts.push({ k: kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, c: Array.isArray(c) ? c[i % c.length] : c, t: 0, d: 0.5 + Math.random() * 0.4, r: 2 + Math.random() * 3, rot: Math.random() * 6 });
      }
      this.capParts();
    }
    // 死亡噴紙片：會翻面、飄落、左右擺
    paper(x, y, n, sp) {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + rand(-1.3, 1.3), v = rand(90, 230) * sp;
        this.parts.push({ k: 'paper', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, d: rand(0.9, 1.5), w: rand(4.5, 9), h: rand(3.5, 6), c: PAPER[i % PAPER.length], rot: Math.random() * 6, vr: rand(-9, 9), fl: Math.random() * 6, fr: rand(8, 16), sw: Math.random() * 6 });
      }
      this.capParts();
    }
    puff(x, y, n) { for (let i = 0; i < n; i++) this.parts.push({ k: 'puff', x: x + rand(-12, 12), y: y + rand(-10, 10), vx: rand(-30, 30), vy: rand(-50, -10), t: 0, d: rand(0.5, 0.8), r: rand(6, 12), c: i % 2 ? '#d9d2ec' : '#b9aed6' }); this.capParts(); }
    capParts() { if (this.parts.length > MAX_PARTS) this.parts.splice(0, this.parts.length - MAX_PARTS); }

    // ---------- 繪製 ----------
    draw(dt) {
      const t0 = SHOW_FPS ? performance.now() : 0;
      const g = this.g, x = this.ctx, s = this.scale;
      if (!s) { this.resize(); if (!this.scale) return; }
      this.rt += dt;
      // hit-stop：只凍結畫面動畫，遊戲照常進行
      let adt = dt;
      if (this.stop > 0) { this.stop -= dt; adt = dt * 0.05; }
      this.t += adt;
      for (let i = this.later.length - 1; i >= 0; i--) { const l = this.later[i]; l.t -= adt; if (l.t <= 0) { this.later.splice(i, 1); l.fn(); } }

      // 鏡頭震動：平滑抖動，幅度隨 trauma² 衰減，最多 6px，避免暈
      if (this.trauma > 0) {
        const a = 6 * this.trauma * this.trauma, r = this.rt;
        this.ox = a * (Math.sin(r * 53) * 0.6 + Math.sin(r * 91 + 1.3) * 0.4);
        this.oy = a * 0.55 * (Math.sin(r * 67 + 2.1) * 0.6 + Math.sin(r * 113) * 0.4);
        this.trauma = Math.max(0, this.trauma - dt * 1.9);
      } else { this.ox = 0; this.oy = 0; }

      this.drawBg(dt);
      this.base();

      // 先算姿勢，再畫全部陰影與地面預警，最後畫角色（陰影不會蓋到別人身上）
      const heroes = this.heroList || (this.heroList = g.heroes.slice().sort((a, b) => DY[a.id] - DY[b.id]));
      const ens = this.enList || (this.enList = []);
      ens.length = 0; for (const e of g.enemies) ens.push(e);
      ens.sort((a, b) => b.x - a.x);
      for (const h of heroes) if (h.on) this.poseHero(h, adt);
      for (const e of ens) this.poseEnemy(e, adt);
      for (const h of heroes) if (h.on) this.drawShadow(this.A(h).p);
      for (const e of ens) { const p = this.A(e).p; if (p) this.drawShadow(p); }
      if (this.cast) this.drawCastGround(dt);
      for (const h of heroes) if (h.on) this.drawPose(this.A(h).p);
      for (const e of ens) { const p = this.A(e).p; if (p) this.drawPose(p); }

      for (const p of g.shots) this.drawShot(p);
      this.base();
      this.drawFx(adt);
      this.drawParts(adt);
      this.drawSays(dt);
      if (g.bonuses) this.drawBonuses(adt);   // 道具要點，畫在泡泡上面
      this.base();
      this.drawNums(adt);
      this.drawCombo(dt);
      x.setTransform(s, 0, 0, s, 0, 0);
      this.drawHud(dt);
      if (this.cutin) this.drawCutin(dt);
      if (this.banner) this.drawBanner(dt);
      if (this.flash > 0) { x.fillStyle = `rgba(${this.flashC},${this.flash})`; x.fillRect(0, 0, W, H); this.flash = Math.max(0, this.flash - dt * 1.5); }
      if (SHOW_FPS) {
        const ms = performance.now() - t0; this.ms += (ms - this.ms) * 0.05; this.fps = (this.fps || 60) + ((dt > 0 ? 1 / dt : 60) - (this.fps || 60)) * 0.05;
        x.font = `bold 9px ${FONT}`; x.textAlign = 'left'; x.fillStyle = '#000a'; x.fillRect(2, H - 14, 118, 12); x.fillStyle = '#7f7';
        x.fillText(`draw ${this.ms.toFixed(2)}ms ${Math.round(this.fps)}fps p${this.parts.length}`, 5, H - 5);
      }
    }
    bgKey() { const s = this.g.s.stage; return s >= 50 ? 'bg' + (Math.floor((s - 50) / 10) % 5 + 1) : D.CHAPTERS[G.Engine.chapterOf(s)].bg; }
    // 背景依實際比例縮成整數像素高的 tile，連同底部壓暗一起快取
    bgTile(im) {
      let c = this.bgc.get(im); if (c) return c;
      const th = this.cv.height, tw = Math.max(2, Math.round(im.width / im.height * th));
      c = canvas(tw, th); const x = c.getContext('2d');
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(im, 0, 0, tw, th);
      const gr = x.createLinearGradient(0, th * 0.55, 0, th);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
      x.fillStyle = gr; x.fillRect(0, Math.floor(th * 0.55), tw, th);
      this.bgc.set(im, c); return c;
    }
    drawBg(dt) {
      const g = this.g, x = this.ctx;
      // 捲動速度平滑加減速
      const target = g.phase === 'walk' ? 90 : 0;
      this.bgV += (target - this.bgV) * (1 - Math.exp(-dt * 7));
      if (this.bgV < 0.5 && target === 0) this.bgV = 0;
      this.bgX += this.bgV * dt;
      const im = IMG[this.bgKey()];
      x.setTransform(1, 0, 0, 1, 0, 0);
      if (!im) { x.fillStyle = '#ccd'; x.fillRect(0, 0, this.cv.width, this.cv.height); return; }
      // tile 已預先縮好、整數像素 1:1 貼上，不會有縫；不重疊（重疊 1px 會跳掉一欄，無縫圖反而看得出來）
      const c = this.bgTile(im), p = c.width;
      if (this.bgX > 1e6) this.bgX %= p / this.scale;
      const ox = Math.round(this.ox * this.scale * 0.5);
      let px = -(Math.round(this.bgX * this.scale) % p) + ox;
      while (px > 0) px -= p;
      for (; px < this.cv.width; px += p) x.drawImage(c, px, 0);
    }
    drawShadow(p) {
      if (!p || p.shW <= 0) return;
      const x = this.ctx, w = p.shW;
      x.globalAlpha = p.shA ?? 1;
      x.drawImage(SHADOW, p.shX - w, p.shY - w * 0.26 + 1, w * 2, w * 0.52);
      x.globalAlpha = 1;
    }

    poseHero(h, dt) {
      const g = this.g, a = this.A(h);
      a.atk = Math.max(0, a.atk - dt); a.hit = Math.max(0, a.hit - dt); a.lunge = Math.max(0, a.lunge - dt);
      spring(a, 'kb', 'kbv', 22, 0.6, dt); spring(a, 'sq', 'sqv', 30, 0.32, dt);
      a.kb = clamp(a.kb, -14, 14); a.sq = clamp(a.sq, -0.18, 0.18);
      const walking = g.phase === 'walk', t = this.t + a.phase;
      const rank = g.rank(g.s.heroes[h.id]), pro = rank >= 2 && IMG['pro_' + h.id];
      const ground = GROUND + DY[h.id];
      const p = a.p || (a.p = {});
      p.shX = h.x; p.shY = ground; p.shW = 19; p.shA = 1; p.extra = null; p.hero = h; p.enemy = null;
      if (h.dead) {
        a.die = Math.min(1, (a.die || 0) + dt * 2.6);
        const k = easeOutBounce(a.die);
        Object.assign(p, { im: pro ? IMG['pro_' + h.id] : IMG[h.id], h: HERO_H, cx: h.x - k * 4, foot: ground, ax: 0.5, sx: 1, sy: 1 - k * 0.12, rot: -k * 1.2, white: 0, alpha: 0.85, grey: true });
        p.shW = 19 + k * 12; p.extra = 'zz';
        return;
      }
      let cx = h.x + a.kb, foot = ground, sx = 1 - Math.sin(t * 3) * 0.012, sy = 1 + Math.sin(t * 3) * 0.018, rot = 0;
      if (walking) {
        // 走路：離地時拉長、踩地時壓扁，身體微微前傾
        const ph = t * 9, up = Math.abs(Math.sin(ph));
        foot -= up * 5; sy = 1 + (up - 0.45) * 0.07; sx = 1 - (up - 0.45) * 0.05; rot = Math.sin(ph) * 0.035 + 0.03;
        p.shW = 19 * (1 - up * 0.12); p.shA = 1 - up * 0.25;
      } else if (g.phase === 'fight' && a.atk <= 0 && h.cd > 0 && h.cd < 0.16) {
        // 蓄力：往後縮、壓低
        const w = 1 - h.cd / 0.16;
        cx -= w * 3.5; sx += w * 0.05; sy -= w * 0.06; rot = -w * 0.05;
      }
      if (a.lunge > 0) cx += Math.sin(a.lunge / 0.2 * Math.PI) * 7;
      sx *= 1 + a.sq; sy *= 1 - a.sq;
      const white = a.hit > 0 ? 0.7 : 0;
      if (a.atk > 0 && !pro && IMG['atk_' + h.id]) {
        const k = ATK[h.id];
        Object.assign(p, { im: IMG['atk_' + h.id], h: HERO_H * k.h, cx, foot, ax: k.ax, sx: 1 + a.sq, sy: 1 - a.sq, rot: 0, white, alpha: 1, grey: false });
      } else {
        const pop = a.atk > 0 ? 1 + Math.sin(a.atk / 0.32 * Math.PI) * 0.06 : 1;
        Object.assign(p, { im: pro ? IMG['pro_' + h.id] : IMG[h.id], h: HERO_H, cx, foot, ax: 0.5, sx: sx * pop, sy: sy * (2 - pop), rot, white, alpha: 1, grey: false });
      }
      p.extra = 'hero';
    }
    poseEnemy(e, dt) {
      const a = this.A(e), H0 = enemyH(e), im = e.t.img ? IMG[e.t.img] : IMG[e.k];
      a.hit = Math.max(0, a.hit - dt); a.lunge = Math.max(0, a.lunge - dt); a.spawn = Math.max(0, a.spawn - dt);
      spring(a, 'kb', 'kbv', 20, 0.55, dt); spring(a, 'sq', 'sqv', 32, 0.3, dt);
      a.kb = clamp(a.kb, -10, 22); a.sq = clamp(a.sq, -0.2, 0.2);
      const t = this.t + a.phase;
      if (e.dead) {
        if (a.die <= 0) { a.p = null; return; }
        // 死亡：先鼓起閃白，再縮小消失
        a.die += dt * 2.6; if (a.die > 1) { a.die = 0; a.p = null; return; }
        const k = a.die, sc = k < 0.25 ? 1 + k * 0.6 : 1.15 * (1 - (k - 0.25) / 0.75 * 0.9);
        a.p = { im, h: H0, cx: e.x + a.kb, foot: e.y - k * 8, ax: 0.5, sx: sc * (1 + a.sq), sy: sc * (1 - a.sq), rot: k * 0.5, white: Math.min(1, 0.5 + k), alpha: k < 0.6 ? 1 : (1 - k) / 0.4, grey: false, flip: !!e.t.img, shX: e.x, shY: GROUND, shW: (e.boss ? 40 : 21) * (1 - k), shA: 1, extra: null };
        return;
      }
      let cx = e.x + a.kb, foot = e.y, sy = 1, sx = 1, rot = 0, shW = e.boss ? 40 : 21;
      if (e.walking) {
        const ph = t * 8, up = Math.abs(Math.sin(ph));
        foot -= up * 6; sy = 1 + (up - 0.4) * 0.09; sx = 1 - (up - 0.4) * 0.06; rot = Math.sin(ph) * 0.05;
        shW *= 1 - up * 0.15;
      } else {
        sy = 1 + Math.sin(t * 3.5) * 0.03; sx = 1 - Math.sin(t * 3.5) * 0.02;
        if (!(e.stun > 0) && e.cd > 0 && e.cd < 0.25 && a.lunge <= 0) {   // 攻擊前往後仰
          const w = 1 - e.cd / 0.25; cx += w * 5; sy -= w * 0.07; sx += w * 0.06; rot = w * 0.06;
        }
      }
      if (a.lunge > 0) { const k = Math.sin(a.lunge / 0.22 * Math.PI); cx -= k * 14; rot -= k * 0.08; }
      if (this.cast && this.cast.e === e) cx += Math.sin(this.rt * 60) * 1.2;   // 頭目蓄力發抖
      const sp = a.spawn > 0 ? easeOutBack(1 - a.spawn / 0.3) : 1;
      sx *= (1 + a.sq) * sp; sy *= (1 - a.sq) * sp;
      a.p = { im, h: H0, cx, foot, ax: 0.5, sx, sy, rot, white: a.hit > 0 ? (e.boss ? 0.3 : 0.55) : 0, alpha: 1, grey: false, flip: !!e.t.img, shX: e.x + a.kb * 0.5, shY: GROUND, shW, shA: 1, extra: 'enemy', enemy: e };
    }
    drawPose(p) {
      if (!p) return;
      const x = this.ctx, e = p.enemy, h = p.hero;
      if (p.extra === 'hero' && this.g.buffT > 0) {
        x.globalAlpha = 0.45 + Math.sin(this.rt * 10) * 0.12;
        x.drawImage(glow('rgba(255,210,63,0.9)'), h.x - 34, p.foot - 14, 68, 22);
        x.globalAlpha = 1;
      }
      if (e && e.boss) {
        x.globalAlpha = (this.cast && this.cast.e === e ? 0.55 + Math.sin(this.rt * 18) * 0.25 : 0.32 + Math.sin(this.rt * 4) * 0.1);
        const r = p.h * 0.62; x.drawImage(glow('rgba(255,61,110,0.9)'), e.x - r, p.foot - p.h * 0.5 - r * 1.15, r * 2, r * 2.3);
        x.globalAlpha = 1;
      }
      this.sprite(p.im, p.cx, p.foot, p.h, p);
      if (p.extra === 'zz') { this.blit(this.glyph('💤', 10, '#fff', null, 0, 1), h.x - 18, p.foot - 26 + Math.sin(this.rt * 3) * 3); return; }
      if (h) {
        if (h.shield > 0) this.bubble(h.x, p.foot - HERO_H * 0.48, 30, HERO_H * 0.56, '140,200,255');
        this.bar(h.x - 18, p.foot + 6, 36, 4, h.hp / h.max, '#5ee07a');
      }
      if (e) {
        const H0 = p.h;
        if (e.shield > 0) this.bubble(e.x, e.y - H0 * 0.47, H0 * (e.boss ? 0.4 : 0.48), H0 * 0.56, '120,210,255');
        if (e.stun > 0) {
          const yy = e.y - H0 - 4;
          this.blit(this.glyph('請稍候…', 9, '#fff', '#335', 3, 1), e.x, yy);
          x.fillStyle = '#ffe066';
          for (let i = 0; i < 3; i++) { const an = this.rt * 5 + i * 2.1; x.beginPath(); x.arc(e.x + Math.cos(an) * 14, yy + 9 + Math.sin(an) * 3.5, 2, 0, 7); x.fill(); }
        }
        if (!e.boss) {
          this.bar(e.x - 16, e.y + 6, 32, 3, e.hp / e.max, '#ff6b6b');
          if (e.shield > 0 && e.shieldMax) { x.fillStyle = '#8fd8ff'; x.fillRect(e.x - 16, e.y + 3, 32 * clamp(e.shield / e.shieldMax, 0, 1), 2); }
        }
      }
    }
    bubble(cx, cy, rx, ry, rgb) {
      const x = this.ctx;
      x.fillStyle = `rgba(${rgb},0.16)`; x.strokeStyle = `rgba(${rgb},0.85)`; x.lineWidth = 2;
      x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); x.stroke();
      const a = this.rt * 1.6; x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineWidth = 2.5;
      x.beginPath(); x.ellipse(cx, cy, rx * 0.86, ry * 0.9, 0, a, a + 0.7); x.stroke();
    }
    sprite(im, cx, footY, h, o) {
      if (!im) return;
      const x = this.ctx, c = this.sc.get(im, h, o.grey ? 'g' : 'n'), w = c.ww, ax = o.ax ?? 0.5;
      this.tf(cx, footY, o.rot || 0, (o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
      const al = o.alpha ?? 1;
      x.globalAlpha = al;
      x.drawImage(c, -w * ax, -h, w, h);
      if (o.white) { x.globalAlpha = al * o.white; x.drawImage(this.sc.get(im, h, 'w'), -w * ax, -h, w, h); }
      x.globalAlpha = 1;
      this.base();
    }
    bar(x0, y0, w, h, p, c) { const x = this.ctx; x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(x0 - 1, y0 - 1, w + 2, h + 2); x.fillStyle = c; x.fillRect(x0, y0, w * clamp(p, 0, 1), h); }

    drawShot(p) {
      const x = this.ctx, k = Math.min(1, p.life / p.dur);
      const px = p.x + (p.tx - p.x) * k, py = p.y + (p.ty - p.y) * k - Math.sin(k * Math.PI) * 26;
      if (p.kind === 'paint') { x.fillStyle = PAINT[Math.floor(p.life * 30) % 4]; x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); x.globalAlpha = 0.4; x.beginPath(); x.arc(px - 6, py + 2, 3, 0, 7); x.fill(); x.globalAlpha = 1; }
      else if (p.kind === 'wave') { x.strokeStyle = '#9fd3ff'; x.lineWidth = 2.5; for (let i = 0; i < 3; i++) { x.globalAlpha = 1 - i * 0.3; x.beginPath(); x.arc(px - i * 7, py, 6 + i * 2, -0.9, 0.9); x.stroke(); } x.globalAlpha = 1; }
      else if (p.kind === 'money') { this.tf(px, py, p.life * 14, 1, 1); x.fillStyle = '#7bd389'; x.fillRect(-6, -3.5, 12, 7); x.strokeStyle = '#2f8f4e'; x.lineWidth = 1; x.strokeRect(-6, -3.5, 12, 7); this.base(); }
      else if (p.kind === 'slash') { x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 3; x.beginPath(); x.moveTo(px - 10, py); x.lineTo(px + 6, py); x.stroke(); }
    }
    drawFx(dt) {
      const x = this.ctx;
      let n = 0;
      for (const f of this.fx) {
        f.t += dt; const k = Math.min(1, f.t / f.d);
        if (f.t < f.d) this.fx[n++] = f; else continue;
        x.globalAlpha = 1;
        if (f.k === 'slash') { x.strokeStyle = f.crit ? '#ffe066' : '#fff'; x.lineWidth = (f.crit ? 5 : 3) * (1 - k * 0.6); x.globalAlpha = 1 - k; x.beginPath(); x.arc(f.x - 6, f.y + 6, 24, -2.4 + k * 0.6, -0.4 + k * 0.6); x.stroke(); }
        else if (f.k === 'ring') { x.strokeStyle = f.c; x.lineWidth = 2; x.globalAlpha = 1 - k; x.beginPath(); x.arc(f.x, f.y, 6 + k * 18, 0, 7); x.stroke(); }
        else if (f.k === 'ringC') { x.strokeStyle = f.c; x.lineWidth = 3 * (1 - k) + 0.5; x.globalAlpha = 1 - k; x.beginPath(); x.arc(f.x, f.y, 4 + (1 - (1 - k) * (1 - k)) * f.r, 0, 7); x.stroke(); }
        else if (f.k === 'bigring') { x.strokeStyle = '#9fd3ff'; x.lineWidth = 4; x.globalAlpha = 1 - k; for (let i = 0; i < 3; i++) { const r = k * 400 - i * 40; if (r <= 0) continue; x.beginPath(); x.arc(f.x, f.y, r, -1, 1); x.stroke(); } }
        else if (f.k === 'bigslash') {
          // 斜斬：外層金色寬帶 + 內層白色細帶，不用 shadowBlur
          const x0 = -20, y0 = 232 - k * 40, x1 = W + 20, y1 = 88 + k * 40, th = 16 * (1 - k) + 1;
          const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
          const band = (wd, c, al) => { x.globalAlpha = al; x.fillStyle = c; x.beginPath(); x.moveTo(x0, y0); x.lineTo((x0 + x1) / 2 + nx * wd, (y0 + y1) / 2 + ny * wd); x.lineTo(x1, y1); x.lineTo((x0 + x1) / 2 - nx * wd, (y0 + y1) / 2 - ny * wd); x.closePath(); x.fill(); };
          band(th * 2.4, '#ffd23f', 0.45 * (1 - k)); band(th, '#fff', 1 - k * 0.7);
        }
        else if (f.k === 'tap') {
          x.strokeStyle = '#fff3a0'; x.lineWidth = 3 * (1 - k) + 0.5; x.globalAlpha = 1 - k; x.beginPath(); x.arc(f.x, f.y, 4 + k * 16, 0, 7); x.stroke();
          this.blit(this.glyph('催！', 12, '#fff', '#a0522d', 3, 1.4), f.x, f.y - 10 - k * 14, k < 0.15 ? 0.7 + k * 3 : 1.15 - k * 0.15);
        }
        else if (f.k === 'rankup') { x.globalAlpha = 1 - k * k; this.blit(this.glyph('升職！', 13, '#ffd23f', '#7a3e00', 3, 1), f.x, f.y - k * 30); x.strokeStyle = '#ffd23f'; x.lineWidth = 3; x.beginPath(); x.arc(f.x, f.y + 20, k * 50, 0, 7); x.stroke(); }
        else if (f.k === 'poof') {
          x.globalAlpha = (1 - k) * 0.9; x.strokeStyle = '#fff'; x.lineWidth = 4 * (1 - k) + 0.5;
          x.beginPath(); x.arc(f.x, f.y, f.r * (0.3 + 0.7 * (1 - (1 - k) * (1 - k))), 0, 7); x.stroke();
          x.fillStyle = '#fff'; x.globalAlpha = (1 - k) * 0.5;
          for (let i = 0; i < 6; i++) { const an = i * 1.047 + 0.3, rr = f.r * 0.75 * k; x.beginPath(); x.arc(f.x + Math.cos(an) * rr, f.y + Math.sin(an) * rr * 0.8, f.r * 0.22 * (1 - k), 0, 7); x.fill(); }
        }
        else if (f.k === 'shock') {
          const r = 20 + k * 440; x.globalAlpha = 1 - k;
          x.strokeStyle = '#ff4d6d'; x.lineWidth = 14 * (1 - k) + 1; x.beginPath(); x.ellipse(f.x, GROUND, r, r * 0.16, 0, 0, Math.PI * 2); x.stroke();
          x.strokeStyle = '#ffd0a0'; x.lineWidth = 4 * (1 - k) + 0.5; x.beginPath(); x.ellipse(f.x, GROUND, r * 0.92, r * 0.15, 0, 0, Math.PI * 2); x.stroke();
        }
        else if (f.k === 'label') {
          const a = k < 0.1 ? k / 0.1 : k > 0.75 ? (1 - k) / 0.25 : 1; x.globalAlpha = a;
          this.blit(this.glyph(f.text, 11, f.c, '#10233a', 3, 1.3), f.x, f.y - 16 * (1 - Math.exp(-f.t * 4)), k < 0.12 ? 0.6 + k * 4.5 : 1.08 - Math.min(0.08, k * 0.3));
        }
        else if (f.k === 'bonusPop' || f.k === 'bonusGone') {
          const pop = f.k === 'bonusPop';
          const sc = pop ? 1 + easeOutBack(k) * 0.7 : 1 - k * 0.3, al = pop ? 1 - k * k : 1 - k;
          const px = pop ? f.x : f.x + k * 60, py = pop ? f.y : f.y - k * 50;
          this.drawBonusItem(f.kind, px, py, sc, al, pop && k < 0.25 ? 0.9 - k * 3 : 0, pop ? k * 0.4 : k * 0.8);
        }
      }
      this.fx.length = n;
      x.globalAlpha = 1;
    }
    drawBonusItem(kind, px, py, sc, al, white, rot) {
      const x = this.ctx, im = IMG['bonus_' + kind];
      if (im) { this.sprite(im, px, py + BONUS_H * 0.5 * sc, BONUS_H, { sx: sc, sy: sc, alpha: al, white, rot }); return; }
      x.globalAlpha = al;
      const c = this.glyph(BONUS_EMOJI[kind] || '🎁', 30, '#fff', null, 0, 1.8);
      this.tf(px, py, rot || 0, sc, sc); this.blit(c, 0, 0); this.base();
      x.globalAlpha = 1;
    }
    drawBonuses(dt) {
      const x = this.ctx;
      for (const b of this.g.bonuses) {
        const a = this.A(b); a.age += dt;
        const remain = b.life != null && b.t != null ? (b.t <= b.life ? b.life - b.t : b.life) : 9;
        const fade = Math.min(1, a.age / 0.25), blink = remain < 1.5 ? 0.55 + 0.45 * Math.cos(this.rt * 18) : 1;
        const py = b.y, rot = Math.sin(this.rt * 2.3 + 1) * 0.12;
        // 光暈 + 旋轉光芒
        x.globalCompositeOperation = 'lighter';
        x.globalAlpha = (0.55 + Math.sin(this.rt * 6) * 0.15) * fade;
        x.drawImage(glow('rgba(255,220,120,0.8)'), b.x - 36, py - 36, 72, 72);
        x.globalAlpha = 0.22 * fade; x.fillStyle = '#fff6c8';
        const r0 = this.rt * 0.9;
        x.beginPath();
        for (let i = 0; i < 8; i++) { const an = r0 + i * Math.PI / 4; x.moveTo(b.x, py); x.lineTo(b.x + Math.cos(an - 0.13) * 40, py + Math.sin(an - 0.13) * 40); x.lineTo(b.x + Math.cos(an + 0.13) * 40, py + Math.sin(an + 0.13) * 40); }
        x.fill();
        x.globalCompositeOperation = 'source-over';
        const pr = (this.rt * 1.2) % 1;
        x.globalAlpha = (1 - pr) * 0.8 * fade; x.strokeStyle = '#fff'; x.lineWidth = 2.5 * (1 - pr) + 0.5;
        x.beginPath(); x.arc(b.x, py, 20 + pr * 18, 0, 7); x.stroke();
        this.drawBonusItem(b.kind, b.x, py, fade < 1 ? easeOutBack(fade) : 1 + Math.sin(this.rt * 5) * 0.04, fade * blink, 0, rot);
        // 閃光
        x.fillStyle = '#fff';
        for (let i = 0; i < 2; i++) {
          const ph = (this.rt * 1.4 + i * 0.5) % 1, tw = Math.sin(ph * Math.PI);
          const sx = b.x + (i ? 18 : -16), sy = py + (i ? -16 : 8);
          x.globalAlpha = tw * fade; x.fillRect(sx - 4 * tw, sy - 0.75, 8 * tw, 1.5); x.fillRect(sx - 0.75, sy - 4 * tw, 1.5, 8 * tw);
        }
        if (a.age < 4) { x.globalAlpha = fade * (a.age > 3.5 ? (4 - a.age) * 2 : 1); this.blit(this.glyph('點我！', 9, '#fff', '#b4532a', 3, 1), b.x, py + 30 + Math.abs(Math.sin(this.rt * 5)) * -3); }
        x.globalAlpha = 1;
        if (Math.random() < dt * 10) this.parts.push({ k: 'star', x: b.x + rand(-14, 14), y: py + rand(-10, 14), vx: rand(-10, 10), vy: rand(10, 30), c: '#ffe9a0', t: 0, d: 0.5, r: 2, rot: 0 });
      }
    }
    drawParts(dt) {
      const x = this.ctx;
      let n = 0;
      for (const p of this.parts) {
        p.t += dt;
        if (p.t >= p.d || p.y > H + 40) continue;
        this.parts[n++] = p;
        const life = p.t / p.d;
        if (p.k === 'coin') { // 先彈起，再飛向左上角薪水
          if (life < 0.45) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; }
          else { const q = 1 - Math.exp(-dt * 7); p.x += (12 - p.x) * q; p.y += (-10 - p.y) * q; }
          const fl = Math.abs(Math.cos(p.t * 9));
          x.fillStyle = '#ffcc33'; x.strokeStyle = '#b8860b'; x.lineWidth = 1;
          x.beginPath(); x.ellipse(p.x, p.y, 3.6 * fl + 0.6, 3.6, 0, 0, 7); x.fill(); x.stroke();
          continue;
        }
        if (p.k === 'bill') { p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 4; this.tf(p.x, p.y, p.rot, 1, Math.cos(p.t * 5)); x.fillStyle = '#7bd389'; x.fillRect(-7, -4, 14, 8); x.fillStyle = '#2f8f4e'; x.fillRect(-2, -2, 4, 4); continue; }
        if (p.k === 'paper') {
          p.vy += 300 * dt; p.vx *= 1 - Math.min(1, 1.8 * dt);
          if (p.vy > 55) p.vy += (55 - p.vy) * Math.min(1, 6 * dt);
          p.x += p.vx * dt + Math.sin(p.t * 7 + p.sw) * 20 * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
          x.globalAlpha = life > 0.7 ? (1 - life) / 0.3 : 1;
          this.tf(p.x, p.y, p.rot, 1, Math.cos(p.t * p.fr + p.fl));
          x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          if (p.w > 6.5) { x.fillStyle = 'rgba(90,110,160,0.45)'; x.fillRect(-p.w / 2 + 1, -p.h / 2 + 1.2, p.w - 2, 0.7); x.fillRect(-p.w / 2 + 1, 0.4, p.w - 3, 0.7); }
          x.globalAlpha = 1;
          continue;
        }
        if (p.k === 'puff') {
          p.x += p.vx * dt; p.y += p.vy * dt;
          x.globalAlpha = (1 - life) * 0.8; x.fillStyle = p.c;
          x.beginPath(); x.arc(p.x, p.y, p.r * (0.6 + life * 0.9), 0, 7); x.fill(); x.globalAlpha = 1;
          continue;
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 300 * dt; p.vx *= 1 - Math.min(1, dt * 1.5);
        x.globalAlpha = 1 - life;
        x.fillStyle = p.c;
        if (p.k === 'shard') { const r = p.r * (1 - life * 0.3); this.tf(p.x, p.y, p.rot + p.t * 9, 1, 1); x.beginPath(); x.moveTo(0, -r); x.lineTo(r * 0.6, r * 0.5); x.lineTo(-r * 0.5, r * 0.4); x.closePath(); x.fill(); }
        else if (p.k === 'star') { const r = p.r * 1.6 * (1 - life * 0.5); this.tf(p.x, p.y, p.rot + p.t * 6, 1, 1); x.fillRect(-r, -0.8, r * 2, 1.6); x.fillRect(-0.8, -r, 1.6, r * 2); }
        else { x.beginPath(); x.arc(p.x, p.y, p.r * (1 - life * 0.4), 0, 7); x.fill(); }
        x.globalAlpha = 1;
      }
      this.parts.length = n;
      if (n > MAX_PARTS) this.parts.splice(0, n - MAX_PARTS);
      this.base();
    }
    drawNums(dt) {
      const x = this.ctx;
      let n = 0;
      for (const m of this.nums) {
        m.t = (m.t || 0) + dt;
        const d = m.crit ? 1.0 : 0.75;
        if (m.t >= d) continue;
        this.nums[n++] = m;
        if (!m.c) {
          const s = m.gold ? '💸 +' + G.fmt(m.v) : (m.crit && !m.gold ? '爆擊 ' : '') + G.fmt(m.v);
          m.c = m.hurt ? textCanvas(s, 10, '#ff6b6b', '#5a0010', 3, this.scale, 1.4)
            : m.crit ? textCanvas(s, 16, '#ffd23f', '#5a1800', 3.5, this.scale, 1.8)
            : m.shield ? textCanvas('🛡' + s, 9.5, '#bfe9ff', '#0e2a44', 3, this.scale, 1.4)
            : m.tap ? textCanvas(s, 9, '#fff7c2', '#2a1a00', 3, this.scale, 1.4)
            : textCanvas(s, 10, '#fff', '#2a1a00', 3, this.scale, 1.4);
        }
        const t = m.t, k = t / d;
        let sc, y = m.y - 24 * (1 - Math.exp(-t * 4)), xx = m.x;
        if (m.crit) {
          // 爆擊：先放大彈跳再穩住
          sc = t < 0.08 ? 0.5 + t / 0.08 * 1.1 : 1 + 0.6 * Math.exp(-(t - 0.08) * 11) * Math.cos((t - 0.08) * 30);
          y = m.y - 10 - 18 * (1 - Math.exp(-t * 3));
        } else sc = t < 0.06 ? 0.6 + t / 0.06 * 0.65 : 1 + 0.25 * Math.exp(-(t - 0.06) * 14);
        x.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        this.blit(m.c, xx, y, sc);
      }
      this.nums.length = n;
      x.globalAlpha = 1;
    }
    drawSays(dt) {
      const x = this.ctx;
      let n = 0;
      for (const b of this.says) {
        b.t += dt; if (b.t >= b.d) continue;
        this.says[n++] = b;
        if (!b.c) b.c = bubbleCanvas(b.text, this.scale);
        const who = b.who, a = this.anim.get(who);
        const [x0, hy] = this.headPos(who), hx = x0 + (a ? a.kb : 0);
        const w = b.c.ww, h = b.c.wh;
        const bx = clamp(hx, w / 2 + 3, W - w / 2 - 3);
        let by = hy - 8 - h / 2 + Math.sin(this.rt * 3 + n) * 1.2;
        const top = (this.cast ? 67 : this.g.enemies.some(e => e.boss && !e.dead) ? 38 : 3) + h / 2;
        by = Math.max(by, top);
        const k = b.t, sc = k < 0.14 ? easeOutBack(k / 0.14) : 1;
        x.globalAlpha = b.t > b.d - 0.25 ? (b.d - b.t) / 0.25 : 1;
        // 尾巴
        const tx = clamp(hx, bx - w / 2 + 8, bx + w / 2 - 8), ty0 = by + h / 2 - 2.5;
        if (hy > ty0 + 2) {
          x.fillStyle = '#fff'; x.strokeStyle = '#2a1f3d'; x.lineWidth = 1.5;
          x.beginPath(); x.moveTo(tx - 4, ty0); x.lineTo(clamp(hx, tx - 6, tx + 6), Math.min(hy - 1, ty0 + 8 * sc)); x.lineTo(tx + 4, ty0); x.fill(); x.stroke();
        }
        this.blit(b.c, bx, by, sc);
        x.globalAlpha = 1;
      }
      this.says.length = n;
    }
    drawCombo(dt) {
      const c = this.combo; if (!c || c.n < 2) return;
      const since = this.rt - c.last;
      if (since > 1.1) { this.combo = null; return; }
      const n = c.n;
      if (!c.c) {
        const [fill, stroke] = n >= 50 ? ['#ff5d7a', '#3a0010'] : n >= 25 ? ['#ff9a3c', '#4a1600'] : n >= 10 ? ['#ffd23f', '#5a2a00'] : ['#fff', '#7a3e00'];
        c.c = textCanvas(`${n} 連擊！`, 11 + Math.min(n, 60) * 0.22, fill, stroke, 3.5, this.scale, 1.5);
      }
      c.pop = Math.max(0, c.pop - dt);
      const sc = 1 + c.pop / 0.18 * 0.35, x = this.ctx;
      const px = clamp(c.x - 34, c.c.ww / 2 + 4, W - c.c.ww / 2 - 4), py = clamp(c.y - 30, 46, H - 20);
      x.globalAlpha = since > 0.8 ? (1.1 - since) / 0.3 : 1;
      this.tf(px, py, -0.08, sc, sc); this.blit(c.c, 0, 0); this.base();
      x.globalAlpha = 1;
    }
    drawCastGround(dt) {
      const c = this.cast, x = this.ctx;
      c.t = c.e && c.e.cast && c.e.cast.t != null ? c.d - c.e.cast.t : c.t + dt;
      if (c.t > c.d + 0.4 || !c.e || c.e.dead) { this.cast = null; return; }
      const k = Math.min(1, c.t / c.d), blink = 0.5 + 0.5 * Math.sin(this.rt * (8 + k * 18));
      const kind = c.skill.kind;
      if (kind === 'aoe') {
        // 紅色範圍：英雄站的地面，隨倒數填滿
        const front = this.g.heroes.filter(h => h.on).reduce((m, h) => Math.max(m, h.x), 120);
        const x0 = 30, x1 = front + 40, cy = GROUND + 2, ry = 15;
        x.globalAlpha = 0.18 + blink * 0.22; x.fillStyle = '#ff3d55';
        x.beginPath(); x.ellipse((x0 + x1) / 2, cy, (x1 - x0) / 2, ry, 0, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 0.5; x.fillStyle = '#ff3d55';
        x.beginPath(); x.ellipse((x0 + x1) / 2, cy, (x1 - x0) / 2 * k, ry * k, 0, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 0.7 + blink * 0.3; x.strokeStyle = '#ff2a44'; x.lineWidth = 2; x.setLineDash([6, 4]); x.lineDashOffset = -this.rt * 30;
        x.beginPath(); x.ellipse((x0 + x1) / 2, cy, (x1 - x0) / 2, ry, 0, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
      } else if (kind === 'summon') {
        x.strokeStyle = '#b28dff'; x.lineWidth = 2; x.setLineDash([5, 4]);
        for (let i = 0; i < 3; i++) { x.globalAlpha = 0.5 + blink * 0.4; x.lineDashOffset = this.rt * 20 * (i % 2 ? 1 : -1); x.beginPath(); x.ellipse(c.e.x - 34 + i * 34, GROUND + 2, 15 * (0.5 + k * 0.5), 5 * (0.5 + k * 0.5), 0, 0, Math.PI * 2); x.stroke(); }
        x.setLineDash([]);
      } else if (kind === 'shield') {
        const e = c.e, cy = e.y - BOSS_H * 0.5;
        x.strokeStyle = '#8fd8ff'; x.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) { const an = i * 1.05 + this.rt, r = 70 * (1 - ((this.rt * 1.5 + i / 6) % 1)); x.globalAlpha = 0.8 * (r / 70); x.beginPath(); x.arc(e.x + Math.cos(an) * r, cy + Math.sin(an) * r, 2.5, 0, 7); x.stroke(); }
      }
      x.globalAlpha = 1;
    }
    drawHud(dt) {
      const g = this.g, x = this.ctx;
      const boss = g.enemies.find(e => e.boss && !e.dead);
      if (boss) {
        const p = clamp(boss.hp / boss.max, 0, 1);
        this.bossTrail = this.bossTrail < p ? p : this.bossTrail + (p - this.bossTrail) * (1 - Math.exp(-dt * 4));
        x.fillStyle = 'rgba(20,10,30,0.7)'; x.fillRect(90, 8, 300, 26);
        x.font = `bold 10px ${FONT}`; x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText(boss.t.name, 96, 19);
        x.textAlign = 'right'; x.fillStyle = g.bossT < 8 ? '#ff6b6b' : '#ffd23f'; x.fillText('⏱ ' + Math.max(0, g.bossT).toFixed(1) + 's', 384, 19);
        x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(95, 22, 290, 8);
        x.fillStyle = '#fff3'; x.fillRect(96, 23, 288 * this.bossTrail, 6);
        x.fillStyle = '#ff3d6e'; x.fillRect(96, 23, 288 * p, 6);
        x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(96, 23, 288 * p, 2);
        if (boss.shield > 0 && boss.shieldMax) {
          const q = clamp(boss.shield / boss.shieldMax, 0, 1);
          x.fillStyle = '#8fd8ff'; x.fillRect(96, 23, 288 * q, 6);
          x.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 288 * q; i += 8) x.fillRect(96 + i, 23, 3, 6);
          x.font = `bold 8px ${FONT}`; x.textAlign = 'left'; x.fillStyle = '#bfe9ff'; x.fillText('🛡 護盾', 96, 39);
        }
      } else this.bossTrail = 1;
      if (this.cast) {
        const c = this.cast, k = Math.min(1, c.t / c.d), left = Math.max(0, c.d - c.t);
        const blink = 0.5 + 0.5 * Math.sin(this.rt * 14), y0 = boss ? 42 : 10;
        x.globalAlpha = 0.85; x.fillStyle = '#5a0014'; x.fillRect(110, y0, 260, 22);
        x.globalAlpha = 0.35 + blink * 0.4; x.fillStyle = '#ff2a44'; x.fillRect(110, y0, 260, 22);
        x.globalAlpha = 1; x.fillStyle = '#ffd0d6'; x.fillRect(110, y0 + 19, 260 * k, 3);
        x.font = `900 12px ${FONT}`; x.textAlign = 'center'; x.lineWidth = 3; x.strokeStyle = '#2a0008'; x.fillStyle = '#fff';
        const s = `⚠ ${c.skill.name || '頭目大招'}　${left.toFixed(1)}`;
        x.strokeText(s, W / 2, y0 + 15); x.fillText(s, W / 2, y0 + 15);
      }
    }
    drawCutin(dt) {
      const c = this.cutin, x = this.ctx; c.t += dt;
      const d = 1.0, k = c.t / d;
      if (k >= 1) { this.cutin = null; return; }
      const ease = k < 0.2 ? k / 0.2 : k > 0.8 ? (1 - k) / 0.2 : 1;
      x.globalAlpha = 0.55 * ease; x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      x.globalAlpha = ease;
      x.fillStyle = c.color; x.beginPath(); x.moveTo(0, 95); x.lineTo(W, 75); x.lineTo(W, 175); x.lineTo(0, 195); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 8; i++) x.fillRect(((c.t * 900 + i * 70) % (W + 80)) - 40, 85 + i * 12, 40, 2);
      const g = this.g, h = g.heroes.find(q => q.id === c.id), pro = g.rank(g.s.heroes[c.id]) >= 2;
      const im = pro ? IMG['pro_' + c.id] : IMG['atk_' + c.id] || IMG[c.id];
      const px = -60 + Math.min(1, k * 5) * 200 + k * 30;
      const ox = this.ox, oy = this.oy; this.ox = 0; this.oy = 0;
      if (im) this.sprite(im, px, 205, 150, { ax: pro ? 0.5 : (ATK[c.id]?.ax ?? 0.5), alpha: ease });
      this.ox = ox; this.oy = oy;
      const s = this.scale; x.setTransform(s, 0, 0, s, 0, 0);
      x.globalAlpha = ease;
      x.textAlign = 'right'; x.font = `900 22px ${FONT}`; x.lineWidth = 5; x.strokeStyle = '#1a0f2e'; x.fillStyle = '#fff'; x.lineJoin = 'round';
      const tx = W - 20 - (1 - Math.min(1, k * 5)) * 120;
      x.strokeText(c.name, tx, 140); x.fillText(c.name, tx, 140);
      x.font = `bold 11px ${FONT}`; x.fillStyle = '#ffe9a8'; x.strokeText(h.def.name, tx, 160); x.fillText(h.def.name, tx, 160);
      x.globalAlpha = 1;
    }
    drawBanner(dt) {
      const b = this.banner, x = this.ctx; b.t += dt; const k = b.t / b.d;
      if (k >= 1) { this.banner = null; return; }
      const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
      x.save(); x.globalAlpha = a;
      x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(0, 120, W, 44);
      x.font = `900 24px ${FONT}`; x.textAlign = 'center'; x.lineWidth = 5; x.lineJoin = 'round'; x.strokeStyle = '#1a0f2e'; x.fillStyle = b.c;
      const sc = 1 + Math.max(0, 0.15 - b.t) * 3;
      x.translate(W / 2, 151); x.scale(sc, sc); x.strokeText(b.text, 0, 0); x.fillText(b.text, 0, 0);
      x.restore();
    }
  }

  G.Render = { Renderer, load, assets, IMG, W, H };
})(window);
