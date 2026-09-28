/**
 * QA שיפור 4, ספרינט 1 (תמר, 28.09.2026) – בדיקה עצמאית מול docs/IMPROVEMENT-4-SOURCE-v2.md
 * (א1–א7, ב1, ב4) ומול שני באגי QA סבב 7. הציפיות נגזרות מהמפרט ומהתזרים עצמו,
 * לא מטקסט ההודעות שהכותב בחר.
 * ממצאים פתוחים מסומנים todo, כדי ש-npm test יישאר ירוק עד שהמפתח יתקן.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');
const U = require('../app.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = (s) => String(s == null ? '' : s).replace(/[⁦-⁩‎‏]/g, '');
const R = Math.round;
const codes = (p) => E.consistencyChecks(p).map((c) => `${c.code}:${c.severity}`);

/** התוכנית לדוגמה (מאפיית השכונה) – עותק של SAMPLE מ-app.js */
function bakery(over) {
  const p = {
    isSample: true,
    business: { name: 'מאפיית השכונה', entity: 'osek', field: 'מאפייה ומכירת מאפים טריים', city: 'בית שמש', years: 3, employees: 4, isNew: false,
      description: 'מאפייה שכונתית שמוכרת לחמים, חלות ומאפים טריים ללקוחות פרטיים, ומספקת לשלוש מכולות באזור.' },
    owner: { name: 'ישראל ישראלי', experience: '12 שנות ניסיון כאופה, מתוכן 3 שנים בניהול המאפייה.', education: '' },
    market: { customers: 'משפחות בשכונה, מכולות ומוסדות באזור. ביקוש גבוה במיוחד לקראת שבת וחגים.', competitors: 'x', pricing: 'x',
      advantage: 'מוצרים טריים שנאפים באותו יום, כשרות מהודרת, ומשלוחים עד הבית בערבי שבת.' },
    history: { lastYearSales: 1150000, lastYearProfit: 160000 },
    startup: { openDate: '', equity: 0, setupCosts: [{ item: '', amount: 0 }], preOpenCosts: 0, deposit: 0, equipmentVat: 0 },
    forecast: { annualSales: 1600000, rampMonths: 2, growthPct: 8, cogsPct: 38, monthlyFixed: 20000, monthlySalaries: 30000, ownerDrawMonthly: 12000,
      openingCash: 40000, salesModel: 'total', customersPerDay: 0, avgTicket: 0, daysPerMonth: 26 },
    loan: { track: 'general', amount: 300000, ratePct: 7.5, years: 5, graceMonths: 6,
      purpose: 'רכישת תנור מסחרי שני ומקרר תעשייתי, כדי להגדיל את כושר הייצור ב-40% ולעמוד בהזמנות מהמכולות.',
      uses: [{ item: 'תנור מסחרי', amount: 180000, type: 'capex' }, { item: 'מקרר תעשייתי', amount: 45000, type: 'capex' },
        { item: 'הון חוזר (חומרי גלם ומלאי)', amount: 75000, type: 'working' }] },
  };
  return over ? over(p) || p : p;
}

/** עסק בהקמה עם הון חוזר נגזר (קפה פינת חן, QA7) – הון עצמי גבוה כך שהמרווח תקין */
function cafe(over) {
  const p = {
    business: { name: 'קפה פינת חן', isNew: true, entity: 'osek', employees: 4, years: null, field: 'בית קפה', description: 'בית קפה שכונתי עם מאפים טריים כל בוקר' },
    owner: { name: 'א', experience: 'ניהול משמרת ברשת בתי קפה ארבע שנים', education: '' },
    market: { customers: 'תושבי השכונה ועובדי המשרדים באזור', competitors: '', pricing: '', advantage: 'אפייה במקום כל בוקר ומחיר הוגן' },
    history: { lastYearSales: 0, lastYearProfit: 0 },
    startup: { equity: 150000, openDate: 'יוני 2027', preOpenCosts: 0, deposit: 0, equipmentVat: 0,
      setupCosts: [{ item: 'ציוד ומכונות קפה', amount: 100000 }, { item: 'שיפוץ המקום', amount: 80000 }] },
    forecast: { annualSales: 1800000, rampMonths: 3, growthPct: 5, cogsPct: 30, monthlyFixed: 22000, monthlySalaries: 35000,
      ownerDrawMonthly: 12000, openingCash: 0, salesModel: 'total', daysPerMonth: 26 },
    loan: { track: 'startup', amount: 200000, ratePct: 7.5, years: 5, graceMonths: 0, purpose: 'ציוד ושיפוץ', uses: [] },
  };
  return over ? over(p) || p : p;
}

