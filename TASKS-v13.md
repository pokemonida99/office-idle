# v1.3 工作清單：同事英雄收集（100 位）（2026-10-22）

使用者：「新增同事英雄收集 100 個」，並同意上一輪的提案（部門相剋、多一種資源、下一個目標／解鎖階梯）。無盡加班塔留到 v1.4。
原則不變：**免費、不用等、不做儲值／登入獎勵／體力**。招募券（履歷）全部靠玩取得。

四個 session 共用這個資料夾，**只改自己負責的檔案、不要 git commit / checkout / stash / 切分支**，由主 session 最後統一 commit 與測試。別人的檔案可能正在改，看到半成品是正常的。

| # | 工作 | 只能改的檔案 |
|---|---|---|
| A | 美術＋名冊：96 位新同事的設定與 Q 版圖、頭像、新圖示 | `js/roster.js`（新）、`art/hero/`（新）、`art/ui/` 新增的圖示、`tools/` 新腳本（不改 sim.js） |
| B | 玩法：名冊整合、隊伍、職業技能、部門相剋、招募、解鎖階梯、平衡 | `js/data.js`、`js/engine.js`、`tools/sim.js` |
| C | 介面：同事分頁、招募、編隊、下一個目標、音效 | `js/ui.js`、`js/audio.js`、`style.css`、`index.html` |
| D | 戰鬥畫面：任意同事上場、5 人站位、各職業攻擊與治療特效、弱點提示 | `js/render.js` |

## 介面約定

### 1. 名冊 `js/roster.js`（A 寫，index.html 在 data.js 之前載入）
```js
(function (G) {
  G.ROSTER = [
    { id: 'h001', name: '實習生阿明', job: '行銷實習生', dept: 'sales', rar: 0, role: 'dps',
      skill: '先衝再說', line: '我可以！我什麼都可以！', look: '生圖用外觀描述（英文）' },
    // …共 96 位
  ];
})(typeof window !== 'undefined' ? window : globalThis);
```
- `id`：`h001`～`h096`。原本四人（`mi`、`jie`、`kui`、`vivi`）保留在 data.js 的 HEROES，合計 100 位。
- `dept`：`design` 設計部、`cs` 客服部、`eng` 工程部、`sales` 業務部、`admin` 行政部（每部門約 19 位）。
- `rar`：0 普通 N、1 稀有 R、2 史詩 SR、3 傳說 SSR、4 神話 UR。建議數量：N 34、R 28、SR 20、SSR 10、UR 4（原本四人算 SSR）。
- `role`：`tank` 坦克（嘲諷、護盾）、`dps` 單體、`aoe` 範圍、`crit` 爆擊、`support` 增益、`healer` 治療。
- `skill`：大招名稱（效果由 B 依 role 決定，A 只寫名字）；`line`：口頭禪；`look`：外觀（給 GPT）。
- 角色是辦公室各種職業與部門（實習生、會計、工程師、業務、HR、警衛、清潔阿姨、IT、行銷、法務、總機、外送員、董事…），台灣職場口語、好笑但不刻薄、不影射真人。

### 2. 圖片（A 產出，C、D 使用）
- 全身：`art/hero/<id>.webp`，綠底去背、高 420px、**頭頂貼齊上緣、腳底貼齊下緣**、身體朝右（3/4 側面），跟原本四人同畫風（大頭 2.5 頭身）。原本四人也複製一份到 `art/hero/mi.webp` 等。
- 頭像：`art/hero/face/<id>.webp`，128×128 正方形、臉置中（100 位都要，含原本四人）。
- 新圖示：`art/ui/resume.webp`（履歷／招募券）、`art/ui/dept_<dept>.webp`（五個部門徽章），去背、高約 96px。
- 圖還沒生好的同事：C、D 要有退路（用部門徽章或剪影代替），不能壞掉。

### 3. 資料（B 寫在 data.js）
- `D.DEPTS = { design: { name: '設計部', color, icon }, cs, eng, sales, admin }`
- `D.ROLES = { tank: { name, ... }, dps, aoe, crit, support, healer }`
- `D.HRAR = [{ name: '普通', key: 'N', color, rate }, …5 級]`（同事稀有度，和寶物的 RARITY 分開）
- `D.ALLHEROES`：合併 HEROES（原本四人）與 G.ROSTER 後的完整清單；每位都有 `id, name, job, dept, rar, role, skill{name, desc}, line, legacy`（原本四人 `legacy: true`，保留升職造型與攻擊姿勢）。
- 敵人加 `weak: '<dept>'`：該部門打它傷害 +50%。
- `D.UNLOCKS`：解鎖階梯 `[{ at: 關卡, key, text }]`，例如招募、第 5 個隊伍格、自動升級…

### 4. 存檔與 engine API（B 實作，C、D 使用）
- `s.heroes = { id: 等級 }`（擁有＝等級 ≥ 1，沿用舊欄位）、`s.stars = { id: 星數 }`（重複抽到升星，★1～★5）、`s.team = [id, …]`（上場，最多 `game.teamSize()` 人，3～5）、`s.resume`（履歷數）、`s.pity`。
- 舊存檔：`team` 預設為原本四人中已加入的人。
- `game.heroDef(id)`：完整定義。`game.heroes`：**只有上場的人**的戰鬥物件，有 `id, def, slot, x, hp, max, energy, shield, dead, on`；換隊伍時重建。
- `game.setTeam(ids)`、`game.autoTeam()`（照戰力與部門相剋自動排，給自動升級的人用）、`game.teamPower()`。
- `game.recruit(n)`：n＝1 或 10，扣履歷，回傳 `[{ id, def, isNew, star, rar }]`，並送 `{ type: 'recruit', results }` 事件；十連至少一位 SR 以上，保底：SSR 30 抽、UR 90 抽。
- `game.recruitCost(n)`、`game.canRecruit(n)`。
- `game.nextGoal()` → `{ text, cur, need }`（畫面上方「下一個目標」用）。
- 新事件：`{ type: 'heal', h, amount }`、`{ type: 'resume', n, e }`（掉履歷，e 可能是 null）、`hit` 事件在打到弱點時帶 `weak: true`、`{ type: 'teamChange' }`、`{ type: 'unlock', u }`。
- 英雄的 `def.shot` 由 B 依 role 或部門給：`wave`、`slash`、`paint`、`money` 沿用，新增 `heal`、`arrow`、`stamp`、`code`、`paper`；D 要能畫全部。

### 5. 載入效能
- 100 張圖不可以一次全部預載。D 提供 `G.Render.ensureHero(id)`（需要時才載入），`assets()` 只放上場隊伍。
- C 的清單、圖鑑用 `<img loading="lazy">` 載頭像。

## 驗收
- 新玩家前 10 分鐘就能招募到新同事（1-5 解鎖招募、第一次十連免費或送足履歷）
- 每一章的怪物弱點不同，換隊伍有感；但「自動升級＋自動編隊」也打得完
- 手機 375×812 順暢，載入時間不能比 v1.2 明顯變慢
- `node tools/sim.js` 一般玩家主線約 30 分鐘；之後還有「收集 100 位」的長期目標
