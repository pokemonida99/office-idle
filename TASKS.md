# v1.1 工作清單（2026-10-21）

使用者回饋：玩起來很卡、背景看得到接縫、不夠精緻、才剛玩就卡住、不有趣。

四個 session 平行處理，**每個 session 只改自己負責的檔案**，在自己的 worktree 分支 commit，不要 push。最後由主 session 合併、整合測試。

| # | 工作 | 只能改的檔案 |
|---|---|---|
| A | 美術：背景無縫、驚喜道具圖 | `art/`、`tools/`（新增 bg/道具處理腳本；不改 tools/sim.js） |
| B | 戰鬥畫面：效能＋打擊感＋新事件的繪製 | `js/render.js` |
| C | 介面：DOM 效能、精緻化、新手引導、新事件的音效與提示 | `js/ui.js`、`js/audio.js`、`style.css`、`index.html` |
| D | 玩法：卡關修正、節奏、新機制邏輯、平衡 | `js/data.js`、`js/engine.js`、`tools/sim.js` |

## 介面約定（大家照這個寫，彼此不用等）

座標：世界座標 480×300，地面 `Engine.GROUND`（250）。

1. **點擊**：`game.tap(wx, wy)`（世界座標，ui.js 用 `rnd.toWorld()` 換算後傳入）。
   回傳 `{ kind: 'bonus', b }`、`{ kind: 'hit', e }` 或 `null`。沒傳座標時照舊打最前面的敵人。
2. **驚喜道具（外送）**：`game.bonuses = [{ uid, kind, x, y, t, life }]`，`kind` 是 `'bento' | 'coffee' | 'boba'`。
   戰鬥中每 20～35 秒從右上飛入、在畫面上飄 6 秒。事件：
   - `{ type: 'bonusSpawn', b }`
   - `{ type: 'bonus', b, gold, buff }`（被點到；`buff` 可能是 `{ kind: 'atk' | 'aspd' | 'gold', mul, dur }` 或 null）
   - `{ type: 'bonusGone', b }`（沒點到就飛走）
   圖片：`art/ui/bonus_<kind>.webp`（去背，高約 160px）；B 載入失敗時用 emoji 🍱☕🧋 代替。
3. **對話泡泡**：`{ type: 'say', who, text }`。`who` 是英雄物件（engine 的 `game.heroes[i]`）或敵人物件，B 在頭上畫約 2 秒泡泡。同一時間最多 2 個。
4. **頭目技能**：
   - `{ type: 'bossCast', e, skill }`：`skill = { id, name, kind: 'aoe' | 'summon' | 'shield', delay }`，delay 秒後生效。B 畫預警（紅色範圍或名稱橫幅），C 播警告音。
   - `{ type: 'bossHit', e, skill }`：生效那一刻。
   - shield 類：`e.shield`、`e.shieldMax`（> 0 時 B 在血條上畫護盾條；點擊與大招先扣護盾）。
5. **連擊**：`game.combo`（0.7 秒內連續點擊的次數），`hit` 事件在 `src === 'tap'` 時帶 `combo` 欄位。B 畫連擊數字，C 依連擊調高點擊音。
6. **自動升級**：`game.s.autoBuy`（布林），engine 每秒自動買最划算的升級。C 在介面加開關（建議 1-5 之後解鎖）。
7. **既有事件不改名**：shoot、hit、kill、hurt、down、ult、stage、wave、clear、fail、levelup、buy、loot、join、goldrain、ending。

## 驗收
- iPhone 尺寸（375×812）順暢，主迴圈每幀不重建 DOM、不在每幀建立漸層或濾鏡
- 背景捲動看不到接縫
- 新玩家前 5 分鐘不會卡住：一直有事可做（升級、驚喜道具、新角色加入），不必懂系統也能前進
- `node tools/sim.js` 主線約 25～30 分鐘、前三章 0 次失敗
