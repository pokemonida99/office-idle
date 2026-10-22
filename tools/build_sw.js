// 產生 sw.js（離線快取清單）：node tools/build_sw.js
// 版本號讀 js/ui.js 的 G.VERSION；改版時跑一次，舊快取會自動換掉
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const ver = (fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').match(/G\.VERSION = '([^']+)'/) || [])[1];
if (!ver) throw new Error('找不到 G.VERSION');
const files = execSync('git ls-files', { cwd: root }).toString().split('\n').filter(f =>
  /^(index\.html|style\.css|manifest\.webmanifest|js\/.+\.js|art\/.+\.(webp|png|jpg))$/.test(f) &&
  !/art\/icon\/.+-(192|512)\.png$/.test(f) && !/art\/ui\/og\.jpg$/.test(f));
// 新加但還沒 commit 的檔案也算進去
for (const dir of ['js', 'art']) {
  const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).forEach(e => {
    const p = d + '/' + e.name;
    if (e.isDirectory()) walk(p);
    else if (/\.(js|webp|png|jpg)$/.test(p) && !files.includes(p) && !/-(192|512)\.png$|og\.jpg$/.test(p)) files.push(p);
  });
  walk(dir);
}
const list = ['./', ...files.filter(f => f !== 'index.html')];
const tpl = fs.readFileSync(path.join(__dirname, 'sw.template.js'), 'utf8');
fs.writeFileSync(path.join(root, 'sw.js'), tpl.replace('__VERSION__', ver).replace('__FILES__', JSON.stringify(list, null, 0).replace(/","/g, '",\n  "')));
console.log(`sw.js ${ver}：${list.length} 個檔案`);
