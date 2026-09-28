/**
 * QA סבב 7 (אפרת, 27.09.2026) – בדיקה עצמאית של:
 *  1. פריסת המס בתזרים החודשי (taxSpread) – סך שנתי זהה, 0 בחודשי הפסד.
 *  2. חודש דחוק (cushion 'warn') – משפט שקיפות בכרטיס, סכום תואם לתזרים.
 *  3. חודש במינוס (rating 'ok' + cushion 'risk') – אזהרה עם חודש וסכום, בכרטיס ובתקציר.
 *
 * כל ציפייה מחושבת כאן מהתזרים (res.cash) או מהמנוע הישן (git HEAD) – לא מפונקציית
 * הטקסט הנבדקת. קלט הבסיס: docs/test-cases/cafe-pinat-chen.html (קפה פינת חן).
 * ממצאים פתוחים מסומנים todo, כדי ש-npm test יישאר ירוק עד שהמפתח יתקן.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const R = (n) => Math.round(n);
const strip = (s) => String(s == null ? '' : s).replace(/[⁦-⁩‎‏]/g, '');
const money = (n) => R(n).toLocaleString('en-US');
const sum = (a) => a.reduce((s, v) => s + v, 0);

function cafe(over) {
  const p = {
    business: { name: 'קפה פינת חן', isNew: true, entity: 'osek', employees: 4, city: 'ירושלים', years: 0,
      field: 'בית קפה שכונתי ומאפה', description: 'בית קפה שכונתי עם מאפים טריים' },
    owner: { name: 'אריאל כהן', experience: 'ניהול משמרת ברשת בתי קפה 4 שנים', education: '' },
    market: { customers: 'תושבי השכונה', competitors: 'קפה גרג', pricing: 'דומה', advantage: 'אפייה במקום' },
    history: { lastYearSales: 0, lastYearProfit: 0 },
    startup: { equity: 60000, openDate: 'יוני 2027', preOpenCosts: 0, deposit: 0, equipmentVat: 0,
      setupCosts: [{ item: 'רכישת ציוד ומכונות קפה', amount: 100000 }, { item: 'שיפוץ ועיצוב המקום', amount: 80000 }] },
    forecast: { annualSales: 1800000, rampMonths: 3, growthPct: 5, cogsPct: 30, monthlyFixed: 22000,
      monthlySalaries: 35000, ownerDrawMonthly: 12000, openingCash: 0, salesModel: 'total', daysPerMonth: 26 },
    loan: { track: 'startup', amount: 200000, ratePct: 7.5, years: 5, graceMonths: 0,
      purpose: 'ציוד ושיפוץ', uses: [{ item: '', amount: 0, type: 'capex' }] },
  };
  return over ? over(p) || p : p;
}

/** עסק פועל (מאפייה) – בלי כסף בחשבון והשקעה מלאה בציוד, כדי לקבל דירוג חזק עם חודשי מינוס */
function bakery(over) {
  const p = {
    business: { name: 'מאפיית בדיקה', entity: 'osek', field: 'מאפייה', city: 'בית שמש', years: 3, employees: 4, isNew: false, description: 'x' },
    owner: { name: 'בודקת', experience: '10 שנים', education: '' },
    market: { customers: 'a', competitors: 'b', pricing: 'c', advantage: 'd' },
    history: { lastYearSales: 1150000, lastYearProfit: 160000 },
    startup: { openDate: '', equity: 0, setupCosts: [{ item: '', amount: 0 }], preOpenCosts: 0, deposit: 0, equipmentVat: 0 },
    forecast: { annualSales: 1600000, rampMonths: 2, growthPct: 8, cogsPct: 38, monthlyFixed: 20000, monthlySalaries: 30000,
      ownerDrawMonthly: 12000, openingCash: 0, salesModel: 'total', daysPerMonth: 26 },
    loan: { track: 'general', amount: 300000, ratePct: 7.5, years: 5, graceMonths: 0, purpose: 'תנור',
      uses: [{ item: 'תנור', amount: 300000, type: 'capex' }] },
  };
  return over ? over(p) || p : p;
}

