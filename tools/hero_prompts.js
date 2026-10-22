// v1.3 同事生圖提示詞：讀 js/roster.js，寫 work/prompts/hg_XX.txt（2×2 四人一張）與 hs_<id>.txt（SSR/UR 單張）
// 用法: node tools/hero_prompts.js  → 印出所有名稱，再丟給 tools/run.sh
// 分組記在 work/prompts/hero_groups.json，給 tools/hero_cut.py 切圖用
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
require(path.join(root, 'js/roster.js'));
const R = globalThis.ROSTER;

const STYLE = 'Art style: cute chibi 2D mobile idle-RPG game character, about 2.5 heads tall (very big head, short stubby limbs), big expressive anime eyes, clean bold dark outlines, soft cel shading, vibrant but tasteful colors, polished gacha-game quality. Match exactly the chibi proportions, line weight and shading of the reference images; the references are ONLY for art style, do not draw the reference characters and do not copy their glasses, hair or clothes. Every character must look clearly different (age, face, hairstyle, body shape).';
const POSE = 'Each character stands in a 3/4 view facing toward the RIGHT side of the image; head, shoulders, hips and feet all face the same right direction, no twisted neck, no looking back, no turning around. Hands and props clearly visible.';
const BG = 'Background: one flat solid pure green color (#00FF00) everywhere, no gradient, no floor, no ground shadow, no text, no logo, no frame, no grid lines, no green on any character or outline.';
const FLAIR = [
  'Simple everyday look.',
  'Neat look with a couple of small accent details.',
  'Stylish look with a few small sparkles near the character.',
  'Glamorous premium look with gold accents and sparkles close around the character.',
  'Legendary divine look with a glowing halo and light effects close around the character, but the character itself stays clearly readable.'
];
// 參考圖的人戴眼鏡，GPT 會讓大家都戴 → 沒寫眼鏡的明確寫不要
const desc = (h) => `${h.look}${/glasses|visor|goggles/.test(h.look) ? '' : ', NO glasses'}, no beard unless stated. ${FLAIR[h.rar]}`;

const refs = ['work/gen/base2_mi.png', 'work/gen/base2_vivi.png', 'work/gen/base2_jie.png'];
const groups = {};
const dir = path.join(root, 'work/prompts');
const names = [];
function write(name, text, ids) {
  fs.writeFileSync(path.join(dir, name + '.txt'), text);
  fs.writeFileSync(path.join(dir, name + '.refs'), refs.join('\n') + '\n');
  groups[name] = ids;
  names.push(name);
}

const singles = R.filter(h => h.rar >= 3 && !h.base);
const rest = R.filter(h => h.rar < 3 && !h.base);
const POS = ['TOP-LEFT', 'TOP-RIGHT', 'BOTTOM-LEFT', 'BOTTOM-RIGHT'];
for (let i = 0, k = 1; i < rest.length; i += 4, k++) {
  const g = rest.slice(i, i + 4);
  const name = 'hg_' + String(k).padStart(2, '0');
  if (g.length < 4) { for (const h of g) singles.push(h); break; }
  const text = 'A tall portrait image showing FOUR different characters arranged in a 2x2 layout, one character per quadrant, each fully separate with wide empty green space between them (no overlapping, no touching, nothing crossing the middle of the image), all four drawn at the same size, each full body from top of head to shoes with margin. ' +
    g.map((h, j) => `${POS[j]}: ${desc(h)}`).join(' ') + ' ' + STYLE + ' ' + POSE + ' ' + BG;
  write(name, text, g.map(h => h.id));
}
for (const h of singles) {
  const text = `A tall portrait image of exactly one character, centered, full body from top of head to shoes with generous empty margin around it. Character: ${desc(h)} ` + STYLE + ' ' + POSE + ' ' + BG;
  write('hs_' + h.id, text, [h.id]);
}
// v1.3.1 本尊的限定版本（h.base）：單張，參考圖用本尊與升職造型，保留臉與辨識特徵、只換服裝道具
const BASEREF = { kui: 'work/gen/base_kui.png', mi: 'work/gen/base2_mi.png', jie: 'work/gen/base2_jie.png', vivi: 'work/gen/base2_vivi.png' };
for (const h of R.filter(h => h.base)) {
  const name = 'hv_' + h.id;
  const text = `A tall portrait image of exactly one character, centered, full body from top of head to shoes with generous empty margin around it. This is the SAME character as in the reference images, in a special themed costume: keep exactly the same face, eye shape and color, hairstyle, hair color, glasses and beard (if any), same chibi proportions and the same art style as the references; only the outfit, accessories and props change. Character: ${h.look}. ${FLAIR[h.rar]} Cute and fun, not scary; modest clothing. ` + STYLE.replace(/ Match exactly.*$/, ' Match exactly the chibi proportions, line weight and shading of the reference images.') + ' ' + POSE + ' ' + BG;
  fs.writeFileSync(path.join(dir, name + '.txt'), text);
  fs.writeFileSync(path.join(dir, name + '.refs'), [BASEREF[h.base], `work/gen/pro_${h.base}.png`].join('\n') + '\n');
  groups[name] = [h.id];
  names.push(name);
}
fs.writeFileSync(path.join(dir, 'hero_groups.json'), JSON.stringify(groups, null, 1));
console.log(names.join(' '));
