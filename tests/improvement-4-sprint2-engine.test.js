/**
 * שיפור 4, ספרינט 2 – צד המנוע (אורי, 29.09.2026).
 * מקור: docs/IMPROVEMENT-4-SOURCE-v2.md, סעיפים ב2, ב3, ב5 ו-ה'.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');

const ROOT = path.join(__dirname, '..');
const strip = (s) => String(s == null ? '' : s).replace(/[⁦-⁩‎‏]/g, '');
const sum = (a) => a.reduce((s, x) => s + x, 0);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} צפוי ${b} (±${tol}), התקבל ${a}`);

/** התוכנית לדוגמה (המאפייה) – נקראת מ-app.js כדי לבדוק בדיוק את מה שהמשתמש רואה */
function sample() {
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const m = app.match(/const SAMPLE = (\{[\s\S]*?\n  \});/);
  return Function(`return (${m[1]});`)();
}

/** עסק פועל שהשנה הקשה שלו היא שנה 2: גרייס 12 חודשים, ואחריו החזר גבוה מהמזומן הפנוי */
function shop(over) {
  const p = {
    business: { name: 'מכולת', entity: 'osek', years: 4, employees: 0, isNew: false, description: 'מכולת שכונתית' },
    owner: { name: 'א', experience: 'ארבע שנים', education: '' },
    market: { customers: 'x', competitors: '', pricing: '', advantage: 'x' },
    history: { lastYearSales: 1200000, lastYearProfit: 100000 },
    startup: { openDate: '', equity: 0, setupCosts: [], preOpenCosts: 0, deposit: 0, equipmentVat: 0 },
    forecast: { annualSales: 1200000, rampMonths: 0, growthPct: 0, cogsPct: 80, monthlyFixed: 0, monthlySalaries: 0,
      ownerDrawMonthly: 10000, openingCash: 30000, salesModel: 'total' },
    loan: { track: 'general', amount: 600000, ratePct: 7.5, years: 5, graceMonths: 12, purpose: 'מקררים',
      uses: [{ item: 'מקררים', amount: 600000, type: 'capex' }] },
  };
  if (over) over(p);
  return p;
}

// ---------- ב2 ----------
test('ב2: במאפייה המס בחודשים 3–12 (מכירות קבועות) זהה בדיוק, בלי מגמה, והסכום = המס השנתי', () => {
  const r = E.computePlan(sample());
  const full = r.taxByMonth.slice(2);
  assert.ok(Math.max(...full) - Math.min(...full) < 1e-6, full.map(Math.round).join(', '));
  near(sum(r.taxByMonth), r.annualTax, 0.01);
  // חודשי ההרצה נשארים כמו שהיו (5,150 ו-7,760), ולכן היתרה הנמוכה בדוגמה לא זזה
  near(r.taxByMonth[0], 5150, 5);
  near(r.taxByMonth[1], 7760, 5);
  near(r.cushion.min, 38142, 1);
});

test('ב2: מוצג בעיגול לעשרות (כמו בטבלה) – אותו מספר ב-10 החודשים, לא 10,370 → 10,420', () => {
  const shown = E.computePlan(sample()).taxByMonth.slice(2).map((t) => Math.round(t / 10) * 10);
  assert.equal(new Set(shown).size, 1, shown.join(', '));
});

test('ב2: taxSpread ישירות – מכירות קבועות וריבית יורדת → 12 תשלומים שווים; הדרגה → חודשים שונים לפי מחזור', () => {
  const f = { annualSales: 1200000, currentSales: 1200000, rampMonths: 0, cogsPct: 50, monthlyFixed: 10000, monthlySalaries: 10000 };
  const sched = Array.from({ length: 12 }, (_, i) => ({ interest: 3000 - 100 * i }));
  for (const t of E.taxSpread(f, 12000, sched)) near(t, 1000, 1e-9);
  const ramp = E.taxSpread({ ...f, currentSales: 0, rampMonths: 3 }, 12000, sched);
  assert.ok(ramp[0] < ramp[1] && ramp[1] < ramp[2] && ramp[2] < ramp[3], ramp.map(Math.round).join(', '));
  const rest = ramp.slice(3);
  assert.ok(Math.max(...rest) - Math.min(...rest) < 1e-9);
  near(sum(ramp), 12000, 1e-6);
});

// ---------- ב3 ----------
test('ב3: במאפייה הסף "חודש של הוצאות" כולל עלות מכר – כ-100,000 ולא 50,000', () => {
  const c = E.computePlan(sample()).cushion;
  near(c.threshold, 99479, 1);
  near(c.thresholdParts.fixed, 20000, 0.01);
  near(c.thresholdParts.salaries, 30000, 0.01);
  near(c.thresholdParts.cogs, 49479, 1);
  assert.equal(c.level, 'warn');
});

test('ב3: בלי עלות מכר הסף נשאר קבועות + שכר; baseRows קובע ממוצע עלות מכר', () => {
  const p = sample(); p.forecast.cogsPct = 0;
  near(E.computePlan(p).cushion.threshold, 50000, 0.01);
  const rows = [{ month: 1, closing: 10, cogs: 0 }, { month: 2, closing: 5, cogs: 0 }];
  const c = E.cashCushion(rows, { monthlyFixed: 1000 }, [{ cogs: 400 }, { cogs: 600 }]);
  near(c.threshold, 1500, 1e-9);
  assert.equal(c.month, 2);
});

