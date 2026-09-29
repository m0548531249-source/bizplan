/**
 * QA שיפור 4, ספרינט 2 – בדיקות קבלה מראש (תמר, 29.09.2026).
 * מקור יחיד: docs/IMPROVEMENT-4-SOURCE-v2.md, סעיפים ב2, ב3, ב5, ג2, ג3.
 * נכתב לפני שהפיתוח הסתיים ובלי לקרוא את השינויים של המפתחים; הערכים הצפויים חושבו
 * ידנית מהנחות התוכנית לדוגמה (מאפייה) ומהגדרות המקור, לא מהקוד החדש.
 *
 * test(...)       – תנאי מוקדם או רגרסיה שחייבים לעבור כבר היום וגם אחרי התיקון.
 * test.todo(...)  – ההתנהגות החדשה. נכשלת היום בכוונה (todo לא שובר את npm test).
 *                   כשהמפתח מסיים – מסירים את ".todo" ומריצים שוב.
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
const clone = (o) => JSON.parse(JSON.stringify(o));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} צפוי ${b} (±${tol}), התקבל ${a}`);

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

/** עסק בהקמה (קפה פינת חן): הדרגה מאפס ב-3 חודשים, גרייס 6 חודשים */
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
    loan: { track: 'startup', amount: 200000, ratePct: 7.5, years: 5, graceMonths: 6, purpose: 'ציוד ושיפוץ', uses: [] },
  };
  return over ? over(p) || p : p;
}

/**
 * עסק קיים שהשנה הקשה שלו היא שנה 2 (ב5): מכירות קבועות 100,000 ₪ בחודש, בלי הדרגה ובלי צמיחה,
 * עלות מכר 80%, בלי הוצאות קבועות ושכר (כדי שהצמדה למדד לא תשפיע), משיכה 10,000 ₪,
 * הלוואה 600,000 ₪ ל-5 שנים עם גרייס 12 חודשים. בשנה 1 משלמים רק ריבית (3,750 ₪) והיתרה עולה;
 * מחודש 13 ההחזר קופץ לכ-14,500 ₪, יותר מכל מה שהעסק מייצר (10,000 ₪ לפני מס), והיתרה יורדת.
 */
function shop(over) {
  const p = {
    business: { name: 'מכולת הגבעה', entity: 'osek', field: 'מכולת', city: 'חולון', years: 4, employees: 0, isNew: false,
      description: 'מכולת שכונתית שפתוחה שבעה ימים בשבוע ומספקת משלוחים לבתים בשכונה.' },
    owner: { name: 'בעל המכולת', experience: 'מנהל את המכולת ארבע שנים, ולפני כן עבד בסופרמרקט.', education: '' },
    market: { customers: 'משפחות בשכונה ובתי אבות באזור', competitors: '', pricing: '', advantage: 'משלוח עד הבית בתוך שעה' },
    history: { lastYearSales: 1200000, lastYearProfit: 100000 },
    startup: { openDate: '', equity: 0, setupCosts: [{ item: '', amount: 0 }], preOpenCosts: 0, deposit: 0, equipmentVat: 0 },
    forecast: { annualSales: 1200000, rampMonths: 0, growthPct: 0, cogsPct: 80, monthlyFixed: 0, monthlySalaries: 0, ownerDrawMonthly: 10000,
      openingCash: 30000, salesModel: 'total', customersPerDay: 0, avgTicket: 0, daysPerMonth: 26 },
    loan: { track: 'general', amount: 600000, ratePct: 7.5, years: 5, graceMonths: 12, purpose: 'מקררים ותצוגה חדשים',
      uses: [{ item: 'מקררים ותצוגה', amount: 600000, type: 'capex' }] },
  };
  return over ? over(p) || p : p;
}

const scen = (p) => Object.fromEntries(E.scenarios(p).map((s) => [s.key, s]));
const sum = (a) => a.reduce((s, x) => s + x, 0);

// =====================================================================
// ב2 – המס עולה ב-10 ₪ בכל חודש כשהמכירות קבועות
// =====================================================================
// במאפייה: עסק קיים (פתיחה ב-71.875% מהקצב המלא) עם הדרגה של 2 חודשים, ולכן מחודש 3
// המכירות קבועות. היום: 10,370 בחודשים 3–7 ואז 10,380 ... 10,420, כי הריבית בלוח
// הסילוקין יורדת אחרי הגרייס והפריסה משקללת אותה.

