// 遊戲資料：角色、敵人、關卡、辦公室升級、任務、戰利品。改數值只改這裡，改完跑 node tools/sim.js
(function (G) {
  const HEROES = [
    {
      id: 'mi', name: '小米', job: '客服', dept: 'cs', rar: 1, role: 'tank', legacy: true, color: '#6d8fd6', line: '您好～這邊幫您處理喔',
      atk: 6, hp: 160, aspd: 0.9, x: 224, cost: 10,
      ranks: ['客服專員', '資深客服', '客服組長', '客服之神'],
      skill: { name: '您的來電對我們很重要', desc: '全隊獲得護盾（小米血量 40%），敵人全部「請稍候」暈 2.5 秒' },
      passive: '敵人優先攻擊小米，受傷也會充能',
      shot: 'wave', lines: ['您好～這邊幫您處理喔', '請稍候，不要掛斷喔', '我們會轉交相關單位'],
      talk: {
        start: ['好，今天也是愉快的一天（並沒有）', '電話又響了，我假裝沒聽到', '先深呼吸，再接下一通', '上班就是一場修行'],
        ult: ['您的來電對我們很重要～', '請稍候，我幫您轉接地獄', '不好意思，系統維護中喔'],
        down: ['我先去茶水間冷靜一下……', '這通……我真的接不下去了', '幫我跟主管說我在忙……'],
        boss: ['這個我處理過，最多就是被罵', '好，大家記得微笑', '客戶永遠是對的（才怪）'],
        bonus: ['外送到了，今天唯一的好消息', '是誰點的？我先吃為敬'],
        idle: ['我今天已經說第 87 次「不好意思」了', '好想把電話線拔掉', '客戶說要找真人，我就是真人啊', '午休還有多久？', '已讀，但我選擇不回']
      }
    },
    {
      id: 'jie', name: '阿傑', job: '老鳥設計師', dept: 'design', rar: 1, role: 'crit', legacy: true, color: '#c98a4b', line: '第一版就是最終版',
      atk: 15, hp: 95, aspd: 0.7, x: 176, cost: 40, joinAt: 2,
      ranks: ['資深設計師', '設計主管', '創意總監', '傳說中的阿傑'],
      skill: { name: '一稿過', desc: '對血量最高的敵人造成 1500% 傷害，必定爆擊' },
      passive: '25% 機率爆擊，造成 2.5 倍傷害',
      shot: 'slash', lines: ['這個我十年前就做過了', '第一版就是最終版', '咖啡先給我'],
      talk: {
        start: ['這種案子我閉著眼睛都能做', '先說，我六點要走', '第一版就是最終版，信我'],
        ult: ['一稿過，不接受修改', '看好了，這叫經驗', '十年功力，一刀搞定'],
        down: ['我年資的腰……', '叫醒我的時候記得帶咖啡'],
        boss: ['又是你，上次也是這樣', '這招我十年前就看過了'],
        bonus: ['咖啡！我活過來了', '這杯算公司的吧？'],
        idle: ['新人很有衝勁嘛，我以前也是', '加班費？那是都市傳說', '我的咖啡呢？誰拿走了？', '這需求跟上週一樣，只是換字型', '不要問我為什麼還沒離職']
      }
    },
    {
      id: 'kui', name: '小葵', job: '新銳設計師', dept: 'design', rar: 1, role: 'aoe', legacy: true, color: '#e0954a', line: '這版我很有信心！',
      atk: 10, hp: 85, aspd: 0.8, x: 126, cost: 15,
      ranks: ['新銳設計師', '視覺設計師', '主視覺設計師', '藝術總監'],
      skill: { name: '靈感爆發', desc: '顏料炸彈轟炸全體敵人，每隻造成 450% 傷害' },
      passive: '攻擊會濺到旁邊的敵人（40% 傷害）',
      shot: 'paint', lines: ['靈感來了！', '我再調一下顏色', '這版我很有信心！'],
      talk: {
        start: ['今天也要元氣滿滿！', '我有做筆記！應該沒問題！', '這次一定可以準時下班！'],
        ult: ['靈感大爆發～！', '顏色就決定是你了！', '看我的配色！'],
        down: ['我、我的電腦當機了……', '前輩……我想回家……'],
        boss: ['好可怕……但我不能逃！', '前輩，這個要怎麼打？'],
        bonus: ['哇！上班的動力來了！', '外送救了我一命！'],
        idle: ['為什麼大家都在嘆氣？', '原來「等一下」是指下週……', '我把檔名改成「最終版_真的最終」了', '前輩說這叫職場的溫度', '咦？薪水是用這個算的嗎？']
      }
    },
    {
      id: 'vivi', name: 'Vivi 老闆', job: '老闆', dept: 'sales', rar: 1, role: 'support', legacy: true, color: '#ec5f9e', line: '年底一定會加薪',
      atk: 8, hp: 110, aspd: 0.75, x: 72, cost: 120, joinAt: 10,
      ranks: ['老闆', '董事長', '集團總裁', '商業女王'],
      skill: { name: '畫大餅', desc: '全隊攻擊 +80%、攻速 +40%，持續 8 秒，並撒下一陣薪水雨' },
      passive: '全隊薪水收入 +25%',
      shot: 'money', lines: ['年底一定會加薪', '公司就是你的家', '這個月業績靠你們了'],
      talk: {
        start: ['大家今天也要當公司的家人喔～', '業績！業績！業績！', '我很開放，有意見都可以講（但不會改）'],
        ult: ['年底一定加薪！大家衝！', '做完這個月就放假（之後再說）', '我請大家喝飲料！'],
        down: ['我先去開個會……', '我去跟董事會報告一下……'],
        boss: ['這個很簡單吧？你們可以的！', '我相信你們（的加班能力）'],
        bonus: ['這是我請的！記得說謝謝老闆', '吃飽才有力氣加班喔～'],
        idle: ['我們是一個大家庭！', '你們都很棒，但可以更棒', '有沒有覺得最近很有成長？', '這個很急，但也沒有很急', '我看好你喔（拍肩）']
      }
    }
  ];
  // 原本四人（陣型由前到後）；v1.3 起實際上場的人看 s.team，站位依職業自動排
  const ORDER = ['mi', 'jie', 'kui', 'vivi'];

  // ---------- v1.3 同事收集 ----------
  // 部門：敵人的 weak 是部門 key，該部門的同事打它傷害 × WEAK
  const DEPTS = {
    design: { name: '設計部', short: '設計', color: '#f08a24', emoji: '🎨', icon: 'art/ui/dept_design.webp' },
    cs:     { name: '客服部', short: '客服', color: '#2f9be8', emoji: '🎧', icon: 'art/ui/dept_cs.webp' },
    eng:    { name: '工程部', short: '工程', color: '#8a55e0', emoji: '💻', icon: 'art/ui/dept_eng.webp' },
    sales:  { name: '業務部', short: '業務', color: '#e23d3d', emoji: '💼', icon: 'art/ui/dept_sales.webp' },
    admin:  { name: '行政部', short: '行政', color: '#e2b123', emoji: '📎', icon: 'art/ui/dept_admin.webp' }
  };
  const WEAK = 1.5;
  // 同部門 n 人以上上場：全隊攻擊 +add（通過 at 關後生效）
  const DEPT_BONUS = { at: 8, add: { 3: 0.1, 4: 0.18, 5: 0.28 } };

  // 職業：基礎能力（稀有 R ★1 的數值，原本四人就是這組）、陣型順序（小 = 前排）、普攻特效、技能說明
  // 普攻特效 shot：wave 聲波、slash 刀光、paint 顏料、money 鈔票、heal 治療光、arrow 便利貼飛鏢、stamp 印章、code 程式碼、paper 文件
  const ROLES = {
    tank:    { name: '坦克', icon: '🛡️', order: 0, atk: 6, hp: 160, aspd: 0.9, shot: 'wave',
               passive: '敵人優先攻擊他，受傷也會充能', skill: '全隊獲得護盾（自身血量 40%），敵人全部暈 2.5 秒' },
    crit:    { name: '爆擊', icon: '⚡', order: 1, atk: 15, hp: 95, aspd: 0.7, shot: 'slash',
               passive: '25% 機率爆擊，造成 2.5 倍傷害', skill: '對血量最高的敵人造成 1500% 傷害，必定爆擊' },
    dps:     { name: '單體', icon: '🎯', order: 2, atk: 16, hp: 100, aspd: 0.85, shot: 'arrow',
               passive: '打護盾的效果加倍', skill: '對最前面的敵人造成 1000% 傷害（護盾照樣打穿）' },
    aoe:     { name: '範圍', icon: '💥', order: 3, atk: 10, hp: 85, aspd: 0.8, shot: 'paint',
               passive: '攻擊會濺到旁邊的敵人（40% 傷害）', skill: '轟炸全體敵人，每隻造成 450% 傷害' },
    support: { name: '增益', icon: '📣', order: 4, atk: 8, hp: 110, aspd: 0.75, shot: 'money',
               passive: '上場時全隊攻擊 +{aura}%', skill: '全隊攻擊 +{buff}%、攻速提升，持續 8 秒' },
    healer:  { name: '治療', icon: '💚', order: 5, atk: 6, hp: 105, aspd: 0.8, shot: 'heal',
               passive: '每次攻擊順便幫血最少的同事回血', skill: '全隊回復 40% 血量，倒下的同事以 30% 血量回來' }
  };
  // 單體職業的普攻特效依部門換
  const DEPT_SHOT = { design: 'arrow', cs: 'paper', eng: 'code', sales: 'arrow', admin: 'stamp' };
  // 治療：普攻回復 = 治療者血量 × hit；大招全隊回復 ult、復活 revive
  const HEAL = { hit: 0.09, ult: 0.4, revive: 0.3 };
  // 增益職業（Vivi 以外）：被動光環與大招強度，依稀有度
  const SUPPORT = { aura: [0.04, 0.05, 0.06, 0.08, 0.1], buff: [0.4, 0.5, 0.6, 0.8, 1] };

  // 同事稀有度（和寶物的 RARITY 分開）。mul = 攻擊血量倍率（R = 1，原本四人是 R）、cost = 升級基礎價、rate = 招募機率
  const HRAR = [
    { name: '普通', key: 'N',   color: '#9aa4b2', rate: 0.5,  mul: 0.88, cost: 10 },
    { name: '稀有', key: 'R',   color: '#3d9bff', rate: 0.32, mul: 1,    cost: 12 },
    { name: '史詩', key: 'SR',  color: '#b26bff', rate: 0.13, mul: 1.13, cost: 15 },
    { name: '傳說', key: 'SSR', color: '#ffb020', rate: 0.04, mul: 1.27, cost: 20 },
    { name: '神話', key: 'UR',  color: '#ff4d8d', rate: 0.01, mul: 1.45, cost: 30 }
  ];
  // 原本四人的主題版本（roster.js 裡有 base 的同事）：繼承本尊的招牌機制，依稀有度變強；SSR、UR 多一個主題小特色
  //   scare：大招後敵人「嚇一跳」，非頭目暈 stun 秒，dur 秒內受到傷害 × mul
  //   party：大招順便撒紅包（薪水雨，打一隻怪的 gold 倍），其他上場同事充能 +energy
  const THEME = {
    2: { name: '夏日員工旅遊' },
    3: { name: '萬聖節', desc: '萬聖節特效：敵人嚇一跳，5 秒內受到傷害 +25%（小怪多暈 1 秒）', scare: { dur: 5, mul: 1.25, stun: 1 } },
    4: { name: '尾牙神裝', desc: '尾牙特效：順便撒紅包（薪水雨），其他同事充能 +25', party: { gold: 4, energy: 25 } }
  };
  // 招募：unlock = 通過幾關後開放（第一次開放送 first 份履歷）；十連至少一位 SR；保底 SSR 30 抽、UR 90 抽
  // 重複抽到升星（★1～★5，每星攻擊血量 +starMul）；★5 再抽到換薪水（打怪 maxGold 隻份）＋履歷 maxResume[稀有度]
  // newW：還沒有的同事被抽到的權重（> 1 比較容易抽到新面孔）
  // drop：打怪 kill、精英 elite 機率掉 1 份；頭目 boss 份；金寶箱 gold、木寶箱 wood 機率掉 1 份；
  //       第 firstFrom 關起第一次過關給 first 份（後期一關打比較久，履歷才不會都集中在前 10 分鐘），頭目關第一次過給 firstBoss 份
  //       加班模式（第 51 關起）打怪、精英掉率 × ot：卡關練功時也一直有新同事可以抽，收集 100 位是通關後的長期目標
  const RECRUIT = {
    unlock: 4, first: 10, ten: 10, pitySSR: 30, pityUR: 90, maxStar: 5, starMul: 0.2, newW: 1.5,
    maxGold: 20, maxResume: [0, 0, 1, 2, 4],
    drop: { kill: 0.004, elite: 0.08, boss: 0, gold: 0.3, wood: 0.03, first: 1, firstFrom: 30, firstBoss: 2, ot: 4 }
  };
  // 隊伍格數：通過 at 關後 n 格；站位 x（由前到後）
  const TEAM = {
    slots: [{ at: 0, n: 3 }, { at: 4, n: 4 }, { at: 10, n: 5 }],
    x: { 3: [224, 170, 116], 4: [224, 176, 126, 72], 5: [228, 184, 140, 96, 52] },
    swapGain: 1.2     // 自動編隊：新隊伍估分要比現在高 20% 以上才換
  };
  // 解鎖階梯：通過 at 關後解鎖（同一個 at 的會合併顯示）；畫面上方「下一個目標」用
  const UNLOCKS = [
    { at: 2, key: 'jie', text: '阿傑加入' },
    { at: 4, key: 'recruit', text: '招募新同事（人資送 10 份履歷）' },
    { at: 4, key: 'slot4', text: '第 4 個隊伍格' },
    { at: 5, key: 'autobuy', text: '自動升級（順便自動招募、自動編隊）' },
    { at: 8, key: 'dept', text: '同部門 3 人上場：全隊攻擊加成' },
    { at: 10, key: 'vivi', text: 'Vivi 老闆加入' },
    { at: 10, key: 'slot5', text: '第 5 個隊伍格' },
    { at: 10, key: 'autoult', text: '自動大招' },
    { at: 10, key: 'office1', text: '人體工學椅、年終獎金池' },
    { at: 20, key: 'office2', text: '機械鍵盤' },
    { at: 30, key: 'office3', text: '能量飲料櫃' },
    { at: 6, key: 'challenge', text: '挑戰關卡（地圖上的支線）' },
    { at: 50, key: 'week2', text: '第二週：黑心公司篇' },
    { at: 60, key: 'office5', text: '午睡艙' },
    { at: 80, key: 'office6', text: '員工工會' },
    { at: 100, key: 'ot', text: '加班模式' }
  ];
  // 收集目標（最後一個 = 名冊總人數，syncRoster 會重算）
  const COLLECT = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  // 新同事沒有專屬台詞時用的通用碎碎念（自己的口頭禪會混進去）
  const TALK_GENERIC = {
    start: ['好，開工了', '今天也要平安下班', '先喝口水再說', '我準備好了（大概）', '新的一天，新的鳥事'],
    ult: ['看我的！', '這招我練很久了', '交給我就對了', '認真起來了喔'],
    down: ['我先去茶水間一下……', '讓我躺一下就好……', '我的電量只剩 1%……', '幫我跟主管說我在忙……'],
    boss: ['這個看起來不好惹', '大家穩住，照流程來', '我只想準時下班啊', '這種場面我見多了（騙你的）'],
    bonus: ['外送！今天有救了', '誰點的？謝啦！', '吃飽才有力氣上班'],
    idle: ['今天的會怎麼這麼多', '下班倒數中……', '我的電腦又在更新了', '這個月的薪水呢？', '誰把冷氣開這麼冷']
  };

  const ENEMIES = {
    e_alarm:    { name: '早會鬧鐘', weak: 'admin', hp: 1.0, atk: 1.0, spd: 34 },
    e_mail:     { name: '未讀郵件', weak: 'cs', hp: 0.8, atk: 1.1, spd: 44 },
    e_sticky:   { name: '便利貼精', weak: 'admin', hp: 1.2, atk: 0.8, spd: 30 },
    e_revise:   { name: '改稿單', weak: 'design', hp: 1.3, atk: 1.0, spd: 30 },
    e_phone:    { name: '奧客電話', weak: 'cs', hp: 0.9, atk: 1.4, spd: 40 },
    e_printer:  { name: '卡紙印表機', weak: 'eng', hp: 1.7, atk: 0.8, spd: 24 },
    e_bug:      { name: '神秘 Bug', weak: 'eng', hp: 0.9, atk: 1.3, spd: 46 },
    e_meeting:  { name: '白板會議', weak: 'admin', hp: 1.6, atk: 0.9, spd: 26 },
    e_kpi:      { name: 'KPI 圖表', weak: 'sales', hp: 1.2, atk: 1.3, spd: 32 },
    e_deadline: { name: 'Deadline 沙漏', weak: 'eng', hp: 1.0, atk: 1.5, spd: 50 },
    e_chat:     { name: '群組 99+', weak: 'sales', hp: 1.4, atk: 1.1, spd: 34 },
    e_overtime: { name: '加班幽靈', weak: 'admin', hp: 1.3, atk: 1.4, spd: 36 },
    // weak：弱點部門（該部門同事打它 ×1.5）。各章分布：週一行政／客服、週二客服、週三什麼部門都有、週四業務、週五工程／行政
    // 頭目。skills：輪流施放，先預警 delay 秒再生效
    //   aoe：全隊受到 power 倍攻擊，且至少扣最大血量的 pct（小米的護盾擋得住）
    //   shield：護盾 = 最大血量 × power，持續 dur 秒；打破前一般攻擊只削 30%，點擊 ×3、大招全額
    //   summon：在頭目前面叫出 n 隻小怪擋刀（小葵範圍攻擊最好清）
    b_vivi:     { name: 'Vivi 老闆・突擊檢查', weak: 'sales', hp: 18, atk: 2.2, spd: 22, boss: true, img: 'vivi',
                  appear: ['大家都在認真上班嗎～？', '我只是路過，你們繼續～'],
                  skills: [{ id: 'inspect', name: '突擊檢查', kind: 'aoe', delay: 2, power: 1.2, pct: 0.2, line: '我來看看大家的螢幕～' }],
                  title: '笑容滿面的突擊檢查', phase2: '看來要拿出真本事了～全員績效面談！',
                  skills2: [{ id: 'review', name: '全員績效面談', kind: 'aoe', delay: 2.2, power: 1.5, pct: 0.24, line: '來，一個一個進會議室～' },
                            { id: 'inspect', name: '突擊檢查', kind: 'aoe', delay: 2, power: 1.2, pct: 0.2, line: '我又來看螢幕囉～' }] },
    b_client:   { name: '甲方大魔王', weak: 'design', hp: 15, atk: 2.4, spd: 20, boss: true,
                  appear: ['我要五彩斑斕的黑！', 'Logo 再大一點，但不要太大'],
                  skills: [{ id: 'revise', name: '再改一版', kind: 'shield', delay: 2, power: 0.2, dur: 7, line: '我覺得還可以再改一版' }],
                  title: '永遠不滿意的付錢的人', phase2: '我請我們主管也來看一下！',
                  skills2: [{ id: 'boss2', name: '主管也來看', kind: 'summon', delay: 2, n: 2, minion: 'e_revise', power: 0.6, line: '我們主管說要更有質感' },
                            { id: 'revise2', name: '預算砍半但要更好', kind: 'shield', delay: 2, power: 0.28, dur: 8, line: '預算砍半，但效果要加倍' }] },
    b_meeting:  { name: '無限會議', weak: 'admin', hp: 11, atk: 2.4, spd: 18, boss: true,
                  appear: ['我們先來對齊一下', '這個會很快，五分鐘就好'],
                  skills: [{ id: 'more', name: '再開一個會', kind: 'summon', delay: 2, n: 3, minion: 'e_meeting', power: 0.5, line: '這個我們另外開個會討論' }],
                  title: '沒有結束時間的會議', phase2: '時間到了，但我們延長一下！',
                  skills2: [{ id: 'storm', name: '腦力激盪', kind: 'aoe', delay: 2.2, power: 1.5, pct: 0.22, line: '大家都要發言喔，一人一個想法' },
                            { id: 'more2', name: '會議的會議', kind: 'summon', delay: 2, n: 4, minion: 'e_meeting', power: 0.5, line: '我們開個會討論剛剛的會' }] },
    b_report:   { name: '週報魔像', weak: 'eng', hp: 12, atk: 2.6, spd: 16, boss: true,
                  appear: ['本週工作內容，請填寫至少五百字', '週報是你成長的證明'],
                  skills: [{ id: 'format', name: '格式不對', kind: 'aoe', delay: 2.5, power: 1.8, pct: 0.26, line: '格式不對，全部重寫' }],
                  title: '五百字起跳的週報', phase2: '主管已讀……並且退件！',
                  skills2: [{ id: 'attach', name: '補附件', kind: 'shield', delay: 2, power: 0.22, dur: 7, line: '請附上佐證資料' },
                            { id: 'reject', name: '主管退件', kind: 'aoe', delay: 2.5, power: 2.1, pct: 0.3, line: '退件，理由請自行體會' }] },
    // ----- 第二週：黑心公司篇（第 6～10 章）-----
    // 各章弱點：6 大廳 行政×2、7 無薪假 客服×2、8 機房 工程×2、9 併購 業務×2、10 頂樓 五部門都有
    e_timeclock:{ name: '血汗打卡機', weak: 'admin', hp: 1.3, atk: 1.0, spd: 30 },
    e_unpaid:   { name: '無薪假通知', weak: 'admin', hp: 0.9, atk: 1.3, spd: 44 },
    e_shackle:  { name: '責任制手銬', weak: 'eng', hp: 1.6, atk: 0.9, spd: 24 },
    e_spy:      { name: '黑心間諜', weak: 'cs', hp: 0.9, atk: 1.5, spd: 50 },
    e_contract: { name: '霸王條款', weak: 'sales', hp: 1.4, atk: 1.1, spd: 32 },
    e_cctv:     { name: '監視器怪', weak: 'eng', hp: 1.1, atk: 1.2, spd: 36 },
    e_pie:      { name: '假大餅', weak: 'design', hp: 1.2, atk: 0.9, spd: 34 },
    e_suit:     { name: '黑西裝打手', weak: 'sales', hp: 1.7, atk: 1.3, spd: 28 },
    e_layoff:   { name: '裁員信', weak: 'cs', hp: 1.0, atk: 1.6, spd: 46 },
    // 第二週頭目的新招式：
    //   stun：全隊被「加班鎖定」dur 秒不能動（坦克大招可以解除）
    //   drain：全隊大招充能被扣 power（0～1），增益效果也被取消
    //   heal：頭目回復最大血量的 pct
    //   curse：全隊攻擊 × power，持續 dur 秒（治療大招可以解除）
    //   第三階段：血量剩 phase3At 以下換 skills3（只有黑心董事長）
    //   villain：黑心公司的反派頭目（登場有大字台詞演出）
    b_996:      { name: '996 監工', weak: 'eng', hp: 15, atk: 2.6, spd: 20, boss: true, villain: true,
                  appear: ['早上九點到晚上九點，一週六天！', '誰說要下班？我允許了嗎？'],
                  skills: [{ id: 'whip', name: '加班鞭', kind: 'stun', delay: 2, dur: 1.5, line: '鞭子一揮，全員繼續！' },
                           { id: 'kpi996', name: '績效鞭策', kind: 'aoe', delay: 2.2, power: 1.4, pct: 0.2, line: '你們的 KPI 呢？' }],
                  title: '拿鞭子的監工機器人', phase2: '偵測到員工想下班……啟動 996 模式！',
                  skills2: [{ id: 'whip2', name: '連續加班鞭', kind: 'stun', delay: 2, dur: 2, line: '今天不准走！明天也不准！' },
                            { id: 'shift', name: '再排一班', kind: 'summon', delay: 2, n: 3, minion: 'e_timeclock', power: 0.5, line: '叫打卡機來盯著你們！' },
                            { id: 'kpi9962', name: '績效鞭策', kind: 'aoe', delay: 2.2, power: 1.7, pct: 0.24, line: '業績不夠就加班補！' }] },
    b_unpaid:   { name: '無薪假魔', weak: 'sales', hp: 14, atk: 2.5, spd: 18, boss: true, villain: true,
                  appear: ['下個月開始，大家「自願」放無薪假喔～', '共體時艱，你們懂的吧？'],
                  skills: [{ id: 'drain', name: '扣薪', kind: 'drain', delay: 2, power: 0.6, line: '這個月的薪水……先欠著' },
                           { id: 'blank', name: '空白月曆', kind: 'shield', delay: 2, power: 0.2, dur: 7, line: '月曆上沒有你的班喔' }],
                  title: '抱著空白月曆的影子惡魔', phase2: '月曆全部撕掉！整年都放無薪假！',
                  skills2: [{ id: 'drain2', name: '全額扣薪', kind: 'drain', delay: 2, power: 1, line: '獎金？那是什麼可以吃嗎？' },
                            { id: 'gloom', name: '士氣低落', kind: 'curse', delay: 2, power: 0.6, dur: 6, line: '反正做再多也沒有用～' },
                            { id: 'blank2', name: '空白月曆', kind: 'shield', delay: 2, power: 0.25, dur: 7, line: '再撕一頁' }] },
    b_duty:     { name: '責任制巨像', weak: 'admin', hp: 17, atk: 2.7, spd: 16, boss: true, villain: true,
                  appear: ['責任制的意思是：責任是你的，制度是我的', '筆電帶回家，週末也是上班日'],
                  skills: [{ id: 'chain', name: '筆電鎖鏈', kind: 'stun', delay: 2.2, dur: 1.5, line: '把筆電鎖在你手上！' },
                           { id: 'oncall', name: '半夜 on call', kind: 'aoe', delay: 2.5, power: 1.8, pct: 0.26, line: '凌晨三點，電話響了～' }],
                  title: '鎖鏈和筆電組成的巨像', phase2: '責任越重，我就越大！',
                  skills2: [{ id: 'self', name: '責任自己扛', kind: 'heal', delay: 2.5, pct: 0.08, line: '出事？那是你的責任，不是我的' },
                            { id: 'oncall2', name: '全天候 on call', kind: 'aoe', delay: 2.5, power: 2.1, pct: 0.3, line: '假日也要回訊息喔' },
                            { id: 'chain2', name: '筆電鎖鏈', kind: 'stun', delay: 2, dur: 2, line: '鎖緊一點！' }] },
    b_merger:   { name: '併購章魚', weak: 'cs', hp: 16, atk: 2.7, spd: 18, boss: true, villain: true,
                  appear: ['簽了吧，每一條都對你很有利（對我）', '我有八隻手，可以同時簽八份合約'],
                  skills: [{ id: 'sign', name: '強迫簽約', kind: 'curse', delay: 2, power: 0.7, dur: 6, line: '附件第 87 條，請自己看' },
                           { id: 'ink', name: '噴墨水', kind: 'aoe', delay: 2.2, power: 1.6, pct: 0.22, line: '墨水是合約的一部分喔' }],
                  title: '每隻腳都在簽合約的章魚', phase2: '我要把你們整間公司都吞下去！',
                  skills2: [{ id: 'board', name: '董事會投票', kind: 'summon', delay: 2, n: 3, minion: 'e_suit', power: 0.5, line: '支持併購的請舉手——全票通過！' },
                            { id: 'sign2', name: '再簽一份', kind: 'curse', delay: 2, power: 0.6, dur: 7, line: '這份是補充合約' },
                            { id: 'absorb', name: '吸收合併', kind: 'heal', delay: 2.5, pct: 0.07, line: '你們的資產，現在是我的了' }] },
    b_ceo:      { name: '黑心董事長', weak: 'design', hp: 22, atk: 3.0, spd: 16, boss: true, villain: true,
                  appear: ['公司就是你家，所以你不用回家。', '喵。我是說——歡迎來到頂樓。'],
                  skills: [{ id: 'home', name: '公司就是你家', kind: 'stun', delay: 2.2, dur: 1.5, line: '家人怎麼會計較加班費呢？' },
                           { id: 'cigar', name: '雪茄煙霧', kind: 'aoe', delay: 2.5, power: 1.8, pct: 0.24, line: '呼～這就是成功的味道' }],
                  title: '胸口一顆黑心的巨大黑貓', phase2: '你們以為打得贏董事會嗎？我就是董事會！',
                  skills2: [{ id: 'freeze', name: '凍結薪資', kind: 'drain', delay: 2, power: 0.8, line: '調薪？明年再說，明年也不會說' },
                            { id: 'guard', name: '黑西裝保鑣', kind: 'summon', delay: 2, n: 3, minion: 'e_suit', power: 0.5, line: '保全！把他們請出去！' },
                            { id: 'cigar2', name: '雪茄煙霧', kind: 'aoe', delay: 2.5, power: 2.1, pct: 0.28, line: '再抽一根' }],
                  phase3At: 0.2, phase3: '黑心……全開！你們一個都別想下班！！',
                  skills3: [{ id: 'blackheart', name: '黑心爆發', kind: 'aoe', delay: 2.5, power: 2.4, pct: 0.32, line: '感受一下真正的黑心吧！' },
                            { id: 'contract996', name: '終身合約', kind: 'curse', delay: 2, power: 0.6, dur: 6, line: '簽到退休，不，簽到下輩子' },
                            { id: 'home2', name: '公司就是你家', kind: 'stun', delay: 2, dur: 2, line: '回家？這裡就是你家！' }] },
    b_final:    { name: '下班前的新需求', weak: 'cs', hp: 16, atk: 2.8, spd: 18, boss: true,
                  appear: ['這個很簡單，下班前可以給我嗎？', '17:59，叮咚——'],
                  skills: [
                    { id: 'easy', name: '這個很簡單', kind: 'shield', delay: 2, power: 0.15, dur: 7, line: '就改一個小地方而已' },
                    { id: 'group', name: '@所有人', kind: 'summon', delay: 2, n: 3, minion: 'e_chat', power: 0.4, line: '我拉個群組，大家一起討論' },
                    { id: 'tomorrow', name: '明天早上要', kind: 'aoe', delay: 2.5, power: 1.8, pct: 0.26, line: '明天早上開會要用喔' }
                  ],
                  title: '17:59 的那封信', phase2: '欸對了，順便把簡報也改一下',
                  skills2: [{ id: 'redo', name: '全部重做', kind: 'aoe', delay: 2.5, power: 2.2, pct: 0.3, line: '方向不對，我們從頭來過' },
                            { id: 'ot', name: '大家留一下', kind: 'summon', delay: 2, n: 3, minion: 'e_overtime', power: 0.5, line: '今天大家辛苦一點，留一下' },
                            { id: 'easy2', name: '就一個小地方', kind: 'shield', delay: 2, power: 0.2, dur: 7, line: '真的，就改一個小地方' }] }
  };

  // 十章（第一週 週一～週五、第二週 下週一～下週五），每章 10 關，每關 3～4 波；第 10 關是頭目（限時 40 秒）
  const CHAPTERS = [
    { day: '週一', title: '收心操', bg: 'bg1', pool: ['e_alarm', 'e_mail', 'e_sticky'], boss: 'b_vivi',
      names: ['打卡', '早會', '收信', '便利貼', '開機更新', '晨間報告', '回覆群組', '整理桌面', '午餐前', '老闆突擊檢查'] },
    { day: '週二', title: '改稿地獄', bg: 'bg2', pool: ['e_revise', 'e_phone', 'e_printer', 'e_mail'], boss: 'b_client',
      names: ['第二版', '客訴電話', '卡紙', '第五版', '再大一點', '換個感覺', '用回第一版', 'Logo 放大', '五彩斑斕的黑', '甲方來了'] },
    { day: '週三', title: '會議星期三', bg: 'bg3', pool: ['e_bug', 'e_meeting', 'e_kpi', 'e_revise'], boss: 'b_meeting',
      names: ['站立會議', '線上會議', '靜音沒開', '這個 Bug', '數字對不上', '會議延長', '腦力激盪', 'KPI 檢討', '會議的會議', '無限會議'] },
    { day: '週四', title: '死線逼近', bg: 'bg4', pool: ['e_deadline', 'e_chat', 'e_kpi', 'e_phone'], boss: 'b_report',
      names: ['倒數三天', '群組爆炸', '已讀不回', '倒數兩天', '數據整理', '週報草稿', '主管已讀', '最後確認', '還有一點點', '週報魔像'] },
    { day: '週五', title: '下班大作戰', bg: 'bg5', pool: ['e_overtime', 'e_deadline', 'e_chat', 'e_bug', 'e_sticky'], boss: 'b_final',
      names: ['小週末', '下午茶', '收尾', '偷偷收包包', '五點半', '電梯快來', '五點五十', '關電腦', '最後一封信', '下班前的新需求'] },
    // ----- 第二週：黑心公司篇（week: 2）-----
    { day: '下週一', week: 2, title: '黑心公司來了', bg: 'bg6', pool: ['e_timeclock', 'e_cctv', 'e_unpaid', 'e_suit'], boss: 'b_996',
      names: ['併購通知', '大廳報到', '刷卡閘門', '血汗打卡', '保全巡邏', '監視器底下', '電梯故障', '爬樓梯', '監工來了', '996 監工'] },
    { day: '下週二', week: 2, title: '無薪假風暴', bg: 'bg7', pool: ['e_layoff', 'e_pie', 'e_unpaid', 'e_spy'], boss: 'b_unpaid',
      names: ['留職停薪', '空白月曆', '假大餅', '畫餅充飢', '人事公告', '裁員名單', '茶水間耳語', '共體時艱', '最後一天', '無薪假魔'] },
    { day: '下週三', week: 2, title: '責任制地獄', bg: 'bg8', pool: ['e_shackle', 'e_cctv', 'e_contract', 'e_timeclock'], boss: 'b_duty',
      names: ['機房入口', '伺服器過熱', '責任制', '手銬會議', '24 小時待命', '凌晨三點', '假日 on call', '已讀不回', '筆電鎖鏈', '責任制巨像'] },
    { day: '下週四', week: 2, title: '併購大會', bg: 'bg9', pool: ['e_contract', 'e_suit', 'e_pie', 'e_spy'], boss: 'b_merger',
      names: ['董事會報到', '霸王條款', '簽了再說', '黑西裝', '股東會', '資產清點', '合約地獄', '對賭協議', '最後簽約', '併購章魚'] },
    { day: '下週五', week: 2, title: '頂樓董事長室', bg: 'bg10', pool: ['e_spy', 'e_layoff', 'e_shackle', 'e_suit', 'e_unpaid'], boss: 'b_ceo',
      names: ['頂樓電梯', '特助辦公室', '黑心金庫', '貓抓板走廊', '雪茄室', '董事長的秘密', '被困的員工', '最終簡報', '董事長室門口', '黑心董事長'] }
  ];
  // 主線關數：第一週 WEEK 關、全部 MAIN 關；MAIN 以後是加班模式
  const WEEK = 50, MAIN = 100;

  // 數值曲線（s = 0 起算的總關卡編號）
  // 第二週（第 51 關起）怪物成長換一條比較平的曲線：新的一週從比週五輕一點的地方開始（hp0、atk0），之後每關 × hp、atk
  // boss：第二週頭目血量再 × boss（小怪的 mobHp 加成在第一週末已經很高，頭目要跟上）
  const W2 = { hp0: 0.16, hp: 1.12, atk0: 1, atk: 1.09, boss: 8 };
  const hp1 = s => 30 * Math.pow(1.355, s) * Math.pow(1.09, Math.max(0, s - 10)) * Math.pow(1.05, Math.max(0, s - 15));
  const CURVE = {
    enemyHp: s => s < 50 ? hp1(s) : hp1(49) * W2.hp0 * Math.pow(W2.hp, s - 49),
    mobHp: s => Math.pow(1.05, Math.max(0, s - 20)),   // v1.3 多了第 5 格與招募：小怪（不含頭目）後期血量再加一點
    bossHp: s => Math.pow(0.99, Math.max(0, Math.min(s, 49) - 20)) * (s >= 50 ? W2.boss : 1),   // 頭目後期少一點：抽卡運氣差的人不要卡在 4-10、5-10 太久
    enemyAtk: s => s < 50 ? 4 * Math.pow(1.16, s) : 4 * Math.pow(1.16, 49) * W2.atk0 * Math.pow(W2.atk, s - 49),
    gold: s => 3 * Math.pow(1.22, s),
    heroAtk: (base, lv) => base * (1 + 0.32 * (lv - 1)) * Math.pow(1.045, lv - 1) * Math.pow(1.3, Math.floor(lv / 10)),
    heroHp: (base, lv) => base * (1 + 0.3 * (lv - 1)) * Math.pow(1.04, lv - 1) * Math.pow(1.3, Math.floor(lv / 10)),
    heroCost: (base, lv) => Math.ceil(base * Math.pow(1.17, lv - 1)),
    rankAt: [0, 15, 35, 60],          // 升職等級
    rankMul: 1.5,                      // 每升一職攻擊、血量倍率
    mentorCost: 0.15,                   // 前輩帶新人：等級比最高等同事低時，升級價格打折
    mentor: 0.9,                        // 前輩帶新人：低等同事補上與最高等級差距的比例（能力、升職倍率都用補完的等級）
    tapDmg: lv => 4 * (1 + 0.5 * (lv - 1)) * Math.pow(1.06, lv - 1),
    tapCost: lv => Math.ceil(8 * Math.pow(1.17, lv - 1)),
    bossTime: 40
  };

  // 辦公室升級（全隊永久加成）；unlock = 解鎖所需章節（0 起）
  const OFFICE = [
    { id: 'coffee', name: '咖啡機', icon: '☕', desc: '全隊攻擊 +6%', per: 0.06, base: 50, grow: 1.42, max: 40, unlock: 0 },
    { id: 'chair', name: '人體工學椅', icon: '🪑', desc: '全隊血量 +7%', per: 0.07, base: 80, grow: 1.42, max: 40, unlock: 1 },
    { id: 'bonus', name: '年終獎金池', icon: '💰', desc: '薪水收入 +8%', per: 0.08, base: 120, grow: 1.45, max: 40, unlock: 1 },
    { id: 'keyboard', name: '機械鍵盤', icon: '⌨️', desc: '全隊攻速 +5%', per: 0.05, base: 400, grow: 1.6, max: 15, unlock: 2 },
    { id: 'drink', name: '能量飲料櫃', icon: '🥤', desc: '大招充能 +6%', per: 0.06, base: 1500, grow: 1.6, max: 15, unlock: 3 },
    // 第二週
    { id: 'nap', name: '午睡艙', icon: '😴', desc: '全隊血量 +10%', per: 0.1, base: 5e6, grow: 1.5, max: 20, unlock: 6 },
    { id: 'union', name: '員工工會', icon: '✊', desc: '對頭目傷害 +10%', per: 0.1, base: 3e8, grow: 1.5, max: 20, unlock: 8 }
  ];

  // 公司福利：每第一次通過一關，已解鎖的辦公室設備都免費升 n 級（不影響購買價格）
  const PERK = { n: 1 };

  // 寶物：rar 0 普通、1 稀有、2 史詩、3 神器（頭目專屬掉落，寶箱開不到）
  // fx 鍵：atk 全隊攻擊、hp 全隊血量、gold 薪水、aspd 攻速、charge 大招充能、tap 點擊傷害、boss 對頭目傷害、time 頭目限時（秒）
  //        crit 阿傑爆擊率、drop 寶箱掉率、bonus 外送薪水、kuiAtk/jieAtk/miHp 個人攻擊血量、miShield 小米護盾、viviBuff 畫大餅加成、ot 加班模式薪水
  // 重複拿到會升星（最多 ★5），每多一星效果 +50%；滿星再拿到換成薪水
  const RARITY = [
    { name: '普通', color: '#9aa4b2' },
    { name: '稀有', color: '#3d9bff' },
    { name: '史詩', color: '#b26bff' },
    { name: '神器', color: '#ffb020' }
  ];
  const TREASURES = [
    { id: 'fan', rar: 3, boss: 'b_vivi', name: 'Vivi 的黃金扇', fx: { gold: 0.4, viviBuff: 0.3 }, lore: '搧一下，年終獎金就會「再研究」。' },
    { id: 'black', rar: 3, boss: 'b_client', name: '五彩斑斕的黑', fx: { atk: 0.3, boss: 0.25 }, lore: '甲方夢寐以求的顏色，看久了會有呼吸感。' },
    { id: 'clock', rar: 3, boss: 'b_meeting', name: '會議室的永恆時鐘', fx: { time: 10, aspd: 0.1 }, lore: '指針永遠停在「再五分鐘就好」。' },
    { id: 'binder', rar: 3, boss: 'b_report', name: '完美週報', fx: { hp: 0.4, atk: 0.2 }, lore: '其實是去年的週報改日期，但主管很滿意。' },
    { id: 'whip', rar: 3, boss: 'b_996', name: '折斷的監工鞭', fx: { aspd: 0.15, time: 5 }, lore: '斷成兩截之後，終於可以拿來當逗貓棒了。' },
    { id: 'calendar', rar: 3, boss: 'b_unpaid', name: '寫滿假期的月曆', fx: { gold: 0.5, hp: 0.2 }, lore: '每一格都寫著「特休」，看了心情就好。' },
    { id: 'offkey', rar: 3, boss: 'b_duty', name: '下班的鑰匙', fx: { atk: 0.3, charge: 0.15 }, lore: '打開它，筆電鎖鏈就鬆開了。' },
    { id: 'nopen', rar: 3, boss: 'b_merger', name: '不簽的鋼筆', fx: { boss: 0.3, atk: 0.2 }, lore: '寫不出「同意」兩個字的筆，非常珍貴。' },
    { id: 'whiteheart', rar: 3, boss: 'b_ceo', name: '變白的心', fx: { atk: 0.3, hp: 0.3, gold: 0.3, ot: 0.5 }, lore: '黑心洗乾淨之後，原來也會發光。' },
    { id: 'badge', rar: 3, boss: 'b_final', name: '準時下班徽章', fx: { atk: 0.25, hp: 0.25, gold: 0.25, ot: 0.5 }, lore: '傳說中的社畜勳章，全公司只有四個人拿過。' },
    { id: 'redpen', rar: 2, name: '傳說中的紅筆', fx: { crit: 0.1, jieAtk: 0.25 }, lore: '阿傑用它圈過一萬張稿子，每一圈都是「再改」。' },
    { id: 'mug', rar: 2, name: '無限續杯馬克杯', fx: { charge: 0.2 }, lore: '喝不完的咖啡，也下不完的班。' },
    { id: 'headset', rar: 2, name: '黃金客服耳機', fx: { miShield: 0.5, miHp: 0.3 }, lore: '戴上它，奧客的聲音會自動變成輕音樂。' },
    { id: 'tablet', rar: 2, name: '神之繪圖板', fx: { kuiAtk: 0.35 }, lore: '畫什麼都會被說「感覺不對」，但畫得很快。' },
    { id: 'stamp', rar: 2, name: '老闆的印章', fx: { gold: 0.25 }, lore: '蓋下去就是「准」，可惜很少蓋。' },
    { id: 'ctrlz', rar: 1, name: '萬用 Ctrl+Z', fx: { hp: 0.15 }, lore: '人生要是也能按一下就好了。' },
    { id: 'swatch', rar: 1, name: 'Pantone 色票', fx: { atk: 0.12 }, lore: '「這個藍再藍一點」的時候派得上用場。' },
    { id: 'throatdrop', rar: 1, name: '客服喉糖', fx: { miHp: 0.3, charge: 0.05 }, lore: '一天要說一千次「不好意思」的必需品。' },
    { id: 'namecard', rar: 1, name: '燙金名片', fx: { gold: 0.12 }, lore: '職稱寫得越長，薪水不一定越多。' },
    { id: 'umbrella', rar: 1, name: '下班的雨傘', fx: { aspd: 0.06 }, lore: '每次準時下班都會下雨，所以一直帶著。' },
    { id: 'mrtcard', rar: 1, name: '通勤悠遊卡', fx: { drop: 0.25 }, lore: '裡面的餘額永遠只夠搭一次。' },
    { id: 'punchclock', rar: 1, name: '老打卡鐘', fx: { time: 4 }, lore: '快五秒，所以大家都會提早打卡。' },
    { id: 'sticky', rar: 0, name: '幸運便利貼', fx: { tap: 0.25 }, lore: '貼在螢幕上，寫著「不要生氣」。' },
    { id: 'stapler', rar: 0, name: '紅色釘書機', fx: { atk: 0.05 }, lore: '辦公室最可靠的同事，從不請假。' },
    { id: 'plant', rar: 0, name: '桌上的小多肉', fx: { hp: 0.06 }, lore: '整個辦公室唯一準時下班的生物。' },
    { id: 'snack', rar: 0, name: '抽屜零食', fx: { bonus: 0.4 }, lore: '下午三點的救命糧食。' },
    { id: 'cushion', rar: 0, name: '腰靠墊', fx: { charge: 0.05 }, lore: '老鳥設計師的腰，就靠它了。' },
    { id: 'mousepad', rar: 0, name: '貓咪滑鼠墊', fx: { tap: 0.15, drop: 0.1 }, lore: '手腕放在肉球上，催稿都溫柔了。' },
    { id: 'smile', rar: 0, name: '營業用微笑', fx: { miShield: 0.2 }, lore: '戴上之後，誰都看不出你想下班。' }
  ];
  // 套裝：三件都有就再加
  const SETS = [
    { id: 'designer', name: '設計師的抽屜', items: ['redpen', 'swatch', 'tablet'], fx: { kuiAtk: 0.3, jieAtk: 0.3 }, desc: '小葵、阿傑攻擊 +30%' },
    { id: 'cs', name: '客服三寶', items: ['headset', 'throatdrop', 'smile'], fx: { miShield: 0.4, miHp: 0.4 }, desc: '小米護盾、血量 +40%' },
    { id: 'safe', name: '老闆的保險箱', items: ['fan', 'stamp', 'namecard'], fx: { gold: 0.5 }, desc: '薪水 +50%' },
    { id: 'home', name: '準時下班套組', items: ['punchclock', 'umbrella', 'mrtcard'], fx: { aspd: 0.15, time: 5 }, desc: '攻速 +15%、頭目限時 +5 秒' }
  ];
  const FX_TEXT = {
    atk: ['全隊攻擊', '%'], hp: ['全隊血量', '%'], gold: ['薪水', '%'], aspd: ['攻速', '%'], charge: ['大招充能', '%'], tap: ['點擊傷害', '%'],
    boss: ['對頭目傷害', '%'], time: ['頭目限時', '秒'], crit: ['爆擊同事爆擊率', '%'], drop: ['寶箱掉率', '%'], bonus: ['外送薪水', '%'],
    kuiAtk: ['小葵攻擊', '%'], jieAtk: ['阿傑攻擊', '%'], miHp: ['小米血量', '%'], miShield: ['小米護盾', '%'], viviBuff: ['畫大餅效果', '%'], ot: ['加班模式薪水', '%']
  };
  // 寶箱：一般怪 drop、精英怪 elite 機率掉木箱；頭目掉 boss 個金箱。w = 開到各稀有度的權重（普通、稀有、史詩）
  const CHEST = {
    drop: 0.025, elite: 0.4, boss: 2, maxStar: 5, starMul: 0.5,
    kinds: { wood: { name: '木頭寶箱', w: [64, 29, 7] }, gold: { name: '黃金寶箱', w: [0, 62, 38] } }
  };
  // 精英怪：第二章起，每波有 chance 機率出現一隻（體型大、血量 hp 倍、攻擊 atk 倍、薪水 gold 倍）
  const ELITE = { from: 10, chance: 0.35, hp: 4, atk: 1.5, gold: 4 };

  // 任務：達成即可領，不限時
  const QUESTS = [
    { id: 'q1', text: '擊敗 20 個工作怪', type: 'kills', n: 20, gold: 30 },
    { id: 'q2', text: '小葵升到 Lv 5', type: 'lv', hero: 'kui', n: 5, gold: 40 },
    { id: 'q3', text: '使用 3 次大招', type: 'ults', n: 3, gold: 50 },
    { id: 'q4', text: '點擊「催稿」50 次', type: 'taps', n: 50, gold: 60 },
    { id: 'qb1', text: '接住 3 份外送', type: 'bonus', n: 3, gold: 100 },
    { id: 'q5', text: '升級咖啡機', type: 'office', n: 1, gold: 80 },
    { id: 'qc1', text: '打開 1 個寶箱', type: 'chests', n: 1, gold: 120 },
    { id: 'q6', text: '打倒 Vivi 老闆', type: 'stage', n: 10, gold: 200 },
    { id: 'q7', text: '任一員工升職', type: 'rank', n: 1, gold: 300 },
    { id: 'q8', text: '擊敗 300 個工作怪', type: 'kills', n: 300, gold: 800 },
    { id: 'q9', text: '通過週二', type: 'stage', n: 20, gold: 3000 },
    { id: 'q10', text: '全隊等級合計 100', type: 'lvsum', n: 100, gold: 6000 },
    { id: 'q11', text: '使用 30 次大招', type: 'ults', n: 30, gold: 8000 },
    { id: 'qb2', text: '接住 20 份外送', type: 'bonus', n: 20, gold: 50000 },
    { id: 'qc2', text: '收集 10 種寶物', type: 'treasures', n: 10, gold: 20000 },
    { id: 'q12', text: '通過週三', type: 'stage', n: 30, gold: 30000 },
    { id: 'qc3', text: '湊齊一組套裝', type: 'sets', n: 1, gold: 40000 },
    { id: 'q13', text: '四人都升職兩次', type: 'rank2', n: 4, gold: 60000 },
    { id: 'q14', text: '擊敗 1500 個工作怪', type: 'kills', n: 1500, gold: 120000 },
    { id: 'q15', text: '通過週四', type: 'stage', n: 40, gold: 300000 },
    { id: 'qc4', text: '收集 20 種寶物', type: 'treasures', n: 20, gold: 500000 },
    { id: 'q16', text: '準時下班！通過週五', type: 'stage', n: 50, gold: 1000000 },
    // v1.4 第二週與挑戰關卡
    { id: 'qw1', text: '打倒 996 監工', type: 'stage', n: 60, gold: 3e7, resume: 3 },
    { id: 'qw2', text: '撐過無薪假風暴', type: 'stage', n: 70, gold: 3e8, resume: 3 },
    { id: 'qw3', text: '擺脫責任制', type: 'stage', n: 80, gold: 3e9, resume: 3 },
    { id: 'qw4', text: '阻止併購', type: 'stage', n: 90, gold: 3e10, resume: 3 },
    { id: 'qw5', text: '打倒黑心董事長', type: 'stage', n: 100, gold: 3e11, resume: 5 },
    { id: 'qc5', text: '通過 1 個挑戰關卡', type: 'chal', n: 1, gold: 500, resume: 1 },
    { id: 'qc6', text: '通過 5 個挑戰關卡', type: 'chal', n: 5, gold: 50000, resume: 2 },
    { id: 'qc7', text: '挑戰關卡合計 15 顆星', type: 'cstars', n: 15, gold: 1e6, resume: 3 },
    { id: 'qc8', text: '通過 15 個挑戰關卡', type: 'chal', n: 15, gold: 1e9, resume: 5 },
    { id: 'qc9', text: '挑戰關卡合計 50 顆星', type: 'cstars', n: 50, gold: 1e10, resume: 5 },
    { id: 'qc10', text: '全部挑戰關卡 3 星', type: 'cstars', n: 999, gold: 1e12, resume: 10 },
    // v1.3：收集同事（獎勵 resume = 履歷份數）
    { id: 'qr1', text: '招募 1 次', type: 'pulls', n: 1, gold: 0, resume: 1 },
    { id: 'qh1', text: '收集 10 位同事', type: 'heroes', n: 10, gold: 0, resume: 1 },
    { id: 'qh2', text: '收集 20 位同事', type: 'heroes', n: 20, gold: 0, resume: 2 },
    { id: 'qh3', text: '收集 30 位同事', type: 'heroes', n: 30, gold: 0, resume: 2 },
    { id: 'qh4', text: '收集 40 位同事', type: 'heroes', n: 40, gold: 0, resume: 3 },
    { id: 'qh5', text: '收集 50 位同事', type: 'heroes', n: 50, gold: 0, resume: 5 },
    { id: 'qh6', text: '收集 60 位同事', type: 'heroes', n: 60, gold: 0, resume: 5 },
    { id: 'qh7', text: '收集 70 位同事', type: 'heroes', n: 70, gold: 0, resume: 5 },
    { id: 'qh8', text: '收集 80 位同事', type: 'heroes', n: 80, gold: 0, resume: 5 },
    { id: 'qh9', text: '收集 90 位同事', type: 'heroes', n: 90, gold: 0, resume: 5 },
    { id: 'qh10', text: '全公司同事到齊！', type: 'heroes', n: 100, gold: 0, resume: 10 },
    { id: 'qs1', text: '任一同事升到 ★3', type: 'star', n: 3, gold: 0, resume: 1 },
    { id: 'qs2', text: '任一同事升到 ★5', type: 'star', n: 5, gold: 0, resume: 5 },
    { id: 'qd1', text: '同部門 3 人一起上場', type: 'dept', n: 3, gold: 0, resume: 1 }
  ];

  // 外送驚喜：戰鬥中每 every 秒出現一個，飄 life 秒；gold = 該關打一隻怪的薪水 × gold
  const BONUS = {
    first: 6, every: [20, 35], life: 6, r: 42,
    kinds: {
      bento:  { name: '便當', w: 4, gold: 14, buff: { kind: 'gold', mul: 2, dur: 15 }, text: '薪水加倍' },
      coffee: { name: '手搖咖啡', w: 3, gold: 5, buff: { kind: 'aspd', mul: 1.5, dur: 12 }, text: '攻速提升' },
      boba:   { name: '珍珠奶茶', w: 3, gold: 5, buff: { kind: 'atk', mul: 2, dur: 12 }, text: '攻擊加倍' }
    }
  };
  // 點擊連擊：window 秒內連點累計，每下 +per 傷害倍率，最多 max 倍
  const COMBO = { window: 0.7, per: 0.05, max: 2 };
  // 頭目技能：登場 first 秒後第一招（邊走邊放）、之後每 every 秒一招
  const BOSS_SKILL = { first: 2, every: 9 };
  // 碎碎念：至少間隔 gap 秒；idle 秒沒人說話就隨口一句
  const TALK = { gap: 11, idle: 18 };
  // 大招充滿後 wait 秒沒按，員工會自己放（自動大招開著就馬上放）
  const ULT_WAIT = 4;
  // 打輸後練功幾關就自動回去挑戰（打輸有同事打氣加成，很快就打得過）
  const BOSS_RETRY = 1;
  // 自動升級：通過幾關後可以開
  const AUTOBUY_AT = 5;
  // 同事打氣：打輸一次 +fail 層、第一次過某關花超過 slow 秒（只算戰鬥時間）+1 層；每層攻擊血量 +per、薪水 +gold（最多 max 層）
  // 之後每順利過 calm 關退 1 層。一般玩家幾乎不會觸發，是給不太會玩的人的保底
  const CHEER = { per: 0.3, gold: 0.15, max: 40, fail: 5, slow: 50, calm: 3 };   // 主線（第 100 關以前）才會因為打太久 +1 層

  // 劇情（章節開頭、頭目登場、頭目擊敗）
  const STORY = {
    intro0: [['kui', '早安～今天是我上班第一週！'], ['mi', '早安。電話已經響了 37 通了。'], ['kui', '欸？才九點耶？'], ['mi', '這間公司的電話是從昨天晚上一路響到現在的。'], ['sys', '點畫面可以「催稿」幫忙打怪，連點傷害更高！外送飛過來記得點，賺到的薪水拿去幫大家升級吧！']],
    join_jie: [['jie', '……吵死了，誰把我的咖啡打翻了？'], ['kui', '阿傑前輩！'], ['jie', '讓開，這種怪我十年前就打過了。'], ['sys', '阿傑加入了！他會爆擊，大招「一稿過」專打頭目。']],
    tut_chest: [['kui', '咦？怪物掉了一個箱子！'], ['jie', '那是寶箱。公司倉庫的東西都被怪物吃掉了，打倒牠們就會吐出來。'], ['mi', '裡面可能有好東西，也可能只是釘書機。'], ['sys', '寶物是永久加成！點畫面下方的「🎁 寶箱」打開，重複拿到會升星，三件湊成一套還有套裝效果。']],
    mid0: [['vivi', '（從辦公室玻璃後面揮手）'], ['kui', '那是誰？一直在看我們……'], ['jie', '老闆。她每週一都會「剛好路過」。'], ['mi', '午餐前通常會進來一次。大家螢幕記得切好。']],
    boss_b_vivi: [['vivi', '大家都在認真上班嗎～？我來突擊檢查囉！'], ['jie', '……又來了。'], ['vivi', '打贏我的話，我就下來跟大家一起做！'], ['sys', '頭目戰限時 40 秒。頭目血量剩一半會「變身」換招！放招前會先預警，趁機放大招或狂點。']],
    win_b_vivi: [['vivi', '不錯嘛！看來公司有你們很安心～'], ['vivi', '好，我也下去一起做！順便把我的扇子送你們。'], ['sys', 'Vivi 老闆加入了！大招「畫大餅」讓全隊攻擊暴增。'], ['sys', '取得神器「Vivi 的黃金扇」！每個頭目都有一件專屬神器。'], ['sys', '解鎖：自動大招（已經幫你打開）、辦公室「人體工學椅」「年終獎金池」']],
    intro1: [['mi', '週二。客戶說 Logo 要再大一點。'], ['kui', '已經佔滿整張海報了啊……'], ['jie', '那就改回第一版，他們會說很好。'], ['vivi', '這個客戶很重要喔～他付的錢可以讓我們撐到年底！']],
    mid1: [['kui', '前輩，客戶說「要有質感，但不要太有質感」……'], ['jie', '意思是「我也不知道我要什麼」。'], ['mi', '客戶剛剛來電，說他們老闆下午要親自來。'], ['jie', '……完了。甲方大魔王要出現了。']],
    boss_b_client: [['sys', '甲方大魔王：「我要五彩斑斕的黑，而且要有呼吸感。」'], ['kui', '呼、呼吸感？'], ['vivi', '照他說的做！他付錢的！'], ['sys', '甲方會「再改一版」張開護盾：狂點或放大招可以打破！變身後還會叫主管來助陣。']],
    win_b_client: [['jie', '最後他選了第一版。'], ['kui', '每次都這樣嗎？'], ['jie', '每次都這樣。'], ['sys', '取得神器「五彩斑斕的黑」！全隊攻擊大幅提升。']],
    intro2: [['vivi', '今天下午兩點、三點、四點各有一場會議喔～'], ['mi', '那我什麼時候上班？'], ['vivi', '開會就是上班呀！'], ['jie', '我建議開一個會，討論要不要少開點會。']],
    mid2: [['kui', '剛剛的會議結論是什麼？'], ['mi', '結論是：下次開會再決定。'], ['jie', '會議室的時鐘好像壞了，從早上十點一直停在「再五分鐘」。'], ['kui', '所以……我們被困在會議裡了？']],
    boss_b_meeting: [['sys', '無限會議：「我們先來對齊一下，再開一個會討論要不要開會。」'], ['jie', '這場會議沒有結束時間。'], ['kui', '那我們把它打到結束！'], ['sys', '它會「再開一個會」叫小怪擋在前面，小葵的大招最好清。']],
    win_b_meeting: [['mi', '會議記錄我寫好了：「下週再議」。'], ['vivi', '很好，很有效率！'], ['kui', '時鐘終於動了！'], ['sys', '取得神器「會議室的永恆時鐘」！頭目戰時間變長了。']],
    intro3: [['kui', '週報明天要交，我還沒開始……'], ['jie', '我也還沒。'], ['mi', '我寫好了，但系統當掉了。'], ['vivi', '週報很重要喔！那是你們成長的證明～']],
    mid3: [['kui', '週報要寫「本週成長」……我這週成長了什麼？'], ['jie', '你學會了「已讀不回」。'], ['mi', '我學會了把電話音量調到最小。'], ['vivi', '寫得好看一點！董事會要看的！']],
    boss_b_report: [['sys', '週報魔像：「本週工作內容……請填寫至少五百字。」'], ['vivi', '數字要好看喔～'], ['sys', '「格式不對」會打全隊，看到預警就放小米的大招擋下來！']],
    win_b_report: [['vivi', '這份週報寫得真好，我會拿去給董事會看！'], ['jie', '……那是去年的週報改日期。'], ['kui', '前輩！'], ['sys', '取得神器「完美週報」！']],
    intro4: [['kui', '週五了！今天一定要準時下班！'], ['mi', '別說出來，會被聽到。'], ['jie', '噓——'], ['vivi', '大家今天也要加油喔～（其實我也想早點走）']],
    mid4: [['kui', '五點半了……大家都在偷偷收包包。'], ['mi', '我已經把電話設成轉語音信箱了。'], ['jie', '小心，每週五 17:59 都會有一封信。'], ['kui', '什麼信？'], ['jie', '……傳說中的「下班前的新需求」。']],
    boss_b_final: [['sys', '17:59，一封新信件：「這個很簡單，下班前可以給我嗎？」'], ['kui', '它、它來了……'], ['vivi', '大家！打倒它就放假！'], ['mi', '這是最後一通電話了。'], ['jie', '這次，我們準時下班。']],
    win_b_final: [['kui', '我們……準時下班了！！'], ['jie', '十年來第一次。'], ['mi', '電話我拔掉了。'], ['vivi', '好啦好啦，下週一見～'], ['sys', '取得神器「準時下班徽章」！'], ['sys', '第一週完成！不過……週一早上好像有一封信在等你們。']],

    // ----- 第二週：黑心公司篇（說話者 v_ceo 黑心董事長、v_aide 黑心特助）-----
    // 第一週結局後的「下週一」預告
    nextweek: [['sys', '——下週一，早上 8:59。'], ['mi', '……信箱裡有一封信，寄件人是「黑心公司」。'], ['kui', '標題寫「恭喜貴公司即將成為我們的一份子」？'],
      ['v_aide', '（視訊會議突然打開）各位早安。我是黑心公司董事長的特助。'], ['v_aide', '上週那些工作怪，都是我們派來做「員工耐操度測試」的。你們分數很高，董事長很欣賞。'],
      ['v_ceo', '喵。從今天起，你們公司歸我管了。我們的口號是——公司就是你家，所以你不用回家。'], ['jie', '……我要請假。'], ['v_aide', '請假單我們已經幫你撕了。'],
      ['vivi', '等一下！誰說要賣公司了！我還沒簽字耶！'], ['sys', '第二週「黑心公司篇」開始！一路打上黑心公司大樓的頂樓，把公司搶回來！']],
    // 舊存檔：原本在加班模式的人
    migrate: [['sys', '公告：「加班模式」暫時關閉整修！'], ['sys', '第 51 關起改成第二週「黑心公司篇」，你的同事、寶物、等級都還在。打完第二週（第 100 關）就會重新開放加班模式。'], ['vivi', '所以上禮拜的加班，原來都是黑心公司害的？']],

    intro5: [['v_aide', '歡迎光臨黑心公司大樓。請在大廳刷卡，並把您的週末寄放在櫃檯。'], ['kui', '刷卡機一直顯示「已打卡：上班」，可是我還沒進去耶。'],
      ['mi', '而且下班的按鈕被貼起來了。'], ['jie', '這棟樓一樓就這麼黑心，上面還得了。'], ['vivi', '大家跟我衝！我們要去頂樓找他們董事長談判！']],
    mid5: [['kui', '天花板上全部都是監視器……連茶水間也有。'], ['v_aide', '我們只是關心員工。每天上廁所超過三分鐘，系統會自動寄關心信給您。'],
      ['mi', '這不是關心，這是監控吧。'], ['jie', '小聲點。前面那台很大的機器人，手上拿的是……鞭子？']],
    boss_b_996: [['v_aide', '介紹一下，這位是我們的 996 監工。早上九點到晚上九點，一週六天，全年無休。'], ['kui', '它、它拿鞭子耶！'],
      ['mi', '看到它舉鞭子就要小心，被打到會一陣子不能動。'], ['sys', '「加班鞭」會讓全隊暫停一下：坦克的大招可以解除！']],
    win_b_996: [['jie', '鞭子斷了。終於。'], ['kui', '我撿到一半，可以拿去逗貓。'], ['v_aide', '……監工只是基層主管而已。樓上的部門，會讓你們想念加班的感覺。'],
      ['sys', '取得神器「折斷的監工鞭」！解鎖辦公室「午睡艙」。']],

    intro6: [['v_aide', '這層是「彈性工作區」。我們很彈性：薪水可以彈性不發。'], ['mi', '這裡的人好安靜……'],
      ['kui', '那位大哥一直抱著空白月曆發呆。'], ['vivi', '空白月曆？那不就是無薪假嗎！誰會這樣對員工啦！'], ['v_aide', '我們都說是「共體時艱」。']],
    mid6: [['kui', '茶水間有人在發大餅耶，好香！'], ['jie', '別吃。那是假的，咬下去是空氣。'], ['mi', '我剛剛跟一個黑心員工聊了一下，他說已經三個月沒領到全薪了。'],
      ['vivi', '……我以前是不是也畫過大餅？'], ['jie', '畫過。但至少妳有發薪水。']],
    boss_b_unpaid: [['v_aide', '請見我們的人資顧問：無薪假魔。他最擅長幫公司「省錢」。'], ['sys', '「扣薪」會把大家的大招充能扣光，增益效果也會被取消。充滿了就趕快放！']],
    win_b_unpaid: [['kui', '月曆上的空格……都變成特休了！'], ['mi', '那位抱月曆的大哥哭了，他說要回家吃晚餐。'], ['vivi', '這才對嘛。上班是為了生活，不是生活為了上班。'],
      ['sys', '取得神器「寫滿假期的月曆」！']],

    intro7: [['v_aide', '這裡是機房。我們實行「責任制」，所以這裡沒有下班時間，也沒有冷氣。'], ['jie', '伺服器的風扇聲跟我的腰一樣在哀號。'],
      ['mi', '每個人手上都銬著一台筆電……'], ['kui', '筆電上還寫著「請保持在線」。']],
    mid7: [['mi', '凌晨三點了。電話又響了。'], ['jie', '我們在打怪，不是在加班。這兩件事要分清楚。'], ['v_aide', '責任制的意思很簡單：事情是你的責任，時間是公司的。'],
      ['vivi', '這根本不是責任制，是無限制吧！']],
    boss_b_duty: [['v_aide', '我們的責任制巨像，由一千台加班的筆電組成。'], ['kui', '它好大……而且一直在變大！'],
      ['sys', '巨像變身後會「責任自己扛」幫自己回血：火力集中，一口氣打下去！']],
    win_b_duty: [['mi', '筆電鎖鏈全部解開了。'], ['jie', '我第一次覺得登出是這麼美的兩個字。'], ['v_aide', '……再上去就是董事會了。董事長在樓上等你們。'],
      ['sys', '取得神器「下班的鑰匙」！解鎖辦公室「員工工會」。']],

    intro8: [['v_aide', '董事會議廳。今天的議程只有一項：通過併購案。'], ['vivi', '我是那間公司的老闆，我反對！'], ['v_aide', '反對無效。合約第 87 條寫了：「反對視同同意」。'],
      ['kui', '這種合約可以簽嗎！？'], ['jie', '不行。所以我們來把它撕掉。']],
    mid8: [['mi', '每一份合約上面都有很小很小的字。'], ['kui', '「乙方需自願加班」「乙方的夢想歸甲方所有」……'], ['jie', '我做了十年設計，第一次想把字級調到 72 級讓大家看清楚。'],
      ['vivi', '我回去要把我們公司的合約都改成大字版。']],
    boss_b_merger: [['v_aide', '請見我們的併購長：併購章魚。八隻手，可以同時簽八份合約。'], ['mi', '那墨水好像會讓人沒力氣……'],
      ['sys', '「強迫簽約」會降低全隊攻擊：治療同事的大招可以解除！']],
    win_b_merger: [['vivi', '合約我撕了！這間公司是我們大家的！'], ['kui', '老闆好帥！'], ['v_ceo', '（廣播）……很好。上來吧。頂樓見。'],
      ['sys', '取得神器「不簽的鋼筆」！']],

    intro9: [['v_aide', '……這裡是頂樓。董事長室在走廊的盡頭。'], ['kui', '特助小姐，妳為什麼一直幫我們開門？'], ['v_aide', '……因為我也好久沒下班了。'],
      ['mi', '那妳要不要一起走？'], ['v_aide', '等你們打倒董事長再說吧。']],
    mid9: [['kui', '這邊的房間裡關了好多黑心員工！'], ['jie', '他們都在加班，一直加班，加到忘記自己為什麼加班。'], ['mi', '我們一定要把他們救出去。'],
      ['vivi', '打完這一場，我請所有人吃飯！這次是真的！']],
    boss_b_ceo: [['v_ceo', '喵。終於來了。'], ['v_ceo', '你們知道嗎？員工不用回家，公司就永遠不會停。這就是我的經營哲學。'],
      ['jie', '你的哲學，我們不買單。'], ['sys', '黑心董事長有三個階段，血量剩一點點時會「黑心全開」！大家撐住！']],
    win_b_ceo: [['v_ceo', '喵嗚……我只是……不想一個人待在公司而已……'], ['v_aide', '董事長，其實您也可以下班的。'],
      ['v_ceo', '……下班？可以嗎？'], ['vivi', '當然可以。明天見，準時上班，準時下班。'], ['sys', '取得神器「變白的心」！']],
    ending2: [['sys', '黑心公司倒閉了。被困住的員工全部救出來，大家一起走出大樓。'], ['kui', '夕陽好漂亮……這是我第一次在天黑前下班！'],
      ['mi', '電話我拔掉了。這次是兩支。'], ['jie', '下週一見。不，下週一我要請特休。'], ['v_aide', '我也想請特休……請問你們公司還缺人嗎？'],
      ['vivi', '歡迎加入！我們公司準時下班的！'], ['sys', '恭喜通關第二週！解鎖「加班模式」：第 101 關起無限關卡，十個頭目輪流出現，想玩多久就多久。']]
  };

  // ---------- 挑戰關卡（v1.4）----------
  // ch：顯示在地圖第幾章（0 起，跟 chapterOf 一樣）；at：通過第幾關解鎖（maxStage ≥ at）
  // off：難度＝怪物強度用「解鎖那關再往後 off 關」（s = at - 1 + off，自動算），數字越大越難
  // rules：time 限時秒數、enemyHp／enemyAtk 倍率、noUlt 不能放大招、noTap 不能催稿、dept 只能派某部門、maxTeam 最多幾人、
  //        allElite 全部精英、bossRush 頭目連戰（每波一隻）、waves 波數、pool 只出這些怪
  // reward：第一次通關 { resume, chests: { gold, wood }, gold（薪水，engine 依 s 換算成金額）, treasure（現有寶物 +1 星） }
  // reward3：第一次拿到 3 星再給；重打過關只給一點薪水（CHAL.repeatGold）
  // 星數：1 過關、2 有限時＝剩一半以上時間／沒限時＝par 秒內過關、3 沒有人倒下
  const W1BOSS = ['b_vivi', 'b_client', 'b_meeting', 'b_report', 'b_final'], W2BOSS = ['b_996', 'b_unpaid', 'b_duty', 'b_merger', 'b_ceo'];
  const CHALLENGES = [
    { id: 'c01', ch: 0, at: 6, off: 0, name: '晨會快問快答', desc: '主管說「大家簡單講一下」，結果要在 45 秒內講完，還不准用絕招。', rules: { waves: 3, time: 45, noUlt: true }, reward: { resume: 2, chests: { wood: 1 }, gold: 30 } },
    { id: 'c02', ch: 0, at: 9, off: 1, name: '打卡大塞車', desc: '八點五十九分，全公司的鬧鐘同時響了。數量很多，但一戳就倒。', rules: { waves: 4, pool: ['e_alarm'], enemyHp: 0.6, time: 50 }, reward: { resume: 2, chests: { wood: 2 }, gold: 30 } },
    { id: 'c03', ch: 1, at: 13, off: 1, name: '客服專線爆線', desc: '所有電話一起響。只有客服部的同事接得起來。', rules: { waves: 3, dept: 'cs' }, reward: { resume: 3, chests: { gold: 1 }, gold: 40 } },
    { id: 'c04', ch: 1, at: 18, off: 2, name: '甲方改稿馬拉松', desc: '甲方說「最後一次修改」。這是今天第八次聽到。不准催稿。', rules: { bossRush: ['b_client'], enemyHp: 4, noTap: true }, reward: { resume: 3, chests: { gold: 1 }, gold: 40, treasure: 'swatch' } },
    { id: 'c05', ch: 1, at: 19, off: 2, name: '印表機卡紙地獄', desc: '每一台印表機都卡紙，而且都是特大號的。', rules: { waves: 3, pool: ['e_printer'], allElite: true, enemyHp: 2 }, reward: { resume: 2, chests: { wood: 2 }, gold: 40, treasure: 'ctrlz' } },
    { id: 'c06', ch: 2, at: 23, off: 2, name: '兩人小組會議', desc: '會議室只訂到兩個位子。最多派 2 人。', rules: { waves: 3, maxTeam: 2 }, reward: { resume: 3, chests: { gold: 1 }, gold: 50 } },
    { id: 'c07', ch: 2, at: 26, off: 3, name: '工程部的大日子', desc: '系統上線日，Bug 比人還多。只能派工程部。', rules: { waves: 3, dept: 'eng', enemyHp: 1.2 }, reward: { resume: 3, chests: { gold: 1 }, gold: 50 } },
    { id: 'c08', ch: 2, at: 29, off: 3, name: '會議連開', desc: '老闆的突擊檢查剛結束，無限會議就開始了。70 秒內兩場都要開完。', rules: { bossRush: ['b_vivi', 'b_meeting'], time: 70, enemyHp: 3 }, reward: { resume: 4, chests: { gold: 1 }, gold: 60, treasure: 'mug' } },
    { id: 'c09', ch: 3, at: 33, off: 2, name: '業務衝業績', desc: '月底了，業績還差一點點。只能派業務部。', rules: { waves: 3, dept: 'sales' }, reward: { resume: 3, chests: { gold: 1 }, gold: 60 } },
    { id: 'c10', ch: 3, at: 36, off: 3, name: '死線前 35 秒', desc: 'Deadline 沙漏都殺紅眼了，攻擊特別痛。', rules: { waves: 3, time: 35, enemyAtk: 1.5 }, reward: { resume: 3, chests: { wood: 2 }, gold: 60 } },
    { id: 'c11', ch: 3, at: 39, off: 3, name: '週報不准點', desc: '主管說週報要「自然地」寫完。不准催稿，也不准放大招。', rules: { waves: 3, noTap: true, noUlt: true }, reward: { resume: 4, chests: { gold: 1 }, gold: 70, treasure: 'redpen' } },
    { id: 'c12', ch: 4, at: 43, off: 2, name: '行政大掃除', desc: '年底大掃除，便利貼精和加班幽靈到處都是。只能派行政部。', rules: { waves: 3, dept: 'admin' }, reward: { resume: 3, chests: { gold: 1 }, gold: 70 } },
    { id: 'c13', ch: 4, at: 46, off: 3, name: '設計部比稿', desc: '五家公司一起比稿，只有設計部能上台。', rules: { waves: 3, dept: 'design', enemyHp: 2 }, reward: { resume: 3, chests: { gold: 1 }, gold: 70 } },
    { id: 'c14', ch: 4, at: 50, off: 2, name: '第一週頭目連戰', desc: '五個頭目排隊上門，而且都吃飽了。150 秒內全部打倒。', rules: { bossRush: W1BOSS, enemyHp: 2, time: 150 }, reward: { resume: 6, chests: { gold: 2 }, gold: 100, treasure: 'stamp' }, reward3: { resume: 3 } },
    { id: 'c15', ch: 5, at: 54, off: 2, name: '大廳保全全精英', desc: '黑心公司大廳的保全，個個都是加大版。', rules: { waves: 4, allElite: true }, reward: { resume: 3, chests: { gold: 1 }, gold: 80 } },
    { id: 'c16', ch: 5, at: 58, off: 3, name: '監工突擊', desc: '996 監工吃了加班便當，血量兩倍。45 秒內解決它。', rules: { bossRush: ['b_996'], enemyHp: 5, time: 45 }, reward: { resume: 4, chests: { gold: 1 }, gold: 80, treasure: 'headset' } },
    { id: 'c17', ch: 6, at: 63, off: 3, name: '無薪假也要上班', desc: '沒領薪水還要上班，大家沒力氣放大招，怪也特別兇。', rules: { waves: 3, noUlt: true, enemyHp: 3, enemyAtk: 1.5 }, reward: { resume: 3, chests: { gold: 1 }, gold: 90 } },
    { id: 'c18', ch: 6, at: 66, off: 2, name: '三人小組', desc: '公司說「人力精實」，這次最多 3 人。', rules: { waves: 4, maxTeam: 3 }, reward: { resume: 4, chests: { gold: 1 }, gold: 90 } },
    { id: 'c19', ch: 6, at: 69, off: 4, name: '畫大餅大會', desc: '假大餅一個接一個飛過來，60 秒內全部打掉。', rules: { waves: 5, pool: ['e_pie'], time: 60 }, reward: { resume: 4, chests: { gold: 1 }, gold: 90, treasure: 'tablet' } },
    { id: 'c20', ch: 7, at: 73, off: 4, name: '機房只准工程師', desc: '機房門禁只認工程部的卡，伺服器還特別硬。', rules: { waves: 3, dept: 'eng', enemyHp: 4 }, reward: { resume: 4, chests: { gold: 1 }, gold: 100 } },
    { id: 'c21', ch: 7, at: 77, off: 4, name: '凌晨三點 on call', desc: '大家都睡眼惺忪，沒力氣催稿。45 秒內處理完。', rules: { waves: 3, noTap: true, time: 45, enemyHp: 3 }, reward: { resume: 4, chests: { gold: 1 }, gold: 100 } },
    { id: 'c22', ch: 8, at: 83, off: 4, name: '業務談判桌', desc: '對面是黑西裝和霸王條款。只有業務部說得過他們。', rules: { waves: 3, dept: 'sales', enemyHp: 4 }, reward: { resume: 4, chests: { gold: 1 }, gold: 110 } },
    { id: 'c23', ch: 8, at: 86, off: 5, name: '霸王條款全精英', desc: '每一份合約都是加大加厚版，看了就痛。', rules: { waves: 4, allElite: true, enemyHp: 3, enemyAtk: 1.3 }, reward: { resume: 4, chests: { gold: 2 }, gold: 110 } },
    { id: 'c24', ch: 8, at: 89, off: 5, name: '雙頭目併購案', desc: '無薪假魔和併購章魚聯手了。90 秒內拆散他們。', rules: { bossRush: ['b_unpaid', 'b_merger'], time: 90, enemyHp: 4 }, reward: { resume: 5, chests: { gold: 2 }, gold: 120, treasure: 'namecard' } },
    { id: 'c25', ch: 9, at: 94, off: 4, name: '特助的考驗', desc: '特助說：「董事長只見兩個人，而且不准用絕招。」', rules: { waves: 3, maxTeam: 2, noUlt: true, enemyHp: 2 }, reward: { resume: 5, chests: { gold: 2 }, gold: 120 } },
    { id: 'c26', ch: 9, at: 100, off: 3, name: '黑心頭目大連戰', desc: '黑心公司五大頭目一起復活。180 秒內全部打倒——這是最難的挑戰。', rules: { bossRush: W2BOSS, enemyHp: 4, time: 180 }, reward: { resume: 8, chests: { gold: 3 }, gold: 150, treasure: 'umbrella' }, reward3: { resume: 5 } }
  ];
  const CHAL = { repeatGold: 5, goldMul: 0.5 };   // 重打過關給 該關打一隻怪 × repeatGold 的薪水；挑戰中打怪薪水 × goldMul（不掉寶箱、履歷）
  for (const c of CHALLENGES) {
    c.s = c.at - 1 + (c.off || 0);
    c.level = c.off <= 1 ? 1 : c.off <= 3 ? 2 : 3;   // 難度 1 簡單、2 普通、3 困難（介面可以畫成 ★ 數）
    const r = c.rules, nb = r.bossRush ? r.bossRush.length : 0;
    c.par = r.time ? null : nb ? 30 * nb : (r.waves || 3) * 15;
    c.starText = ['過關', r.time ? '剩一半以上的時間' : `${c.par} 秒內過關`, '沒有人倒下'];
    const t = [];
    if (r.time) t.push(`限時 ${r.time} 秒`);
    if (nb) t.push(`頭目連戰 ×${nb}`); else t.push(`${r.waves || 3} 波`);
    if (r.dept) t.push(`只能派${DEPTS[r.dept].name}`);
    if (r.maxTeam) t.push(`最多 ${r.maxTeam} 人`);
    if (r.noUlt) t.push('不能放大招');
    if (r.noTap) t.push('不能催稿');
    if (r.allElite) t.push('全部精英');
    if (r.enemyHp && r.enemyHp !== 1) t.push(`敵人血量 ×${r.enemyHp}`);
    if (r.enemyAtk && r.enemyAtk !== 1) t.push(`敵人攻擊 ×${r.enemyAtk}`);
    c.ruleText = t;   // 介面直接列出來
  }
  { const q = QUESTS.find(x => x.id === 'qc10'); if (q) q.n = CHALLENGES.length * 3; }

  // ---------- 地圖（v1.4）----------
  // week1 第 1～50 關、week2 第 51～100 關。圖 1080×2592（ar = 高 ÷ 寬）。
  // path[i] = 那週第 i 關節點的 [x, y]（0～1 比例，左上角為原點，由下往上走）：A 的 art/map/weekN.json 道路中心線沿弧長平均取 50 點（頭尾各留 1.2%）
  // chal[id] = 挑戰節點：解鎖那關（c.at - 1）的節點往道路垂直方向推出寬度的 0.15～0.18，避開其他節點與圖邊
  const MAP = {
    week1: { img: 'art/map/week1.webp', ar: 2.4, from: 0, to: 50,
      path: [[0.494, 0.9823], [0.499, 0.9606], [0.522, 0.941], [0.545, 0.9213], [0.564, 0.9012], [0.57, 0.8794], [0.563, 0.8579], [0.541, 0.838], [0.511, 0.8201], [0.483, 0.8016], [0.462, 0.7815], [0.456, 0.7601], [0.474, 0.7399], [0.504, 0.7219], [0.538, 0.7054], [0.57, 0.6881], [0.591, 0.6682], [0.6, 0.6467], [0.591, 0.6253], [0.569, 0.6056], [0.532, 0.5898], [0.495, 0.5744], [0.462, 0.5574], [0.437, 0.5382], [0.442, 0.5173], [0.469, 0.4985], [0.508, 0.4836], [0.547, 0.4691], [0.569, 0.4506], [0.56, 0.4294], [0.533, 0.4109], [0.505, 0.3924], [0.507, 0.3711], [0.533, 0.3519], [0.555, 0.3322], [0.559, 0.3108], [0.535, 0.292], [0.504, 0.2741], [0.493, 0.2538], [0.516, 0.2345], [0.552, 0.2184], [0.585, 0.2016], [0.593, 0.1804], [0.568, 0.1612], [0.543, 0.1429], [0.55, 0.1219], [0.557, 0.1005], [0.557, 0.0786], [0.558, 0.0567], [0.558, 0.0348]],
      chal: {'c01':  [0.41, 0.8805], 'c02':  [0.644, 0.7832], 'c03':  [0.332, 0.7092], 'c04':  [0.44, 0.6468], 'c05':  [0.744, 0.6053], 'c06':  [0.595, 0.5207], 'c07':  [0.345, 0.4566], 'c08':  [0.728, 0.4599], 'c09':  [0.353, 0.3531], 'c10':  [0.716, 0.2969], 'c11':  [0.642, 0.2612], 'c12':  [0.435, 0.1918], 'c13':  [0.391, 0.1125], 'c14':  [0.398, 0.0337]} },
    week2: { img: 'art/map/week2.webp', ar: 2.4, from: 50, to: 100, lockedUntil: 50,
      path: [[0.497, 0.943], [0.496, 0.9227], [0.496, 0.9024], [0.497, 0.8821], [0.5, 0.8619], [0.514, 0.8428], [0.537, 0.825], [0.555, 0.8062], [0.56, 0.7861], [0.547, 0.7666], [0.522, 0.7493], [0.489, 0.7345], [0.455, 0.72], [0.43, 0.7028], [0.427, 0.6828], [0.447, 0.6645], [0.479, 0.6492], [0.514, 0.6352], [0.554, 0.6238], [0.591, 0.6105], [0.61, 0.5922], [0.596, 0.5731], [0.563, 0.5582], [0.526, 0.5451], [0.489, 0.5323], [0.45, 0.5201], [0.434, 0.5018], [0.462, 0.4855], [0.501, 0.4733], [0.542, 0.4628], [0.583, 0.4517], [0.615, 0.4366], [0.606, 0.4181], [0.568, 0.4051], [0.529, 0.3932], [0.505, 0.3773], [0.516, 0.3581], [0.502, 0.3405], [0.495, 0.3212], [0.527, 0.3064], [0.565, 0.2937], [0.591, 0.2771], [0.58, 0.2589], [0.573, 0.2391], [0.574, 0.2191], [0.599, 0.2019], [0.607, 0.1856], [0.573, 0.1725], [0.532, 0.1617], [0.543, 0.1432]],
      chal: {'c15': [0.656, 0.8849], 'c16': [0.4, 0.7904], 'c17': [0.582, 0.6793], 'c18': [0.313, 0.6282], 'c19': [0.714, 0.6238], 'c20': [0.674, 0.5102], 'c21': [0.276, 0.4921], 'c22': [0.742, 0.3833], 'c23': [0.347, 0.3873], 'c24': [0.647, 0.3412], 'c25': [0.413, 0.2434], 'c26': [0.388, 0.1265]} }
  };

  // ---------- 名冊合併：原本四人 + G.ROSTER（js/roster.js）→ ALLHEROES ----------
  // 同事能力由稀有度、職業、星數決定；roster.js 晚載入也沒關係，engine 會呼叫 syncRoster() 重新合併
  // 主題版本：能力 = 本尊 × 稀有度倍率，職業、部門、普攻、升職路線、台詞跟本尊
  function makeVariant(r, b) {
    const rar = Math.max(2, Math.min(4, r.rar | 0)), M = HRAR[rar].mul / HRAR[b.rar].mul, th = THEME[rar];
    const sk = typeof r.skill === 'string' ? r.skill : (r.skill && r.skill.name) || b.skill.name;
    const line = r.line || b.line;
    return Object.assign({}, r, {
      id: r.id, name: r.name || b.name, job: r.job || b.job, dept: b.dept, rar, role: b.role, roleName: ROLES[b.role].name,
      legacy: false, base: b.id, theme: th.name, line, color: b.color,
      atk: b.atk * M, hp: b.hp * M, aspd: b.aspd, cost: HRAR[rar].cost,
      skill: { name: sk, desc: b.skill.desc + (th.desc ? '。' + th.desc : '') }, passive: b.passive,
      shot: b.shot, lines: [line].concat(b.lines), ranks: b.ranks,
      talk: Object.assign({}, b.talk, { start: [line].concat(b.talk.start), ult: [sk + '！'].concat(b.talk.ult), idle: [line].concat(b.talk.idle) })
    });
  }
  function makeHero(r) {
    const base = r.base && HEROES.find(h => h.id === r.base);
    if (base) return makeVariant(r, base);
    const role = ROLES[r.role] ? r.role : 'dps', R = ROLES[role], rar = Math.max(0, Math.min(4, r.rar | 0)), M = HRAR[rar].mul;
    const dept = DEPTS[r.dept] ? r.dept : 'admin';
    const fill = t => t.replace('{aura}', Math.round(SUPPORT.aura[rar] * 100)).replace('{buff}', Math.round(SUPPORT.buff[rar] * 100));
    const sk = typeof r.skill === 'string' ? r.skill : (r.skill && r.skill.name) || R.name + '大招';
    const line = r.line || '……';
    const T = TALK_GENERIC;
    const job = r.job || '同事';
    return Object.assign({}, r, {
      id: r.id, name: r.name, job, dept, rar, role, legacy: false, line,
      roleName: R.name, color: DEPTS[dept].color, atk: R.atk * M, hp: R.hp * M, aspd: R.aspd, cost: HRAR[rar].cost,
      skill: { name: sk, desc: fill(R.skill) }, passive: fill(R.passive),
      shot: role === 'dps' ? DEPT_SHOT[dept] : R.shot, lines: [line],
      ranks: [job, '資深' + job, job + '主管', '傳說中的' + job],
      talk: {
        start: [line].concat(T.start), ult: [sk + '！', line].concat(T.ult), down: T.down, boss: T.boss, bonus: T.bonus,
        idle: [line, line].concat(T.idle)
      }
    });
  }
  function syncRoster() {
    const R = G.ROSTER || [];
    if (D.ALLHEROES && D._roster === R && D._rosterN === R.length) return false;
    const list = HEROES.slice(), by = {};
    for (const h of HEROES) by[h.id] = h;
    for (const r of R) if (r && r.id && !by[r.id]) { const h = makeHero(r); list.push(h); by[h.id] = h; }
    D.ALLHEROES = list; D.HERO_BY = by; D._roster = R; D._rosterN = R.length;
    // 收集目標與「全員到齊」任務跟著名冊人數走
    const n = list.length;
    D.COLLECT = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].filter(x => x < n).concat(n);
    const q = QUESTS.find(x => x.id === 'qh10'); if (q) { q.n = n; q.text = `全公司 ${n} 位同事到齊！`; }
    return true;
  }
  // 原本四人補上職業的通用說明以外的欄位
  for (const h of HEROES) { h.cost = h.cost || HRAR[h.rar].cost; h.roleName = ROLES[h.role].name; }

  const D = G.DATA = { HEROES, ORDER, ENEMIES, CHAPTERS, CURVE, OFFICE, RARITY, TREASURES, SETS, FX_TEXT, CHEST, ELITE, QUESTS, STORY, BONUS, COMBO, BOSS_SKILL, TALK, ULT_WAIT, AUTOBUY_AT, CHEER, PERK, BOSS_RETRY, WEEK, MAIN, W2, CHALLENGES, CHAL, MAP,
    DEPTS, WEAK, DEPT_BONUS, ROLES, DEPT_SHOT, HEAL, SUPPORT, HRAR, THEME, RECRUIT, TEAM, UNLOCKS, COLLECT, TALK_GENERIC, makeHero, syncRoster };
  syncRoster();
})(typeof window !== 'undefined' ? window : globalThis);
