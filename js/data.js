// 遊戲資料：角色、敵人、關卡、辦公室升級、任務、戰利品。改數值只改這裡，改完跑 node tools/sim.js
(function (G) {
  const HEROES = [
    {
      id: 'mi', name: '小米', job: '客服', role: '坦克', color: '#6d8fd6',
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
      id: 'jie', name: '阿傑', job: '老鳥設計師', role: '爆擊', color: '#c98a4b',
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
      id: 'kui', name: '小葵', job: '新銳設計師', role: '範圍輸出', color: '#e0954a',
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
      id: 'vivi', name: 'Vivi 老闆', job: '老闆', role: '輔助', color: '#ec5f9e',
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
    // 頭目。skills：輪流施放，先預警 delay 秒再生效
    //   aoe：全隊受到 power 倍攻擊，且至少扣最大血量的 pct（小米的護盾擋得住）
    //   shield：護盾 = 最大血量 × power，持續 dur 秒；打破前一般攻擊只削 30%，點擊 ×3、大招全額
    //   summon：在頭目前面叫出 n 隻小怪擋刀（小葵範圍攻擊最好清）
    b_vivi:     { name: 'Vivi 老闆・突擊檢查', hp: 18, atk: 2.2, spd: 22, boss: true, img: 'vivi',
                  appear: ['大家都在認真上班嗎～？', '我只是路過，你們繼續～'],
                  skills: [{ id: 'inspect', name: '突擊檢查', kind: 'aoe', delay: 2, power: 1.2, pct: 0.2, line: '我來看看大家的螢幕～' }] },
    b_client:   { name: '甲方大魔王', hp: 15, atk: 2.4, spd: 20, boss: true,
                  appear: ['我要五彩斑斕的黑！', 'Logo 再大一點，但不要太大'],
                  skills: [{ id: 'revise', name: '再改一版', kind: 'shield', delay: 2, power: 0.2, dur: 7, line: '我覺得還可以再改一版' }] },
    b_meeting:  { name: '無限會議', hp: 11, atk: 2.4, spd: 18, boss: true,
                  appear: ['我們先來對齊一下', '這個會很快，五分鐘就好'],
                  skills: [{ id: 'more', name: '再開一個會', kind: 'summon', delay: 2, n: 3, minion: 'e_meeting', power: 0.5, line: '這個我們另外開個會討論' }] },
    b_report:   { name: '週報魔像', hp: 12, atk: 2.6, spd: 16, boss: true,
                  appear: ['本週工作內容，請填寫至少五百字', '週報是你成長的證明'],
                  skills: [{ id: 'format', name: '格式不對', kind: 'aoe', delay: 2.5, power: 1.8, pct: 0.26, line: '格式不對，全部重寫' }] },
    b_final:    { name: '下班前的新需求', hp: 16, atk: 2.8, spd: 18, boss: true,
                  appear: ['這個很簡單，下班前可以給我嗎？', '17:59，叮咚——'],
                  skills: [
                    { id: 'easy', name: '這個很簡單', kind: 'shield', delay: 2, power: 0.15, dur: 7, line: '就改一個小地方而已' },
                    { id: 'group', name: '@所有人', kind: 'summon', delay: 2, n: 3, minion: 'e_chat', power: 0.4, line: '我拉個群組，大家一起討論' },
                    { id: 'tomorrow', name: '明天早上要', kind: 'aoe', delay: 2.5, power: 1.8, pct: 0.26, line: '明天早上開會要用喔' }
                  ] }
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
    enemyHp: s => 30 * Math.pow(1.355, s) * Math.pow(1.09, Math.max(0, s - 10)),
    enemyAtk: s => 4 * Math.pow(1.16, s),
    gold: s => 3 * Math.pow(1.22, s),
    heroAtk: (base, lv) => base * (1 + 0.32 * (lv - 1)) * Math.pow(1.045, lv - 1) * Math.pow(1.3, Math.floor(lv / 10)),
    heroHp: (base, lv) => base * (1 + 0.3 * (lv - 1)) * Math.pow(1.04, lv - 1) * Math.pow(1.3, Math.floor(lv / 10)),
    heroCost: (base, lv) => Math.ceil(base * Math.pow(1.17, lv - 1)),
    rankAt: [0, 15, 35, 60],          // 升職等級
    rankMul: 1.5,                      // 每升一職攻擊、血量倍率
    mentor: 0.65,                       // 前輩帶新人：低等員工補上與最高等級差距的比例
    tapDmg: lv => 4 * (1 + 0.5 * (lv - 1)) * Math.pow(1.06, lv - 1),
    tapCost: lv => Math.ceil(8 * Math.pow(1.17, lv - 1)),
    bossTime: 30
  };

  // 辦公室升級（全隊永久加成）；unlock = 解鎖所需章節（0 起）
  const OFFICE = [
    { id: 'coffee', name: '咖啡機', icon: '☕', desc: '全隊攻擊 +6%', per: 0.06, base: 50, grow: 1.42, max: 40, unlock: 0 },
    { id: 'chair', name: '人體工學椅', icon: '🪑', desc: '全隊血量 +7%', per: 0.07, base: 80, grow: 1.42, max: 40, unlock: 1 },
    { id: 'bonus', name: '年終獎金池', icon: '💰', desc: '薪水收入 +8%', per: 0.08, base: 120, grow: 1.45, max: 40, unlock: 1 },
    { id: 'keyboard', name: '機械鍵盤', icon: '⌨️', desc: '全隊攻速 +5%', per: 0.05, base: 400, grow: 1.6, max: 15, unlock: 2 },
    { id: 'drink', name: '能量飲料櫃', icon: '🥤', desc: '大招充能 +6%', per: 0.06, base: 1500, grow: 1.6, max: 15, unlock: 3 }
  ];

  // 公司福利：每第一次通過一關，已解鎖的辦公室設備都免費升 n 級（不影響購買價格）
  const PERK = { n: 1 };

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
    { id: 'qb1', text: '接住 3 份外送', type: 'bonus', n: 3, gold: 100 },
    { id: 'q5', text: '升級咖啡機', type: 'office', n: 1, gold: 80 },
    { id: 'q6', text: '打倒 Vivi 老闆', type: 'stage', n: 10, gold: 200 },
    { id: 'q7', text: '任一員工升職', type: 'rank', n: 1, gold: 300 },
    { id: 'q8', text: '擊敗 300 個工作怪', type: 'kills', n: 300, gold: 800 },
    { id: 'q9', text: '通過週二', type: 'stage', n: 20, gold: 3000 },
    { id: 'q10', text: '全隊等級合計 100', type: 'lvsum', n: 100, gold: 6000 },
    { id: 'q11', text: '使用 30 次大招', type: 'ults', n: 30, gold: 8000 },
    { id: 'qb2', text: '接住 20 份外送', type: 'bonus', n: 20, gold: 50000 },
    { id: 'q12', text: '通過週三', type: 'stage', n: 30, gold: 30000 },
    { id: 'q13', text: '四人都升職兩次', type: 'rank2', n: 4, gold: 60000 },
    { id: 'q14', text: '擊敗 1500 個工作怪', type: 'kills', n: 1500, gold: 120000 },
    { id: 'q15', text: '通過週四', type: 'stage', n: 40, gold: 300000 },
    { id: 'q16', text: '準時下班！通過週五', type: 'stage', n: 50, gold: 1000000 }
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
  // 自動升級：通過幾關後可以開
  const AUTOBUY_AT = 5;
  // 同事打氣：打輸一次 +fail 層、第一次過某關花超過 slow 秒（只算戰鬥時間）+1 層；每層攻擊血量 +per、薪水 +gold（最多 max 層）
  // 之後每順利過 calm 關退 1 層。一般玩家幾乎不會觸發，是給不太會玩的人的保底
  const CHEER = { per: 0.3, gold: 0.15, max: 40, fail: 3, slow: 50, calm: 3 };

  // 劇情（章節開頭、頭目登場、頭目擊敗）
  const STORY = {
    intro0: [['kui', '早安～今天是我上班第一週！'], ['mi', '早安。電話已經響了 37 通了。'], ['kui', '欸？才九點耶？'], ['sys', '點畫面可以「催稿」幫忙打怪，連點傷害更高！外送飛過來記得點，賺到的薪水拿去幫大家升級吧！']],
    join_jie: [['jie', '……吵死了，誰把我的咖啡打翻了？'], ['kui', '阿傑前輩！'], ['jie', '讓開，這種怪我十年前就打過了。'], ['sys', '阿傑加入了！他會爆擊，大招「一稿過」專打頭目。']],
    boss_b_vivi: [['vivi', '大家都在認真上班嗎～？我來突擊檢查囉！'], ['jie', '……又來了。'], ['sys', '頭目戰限時 30 秒。頭目放招前會先預警，趁機放大招或狂點！打不贏也沒關係，回去練功時同事會幫你打氣。']],
    win_b_vivi: [['vivi', '不錯嘛！看來公司有你們很安心～'], ['vivi', '好，我也下去一起做！'], ['sys', 'Vivi 老闆加入了！大招「畫大餅」讓全隊攻擊暴增。'], ['sys', '解鎖：自動大招（已經幫你打開）、辦公室「人體工學椅」「年終獎金池」']],
    intro1: [['mi', '週二。客戶說 Logo 要再大一點。'], ['kui', '已經佔滿整張海報了啊……'], ['jie', '那就改回第一版，他們會說很好。']],
    boss_b_client: [['sys', '甲方大魔王：「我要五彩斑斕的黑，而且要有呼吸感。」'], ['kui', '呼、呼吸感？'], ['vivi', '照他說的做！他付錢的！'], ['sys', '甲方會「再改一版」張開護盾：狂點或放大招可以打破！']],
    win_b_client: [['jie', '最後他選了第一版。'], ['kui', '每次都這樣嗎？'], ['jie', '每次都這樣。']],
    intro2: [['vivi', '今天下午兩點、三點、四點各有一場會議喔～'], ['mi', '那我什麼時候上班？'], ['vivi', '開會就是上班呀！']],
    boss_b_meeting: [['sys', '無限會議：「我們先來對齊一下，再開一個會討論要不要開會。」'], ['jie', '這場會議沒有結束時間。'], ['kui', '那我們把它打到結束！'], ['sys', '它會「再開一個會」叫小怪擋在前面，小葵的大招最好清。']],
    win_b_meeting: [['mi', '會議記錄我寫好了：「下週再議」。'], ['vivi', '很好，很有效率！']],
    intro3: [['kui', '週報明天要交，我還沒開始……'], ['jie', '我也還沒。'], ['mi', '我寫好了，但系統當掉了。']],
    boss_b_report: [['sys', '週報魔像：「本週工作內容……請填寫至少五百字。」'], ['vivi', '數字要好看喔～'], ['sys', '「格式不對」會打全隊，看到預警就放小米的大招擋下來！']],
    win_b_report: [['vivi', '這份週報寫得真好，我會拿去給董事會看！'], ['jie', '……那是去年的週報改日期。']],
    intro4: [['kui', '週五了！今天一定要準時下班！'], ['mi', '別說出來，會被聽到。'], ['jie', '噓——']],
    boss_b_final: [['sys', '17:59，一封新信件：「這個很簡單，下班前可以給我嗎？」'], ['kui', '它、它來了……'], ['vivi', '大家！打倒它就放假！'], ['mi', '這是最後一通電話了。']],
    win_b_final: [['kui', '我們……準時下班了！！'], ['jie', '十年來第一次。'], ['mi', '電話我拔掉了。'], ['vivi', '好啦好啦，下週一見～'], ['sys', '恭喜通關！解鎖「加班模式」：無限關卡，想玩多久就多久。']]
  };

  G.DATA = { HEROES, ORDER, ENEMIES, CHAPTERS, CURVE, OFFICE, LOOT, QUESTS, STORY, BONUS, COMBO, BOSS_SKILL, TALK, ULT_WAIT, AUTOBUY_AT, CHEER, PERK };
})(typeof window !== 'undefined' ? window : globalThis);