// ---------- 1. פריסת המס ----------

const TAX_CASES = [
  ['קפה פינת חן (עסק חדש, עוסק)', cafe()],
  ['קפה פינת חן כחברה בע"מ', cafe((p) => { p.business.entity = 'company'; })],
  ['קפה פינת חן כשותפות', cafe((p) => { p.business.entity = 'partnership'; })],
  ['קפה פינת חן עם גרייס 6 חודשים', cafe((p) => { p.loan.graceMonths = 6; })],
  ['קפה פינת חן בהרצה של חצי שנה', cafe((p) => { p.forecast.rampMonths = 6; })],
  ['עסק פועל (מאפייה)', bakery()],
  ['עסק פועל בלי הרצה', bakery((p) => { p.forecast.rampMonths = 0; })],
];

for (const [name, plan] of TAX_CASES) {
  test(`פריסת מס – ${name}: סך המס בתזרים = המס השנתי בדוח רווח והפסד`, () => {
    const res = E.computePlan(plan);
    const annual = res.years[0].tax;
    const inCash = sum(res.cash.map((c) => c.tax));
    assert.ok(Math.abs(inCash - annual) < 0.01, `בתזרים ${inCash} מול שנתי ${annual}`);
    assert.equal(res.taxByMonth.length, 12);
    assert.ok(res.taxByMonth.every((t) => t >= 0), 'אין מס שלילי');
  });

  test(`פריסת מס – ${name}: חודש שבו הרווח החודשי שלילי – המס בו 0`, () => {
    const res = E.computePlan(plan);
    const f = { ...plan.forecast, currentSales: plan.history.lastYearSales || 0 };
    const sched = E.amortization(plan.loan.amount, plan.loan.ratePct, plan.loan.years, plan.loan.graceMonths);
    for (let m = 1; m <= 12; m++) {
      const rev = (f.annualSales / 12) * E.salesLevel(f, m);
      const profit = rev * (1 - f.cogsPct / 100) - f.monthlyFixed - f.monthlySalaries - sched[m - 1].interest;
      if (profit <= 0) assert.equal(res.cash[m - 1].tax, 0, `חודש ${m}: רווח ${R(profit)} ומס ${res.cash[m - 1].tax}`);
      else assert.ok(res.cash[m - 1].tax > 0, `חודש ${m} ברווח (${R(profit)}) אבל בלי מס`);
    }
  });
}

test('פריסת מס: שיעור המס זהה בכל החודשים הרווחיים (מס חלקי רווח חודשי)', () => {
  const plan = cafe();
  const res = E.computePlan(plan);
  const f = plan.forecast;
  const sched = E.amortization(200000, 7.5, 5, 0);
  const rates = [];
  for (let m = 1; m <= 12; m++) {
    const rev = (f.annualSales / 12) * E.salesLevel({ ...f, currentSales: 0 }, m);
    const profit = rev * 0.7 - 57000 - sched[m - 1].interest;
    if (profit > 0) rates.push(res.cash[m - 1].tax / profit);
  }
  const spread = Math.max(...rates) - Math.min(...rates);
  assert.ok(spread < 1e-9, `שיעורים שונים בין חודשים: ${rates.map((r) => r.toFixed(4)).join(', ')}`);
});

test('פריסת מס: לפני/אחרי – המס השנתי ויתרת סוף השנה לא השתנו, רק הפיזור', () => {
  for (const eq of [40000, 60000, 150000]) {
    const plan = cafe((p) => { p.startup.equity = eq; });
    const res = E.computePlan(plan);
    // "לפני": אותו תזרים עם 1/12 קבוע, כפי שהמנוע עבד עד השינוי
    const f = { ...plan.forecast, currentSales: 0, entity: 'osek', openingCash: 0 };
    const sched = E.amortization(200000, 7.5, 5, 0);
    const flat = E.cashflow(f, 200000, E.planUses(plan), sched, E.equityInflow(plan), {
      capex: E.investmentTotal(plan), monthlyTax: res.years[0].tax / 12, vat: { amount: 0, refundMonth: 3 },
    });
    assert.ok(Math.abs(sum(flat.map((c) => c.tax)) - sum(res.cash.map((c) => c.tax))) < 0.01, 'סך המס זהה');
    assert.ok(Math.abs(flat[11].closing - res.cash[11].closing) < 0.01, `יתרת חודש 12: ${flat[11].closing} מול ${res.cash[11].closing}`);
  }
});

