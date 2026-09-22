const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

const basePlan = () => ({
  business: { years: 3 },
  forecast: { annualSales: 1200000, rampMonths: 0, growthPct: 0, cogsPct: 40, monthlyFixed: 20000, monthlySalaries: 30000, ownerDrawMonthly: 10000, taxRatePct: 20, openingCash: 50000 },
  loan: { track: 'general', amount: 300000, ratePct: 6, years: 5, graceMonths: 0, uses: [{ item: 'x', amount: 300000, type: 'capex' }] },
});

test('תקרת הלוואה: הגבוה מבין 500 אלף ו-8% מהמחזור', () => {
  assert.equal(E.maxLoan(1000000), 500000);
  assert.equal(E.maxLoan(10000000), 800000);
  assert.equal(E.maxLoan(0), 500000);
  assert.equal(E.maxLoan(-5), 500000);
});

test('שפיצר: ערך ידוע (100,000 ₪, 6%, 60 חודשים ≈ 1,933.28 ₪)', () => {
  near(E.spitzerPayment(100000, 6, 60), 1933.28);
  near(E.spitzerPayment(120000, 0, 60), 2000);
});

test('לוח סילוקין מחזיר את כל הקרן ומסתיים ביתרה 0', () => {
  const s = E.amortization(300000, 7.5, 5, 0);
  assert.equal(s.length, 60);
  near(s.reduce((a, r) => a + r.principal, 0), 300000);
  near(s[59].balance, 0);
});

test('גרייס: ריבית בלבד, ואז שפיצר על יתרת החודשים', () => {
  const s = E.amortization(300000, 6, 5, 6);
  near(s[0].payment, 1500);
  assert.equal(s[5].principal, 0);
  near(s[6].payment, E.spitzerPayment(300000, 6, 54));
  near(s[59].balance, 0);
  near(s.reduce((a, r) => a + r.principal, 0), 300000);
});

test('debtByYear מחלק לשנים ותואם לסך התשלומים', () => {
  const s = E.amortization(300000, 6, 5, 0);
  const y = E.debtByYear(s);
  assert.equal(y.length, 5);
  near(y.reduce((a, r) => a + r.payment, 0), s.reduce((a, r) => a + r.payment, 0));
});

test('rampFactor עולה בהדרגה עד קצב מלא', () => {
  assert.equal(E.rampFactor(1, 0), 1);
  near(E.rampFactor(1, 3), 0.25);
  assert.equal(E.rampFactor(4, 3), 1);
  assert.equal(E.rampFactor(12, 3), 1);
});

test('salesLevel: עסק קיים עולה מהמכירות הנוכחיות, לא מאפס', () => {
  const existing = { annualSales: 1200000, currentSales: 900000, rampMonths: 3 };
  near(E.salesLevel(existing, 1), 0.75 + 0.25 * 0.25); // מתחיל מ-75% מהקצב המלא
  assert.equal(E.salesLevel(existing, 4), 1);
  const startup = { annualSales: 1200000, currentSales: 0, rampMonths: 3 };
  near(E.salesLevel(startup, 1), 0.25);
  const shrinking = { annualSales: 500000, currentSales: 900000, rampMonths: 3 };
  assert.equal(E.salesLevel(shrinking, 1), 1); // לא מעל הקצב המלא
});

test('computePlan: עסק קיים עם תקופת הרצה לא נראה חלש יותר מעסק שכבר בקצב מלא בפער גדול', () => {
  const p = basePlan();
  p.forecast.rampMonths = 3;
  p.history = { lastYearSales: 1100000 };
  const withHistory = E.computePlan(p).years[0].revenue;
  p.history = { lastYearSales: 0 };
  const fromZero = E.computePlan(p).years[0].revenue;
  assert.ok(withHistory > fromZero);
  assert.ok(withHistory > 1150000); // קרוב לקצב המלא (1.2M), לא 1.05M
});

test('תחזית: רווח תפעולי, ריבית, מס ו-DSCR מחושבים נכון בשנה 1', () => {
  const p = basePlan();
  const s = E.amortization(p.loan.amount, p.loan.ratePct, p.loan.years, 0);
  const [y1] = E.forecast(p.forecast, s);
  near(y1.revenue, 1200000);
  near(y1.ebitda, 1200000 * 0.6 - 240000 - 360000); // 120,000
  const debt1 = E.debtByYear(s)[0];
  near(y1.interest, debt1.interest);
  near(y1.tax, (120000 - debt1.interest) * 0.2);
  near(y1.dscr, (120000 - y1.tax - 120000) / debt1.payment);
});

test('תחזית: הפסד לא יוצר מס שלילי', () => {
  const p = basePlan();
  p.forecast.annualSales = 100000;
  const [y1] = E.forecast(p.forecast, E.amortization(300000, 6, 5, 0));
  assert.ok(y1.preTax < 0);
  assert.equal(y1.tax, 0);
});

test('תזרים: יתרה מתגלגלת, ההלוואה וההשקעות בחודש 1', () => {
  const p = basePlan();
  const s = E.amortization(300000, 6, 5, 0);
  const c = E.cashflow(p.forecast, 300000, p.loan.uses, s);
  assert.equal(c.length, 12);
  assert.equal(c[0].loanIn, 300000);
  assert.equal(c[0].invest, 300000);
  assert.equal(c[1].loanIn, 0);
  for (let i = 1; i < 12; i++) near(c[i].opening, c[i - 1].closing);
  near(c[0].closing, 50000 + 100000 + 300000 - (40000 + 20000 + 30000 + 10000 + s[0].payment + 300000));
});

test('dscrLevel: ספים של 1 ו-1.25', () => {
  assert.equal(E.dscrLevel(1.5).level, 'ok');
  assert.equal(E.dscrLevel(1.25).level, 'ok');
  assert.equal(E.dscrLevel(1.1).level, 'warn');
  assert.equal(E.dscrLevel(0.8).level, 'risk');
  assert.equal(E.dscrLevel(Infinity).level, 'ok');
});

test('validatePlan מתריע על חריגה מהתקרה, גרייס ארוך ושימושים שלא מסתכמים', () => {
  const p = basePlan();
  assert.deepEqual(E.validatePlan(p), []);
  p.loan.amount = 900000; p.loan.graceMonths = 12; p.loan.years = 7;
  const w = E.validatePlan(p);
  assert.equal(w.length, 4);
});

test('computePlan מחזיר תוצאה מלאה לדוגמה', () => {
  const r = E.computePlan(basePlan());
  assert.equal(r.cap, 500000);
  assert.ok(r.monthlyPayment > 0);
  assert.equal(r.years.length, 3);
  assert.ok(Array.isArray(r.negativeMonths));
});

test('הדף בעברית, RTL, ובלי שליחת נתונים לשרת', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(html, /<html[^>]*lang="he"[^>]*dir="rtl"/);
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(app), 'app.js לא אמור לשלוח נתונים');
  assert.ok(app.includes('אינו מהווה ייעוץ פיננסי'));
});

test('בלי דיאלוגים של הדפדפן (חסומים ב-claude.ai): confirm / alert / prompt', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/\b(confirm|alert|prompt)\s*\(/.test(app), 'נמצא דיאלוג חוסם');
});
