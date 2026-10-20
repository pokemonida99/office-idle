// 遊戲資料：角色、敵人、關卡、辦公室升級、任務、戰利品。改數值只改這裡，改完跑 node tools/sim.js
(function (G) {
  const HEROES = [
    {
      id: 'mi', name: '小米', job: '客服', role: '坦克', color: '#6d8fd6',
      atk: 6, hp: 160, aspd: 0.9, x: 224, cost: 10,
      ranks: ['客服專員', '資深客服', '客服組長', '客服之神'],
      skill: { name: '您的來電對我們很重要', desc: '全隊獲得護盾（小米血量 40%），敵人全部「請稍候」暈 2.5 秒' },
      passive: '敵人優先攻擊小米，受傷也會充能',
      shot: 'wave', lines: ['您好～這邊幫您處理喔', '請稍候，不要掛斷喔', '我們會轉交相關單位']
    },
    {
      id: 'jie', name: '阿傑', job: '老鳥設計師', role: '爆擊', color: '#c98a4b',
      atk: 15, hp: 95, aspd: 0.7, x: 176, cost: 40, joinAt: 4,
      ranks: ['資深設計師', '設計主管', '創意總監', '傳說中的阿傑'],
      skill: { name: '一稿過', desc: '對血量最高的敵人造成 1500% 傷害，必定爆擊' },
      passive: '25% 機率爆擊，造成 2.5 倍傷害',
      shot: 'slash', lines: ['這個我十年前就做過了', '第一版就是最終版', '咖啡先給我']
    },
    {
      id: 'kui', name: '小葵', job: '新銳設計師', role: '範圍輸出', color: '#e0954a',
      atk: 10, hp: 85, aspd: 0.8, x: 126, cost: 15,
      ranks: ['新銳設計師', '視覺設計師', '主視覺設計師', '藝術總監'],
      skill: { name: '靈感爆發', desc: '顏料炸彈轟炸全體敵人，每隻造成 450% 傷害' },
      passive: '攻擊會濺到旁邊的敵人（40% 傷害）',
      shot: 'paint', lines: ['靈感來了！', '我再調一下顏色', '這版我很有信心！']
    },
    {
      id: 'vivi', name: 'Vivi 老闆', job: '老闆', role: '輔助', color: '#ec5f9e',
      atk: 8, hp: 110, aspd: 0.75, x: 72, cost: 120, joinAt: 10,
      ranks: ['老闆', '董事長', '集團總裁', '商業女王'],
      skill: { name: '畫大餅', desc: '全隊攻擊 +80%、攻速 +40%，持續 8 秒，並撒下一陣薪水雨' },
      passive: '全隊薪水收入 +25%',
      shot: 'money', lines: ['年底一定會加薪', '公司就是你的家', '這個月業績靠你們了']
    }
  ];
  // 陣型由前到後：小米、阿傑、小葵、Vivi
  const ORDER = ['mi', 'jie', 'kui', 'vivi'];

  const ENEMIES = {
    e_alarm:    { name: '早會鬧鐘', hp: 1.0, atk: 1.0, spd: 34 },
    e_mail:     { name: '未讀郵件', hp: 0.8, atk: 1.1, spd: 44 },
    e_sticky:   { name: '便利貼精', hp: 1.2, atk: 0.8, spd: 30 },
    e_revise:   { name: '改稿單', hp: 1.3, atk: 1.0, spd: 30 },
    e_phone:    { name: '奧客電話', hp: 0.9, atk: 1.4, spd: 40 },
    e_printer:  { name: '卡紙印表機', hp: 1.7, atk: 0.8, spd: 24 },
    e_bug:      { name: '神秘 Bug', hp: 0.9, atk: 1.3, spd: 46 },
    e_meeting:  { name: '白板會議', hp: 1.6, atk: 0.9, spd: 26 },
    e_kpi:      { name: 'KPI 圖表', hp: 1.2, atk: 1.3, spd: 32 },
    e_deadline: { name: 'Deadline 沙漏', hp: 1.0, atk: 1.5, spd: 50 },
    e_chat:     { name: '群組 99+', hp: 1.4, atk: 1.1, spd: 34 },
    e_overtime: { name: '加班幽靈', hp: 1.3, atk: 1.4, spd: 36 },
    // 頭目
    b_vivi:     { name: 'Vivi 老闆・突擊檢查', hp: 9, atk: 2.2, spd: 22, boss: true, img: 'vivi' },
    b_client:   { name: '甲方大魔王', hp: 11, atk: 2.4, spd: 20, boss: true },
    b_meeting:  { name: '無限會議', hp: 12, atk: 2.4, spd: 18, boss: true },
    b_report:   { name: '週報魔像', hp: 13, atk: 2.6, spd: 16, boss: true },
    b_final:    { name: '下班前的新需求', hp: 15, atk: 2.8, spd: 18, boss: true }
  };

  // 五章（週一～週五），每章 10 關，每關 3 波；第 10 關是頭目（限時 30 秒）
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
      names: ['小週末', '下午茶', '收尾', '偷偷收包包', '五點半', '電梯快來', '五點五十', '關電腦', '最後一封信', '下班前的新需求'] }
  ];

  // 數值曲線（s = 0 起算的總關卡編號）
  const CURVE = {
    enemyHp: s => 30 * Math.pow(1.355, s),
    enemyAtk: s => 4 * Math.pow(1.16, s),
    gold: s => 3 * Math.pow(1.22, s),
    heroAtk: (base, lv) => base * (1 + 0.32 * (lv - 1)) * Math.pow(1.045, lv - 1) * Math.pow(1.3, Math.floor(lv / 10)),
    heroHp: (base, lv) => base * (1 + 0.3 * (lv - 1)) * Math.pow(1.04, lv - 1) * Math.pow(1.3, Math.floor(lv / 10)),
    heroCost: (base, lv) => Math.ceil(base * Math.pow(1.17, lv - 1)),
    rankAt: [0, 15, 35, 60],          // 升職等級
    rankMul: 1.5,                      // 每升一職攻擊、血量倍率
    tapDmg: lv => 4 * (1 + 0.5 * (lv - 1)) * Math.pow(1.06, lv - 1),
    tapCost: lv => Math.ceil(8 * Math.pow(1.17, lv - 1)),
    bossTime: 30
  };

  // 辦公室升級（全隊永久加成）；unlock = 解鎖所需章節（0 起）
  const OFFICE = [
    { id: 'coffee', name: '咖啡機', icon: '☕', desc: '全隊攻擊 +12%', per: 0.12, base: 50, grow: 1.42, max: 40, unlock: 0 },
    { id: 'chair', name: '人體工學椅', icon: '🪑', desc: '全隊血量 +15%', per: 0.15, base: 80, grow: 1.42, max: 40, unlock: 1 },
    { id: 'bonus', name: '年終獎金池', icon: '💰', desc: '薪水收入 +15%', per: 0.15, base: 120, grow: 1.45, max: 40, unlock: 1 },
    { id: 'keyboard', name: '機械鍵盤', icon: '⌨️', desc: '全隊攻速 +5%', per: 0.05, base: 400, grow: 1.6, max: 15, unlock: 2 },
    { id: 'drink', name: '能量飲料櫃', icon: '🥤', desc: '大招充能 +10%', per: 0.10, base: 1500, grow: 1.6, max: 15, unlock: 3 }
  ];

  // 頭目掉落戰利品（永久加成）
  const LOOT = [
    { id: 'fan', boss: 'b_vivi', name: 'Vivi 的金扇子', icon: '🪭', desc: '薪水收入 +20%', gold: 0.2 },
    { id: 'black', boss: 'b_client', name: '五彩斑斕的黑色卡', icon: '🎴', desc: '全隊攻擊 +25%', atk: 0.25 },
    { id: 'clock', boss: 'b_meeting', name: '會議室的時鐘', icon: '⏰', desc: '頭目限時 +10 秒', time: 10 },
    { id: 'binder', boss: 'b_report', name: '完美週報', icon: '📒', desc: '全隊血量 +30%、攻擊 +15%', hp: 0.3, atk: 0.15 },
    { id: 'badge', boss: 'b_final', name: '準時下班徽章', icon: '🏅', desc: '加班模式薪水 +50%', gold: 0.5 }
  ];

  // 任務：達成即可領，不限時
  const QUESTS = [
    { id: 'q1', text: '擊敗 20 個工作怪', type: 'kills', n: 20, gold: 30 },
    { id: 'q2', text: '小葵升到 Lv 5', type: 'lv', hero: 'kui', n: 5, gold: 40 },
    { id: 'q3', text: '使用 3 次大招', type: 'ults', n: 3, gold: 50 },
    { id: 'q4', text: '點擊「催稿」50 次', type: 'taps', n: 50, gold: 60 },
    { id: 'q5', text: '升級咖啡機', type: 'office', n: 1, gold: 80 },
    { id: 'q6', text: '打倒 Vivi 老闆', type: 'stage', n: 10, gold: 200 },
    { id: 'q7', text: '任一員工升職', type: 'rank', n: 1, gold: 300 },
    { id: 'q8', text: '擊敗 300 個工作怪', type: 'kills', n: 300, gold: 800 },
    { id: 'q9', text: '通過週二', type: 'stage', n: 20, gold: 3000 },
    { id: 'q10', text: '全隊等級合計 100', type: 'lvsum', n: 100, gold: 6000 },
    { id: 'q11', text: '使用 30 次大招', type: 'ults', n: 30, gold: 8000 },
    { id: 'q12', text: '通過週三', type: 'stage', n: 30, gold: 30000 },
    { id: 'q13', text: '四人都升職兩次', type: 'rank2', n: 4, gold: 60000 },
    { id: 'q14', text: '擊敗 1500 個工作怪', type: 'kills', n: 1500, gold: 120000 },
    { id: 'q15', text: '通過週四', type: 'stage', n: 40, gold: 300000 },
    { id: 'q16', text: '準時下班！通過週五', type: 'stage', n: 50, gold: 1000000 }
  ];

  // 劇情（章節開頭、頭目登場、頭目擊敗）
  const STORY = {
    intro0: [['kui', '早安～今天是我上班第一週！'], ['mi', '早安。電話已經響了 37 通了。'], ['kui', '欸？才九點耶？'], ['sys', '點畫面可以「催稿」幫忙打怪，賺到的薪水拿去幫大家升級吧！']],
    join_jie: [['jie', '……吵死了，誰把我的咖啡打翻了？'], ['kui', '阿傑前輩！'], ['jie', '讓開，這種怪我十年前就打過了。'], ['sys', '阿傑加入了！他會爆擊，大招「一稿過」專打頭目。']],
    boss_b_vivi: [['vivi', '大家都在認真上班嗎～？我來突擊檢查囉！'], ['jie', '……又來了。'], ['sys', '頭目戰限時 30 秒，打不贏就先回去練功再挑戰。']],
    win_b_vivi: [['vivi', '不錯嘛！看來公司有你們很安心～'], ['vivi', '好，我也下去一起做！'], ['sys', 'Vivi 老闆加入了！大招「畫大餅」讓全隊攻擊暴增。'], ['sys', '解鎖：自動大招、辦公室「人體工學椅」「年終獎金池」']],
    intro1: [['mi', '週二。客戶說 Logo 要再大一點。'], ['kui', '已經佔滿整張海報了啊……'], ['jie', '那就改回第一版，他們會說很好。']],
    boss_b_client: [['sys', '甲方大魔王：「我要五彩斑斕的黑，而且要有呼吸感。」'], ['kui', '呼、呼吸感？'], ['vivi', '照他說的做！他付錢的！']],
    win_b_client: [['jie', '最後他選了第一版。'], ['kui', '每次都這樣嗎？'], ['jie', '每次都這樣。']],
    intro2: [['vivi', '今天下午兩點、三點、四點各有一場會議喔～'], ['mi', '那我什麼時候上班？'], ['vivi', '開會就是上班呀！']],
    boss_b_meeting: [['sys', '無限會議：「我們先來對齊一下，再開一個會討論要不要開會。」'], ['jie', '這場會議沒有結束時間。'], ['kui', '那我們把它打到結束！']],
    win_b_meeting: [['mi', '會議記錄我寫好了：「下週再議」。'], ['vivi', '很好，很有效率！']],
    intro3: [['kui', '週報明天要交，我還沒開始……'], ['jie', '我也還沒。'], ['mi', '我寫好了，但系統當掉了。']],
    boss_b_report: [['sys', '週報魔像：「本週工作內容……請填寫至少五百字。」'], ['vivi', '數字要好看喔～']],
    win_b_report: [['vivi', '這份週報寫得真好，我會拿去給董事會看！'], ['jie', '……那是去年的週報改日期。']],
    intro4: [['kui', '週五了！今天一定要準時下班！'], ['mi', '別說出來，會被聽到。'], ['jie', '噓——']],
    boss_b_final: [['sys', '17:59，一封新信件：「這個很簡單，下班前可以給我嗎？」'], ['kui', '它、它來了……'], ['vivi', '大家！打倒它就放假！'], ['mi', '這是最後一通電話了。']],
    win_b_final: [['kui', '我們……準時下班了！！'], ['jie', '十年來第一次。'], ['mi', '電話我拔掉了。'], ['vivi', '好啦好啦，下週一見～'], ['sys', '恭喜通關！解鎖「加班模式」：無限關卡，想玩多久就多久。']]
  };

  G.DATA = { HEROES, ORDER, ENEMIES, CHAPTERS, CURVE, OFFICE, LOOT, QUESTS, STORY };
})(typeof window !== 'undefined' ? window : globalThis);
