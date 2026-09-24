// סבב QA שלישי: יישוב הכפילות בין עלויות ההקמה לשימושי ההלוואה, והון עצמי בתזרים.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

/** המקרה של תמר: עלויות הקמה 150,000 מול הלוואה 280,000 שכל שימושיה מפורטים */
function newPlan(over) {
  return {
    business: { name: 'עסק חדש', isNew: true, years: 0 },
    history: { lastYearSales: 0, lastYearProfit: 0 },
    startup: { equity: 120000, openDate: 'מרץ 2027', setupCosts: [{ item: 'שיפוץ', amount: 150000 }] },
    forecast: { annualSales: 900000, rampMonths: 6, growthPct: 10, cogsPct: 35, monthlyFixed: 12000, monthlySalaries: 8000, ownerDrawMonthly: 8000, taxRatePct: 20, openingCash: 0 },
    loan: {
      track: 'startup', amount: 280000, ratePct: 7.5, years: 5, graceMonths: 6,
      uses: [{ item: 'ציוד', amount: 200000, type: 'capex' }, { item: 'הון חוזר', amount: 80000, type: 'working' }],
    },
    ...(over || {}),
  };
}

// ---------- באג 1: המסמך לא מצהיר הצהרה לא נכונה על עצמו ----------

// עודכן בסבב QA 4 (באג #3): במקום "לזהות סתירה בין שתי רשימות ולהסביר אותה",
// עלויות ההקמה הן מקור האמת היחיד והשימושים נגזרים ממנה, ולכן הסתירה לא נוצרת מראש.
test('עלויות הקמה: המסמך לא מציג שני סכומים לאותו כסף, כי טבלת השימושים נגזרת מהמנוע', () => {
  const app = read('app.js');
  assert.ok(app.includes('const usesTotalSum = res.usesTotal'), 'סך השימושים מגיע מהמנוע');
  assert.ok(/\.\.\.res\.uses\.map\(/.test(app), 'שורות הטבלה נגזרות מ-res.uses ולא מרשימה שהוזנה שוב');
  assert.ok(!app.includes('setupMismatch'), 'מכניזם ה"סתירה" הוסר');
  assert.ok(!app.includes('נמוכות משימושי ההלוואה'), 'ההתנצלות על ההפרש הוסרה');
  assert.ok(app.includes('סך המקורות') && app.includes('שווה לסך השימושים'), 'במקומה טבלת התאמה מקורות מול שימושים');
});

test('עלויות הקמה: המקרה של תמר מאוזן אוטומטית – הון חוזר במקום סתירה', () => {
  const p = newPlan(); // עלויות הקמה 150,000, הלוואה 280,000, הון עצמי 120,000
  const uses = E.planUses(p);
  assert.equal(E.setupCostsTotal(p), 150000);
  assert.equal(E.sourcesTotal(p), 400000);
  assert.equal(E.usesTotal(p), 400000, 'סך השימושים שווה לסך המקורות, בלי הפרש שלא פורט');
  assert.equal(uses[uses.length - 1].amount, 250000, 'ההפרש מוצג כהון חוזר');
  const full = newPlan({ startup: { equity: 120000, setupCosts: [{ item: 'שיפוץ', amount: 400000 }] } });
  assert.equal(E.planUses(full).length, 1, 'כשההקמה מכסה את כל המקורות אין שורת הון חוזר');
});

// ---------- באג 2: ההון העצמי נכנס לתזרים ----------

test('תזרים: ההון העצמי נכנס כתקבול בחודש 1 בלבד, כמו ההלוואה', () => {
  const p = newPlan();
  const s = E.amortization(p.loan.amount, p.loan.ratePct, p.loan.years, p.loan.graceMonths);
  const c = E.cashflow(p.forecast, p.loan.amount, p.loan.uses, s, 120000);
  assert.equal(c[0].equityIn, 120000);
  assert.equal(c[1].equityIn, 0);
  near(c[0].inflow, c[0].revenue + 280000 + 120000);
  for (let i = 1; i < 12; i++) near(c[i].opening, c[i - 1].closing);
});

test('תזרים: בלי הון עצמי התוצאה לא משתנה (תאימות לאחור)', () => {
  const p = newPlan();
  const s = E.amortization(p.loan.amount, p.loan.ratePct, p.loan.years, p.loan.graceMonths);
  const base = E.cashflow(p.forecast, p.loan.amount, p.loan.uses, s);
  const zero = E.cashflow(p.forecast, p.loan.amount, p.loan.uses, s, 0);
  assert.equal(base[0].equityIn, 0);
  base.forEach((r, i) => near(r.closing, zero[i].closing, 0.001));
  const withEq = E.cashflow(p.forecast, p.loan.amount, p.loan.uses, s, 120000);
  near(withEq[0].closing - base[0].closing, 120000, 0.001);
});

test('פרק 7 מתיישב עם פרק 5: סך ההשקעה שמוצהר נכנס בפועל לתזרים של עסק חדש', () => {
  const p = newPlan();
  const res = E.computePlan(p);
  const share = E.equityShare(p.startup.equity, p.loan.amount);
  assert.equal(share.total, 400000, 'פרק 5 מצהיר 400,000 סך השקעה');
  near(res.cash[0].loanIn + res.cash[0].equityIn, share.total, 0.001, 'אותו סכום נכנס בחודש 1 בתזרים');
  assert.equal(E.equityInflow(p), 120000);
});

test('הון עצמי נכנס רק בעסק בהקמה, ולא בעסק פעיל שנשאר לו ערך ישן בשדה', () => {
  const existing = newPlan({ business: { name: 'עסק ותיק', isNew: false, years: 6 } });
  assert.equal(E.isNewBusiness(existing), false);
  assert.equal(E.equityInflow(existing), 0, 'בעסק פעיל לא שואלים על הון עצמי, ולכן הוא לא נכנס לתזרים');
  assert.equal(E.computePlan(existing).cash[0].equityIn, 0);
  // תוכנית ישנה בלי הדגל נקבעת לפי ותק, כמו באשף
  assert.equal(E.isNewBusiness({ business: { years: 0 } }), true);
  assert.equal(E.isNewBusiness({ business: { years: 4 } }), false);
  assert.equal(E.isNewBusiness({}), true);
  assert.equal(E.equityInflow({}), 0);
});

test('המסמך מציג שורת "הכנסת הון עצמי" בתזרים רק כשיש הון עצמי', () => {
  const app = read('app.js');
  assert.ok(app.includes("res.cash.some((c) => c.equityIn)"), 'השורה מותנית בקיום הון עצמי');
  assert.ok(app.includes('הכנסת הון עצמי'), 'שם השורה בעברית פשוטה');
  assert.ok(app.includes('...equityRow,'), 'השורה נכנסת לטבלת התזרים');
});

test('ההון העצמי לא הופך לאזהרה ולא שובר תוכנית תקינה', () => {
  const p = newPlan();
  assert.deepEqual(E.computePlan(p).warnings, [], 'validatePlan נשאר נקי');
});