// ---------- א1–א7 ----------

test('א1: עסק פועל שנה ומעלה במסלול בהקמה – אזהרה (לא חסימה) שמציעה את המסלול הכללי; פחות משנה – בלי אזהרה', () => {
  const warn = E.consistencyChecks(bakery((p) => { p.loan.track = 'startup'; }))
    .find((c) => c.code === 'trackVsYears');
  assert.ok(warn && warn.severity === 'warn');
  assert.match(warn.message, new RegExp(E.TRACKS.general));
  assert.ok(!codes(bakery((p) => { p.loan.track = 'startup'; p.business.years = 0.5; })).some((c) => c.startsWith('trackVsYears')));
  assert.ok(!codes(bakery()).some((c) => c.startsWith('trackVsYears')), 'מסלול כללי – אין אזהרה');
});

test('א2: מילות המטרה מהמקור (עובדים/העסקה/גיוס, שכירות/מתחם/מקום) מול שכר 0 וקבועות < 3,000', () => {
  for (const w of ['עובדים', 'העסקה', 'גיוס']) {
    assert.ok(codes(bakery((p) => { p.loan.purpose = `כסף ל${w} חדשים`; p.forecast.monthlySalaries = 0; })).includes('purposeStaff:warn'), w);
  }
  for (const w of ['שכירות', 'מתחם', 'מקום']) {
    assert.ok(codes(bakery((p) => { p.loan.purpose = `תשלום ${w}`; p.forecast.monthlyFixed = 2999; })).includes('purposePremises:warn'), w);
  }
  assert.ok(!codes(bakery((p) => { p.loan.purpose = 'שכירות'; p.forecast.monthlyFixed = 3000; })).includes('purposePremises:warn'), '3,000 בדיוק אינו "נמוך מ-3,000"');
  assert.ok(!codes(bakery((p) => { p.loan.purpose = 'שיווק מקומי'; p.forecast.monthlyFixed = 0; })).includes('purposePremises:warn'), '"מקומי" אינו "מקום"');
});

test('א3: 120,000 ← 255,000 בלי הסבר – אזהרה; עם הסבר – ההסבר מופיע במסמך בפרק התחזית', () => {
  const p = bakery((q) => { q.isSample = false; q.history.lastYearSales = 120000; q.forecast.annualSales = 255000; });
  assert.ok(codes(p).includes('salesJump:warn'));
  p.forecast.growthReason = 'חוזה שנתי חתום עם רשת חנויות';
  assert.ok(!codes(p).includes('salesJump:warn'));
  assert.match(U.jumpDocNote(p), /חוזה שנתי חתום עם רשת חנויות/);
  // בממשק השדה חובה ומוצג רק כשצריך
  assert.match(read('app.js'), /k: U\.JUMP_FIELD[^\n]*req: 1[^\n]*showIf/);
  // עסק בהקמה – אין "שנה שעברה"
  assert.equal(E.salesJump(cafe()), null);
});

test('חשוב (תוקן): קפיצה של 30% בדיוק – הממשק מחייב הסבר, המנוע (והמפרט: "מעל 30%") לא', () => {
  const p = { business: { isNew: false, years: 3 }, history: { lastYearSales: 1000000 }, forecast: { annualSales: 1300000 } };
  assert.equal(E.salesJump(p).needsReason, false);
  assert.equal(U.jumpInfo(p).needed, E.salesJump(p).needsReason, 'שדה החובה בממשק מופיע גם ב-30% בדיוק (נקודה צפה: 30.000000000000004)');
});

test('א4: הצעת סיווג לפי מילות המפתח מהמקור, ואזהרה כשהסיווג סותר ("משווק" 80,000 כהשקעה)', () => {
  for (const w of ['מחשב', 'תנור', 'מקרר', 'ציוד', 'מכונה', 'ריהוט', 'רכב', 'שיפוץ']) assert.equal(E.suggestUseCategory(w), 'capex', w);
  for (const w of ['שכר', 'משווק', 'שיווק', 'פרסום', 'מלאי', 'סחורה', 'חומרי גלם']) assert.equal(E.suggestUseCategory(w), 'working', w);
  const p = bakery((q) => { q.loan.uses = [{ item: 'משווק', amount: 80000, type: 'capex' }, { item: 'מחשב', amount: 20000, type: 'working' }, { item: 'תנור', amount: 1, type: 'capex' }]; });
  const list = E.consistencyChecks(p).filter((c) => c.code === 'useCategory');
  assert.deepEqual(list.map((c) => c.field), ['loan.uses.0.type', 'loan.uses.1.type']);
  assert.match(strip(list[0].message), /80,000/);
  // ממשק: סיווג אוטומטי, ובחירה ידנית סותרת – הערה מתחת לפריט
  const u = { item: 'משווק', type: 'capex' };
  assert.equal(U.autoClassify(E, u), true); assert.equal(u.type, 'working');
  assert.equal(U.useRowNote(E, { item: 'משווק', type: 'capex' }).level, 'warn');
});

