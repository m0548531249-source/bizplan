/**
 * QA שיפור 4, ספרינט 1 – סבב 2 (תמר, 28.09.2026): אימות סגירת באגים 1–4 מ-docs/QA-improvement-4-sprint1.md
 * ובדיקת רגרסיה ממוקדת. הציפיות נגזרות מהמפרט ומהתזרים, לא מהנוסח שהמפתח בחר.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');
const U = require('../app.js');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const strip = (s) => String(s == null ? '' : s).replace(/[⁦-⁩‎‏]/g, '');
const R = Math.round;

function sample() {
  const src = read('app.js');
  return new Function(`${(src.match(/const SAMPLE = \{[\s\S]*?\n  \};/) || [''])[0]}; return SAMPLE;`)();
}
function cafe(over) {
  const p = {
    business: { name: 'קפה פינת חן', isNew: true, entity: 'osek', employees: 4, years: null, field: 'בית קפה', description: 'בית קפה שכונתי' },
    owner: {}, market: {}, history: { lastYearSales: 0, lastYearProfit: 0 },
    startup: { equity: 150000, preOpenCosts: 0, deposit: 0, equipmentVat: 0,
      setupCosts: [{ item: 'ציוד ומכונות קפה', amount: 100000 }, { item: 'שיפוץ המקום', amount: 80000 }] },
    forecast: { annualSales: 1800000, rampMonths: 3, growthPct: 5, cogsPct: 30, monthlyFixed: 22000, monthlySalaries: 35000,
      ownerDrawMonthly: 12000, openingCash: 0, salesModel: 'total', daysPerMonth: 26 },
    loan: { track: 'startup', amount: 200000, ratePct: 7.5, years: 5, graceMonths: 0, purpose: 'ציוד ושיפוץ', uses: [] },
  };
  return over ? over(p) || p : p;
}
const running = (years) => ({ business: { isNew: false, years }, history: { lastYearSales: 100 }, forecast: { annualSales: 100 }, loan: {} });

// ---------- באג 1 ----------
test('סבב 2, באג 1: עסק בהקמה – משפט הרזרבה נוקב באותה יתרה שבכרטיס, ומוצג מיד אחרי כרטיסי המדדים', () => {
  const p = cafe(); const res = E.computePlan(p);
  const note = strip(E.reserveNote(p, res));
  assert.ok(note.includes(E.num(R(res.cushion.min))), 'הסכום במשפט = היתרה הנמוכה בכרטיס');
  assert.match(note, /^כל היתרה הנמוכה ביותר/, 'כל היתרה היא הון חוזר – ניסוח "כל", בלי "מתוך X, סכום של X"');
  // בממשק: בתוך metricsHtml, אחרי סגירת section של המדדים
  assert.match(read('app.js'), /<\/section>\$\{reserve \? `<p class="note reserve-note" id="reserve-note">\$\{dt\(reserve\)\}<\/p>` : ''\}/);
});

test('סבב 2, באג 1: ניסוח חלקי כשרק חלק מהיתרה הוא רזרבה (בלי הרצה), ואין משפט בעסק פועל או כשאין הון חוזר', () => {
  const p = cafe((q) => { q.forecast.rampMonths = 0; }); const res = E.computePlan(p);
  const note = strip(E.reserveNote(p, res));
  // 183,234 → 183,196 בשיפור 4 ספרינט 2 (ב2): המס בחודשים עם מחזור זהה שווה, ולכן הפיזור בתוך השנה זז מעט
  assert.match(note, /^מתוך היתרה הנמוכה ביותר בתזרים \(183,196\s*₪\), סכום של 170,000\s*₪/);
  assert.equal(E.reserveNote(sample(), E.computePlan(sample())), '', 'עסק פועל (הדוגמה) – אין משפט רזרבה');
  const noWc = cafe((q) => { q.startup.equity = 180000; q.loan.amount = 0; });
  assert.equal(E.reserveNote(noWc, E.computePlan(noWc)), '', 'אין הון חוזר – אין משפט');
});

// ---------- באג 2 ----------
test('סבב 2, באג 2: הוותק לא מעוגל ובעברית תקינה, בכל שלושת המקומות (תקציר, סטטוס, אזהרת מסלול)', () => {
  const want = { 0.5: 'חצי שנה', 1: 'שנה', 1.5: 'שנה וחצי', 2: 'שנתיים', 2.5: 'שנתיים וחצי', 3: '3 שנים', 3.5: '3 שנים וחצי', 12.5: '12 שנים וחצי' };
  for (const [y, t] of Object.entries(want)) {
    assert.equal(strip(E.yearsText(Number(y))), t, y);
    assert.equal(strip(E.businessStatus(running(Number(y))).value), `עסק פועל ${t}`, y);
  }
  // תקציר: אותה פונקציה, לא N()
  const app = read('app.js');
  assert.ok(!/N\(b\.years\)/.test(app));
  assert.match(app, /פועל \$\{dt\(E\.yearsText\(b\.years\)\)\}/);
  // אזהרת מסלול (א1)
  for (const [y, t] of [[1.5, 'שנה וחצי'], [2, 'שנתיים'], [1, 'שנה']]) {
    const w = E.consistencyChecks({ business: { isNew: false, years: y, employees: 1 }, history: {}, forecast: {}, loan: { track: 'startup', uses: [] } })
      .find((c) => c.code === 'trackVsYears');
    assert.ok(strip(w.message).includes(`העסק פועל ${t}.`), y);
  }
  // שום ערך לא מודפס כ"1 שנים"/"2 שנים"
  for (let y = 0.5; y <= 30; y += 0.5) assert.ok(!/(^|\s)[12] שנים/.test(strip(E.yearsText(y))), String(y));
});

test('סבב 2, באג 2: ותק ארוך בטבלת "סטטוס" – עד 21 תווים עד 99.5 שנים (נשבר לשתי שורות בטלפון, בלי גלילה לרוחב – נבדק בדפדפן)', () => {
  let max = 0;
  for (let y = 0.5; y < 100; y += 0.5) max = Math.max(max, strip(E.businessStatus(running(y)).value).length);
  assert.ok(max <= 21, String(max));
});

test('קוסמטי (סבב 2): ותק של רבע שנה מעל שנה מעוגל – 1.25 מודפס "1.3 שנים" (15 חודשים), 2.75 מודפס "2.8 שנים"', () => {
  assert.ok(!/1\.3/.test(strip(E.yearsText(1.25))), strip(E.yearsText(1.25)));
});

// ---------- באג 3 ----------
test('סבב 2, באג 3: 1,300,000 מול 1,000,000 לא דורש הסבר, 1,300,001 כן; הממשק והמנוע מסכימים בכל הגבול', () => {
  const mk = (a, b) => ({ business: { isNew: false, years: 3 }, history: { lastYearSales: a }, forecast: { annualSales: b } });
  assert.equal(U.jumpInfo(mk(1000000, 1300000)).needed, false);
  assert.equal(U.jumpInfo(mk(1000000, 1300001)).needed, true);
  for (const [a, b] of [[700000, 910000], [1150000, 1495000], [100, 130]]) assert.equal(U.jumpInfo(mk(a, b)).needed, false, `${a}→${b}`);
  for (let a = 1000; a <= 3000000; a += 997) {
    const p = mk(a, R(a * 1.3));
    assert.equal(U.jumpInfo(p).needed, E.salesJump(p).needsReason, `${a}`);
  }
});

// ---------- באג 4 ----------
test('סבב 2, באג 4: אזהרת עלות מכר אומרת כמה באמת נשאר מכל 100 ₪', () => {
  const msg = (v) => strip(E.consistencyChecks({ business: { isNew: false, years: 2, employees: 1 }, history: {}, forecast: { cogsPct: v }, loan: { uses: [] } })
    .find((c) => c.code === 'cogsHigh').message);
  assert.match(msg(90), /הולכים 90 ₪[\s\S]*נשארים רק 10 ₪/);
  assert.match(msg(99), /נשארים רק 1 ₪/);
});

// ---------- רגרסיה ----------
test('סבב 2, רגרסיה: הדוגמה – יתרה נמוכה 38,142 ₪ בחודש 1, יחס כיסוי 1.88, בלי חודשי מינוס (בסיס לכותרת "בקשה חזקה")', () => {
  const res = E.computePlan(sample());
  assert.equal(R(res.cushion.min), 38142);
  assert.equal(res.negativeMonths.length, 0);
  assert.equal(E.num(res.minDscr, 2), '1.88');
  assert.equal(res.cash[0].working, 75000);
});

test('סבב 2, רגרסיה: עסק בהקמה (קפה פינת חן) – יתרה נמוכה 101,699 ₪, בלי מינוס', () => {
  const res = E.computePlan(cafe());
  assert.equal(R(res.cushion.min), 101699);
  assert.equal(res.negativeMonths.length, 0);
});