test('ב2 תנאי מוקדם: סך הפריסה החודשית של המס שווה למס השנתי (116,762 ₪ במאפייה)', () => {
  const r = E.computePlan(bakery());
  near(sum(r.taxByMonth), r.annualTax, 1, 'סך המס החודשי');
  near(r.annualTax, 116762, 1, 'המס השנתי של המאפייה');
});

test('ב2 רגרסיה: בלי הלוואה ובלי הדרגה – 12 תשלומי מס שווים', () => {
  const f = { annualSales: 1200000, currentSales: 1200000, rampMonths: 0, cogsPct: 50, monthlyFixed: 10000, monthlySalaries: 10000 };
  for (const t of E.taxSpread(f, 12000, null)) near(t, 1000, 0.01);
});

test('ב2: במאפייה המס בחודשים 3–12 (מכירות קבועות) זהה בכל חודש – הפרש מקסימלי ≤ 1 ₪, כל ערך בין 10,300 ל-10,420 ₪, והסכום נשאר 116,762 ₪', () => {
  const r = E.computePlan(bakery());
  const full = r.taxByMonth.slice(2);
  assert.ok(Math.max(...full) - Math.min(...full) <= 1, `מס בחודשים 3–12: ${full.map(Math.round).join(', ')}`);
  for (const t of full) assert.ok(t >= 10300 && t <= 10420, `מס חודשי ${Math.round(t)} מחוץ לטווח 10,300–10,420`);
  near(sum(r.taxByMonth), 116762, 1, 'סך המס');
});

test('ב2: חודשי ההרצה של המאפייה עדיין נמוכים מחודש מלא (חודש 1 < חודש 2 < חודש 3) – לא חוזרים ל-1/12 קבוע', () => {
  const t = E.computePlan(bakery()).taxByMonth;
  assert.ok(t[0] < t[1] && t[1] < t[2], `חודשים 1–3: ${t.slice(0, 3).map(Math.round).join(', ')}`);
  // בדיקת ביניים שחייבת להישאר אחרי התיקון: חודש מלא מקבל את רוב המס
  assert.ok(t[2] > 10000);
});

test('ב2: taxSpread ישירות – מכירות קבועות וריבית שיורדת מ-3,000 ל-1,900 ₪: 12 תשלומים של 1,000 ₪ בדיוק (היום 980 → 1,020)', () => {
  const f = { annualSales: 1200000, currentSales: 1200000, rampMonths: 0, cogsPct: 50, monthlyFixed: 10000, monthlySalaries: 10000 };
  const schedule = Array.from({ length: 12 }, (_, i) => ({ interest: 3000 - 100 * i, payment: 5000 }));
  const t = E.taxSpread(f, 12000, schedule);
  for (let m = 0; m < 12; m++) near(t[m], 1000, 1, `חודש ${m + 1}`);
});

test('ב2 מקרה קצה: מכולת בלי גרייס (הריבית יורדת מחודש 1) ובלי הדרגה – כל 12 התשלומים = המס השנתי / 12', () => {
  const r = E.computePlan(shop((p) => { p.loan.graceMonths = 0; }));
  const avg = r.annualTax / 12;
  for (let m = 0; m < 12; m++) near(r.taxByMonth[m], avg, 1, `חודש ${m + 1}`);
});

test('ב2 מקרה קצה: עסק בהקמה (הדרגה 3 חודשים, גרייס 6) – המס בחודשים 4–12 זהה (הפרש ≤ 1 ₪)', () => {
  const t = E.computePlan(cafe()).taxByMonth.slice(3);
  assert.ok(Math.max(...t) - Math.min(...t) <= 1, `מס בחודשים 4–12: ${t.map(Math.round).join(', ')}`);
});

// =====================================================================
// ב3 – סף "חודש של הוצאות" חייב לכלול עלות מכר חודשית ממוצעת
// =====================================================================
// במאפייה: קבועות 20,000 + שכר 30,000 = 50,000. עלות המכר בשנה 1: 41,167 + 45,917 + 10 × 50,667
// = 593,750 ₪, כלומר ממוצע 49,479 ₪ בחודש. הסף הצפוי: 99,479 ₪ ("כ-100,000" במקור).

test('ב3 תנאי מוקדם: עלות המכר בתזרים המאפייה – ממוצע חודשי 49,479 ₪', () => {
  const r = E.computePlan(bakery());
  near(sum(r.cash.map((c) => c.cogs)) / 12, 49479.17, 1);
});