test('א5: שדות החובה (תיאור, לקוחות, יתרון, ניסיון) עם פחות מ-5 מילים – "הבנק יקרא את זה. כדאי להרחיב."', () => {
  const p = bakery((q) => { q.business.description = 'שירות מחיר'; q.owner.experience = '4'; q.market.customers = 'עסקים'; q.market.advantage = 'אחת שתיים שלוש ארבע'; });
  const list = E.consistencyChecks(p).filter((c) => c.code === 'shortText');
  assert.deepEqual(list.map((c) => c.field).sort(), ['business.description', 'market.advantage', 'market.customers', 'owner.experience'].sort());
  list.forEach((c) => { assert.ok(c.message.includes('הבנק יקרא את זה. כדאי להרחיב.')); assert.equal(c.severity, 'warn'); });
  assert.ok(!codes(bakery((q) => { q.market.advantage = 'אחת שתיים שלוש ארבע חמש'; })).includes('shortText:warn'), '5 מילים עוברות');
});

test('א6: ותק/עובדים בלי ברירת מחדל 0; בעסק פועל ריק או 0 שנים – שגיאה חוסמת; 0 עובדים – תקין', () => {
  const src = read('app.js');
  assert.match(src, /years: null, employees: null/, 'EMPTY מתחיל ריק');
  for (const y of [null, '', 0]) assert.ok(codes(bakery((p) => { p.business.years = y; })).includes('yearsMissing:block'), JSON.stringify(y));
  assert.ok(!codes(bakery((p) => { p.business.years = 0.5; })).includes('yearsMissing:block'));
  assert.ok(codes(bakery((p) => { p.business.employees = null; })).includes('employeesMissing:block'));
  assert.ok(!codes(bakery((p) => { p.business.employees = 0; })).includes('employeesMissing:block'));
  assert.ok(!codes(cafe((p) => { p.business.employees = null; })).some((c) => /Missing/.test(c)), 'עסק בהקמה – לא נדרש');
  assert.equal(U.numberFieldError({ req: 1, positive: 1 }, 0) !== '', true);
});

test('חשוב (תוקן): "0.5 שנים" (שהממשק עצמו מציע) לא מודפס במסמך כ"פועל 1 שנים"', () => {
  // המקור של התקציר היה `${b.years === 1 ? 'שנה' : N(b.years) + ' שנים'}`, כש-N מעגל לשלם.
  // התיקון (נדב): E.yearsText, בלי עיגול ובדקדוק תקין. N עצמו מעגל בכוונה ולא השתנה.
  assert.ok(!/N\(b\.years\)/.test(read('app.js')), 'התקציר לא מעביר את הוותק דרך N()');
  assert.match(read('app.js'), /פועל \$\{dt\(E\.yearsText\(b\.years\)\)\}/);
  assert.equal(E.yearsText(0.5), 'חצי שנה');
  assert.equal(E.yearsText(1.5), 'שנה וחצי');
});

test('א7: עלות מכר מעל 100% – חסימה; מעל 85% – אזהרה; 85 ו-100 בדיוק לפי "מעל"', () => {
  const c = (v) => codes(bakery((p) => { p.forecast.cogsPct = v; })).filter((x) => x.startsWith('cogs'));
  assert.deepEqual(c(85), []);
  assert.deepEqual(c(86), ['cogsHigh:warn']);
  assert.deepEqual(c(100), ['cogsHigh:warn']);
  assert.deepEqual(c(100.5), ['cogsOver100:block']);
  assert.deepEqual(c(150), ['cogsOver100:block']);
  // חסימה בפועל: שער ההפקה בממשק בודק את בדיקות העקביות החוסמות
  assert.match(read('app.js'), /if \(U\.blocking\(currentChecks\(\)\)\.length\)/);
});

