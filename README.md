# 不想上班！放置辦公室

「a4 不想上班」的放置小遊戲 demo。小葵、小米、阿傑和 Vivi 老闆打倒工作怪，帶大家準時下班。
免費、不用登入、沒有儲值和等待時間，進度存在瀏覽器的 localStorage。

- 主線：週一～週五 5 章 × 10 關，每章最後是頭目（限時 30 秒），通關後是無限的「加班模式」
- 約 25～35 分鐘打完主線（看點擊頻率與升級選擇）；只開自動升級也打得完
- 五個頭目都有二階段變身與專屬神器；怪物掉寶箱，24 種寶物（普通／稀有／史詩／神器）可升星、湊套裝
- 版本號在 ui.js 的 `G.VERSION` 與 index.html `#verTxt`，改版時一起改（還有所有 `?v=`）

## 檔案
- `js/data.js`：角色、敵人（含頭目二階段 skills2）、關卡、數值曲線、辦公室升級、寶物 TREASURES／套裝 SETS／寶箱 CHEST／精英 ELITE、任務、劇情。**改數值只改這裡**
- `js/engine.js`：戰鬥與成長邏輯（不碰 DOM）
- `js/render.js`：canvas 繪製；角色動作全部用程式做（呼吸、衝刺、攻擊姿勢圖、受擊閃白、倒地）
- `js/ui.js`：介面、存檔、劇情、主迴圈；`js/audio.js`：WebAudio 合成音效與音樂
- `art/`：GPT 生圖後去背的成品（char 角色、enemy 敵人、bg 背景、ui 標題與外送、item 寶物與寶箱）

## 工具
- `node tools/sim.js [每秒點擊=1.5] [分鐘=45]`：平衡模擬，改數值後先跑
- `tools/gen.sh <名稱> "<提示詞>" [參考圖...]`：用 ChatGPT.app 內建 codex 生圖到 work/gen/
- `tools/run.sh name...`：讀 work/prompts/<name>.txt（與 .refs）4 張並行生圖
- `tools/process.sh [-f]`：work/gen 綠底圖去背 → art/（`tools/cut.py`）

本機預覽：`python3 -m http.server 4300`