test('ב3 רגרסיה: עסק בלי עלות מכר (0%) – הסף נשאר קבועות + שכר = 50,000 ₪', () => {
  const r = E.computePlan(bakery((p) => { p.forecast.cogsPct = 0; }));
  near(r.cushion.threshold, 50000, 1);
});

test('ב3: cashCushion ישירות – עלות מכר 50,000 ₪ בכל חודש, קבועות 20,000, שכר 30,000 → סף 100,000 ₪; יתרה נמוכה 80,000 → warn, 0.8 חודשים', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, cogs: 50000, closing: i === 4 ? 80000 : 200000 }));
  const c = E.cashCushion(rows, { monthlyFixed: 20000, monthlySalaries: 30000, cogsPct: 40, annualSales: 1500000 });
  near(c.threshold, 100000, 1, 'סף');
  assert.equal(c.level, 'warn');
  assert.equal(c.month, 5);
  near(c.monthsCovered, 0.8, 0.001, 'חודשים מכוסים');
});

test('ב3: cashCushion – עלות מכר משתנה (30,000 בחצי שנה, 60,000 בחצי השני) → ממוצע 45,000, סף 95,000 ₪', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, cogs: i < 6 ? 30000 : 60000, closing: 500000 }));
  const c = E.cashCushion(rows, { monthlyFixed: 20000, monthlySalaries: 30000 });
  near(c.threshold, 95000, 1);
  assert.equal(c.level, 'ok');
});

test('ב3: במאפייה הסף הוא 99,479 ₪ (לא 50,000), היתרה הנמוכה (כ-38,000 ₪) נשארת "warn", ומכסה כ-0.38 חודש', () => {
  const c = E.computePlan(bakery()).cushion;
  near(c.threshold, 99479, 1, 'סף');
  assert.ok(c.min > 37000 && c.min < 39000, `יתרה נמוכה ${Math.round(c.min)}`);
  assert.equal(c.level, 'warn');
  near(c.monthsCovered, c.min / 99479.17, 0.001, 'חודשים מכוסים');
  assert.ok(c.monthsCovered > 0.37 && c.monthsCovered < 0.39);
});

test('ב3 מקרה קצה: מכולת בלי קבועות ושכר (עלות מכר 80,000 ₪ בחודש) – הסף 80,000 ₪ (היום 0), והיתרה 32,562 ₪ היא "warn" ולא "ok"', () => {
  const c = E.computePlan(shop()).cushion;
  near(c.threshold, 80000, 1, 'סף');
  assert.equal(c.level, 'warn');
});

test('ב3 ניסוח: הודעת החודש הדחוק (thinMonthNote) מזכירה את עלות המכר/הסחורה, לא רק "הוצאות קבועות ושכר"', () => {
  const note = strip(E.thinMonthNote(E.computePlan(bakery()).cushion));
  assert.ok(note, 'צפויה הודעה – המאפייה ב-warn');
  assert.match(note, /עלות (ה)?מכר|סחורה|חומרי גלם/);
});