test('פריסת מס: בלי רווח חודשי בכלל – חוזרים לחלוקה שווה ולא מאבדים את הסכום', () => {
  const t = E.taxSpread({ annualSales: 120000, cogsPct: 0, monthlyFixed: 20000, monthlySalaries: 0, rampMonths: 0 }, 1200, []);
  assert.equal(t.length, 12);
  assert.ok(Math.abs(sum(t) - 1200) < 1e-9);
  assert.deepEqual(E.taxSpread({ annualSales: 1200000, cogsPct: 0, monthlyFixed: 0, monthlySalaries: 0, rampMonths: 0 }, 0, []), Array(12).fill(0));
});

test('קוסמטי (תוקן בשיפור 4): taxSpread(null, ...) קורס (TypeError ב-salesLevel) למרות השמירות f && f.x בגוף הפונקציה', () => {
  assert.doesNotThrow(() => E.taxSpread(null, 1200, null));
});

// ---------- 2. קפה פינת חן הבסיסי: חודש דחוק, בלי מינוס ----------

test('קפה פינת חן: אין חודש במינוס, יתרת חודש 3 היא 11,699 ₪, והיא הנמוכה בשנה', () => {
  const res = E.computePlan(cafe());
  assert.deepEqual(res.negativeMonths, []);
  assert.equal(R(res.cash[2].closing), 11699);
  assert.equal(res.cushion.month, 3);
  assert.equal(R(res.cushion.min), 11699);
  assert.ok(res.cash.every((c) => c.closing >= 0));
  assert.equal(res.cushion.level, 'warn');
  assert.equal(res.rating.level, 'ok');
  assert.equal(E.negativeMonthNote(res.cushion, res.negativeMonths, true), '');
  assert.equal(E.negativeMonthSummary(res.cushion, res.negativeMonths), '');
});

test('קפה פינת חן: משפט החודש הדחוק בכרטיס ומשפט המרווח במסמך מציגים את אותה יתרה מהתזרים', () => {
  const p = cafe();
  const res = E.computePlan(p);
  const min = money(Math.min(...res.cash.map((c) => c.closing)));
  const card = strip(E.thinMonthNote(res.cushion));
  const doc = strip(E.thinCushionText(true, E.workingCapitalTotal(p), res.cash));
  assert.ok(card.includes(`בחודש ${res.cushion.month}`) && card.includes(min), card);
  assert.ok(doc.includes(min) && !doc.includes('80,000'), doc);
  assert.ok(!/מסגרת/.test(doc), 'עסק בהקמה – בלי מסגרת אשראי');
});

// ---------- 3. תרחיש מינוס: הון עצמי 40,000 ₪ ----------

test('מינוס (הון עצמי 40,000): החודשים, החודש הקשה והסכום באזהרה תואמים לטבלת התזרים', () => {
  const res = E.computePlan(cafe((p) => { p.startup.equity = 40000; }));
  const neg = res.cash.filter((c) => c.closing < 0);
  const worst = neg.reduce((a, c) => (c.closing < a.closing ? c : a));
  assert.deepEqual(neg.map((c) => c.month), [2, 3]);
  assert.equal(worst.month, 3);
  assert.equal(R(worst.closing), -8301);
  const card = strip(E.negativeMonthNote(res.cushion, res.negativeMonths, true));
  const sum1 = strip(E.negativeMonthSummary(res.cushion, res.negativeMonths));
  for (const s of [card, sum1]) {
    assert.ok(s.includes('2–3'), `טווח החודשים: ${s}`);
    assert.ok(s.includes('חודש 3') && s.includes('8,301'), `חודש וסכום: ${s}`);
    assert.ok(!s.includes('-8,301'), 'הסכום החסר בלי סימן מינוס');
    assert.ok(!/מסגרת/.test(s), 'לעסק שעוד לא נפתח אין מסגרת אשראי');
  }
  assert.ok(!/מסגרת/.test(strip(E.bridgeText(true, E.workingCapitalTotal(cafe((p) => { p.startup.equity = 40000; })), res.cash))));
});