test('ב3 ניסוח: הודעת החודש הדחוק מזכירה עלות מכר', () => {
  const note = strip(E.thinMonthNote(E.computePlan(sample()).cushion));
  assert.match(note, /עלות מכר/);
});

// ---------- ב5 ----------
test('ב5: computePlan מחזיר תזרים לכל תקופת ההלוואה; שנה 1 זהה לטבלת התזרים', () => {
  const r = E.computePlan(sample());
  assert.equal(r.cashPeriod.length, 60);
  for (let m = 0; m < 12; m++) near(r.cashPeriod[m].closing, r.cash[m].closing, 1e-6);
  assert.equal(r.cashPeriod[12].year, 2);
  assert.equal(r.cashPeriod[12].monthInYear, 1);
  near(r.cashPeriod[12].opening, r.cash[11].closing, 1e-6);
  near(sum(r.cashPeriod.slice(12, 24).map((c) => c.tax)), r.years[1].tax, 0.01);
  near(sum(r.cashPeriod.slice(12, 24).map((c) => c.debt)), r.years[1].debtService, 0.01);
  assert.ok(r.cushionPeriod.min <= r.cushion.min);
  near(r.cushionPeriod.threshold, r.cushion.threshold, 1e-6, 'אותו סף כמו בשנה 1');
});

test('ב5: הלוואה של שנה אחת או בלי הלוואה – 12 חודשים בלבד', () => {
  const p = sample(); p.loan.years = 1; p.loan.graceMonths = 0;
  assert.equal(E.computePlan(p).cashPeriod.length, 12);
  const q = sample(); q.loan.amount = 0;
  assert.doesNotThrow(() => E.scenarios(q));
});

test('ב5: במכולת (גרייס 12) היתרה הנמוכה בתרחישים היא אחרי חודש 12 ושלילית, בזמן ששנה 1 חיובית', () => {
  const p = shop();
  const r = E.computePlan(p);
  assert.ok(r.cash.every((c) => c.closing > 0), 'שנה 1 חיובית');
  const s = Object.fromEntries(E.scenarios(p).map((x) => [x.key, x]));
  assert.ok(s.base.minCashMonth > 12, `חודש ${s.base.minCashMonth}`);
  assert.ok(s.base.minCash < 0);
  assert.ok(s.base.minCashYear1 > 0, 'היתרה הנמוכה בשנה 1 בלבד – להשוואה');
  assert.equal(s.base.minCashYear, Math.ceil(s.base.minCashMonth / 12));
  assert.equal(s.base.level, 'risk');
  assert.ok(s.base.negativeMonths > 0);
  assert.equal(s.base.periodMonths, 60);
  const note = strip(E.scenarioNote(E.scenarios(p)));
  assert.match(note, /כבר בתחזית הבסיס/);
  assert.match(note, /בשנה (השנייה|השלישית|הרביעית|החמישית)/);
  assert.ok(!/--/.test(note), note);
});

test('ב5: periodMonthText – שנה 1 כמו קודם, אחריה "חודש X בשנה ה..."', () => {
  assert.equal(E.periodMonthText(3), 'חודש 3');
  assert.equal(E.periodMonthText(13), 'חודש 1 בשנה השנייה');
  assert.equal(E.periodMonthText(60), 'חודש 12 בשנה החמישית');
  assert.equal(E.periodMonthText(150), 'חודש 6 בשנה 13');
});

test('ב5: במאפייה בתרחיש הבסיס החודש הקשה נשאר חודש 1 (השנים הבאות חזקות יותר)', () => {
  const base = E.scenarios(sample()).find((s) => s.key === 'base');
  assert.equal(base.minCashMonth, 1);
  near(base.minCash, 38142, 1);
  assert.equal(base.minCashText, 'חודש 1');
});

// ---------- ה ----------
test('ה: taxSpread(null) לא זורק', () => {
  assert.doesNotThrow(() => E.taxSpread(null, 1200, null));
  near(sum(E.taxSpread(null, 1200, null)), 1200, 1e-9);
});

test('ה: עלות מכר 150% – מחזירה חסימה/אזהרה על שדה עלות המכר, ו-computePlan לא קורס', () => {
  const p = sample(); p.forecast.cogsPct = 150;
  const res = E.computePlan(p);
  const c = res.consistency.find((x) => x.field === 'forecast.cogsPct');
  assert.ok(c, 'אין התרעה על עלות מכר 150%');
  assert.equal(c.code, 'cogsOver100');
});

test('ה: הערת התרחישים – כשתרחיש הבסיס עצמו במינוס, זה נאמר ראשון', () => {
  const p = sample(); p.forecast.openingCash = -200000;
  const note = strip(E.scenarioNote(E.scenarios(p)));
  assert.match(note, /כבר בתחזית הבסיס/);
});

test('ה: עסק פועל עם חודשי מינוס – ניסוחי המנוע לא קובעים "מסגרת אשראי קיימת"', () => {
  for (const t of [E.bridgeText(false, 0, -5000), E.thinCushionText(false, 0, 5000)]) {
    assert.ok(!/מסגרת אשראי קיימת/.test(strip(t)), t);
  }
  const n = strip(E.negativeMonthNote({ level: 'risk', min: -5000, month: 3 }, [3], false));
  assert.ok(!/מסגרת אשראי קיימת/.test(n) && /לבדוק מול הבנק/.test(n), n);
});