test('ב3 ניסוח: המשפט במסך/מסמך (cushionText ב-app.js) לא מתאר את הסף כ"הוצאות קבועות ושכר" בלבד', () => {
  const app = read('app.js');
  assert.ok(!/חודש אחד של הוצאות קבועות ושכר \(/.test(app), 'עדיין כתוב "חודש אחד של הוצאות קבועות ושכר (סכום)" – הסכום כבר כולל עלות מכר');
});

// =====================================================================
// ב5 – יתרת המזומן בתרחישים לכל תקופת ההלוואה, לא רק שנה 1
// =====================================================================

// הערה: ב2 משנה את המס של חודש 1 (5,150 → כ-5,436), ולכן היתרה הנמוכה של המאפייה זזה
// מ-38,142 ל-כ-37,856 ₪. הבדיקה משווה ליתרה של שנה 1 מאותו מנוע, כדי לא להיות תלויה בסדר התיקונים.
test('ב5 רגרסיה: במאפייה, בתרחיש הבסיס החודש הקשה נשאר חודש 1, בדיוק היתרה הנמוכה של שנה 1 (37,856–38,142 ₪) – השנים הבאות חזקות יותר', () => {
  const y1 = E.computePlan(bakery()).cushion;
  const s = scen(bakery()).base;
  near(s.minCash, y1.min, 1);
  assert.ok(s.minCash >= 37855 && s.minCash <= 38143, `${Math.round(s.minCash)}`);
  assert.equal(s.minCashMonth, 1);
});

test('ב5 רגרסיה: במאפייה, בירידה של 20% היתרה הנמוכה היא לכל היותר ‎-8,533 ₪ (אופק ארוך יותר לא יכול לשפר מינימום)', () => {
  assert.ok(scen(bakery()).down20.minCash <= -8533 + 1);
});

test('ב5 תנאי מוקדם: במכולת עם גרייס 12 חודשים, שנה 1 חיובית כל הזמן ויחס הכיסוי בשנה 2 מתחת ל-1.0', () => {
  const r = E.computePlan(shop());
  assert.ok(r.cash.every((c) => c.closing > 0), 'שנה 1 כולה חיובית');
  assert.ok(r.years[1].dscr < 1, `יחס כיסוי שנה 2: ${r.years[1].dscr}`);
});

test('ב5: במכולת (גרייס 12) היתרה הנמוכה בתרחיש הבסיס נמצאת אחרי חודש 12 (בין 13 ל-60) ושלילית – לפחות ‎-47,000 ₪ עד סוף שנה 3 גם בלי מס', () => {
  const p = shop();
  const r = E.computePlan(p);
  // חסם עליון בלי מס: יתרת חודש 12 + 24 חודשים × (100,000 − 80,000 − 10,000) − ההחזרים בחודשים 13–36
  const bound = r.cash[11].closing + 24 * 10000 - sum(r.schedule.slice(12, 36).map((x) => x.payment));
  assert.ok(bound < -40000, `החסם עצמו ${Math.round(bound)} (בדיקה פנימית)`);
  const s = scen(p).base;
  assert.ok(s.minCashMonth >= 13 && s.minCashMonth <= 60, `חודש היתרה הנמוכה: ${s.minCashMonth} (היום 1)`);
  assert.ok(s.minCash <= bound + 1, `יתרה נמוכה ${Math.round(s.minCash)}, צפוי ≤ ${Math.round(bound)} (היום +32,562)`);
});

test('ב5: במכולת כל שלושת התרחישים שליליים, והסדר הגיוני: ‎-20% ≤ ‎-10% ≤ בסיס < 0', () => {
  const s = scen(shop());
  assert.ok(s.base.minCash < 0, `בסיס ${Math.round(s.base.minCash)}`);
  assert.ok(s.down10.minCash <= s.base.minCash && s.down20.minCash <= s.down10.minCash);
  for (const k of ['base', 'down10', 'down20']) assert.ok(s[k].level === 'risk', `${k}: ${s[k].level}`);
});

test('ב5: הערת התרחישים במכולת לא אומרת שהיתרה "נשארת חיובית" – היא מציינת מינוס', () => {
  const note = strip(E.scenarioNote(E.scenarios(shop())));
  assert.ok(!/נשארת חיובית/.test(note), note);
  assert.match(note, /מינוס/);
});

test('ב5 מקרה קצה: עסק בהקמה (קפה, גרייס 6) – היתרה הנמוכה בתרחישים לא גבוהה מהיתרה הנמוכה של שנה 1, והחודש בטווח 1–60', () => {
  const p = cafe();
  const y1 = E.computePlan(p).cushion.min;
  const s = scen(p).base;
  assert.ok(s.minCash <= y1 + 1);
  assert.ok(s.minCashMonth >= 1 && s.minCashMonth <= p.loan.years * 12);
  // סימן שהאופק באמת ארוך: במכולת, שבה שנה 2 קשה, החודש חורג מ-12
  assert.ok(scen(shop()).base.minCashMonth > 12);
});

// =====================================================================
// ג2 – משפט רגישות בתקציר כשירידה של 10% מורידה את היחס מתחת ל-1.25
// =====================================================================

test('ג2 תנאי מוקדם: במאפייה יחס הכיסוי בבסיס 1.88 (טוב), ובירידה של 10% – 1.16 (מתחת ל-1.25)', () => {
  const s = scen(bakery());
  assert.equal(s.base.minDscr.toFixed(2), '1.88');
  assert.equal(s.down10.minDscr.toFixed(2), '1.16');
});

test('ג2 תנאי מוקדם: מאפייה עם הלוואה של 150,000 ₪ – גם בירידה של 10% היחס 2.12 (אין צורך במשפט)', () => {
  const s = scen(smallLoanBakery());
  assert.ok(s.down10.minDscr >= 1.25, `${s.down10.minDscr}`);
});

function smallLoanBakery() {
  return bakery((p) => {
    p.loan.amount = 150000;
    p.loan.uses = [{ item: 'תנור מסחרי', amount: 30000, type: 'capex' }, { item: 'מקרר תעשייתי', amount: 45000, type: 'capex' },
      { item: 'הון חוזר (חומרי גלם ומלאי)', amount: 75000, type: 'working' }];
  });
}

/** מחפש פונקציה טהורה שמחזירה את משפט הרגישות (בשם שמכיל sensitiv / scenarioSummary / riskSummary) */
function sensitivityFn() {
  for (const lib of [E, U]) {
    for (const [name, fn] of Object.entries(lib || {})) {
      if (typeof fn === 'function' && /sensitiv|scenarioSummary|summaryScenario|riskSummary|summaryRisk/i.test(name)) return fn;
    }
  }
  return null;
}
function sensitivityText(fn, p) {
  const res = E.computePlan(p);
  for (const args of [[p, res], [p], [E.scenarios(p)], [E, p]]) {
    try {
      const out = fn(...args);
      if (typeof out === 'string') return strip(out);
      if (out && typeof out.text === 'string') return strip(out.text);
    } catch (e) { /* נסה חתימה אחרת */ }
  }
  return null;
}

test('ג2: פונקציה טהורה מחזירה למאפייה משפט אחד שמזכיר ירידה של 10% במכירות ויחס 1.16; להלוואה של 150,000 ₪ – מחרוזת ריקה', () => {
  const fn = sensitivityFn();
  assert.ok(fn, 'לא נמצאה פונקציה טהורה למשפט הרגישות (אם המשפט נבנה רק בתוך renderDocument – לבדוק בדפדפן, ראו docs/QA-improvement-4-sprint2-plan.md)');
  const text = sensitivityText(fn, bakery());
  assert.ok(text, 'הפונקציה לא החזירה טקסט למאפייה');
  assert.match(text, /10%/);
  assert.match(text, /1\.16/);
  assert.ok((text.match(/[.!?](\s|$)/g) || []).length <= 1, `צפוי משפט אחד: "${text}"`);
  assert.equal(sensitivityText(fn, smallLoanBakery()) || '', '');
});

test('ג2 מבנה: פרק 1 (תקציר מנהלים) במסמך משתמש בתוצאות התרחישים / משפט הרגישות', () => {
  const app = read('app.js');
  const sec1 = (app.match(/1\. תקציר מנהלים[\s\S]*?2\. תיאור העסק/) || [''])[0];
  assert.ok(sec1, 'לא נמצא פרק 1 ב-app.js');
  assert.match(sec1, /scenario|sensitiv|down10|רגישות/i);
});

// =====================================================================
// ג3 – להסתיר "חודש האיזון" בעסק קיים
// =====================================================================

test('ג3 רגרסיה: בעסק בהקמה (קפה) כרטיס "חודש האיזון" נשאר', () => {
  const cards = E.headlineMetrics(cafe(), E.computePlan(cafe()));
  const be = cards.find((c) => c.key === 'breakeven');
  assert.ok(be, 'אין כרטיס חודש איזון בעסק בהקמה');
  assert.equal(be.label, 'חודש האיזון');
});

test('ג3: במאפייה (עסק קיים, 3 שנים) אין כרטיס "חודש האיזון" – 4 כרטיסים: סכום, הון עצמי, יחס כיסוי, יתרה נמוכה (היום מוצג "חודש 1")', () => {
  const cards = E.headlineMetrics(bakery(), E.computePlan(bakery()));
  assert.ok(!cards.some((c) => c.key === 'breakeven' || /האיזון/.test(strip(c.label))), cards.map((c) => c.label).join(' | '));
  assert.deepEqual(cards.map((c) => c.key), ['loan', 'equity', 'dscr', 'cash']);
});

test('ג3 מקרה קצה: עסק קיים עם ותק של חצי שנה ועסק קיים של 10 שנים – גם שם אין "חודש האיזון"', () => {
  for (const years of [0.5, 10]) {
    const p = bakery((q) => { q.business.years = years; q.isSample = false; });
    const cards = E.headlineMetrics(p, E.computePlan(p));
    assert.ok(!cards.some((c) => c.key === 'breakeven'), `ותק ${years}`);
  }
});

// =====================================================================
// סבב אימות אחרי הפיתוח (תמר, 29.09.2026) – בדיקות עצמאיות של המספרים, ובאגים שנמצאו.
// test.todo = באג פתוח. כשמתקנים – מסירים ".todo".
// =====================================================================
const fnSrcApp = (name) => {
  const src = read('app.js');
  const start = src.indexOf(`  function ${name}(`);
  if (start < 0) return '';
  const end = src.indexOf('\n  }', start);
  return src.slice(start, end + 4);
};

/** מכולת בתנאים שאפשר להזין באשף (גרייס 6, הלוואה 300,000): שנה 1 חיובית ודחוקה, ובהמשך מינוס */
function shopUi() {
  return shop((p) => {
    p.loan.amount = 300000; p.loan.graceMonths = 6; p.loan.uses = [{ item: 'מקררים ותצוגה', amount: 300000, type: 'capex' }];
    p.forecast.openingCash = 60000; p.forecast.ownerDrawMonthly = 12000;
  });
}

/**
 * חישוב עצמאי של היתרה לכל תקופת ההלוואה, מאבני הבניין הוותיקות בלבד (amortization, taxFor,
 * השורות של שנה 1): משנה 2 כל חודש = 1/12 מהשנה, המכירות וההוצאות נעצרות ברמת שנה 3,
 * המס לפי רווח השנה אחרי ריבית של אותה שנה, וההחזר מלוח הסילוקין בפועל.
 */
function independentPeriod(p) {
  const f = p.forecast, L = p.loan;
  const sch = E.amortization(L.amount, L.ratePct, L.years, L.graceMonths);
  const res = E.computePlan(p);
  const out = res.cash.map((c) => c.closing);
  let cash = out[11];
  for (let m = 13; m <= sch.length; m++) {
    const y = Math.ceil(m / 12), ly = Math.min(y, 3);
    const rev = f.annualSales * Math.pow(1 + (f.growthPct || 0) / 100, ly - 1);
    const infl = Math.pow(1.03, ly - 1);
    const ebitda = rev * (1 - f.cogsPct / 100) - (f.monthlyFixed + f.monthlySalaries) * 12 * infl;
    const interest = sum(sch.slice((y - 1) * 12, y * 12).map((r) => r.interest));
    const tax = Math.max(0, E.taxFor(ebitda - interest, f.entity).total);
    cash += (ebitda - tax - f.ownerDrawMonthly * 12) / 12 - sch[m - 1].payment;
    out.push(cash);
  }
  const min = Math.min(...out);
  return { min, month: out.indexOf(min) + 1, res };
}

test('אימות ב5: התזרים לכל התקופה תואם חישוב עצמאי (מאפייה, קפה, מכולת, מכולת-אשף), ו-12 החודשים הראשונים זהים לטבלת התזרים במסמך', () => {
  for (const [name, p] of [['מאפייה', bakery()], ['קפה', cafe()], ['מכולת', shop()], ['מכולת-אשף', shopUi()]]) {
    const ind = independentPeriod(p);
    near(ind.res.cushionPeriod.min, ind.min, 1, name);
    assert.equal(ind.res.cushionPeriod.month, ind.month, name);
    assert.equal(ind.res.cashPeriod.length, p.loan.years * 12, name);
    ind.res.cash.forEach((c, i) => assert.equal(ind.res.cashPeriod[i].closing, c.closing, `${name} חודש ${i + 1}`));
  }
});

test('אימות ב5: בטבלת התרחישים, שורת הבסיס = היתרה הנמוכה בתזרים של כל התקופה, והטקסט "מתי" תואם לחודש', () => {
  for (const p of [bakery(), cafe(), shop(), shopUi()]) {
    const res = E.computePlan(p);
    const base = scen(p).base;
    const worst = res.cashPeriod.reduce((a, c) => (c.closing < a.closing ? c : a));
    assert.equal(base.minCash, worst.closing);
    assert.equal(base.minCashMonth, worst.month);
    assert.equal(strip(base.minCashText), strip(E.periodMonthText(worst.month)));
    assert.equal(base.minCashYear1, res.cushion.min, 'היתרה של שנה 1 להשוואה');
    if (worst.month <= 12) assert.equal(base.minCash, res.cushion.min, 'כשהחודש הקשה בשנה 1 – זה אותו מספר כמו בכרטיס ובטבלת התזרים');
  }
  assert.equal(strip(E.periodMonthText(60)), 'חודש 12 בשנה החמישית');
  assert.equal(strip(E.periodMonthText(13)), 'חודש 1 בשנה השנייה');
});

test('אימות ב5: אזהרת "מינוס בהמשך" מופיעה במכולת-אשף (שנה 1 חיובית, שנה 5 במינוס) ולא במאפייה, בקפה, או כששנה 1 כבר במינוס', () => {
  const r = E.computePlan(shopUi());
  assert.ok(r.cushion.min > 0 && r.cushionPeriod.min < 0, 'תנאי מוקדם');
  const note = strip(U.laterNegativeNote(r, E.periodMonthText, E.ils));
  assert.match(note, /מינוס של 117,509/);
  assert.ok(note.includes('חודש 12 בשנה החמישית'), note);
  for (const p of [bakery(), cafe()]) assert.equal(U.laterNegativeNote(E.computePlan(p), E.periodMonthText, E.ils), '');
  const y1neg = bakery((q) => { q.forecast.cogsPct = 0; q.forecast.openingCash = 0; q.forecast.monthlyFixed = 90000; q.isSample = false; });
  const rn = E.computePlan(y1neg);
  assert.ok(rn.cushion.min < 0, 'תנאי מוקדם: שנה 1 במינוס');
  assert.equal(U.laterNegativeNote(rn, E.periodMonthText, E.ils), '');
});

test('אימות ג2: הסף בודק את הערך המוצג (שתי ספרות) – 1.249 מקבל משפט, 1.2451 לא; בסיס מתחת ל-1.25 או בלי הלוואה – בלי משפט', () => {
  const mk = (b, d) => [{ key: 'base', minDscr: b }, { key: 'down10', minDscr: d }, { key: 'down20', minDscr: 0.5 }];
  assert.match(strip(U.sensitivityNote(mk(1.9, 1.244), E.dscrPhrase)), /1\.24/);
  assert.equal(U.sensitivityNote(mk(1.9, 1.2451), E.dscrPhrase), '');
  assert.equal(U.sensitivityNote(mk(1.2, 0.9), E.dscrPhrase), '');
  assert.equal(U.sensitivityNote(mk(Infinity, Infinity), E.dscrPhrase), '');
});

test('אימות קוסמטי: ותק בשברים – בחודשים ולא בעשרוני', () => {
  assert.equal(strip(E.yearsText(1.25)), 'שנה ו-3 חודשים');
  assert.equal(strip(E.yearsText(2.75)), 'שנתיים ו-9 חודשים');
  assert.equal(strip(E.yearsText(1.0833)), 'שנה וחודש');
  assert.equal(strip(E.yearsText(1.96)), 'שנתיים');
  assert.equal(strip(E.yearsText(3.5)), '3 שנים וחצי');
});

test('אימות קוסמטי: בתקציר "העסק, [שם], פועל" – בלי "[שם] פועל" בתחילת המשפט', () => {
  const app = read('app.js');
  assert.ok(app.includes("`העסק, ${dtl(b.name)},`"));
  assert.ok(!/: `\$\{dtl\(b\.name\)\} פועל/.test(app));
});

// ---------- באגים פתוחים ----------
test('באג P1 (ב5): כשהשנה הראשונה דחוקה אבל תקינה ובהמשך יש מינוס, משפט המרווח לא קובע "התזרים לא נכנס למינוס" בלי הסתייגות', () => {
  // מכולת-אשף: באשף "התזרים לא נכנס למינוס, אבל המרווח דק", ובמסמך "התזרים אינו נכנס למינוס בתחזית" –
  // ומיד אחריו "בהמשך תקופת ההלוואה הוא צפוי לרדת למינוס של 117,509 ₪". סתירה באותה רשימה.
  const fn = fnSrcApp('cushionText');
  assert.ok(fn.length > 100, 'לא נמצאה cushionText ב-app.js');
  const qualified = /cushionPeriod|laterNegative/.test(fn)
    || !/התזרים (לא|אינו) נכנס למינוס(?! בשנה הראשונה)/.test(fn);
  assert.ok(qualified, 'cushionText עדיין קובע "התזרים לא/אינו נכנס למינוס" בלי לבדוק את המשך התקופה');
});

test('באג P2 (ב3): הודעת החודש הדחוק (thinMonthNote) בעסק בלי עלות מכר לא מזכירה "עלות מכר"', () => {
  const p = bakery((q) => { q.forecast.cogsPct = 0; q.forecast.openingCash = 60000; q.forecast.monthlyFixed = 60000; q.isSample = false;
    q.loan.uses = [{ item: 'תנור', amount: 300000, type: 'capex' }]; });
  const c = E.computePlan(p).cushion;
  assert.equal(c.level, 'warn', 'תנאי מוקדם');
  assert.equal(c.thresholdParts.cogs, 0, 'תנאי מוקדם');
  const note = strip(E.thinMonthNote(c));
  assert.ok(!/עלות מכר/.test(note), note);
});

// ---------- תיקוני נדב לבאגים 1-3 (29.09.2026) ----------
test('תיקון באג 3: במסמך לבנק משפט "המינוס בהמשך" עובדתי בגוף שלישי, בלי עצה; באשף העצה נשארת', () => {
  const r = E.computePlan(shopUi());
  const wiz = strip(U.laterNegativeNote(r, E.periodMonthText, E.ils));
  const doc = strip(U.laterNegativeNote(r, E.periodMonthText, E.ils, 'doc'));
  assert.match(wiz, /כדאי לבדוק מראש/);
  assert.ok(doc.length > 0);
  assert.ok(!/כדאי|מומלץ|לבדוק|שקלו|בדקו/.test(doc), doc);
  assert.match(doc, /יתרה שלילית של 117,509/);
  assert.ok(doc.includes('חודש 12 בשנה החמישית'), doc);
  assert.equal(U.laterNegativeNote(E.computePlan(bakery()), E.periodMonthText, E.ils, 'doc'), '');
  const app = read('app.js');
  assert.ok(app.includes("[U.laterNegativeNote(res, E.periodMonthText, ils, 'doc')]"), 'מערך הסיכונים במסמך משתמש בניסוח המסמך');
});

test('תיקון באג 1: בענף הדחוק של cushionText הטענה "לא נכנס למינוס" מוגבלת לשנה הראשונה כשבהמשך יש מינוס', () => {
  const fn = fnSrcApp('cushionText');
  assert.match(fn, /res\.cushionPeriod && res\.cushionPeriod\.min < 0/);
  assert.ok(fn.includes("'בשנה הראשונה התזרים'"), fn);
  // תנאי המינוס בהמשך זהה לזה של laterNegativeNote בתרחיש השחזור (שם cushion.level = 'warn')
  const r = E.computePlan(shopUi());
  assert.ok(r.cushionPeriod.min < 0 && U.laterNegativeNote(r, E.periodMonthText, E.ils));
});

test('תיקון באג 2: thinMonthNote ו-U.thresholdLabel משתמשים באותו כלל (E.thresholdLabel)', () => {
  const withCogs = E.computePlan(bakery()).cushion;
  assert.equal(U.thresholdLabel(withCogs), E.thresholdLabel(withCogs));
  assert.ok(strip(E.thinMonthNote(withCogs)).includes(E.thresholdLabel(withCogs)) || withCogs.level !== 'warn');
  assert.equal(E.thresholdLabel({ thresholdParts: { fixed: 1, salaries: 0, cogs: 0 } }), 'הוצאות קבועות ושכר');
});

// ---------- QA חוזר (תמר, 29.09.2026) ----------
test('QA חוזר באג 2: עם עלות מכר, הודעת החודש הדחוק מזכירה עלות מכר; בלי – לא (thinMonthNote + thresholdLabel)', () => {
  const withCogs = E.computePlan(shopUi()).cushion;
  assert.equal(withCogs.level, 'warn', 'תנאי מוקדם');
  assert.match(strip(E.thinMonthNote(withCogs)), /עלות מכר/);
  assert.match(U.thresholdLabel(withCogs), /עלות מכר/);
  const noCogs = E.computePlan(shop((p) => { p.forecast.cogsPct = 0; p.forecast.monthlyFixed = 60000; p.forecast.openingCash = 40000;
    p.forecast.ownerDrawMonthly = 12000; p.loan.amount = 300000; p.loan.graceMonths = 6; p.loan.uses = [{ item: 'מקררים', amount: 300000, type: 'capex' }]; })).cushion;
  assert.equal(noCogs.level, 'warn', 'תנאי מוקדם');
  assert.ok(!/עלות מכר/.test(strip(E.thinMonthNote(noCogs))));
  assert.equal(U.thresholdLabel(noCogs), 'הוצאות קבועות ושכר');
});

test('QA חוזר באג 1: במאפייה (בלי מינוס בהמשך) אין משפט "מינוס בהמשך", ובמכולת-אשף יש', () => {
  assert.equal(U.laterNegativeNote(E.computePlan(bakery()), E.periodMonthText, E.ils), '');
  assert.equal(U.laterNegativeNote(E.computePlan(bakery()), E.periodMonthText, E.ils, 'doc'), '');
  assert.ok(U.laterNegativeNote(E.computePlan(shopUi()), E.periodMonthText, E.ils).length > 0);
});