test('מינוס: בכרטיס ההלוואה הכותרת אינה "בקשה חזקה" נקייה, ובסיכום אין שורת מינוס כפולה', () => {
  const app = read('app.js');
  const fn = (app.match(/function verdict\(res\)[\s\S]*?\n {2}\}/) || [''])[0];
  assert.ok(/if \(minus\)[\s\S]*level: 'warn'/.test(fn));
  assert.ok(app.includes("if (res.negativeMonths.length && res.rating.level !== 'ok') fixes.push("));
});

// ---------- 4. מרווח תקין: אין תיקון יתר ----------

test('מרווח תקין (הון עצמי 150,000): אין אזהרת מינוס ואין אזהרת חודש דחוק', () => {
  const res = E.computePlan(cafe((p) => { p.startup.equity = 150000; }));
  assert.equal(res.cushion.level, 'ok');
  assert.equal(E.thinMonthNote(res.cushion), '');
  assert.equal(E.negativeMonthNote(res.cushion, res.negativeMonths, true), '');
  assert.equal(E.negativeMonthSummary(res.cushion, res.negativeMonths), '');
});

// ---------- 5. ממצאים פתוחים (todo – ממתינים למפתח) ----------

test('חשוב (תוקן בשיפור 4): עסק פועל עם חודשי מינוס – הכרטיס אומר "לבדוק מול הבנק מסגרת אשראי", המסמך קובע "מסגרת אשראי קיימת"', () => {
  const res = E.computePlan(bakery());
  assert.equal(res.rating.level, 'ok');
  assert.equal(res.cushion.level, 'risk');
  const card = E.negativeMonthNote(res.cushion, res.negativeMonths, false);
  const doc = E.bridgeText(false, 0, res.cash);
  assert.ok(/לבדוק מול הבנק מסגרת אשראי/.test(card));
  assert.ok(!/מסגרת אשראי קיימת/.test(doc), `המסמך מצהיר על עובדה שהמשתמש לא מסר: ${doc}`);
});

test('חשוב (תוקן בשיפור 4, אומת ע"י תמר): בחודש דחוק מסך הסיכום מציג את אותה אזהרה פעמיים (בכרטיס וב"כדאי לטפל לפני ההגשה")', () => {
  const app = read('app.js');
  // הכרטיס מוסיף thinMonthNote כשהדירוג חזק; רשימת התיקונים מוסיפה cushionText('wizard') באותו מצב
  const cardAddsThin = /E\.thinMonthNote\(res\.cushion\)/.test(app);
  const fixesAddThin = /else if \(res\.cushion && res\.cushion\.level === 'warn'\) fixes\.push\(cushionText\(res, 'wizard', plan\)\)/.test(app);
  assert.ok(!(cardAddsThin && fixesAddThin), 'אותו חודש דחוק מדווח פעמיים במסך הסיכום');
});

test('קוסמטי (תוקן בשיפור 4): הערת התרחישים מדברת רק על התרחיש הגרוע, גם כשתרחיש הבסיס עצמו כבר במינוס', () => {
  const res = E.computePlan(cafe((p) => { p.startup.equity = 40000; }));
  const list = E.scenarios(cafe((p) => { p.startup.equity = 40000; }));
  assert.ok(list[0].minCash < 0, 'תרחיש הבסיס במינוס');
  const note = strip(E.scenarioNote(list));
  assert.ok(res.cushion.min < 0);
  assert.ok(/בסיס|כבר בתחזית/.test(note), `ההערה לא מזכירה שגם בתחזית הבסיס יש מינוס: ${note}`);
});