// ---------- ב1, ב4 ----------

test('ב1: בדוגמה ההון החוזר (75,000) יוצא בחודש 1, והיתרה המינימלית יורדת מ-113,142 ל-38,142', () => {
  const res = E.computePlan(bakery());
  assert.equal(res.cash[0].working, 75000);
  assert.equal(R(res.cushion.min), 113142 - 75000);
  // סך היציאות בשנה ירד בדיוק ב-75,000 מהגרסה הקודמת – לא יותר (אין ספירה כפולה בחודשים אחרים)
  assert.equal(res.cash.slice(1).reduce((s, r) => s + (r.working || 0), 0), 0);
});

test('ב1: עסק בהקמה – ההון החוזר הנגזר לא יוצא פעמיים (הוצאות ההרצה כבר בתזרים)', () => {
  assert.equal(E.workingCapitalOutflow(cafe()), 0);
});

test('חוסם (תוקן): ב1 בעסק בהקמה – "רזרבה שלא נוצלה" (reserveNote) לא מוצגת בשום מקום בממשק או במסמך', () => {
  const p = cafe(); const res = E.computePlan(p);
  assert.equal(res.cushion.level, 'ok');
  assert.ok(E.reserveNote(p, res).length > 0, 'יש רזרבה – 101,699 ₪ מתוך היתרה הנמוכה הם הון חוזר שלא נוצל');
  assert.match(read('app.js'), /reserveNote/, 'app.js לא קורא ל-E.reserveNote, ולכן היתרה המינימלית במסמך מוצגת בלי הסתייגות');
});

test('ב4: שלוש רמות ניסוח לפי 1.25 / 1.0, ו-0.04 לא מתואר יותר כ"מרווח מצטמצם"', () => {
  assert.equal(E.dscrPhrase(1.25).text, 'יכולת החזר טובה');
  assert.equal(E.dscrPhrase(1.1).text, 'מרווח צר');
  assert.equal(E.dscrPhrase(1).text, 'מרווח צר');
  assert.equal(E.dscrPhrase(0.99).text, 'העסק לא יעמוד בהחזרים מהתזרים השוטף');
  const note = strip(E.scenarioNote(E.scenarios(bakery())));
  assert.match(note, /0\.04: העסק לא יעמוד בהחזרים מהתזרים השוטף/);
  assert.ok(!/מצטמצם/.test(note));
});

// ---------- באגי QA סבב 7 ----------

test('QA7 באג 1: עסק פועל עם חודשי מינוס – המסמך לא מצהיר על "מסגרת אשראי" שלא נמסרה', () => {
  const app = read('app.js');
  assert.ok(!/מסגרת אשראי קיימת/.test(app + E.bridgeText(false, 0) + E.thinCushionText(false, 0)));
  assert.ok(!/מסגרת אשראי/.test(U.EXISTING_BRIDGE));
});

test('QA7 באג 2: חודש דחוק מופיע פעם אחת בלבד בסיכום (בכרטיס כשהדירוג חזק, ברשימה אחרת)', () => {
  const res = E.computePlan(bakery((p) => { p.isSample = false; }));
  assert.equal(res.cushion.level, 'warn');
  assert.equal(res.rating.level, 'ok');
  assert.ok(E.thinMonthNote(res.cushion), 'הכרטיס מציג');
  assert.equal(U.listThinMonth(res), false, 'הרשימה לא מציגה שוב');
  assert.equal(U.listThinMonth({ cushion: { level: 'warn' }, rating: { level: 'warn' } }), true, 'דירוג לא חזק – הכרטיס לא אומר, הרשימה כן');
});

// ---------- החלטת מאיר: הדוגמה כהדגמה ----------

test('הדוגמה: בדיוק 2 נקודות, מוצגות כ"מה הכלי תפס" ולא כשגיאה; בתוכנית של משתמש – לא מוצג', () => {
  const p = bakery(); const d = U.sampleDemo(E, p, E.computePlan(p));
  assert.equal(d.items.length, 2);
  assert.match(d.title, /מה הכלי תפס/);
  assert.match(d.intro, /בכוונה/);
  const user = bakery((q) => { q.isSample = false; });
  assert.equal(U.sampleDemo(E, user, E.computePlan(user)), null);
});

test('בלי דיאלוגים של הדפדפן ב-app.js וב-engine.js', () => {
  for (const f of ['app.js', 'engine.js']) assert.ok(!/\b(alert|confirm|prompt)\s*\(/.test(read(f)), f);
});
