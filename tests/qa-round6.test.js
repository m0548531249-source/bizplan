/**
 * סבב QA 6 (תמר, 27.09.2026) – בדיקה עצמאית של שני התיקונים מסבב 5, על התוצר החי.
 *
 * הבדיקות כאן לא מסתמכות על פונקציות העזר של המנוע לחישוב הצפוי: כל מספר צפוי
 * מחושב כאן מחדש מהשיעורים הרשמיים ומהנוסחאות, כדי שתקלה במנוע לא "תאשר את עצמה".
 *
 * מקרה הבדיקה: "קפה פינת חן" – עסק בהקמה, עוסק מורשה, מחזור 1,800,000 ₪,
 * הלוואה 200,000 ₪ ל-5 שנים ב-7.5%, הון עצמי 60,000 ₪, עלויות הקמה 180,000 ₪.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const R = (n) => Math.round(n);
const strip = (s) => String(s == null ? '' : s).replace(/[⁦-⁩‎‏]/g, '');
const close = (a, b, tol = 1) => Math.abs(a - b) <= tol;

function cafe(over) {
  return {
    business: { name: 'קפה פינת חן', isNew: true, entity: 'osek', employees: 4, city: 'ירושלים', years: 0,
      field: 'בית קפה שכונתי', description: 'בית קפה שכונתי עם אפייה במקום' },
    owner: { name: 'אריאל כהן', experience: 'שבע שנים ברשת בתי קפה', education: '' },
    market: { customers: 'תושבי השכונה', competitors: 'שתי רשתות', pricing: 'מחירים דומים', advantage: 'אפייה במקום' },
    history: { lastYearSales: 0, lastYearProfit: 0 },
    startup: { equity: 60000, openDate: 'יוני 2027', preOpenCosts: 0, deposit: 0, equipmentVat: 0,
      setupCosts: [{ item: 'רכישת ציוד ומכונות קפה:', amount: 100000 }, { item: 'שיפוץ ועיצוב', amount: 80000 }] },
    forecast: { annualSales: 1800000, rampMonths: 3, growthPct: 5, cogsPct: 30, monthlyFixed: 22000,
      monthlySalaries: 35000, ownerDrawMonthly: 12000, openingCash: 0, salesModel: 'total', daysPerMonth: 26 },
    loan: { track: 'startup', amount: 200000, ratePct: 7.5, years: 5, graceMonths: 0,
      purpose: 'רכישת ציוד ושיפוץ הנכס', uses: [{ item: '', amount: 0, type: 'capex' }] },
    ...(over || {}),
  };
}

// ---------- חישוב מס עצמאי, מהשיעורים הרשמיים של 2025 ----------
// עצמאי: עד 60% מהשכר הממוצע (7,522 ₪ לחודש → 90,264 ₪ לשנה) 2.87% ביטוח לאומי + 3.10%
// ביטוח בריאות = 5.97%. מעל זה ועד התקרה (49,030 ₪ לחודש → 588,360 ₪ לשנה)
// 12.83% + 5.00% = 17.83%. מעל התקרה אין חיוב.
const NI_LOW_CAP = 90264, NI_CEIL = 588360;
function myNi(profit) {
  const inc = Math.min(Math.max(0, profit), NI_CEIL);
  const low = Math.min(inc, NI_LOW_CAP), high = Math.max(0, inc - NI_LOW_CAP);
  return { paid: low * 0.0597 + high * 0.1783, insuranceOnly: low * 0.0287 + high * 0.1283 };
}
function myBracketTax(x) {
  const br = [[84120, 10], [120720, 14], [193800, 20], [269280, 31], [560280, 35], [721560, 47], [Infinity, 50]];
  let left = Math.max(0, x), prev = 0, t = 0;
  for (const [upTo, pct] of br) { const s = Math.min(left, upTo - prev); if (s <= 0) break; t += s * pct / 100; left -= s; prev = upTo; }
  return t;
}
function myOsekTax(profit) {
  const ni = myNi(profit);
  // רק רכיב הביטוח הלאומי מוכר כהוצאה (52% ממנו); דמי ביטוח הבריאות אינם מוכרים.
  const incomeTax = Math.max(0, myBracketTax(profit - ni.insuranceOnly * 0.52) - 2.25 * 2904);
  return { ni: ni.paid, incomeTax, total: incomeTax + ni.paid };
}

test('QA6 סעיף 3: ביטוח לאומי לעצמאי לפי שיעורי 2025 המלאים, כולל ביטוח בריאות', () => {
  // המספר שמופיע במסמך של "קפה פינת חן": רווח לפני מס בשנה הראשונה.
  const got = E.taxFor(404662, 'osek');
  assert.ok(close(got.ni, 61445.92, 1), `ביטוח לאומי ${R(got.ni)} במקום 61,446`);
  assert.ok(got.ni > 60000, 'בלי רכיב הבריאות היה יוצא 42,928 – זה בדיוק הבאג של סבב 5');
  assert.ok(close(got.incomeTax, myOsekTax(404662).incomeTax, 1), 'מס הכנסה לא זז בגלל התיקון');
});

test('QA6 סעיף 3: אותה נוסחה נכונה בכל טווח ההכנסות, כולל התקרה', () => {
  [0, 1, 50000, 90263, 90264, 90265, 200000, 404662, 588359, 588360, 700000, 5000000].forEach((profit) => {
    const mine = myOsekTax(profit), got = E.taxFor(profit, 'osek');
    assert.ok(close(got.ni, mine.ni, 1), `רווח ${profit}: ב"ל ${R(got.ni)} מול ${R(mine.ni)}`);
    assert.ok(close(got.total, mine.total, 1), `רווח ${profit}: סה"כ מס ${R(got.total)} מול ${R(mine.total)}`);
  });
  // מעל התקרה דמי הביטוח קופאים
  assert.equal(R(E.taxFor(700000, 'osek').ni), R(E.taxFor(5000000, 'osek').ni));
  assert.ok(close(E.taxFor(700000, 'osek').ni, 94199, 2), 'התקרה: 90,264×5.97% + 498,096×17.83%');
});

test('QA6 סעיף 3: הרווח לא "מיופה" – ההפרש מול החישוב הישן הוא בדיוק רכיב הבריאות', () => {
  const profit = 404662;
  const healthComponent = myNi(profit).paid - myNi(profit).insuranceOnly; // 3.10% ו-5.00%
  assert.ok(close(E.taxFor(profit, 'osek').ni - myNi(profit).insuranceOnly, healthComponent, 1),
    `רכיב הבריאות שנוסף: ${R(healthComponent)} ₪ לשנה`);
  assert.ok(healthComponent > 18000 && healthComponent < 19000, 'כ-18,500 ₪ לשנה');
});

test('QA6 סעיף 4: חברה בע"מ – מס חברות בלבד, בלי ביטוח לאומי, לא הושפעה מהתיקון', () => {
  [0, 100000, 404662, 1000000].forEach((profit) => {
    const co = E.taxFor(profit, 'company');
    assert.equal(co.ni, 0, 'לחברה אין שורת ביטוח לאומי');
    assert.ok(close(co.total, Math.max(0, profit) * 0.23, 0.5), `מס חברות על ${profit}`);
    if (profit > 0) assert.ok(close(co.effectivePct, 23, 0.01));
  });
  assert.equal(R(E.taxFor(404662, 'company').total), 93072);
  // שותפות מחושבת כמו עוסק מורשה (שותף אחד)
  assert.equal(R(E.taxFor(404662, 'partnership').ni), R(E.taxFor(404662, 'osek').ni));
});

test('QA6 סעיף 5: טבלת היעד של מאיר (monthlyTax=0) לא זזה', () => {
  const p = cafe();
  const rows = E.cashflow({ ...p.forecast, currentSales: 0, entity: 'osek', openingCash: 0 },
    p.loan.amount, E.planUses(p), E.amortization(200000, 7.5, 5, 0), E.equityInflow(p),
    { capex: E.investmentTotal(p), monthlyTax: 0 });
  [[0, 33242], [1, 12735], [2, 18477], [11, 306409]].forEach(([i, want]) =>
    assert.equal(R(rows[i].closing), want, `חודש ${i + 1}`));
  // וגם בחישוב עצמאי לגמרי, בלי המנוע
  const pay = 200000 * (0.075 / 12) / (1 - Math.pow(1 + 0.075 / 12, -60));
  let cash = 0;
  const mine = [];
  for (let m = 1; m <= 12; m++) {
    const rev = 150000 * Math.min(1, m / 4);
    cash += rev - (rev * 0.3 + 22000 + 35000 + 12000 + pay + (m === 1 ? 180000 - 260000 : 0));
    mine.push(cash);
  }
  [[0, 33242], [1, 12735], [2, 18477], [11, 306409]].forEach(([i, want]) => assert.ok(close(R(mine[i]), want, 1)));
});

test('QA6 סעיף 1: במקרה "קפה פינת חן" אין הצהרה על הון חוזר כמקור גישור', () => {
  // מאז פריסת המס לפי הפעילות בפועל (27.09.2026) התזרים של "קפה פינת חן" לא נכנס למינוס,
  // ולכן הענף הזה נבדק על אותו עסק עם משיכת בעלים של 20,000 ₪ (מינוס בחודשים 2–4).
  const p = cafe();
  p.forecast = { ...p.forecast, ownerDrawMonthly: 20000 };
  const res = E.computePlan(p);
  assert.deepEqual(res.negativeMonths, [2, 3, 4], 'התזרים נכנס למינוס');
  assert.ok(res.cushion.min < 0, 'היתרה הנמוכה ביותר שלילית – ההון החוזר כבר נוצל');
  const text = strip(E.bridgeText(true, E.workingCapitalTotal(p), res.cash));
  assert.ok(!/ההון החוזר/.test(text), `המשפט מפנה לכסף שכבר נוצל: ${text}`);
  assert.ok(/דחיית חלק מההשקעות/.test(text) && /גרייס/.test(text), 'ובמקומו מוצעים מקורות אמיתיים');
  // גם כשלא מועבר מסלול תזרים כלל – ברירת המחדל שמרנית
  assert.ok(!/ההון החוזר/.test(strip(E.bridgeText(true, 80000))));
});

test('QA6 סעיף 2: המקרה ההפוך – כשההון החוזר באמת נשאר, המשפט כן מפנה אליו', () => {
  const wc = 200000;
  const cash = [{ month: 1, closing: 150000 }, { month: 2, closing: 80000 }, { month: 3, closing: 120000 }];
  const text = strip(E.bridgeText(true, wc, cash));
  assert.ok(/ההון החוזר שנותר בחשבון/.test(text), `התיקון הסיר את ההפניה גם כשהיא נכונה: ${text}`);
  assert.ok(/80,000/.test(text), 'והסכום הוא מה שבאמת נשאר בנקודה הנמוכה, לא סך ההון החוזר');
  // וכשההון החוזר קטן מהיתרה – מציגים את ההון החוזר, לא את כל היתרה
  assert.ok(/50,000/.test(strip(E.bridgeText(true, 50000, cash))));
  // עסק פועל: ניסוח נפרד, מסגרת אשראי קיימת
  assert.equal(strip(E.bridgeText(false, wc, cash)), 'העסק יגשר על כך באמצעות מסגרת אשראי קיימת או דחיית חלק מההשקעות.');
});

test('QA6 סעיף 2: הכלל עצמו – כמה הון חוזר באמת נשאר בנקודה הנמוכה', () => {
  assert.equal(E.unusedWorkingCapital(80000, [{ closing: 120000 }, { closing: 30000 }], 0), 30000, 'תקרה: היתרה בפועל');
  assert.equal(E.unusedWorkingCapital(80000, [{ closing: 120000 }, { closing: 90000 }], 0), 80000, 'תקרה: ההון החוזר עצמו');
  assert.equal(E.unusedWorkingCapital(80000, [{ closing: -1 }], 0), 0, 'יתרה שלילית – לא נשאר כלום');
  assert.equal(E.unusedWorkingCapital(80000, { min: -18031 }, 0), 0, 'גם כשמעבירים אובייקט מרווח');
});

test('QA6 סעיף 2: מסלול ה-warn שבמסמך עדיין מפנה להון החוזר (התיקון לא גלש)', () => {
  const p = cafe({ forecast: { ...cafe().forecast, ownerDrawMonthly: 0 } });
  const res = E.computePlan(p);
  assert.equal(res.cushion.level, 'warn', 'יתרה חיובית אך מתחת לחודש הוצאות');
  assert.ok(res.cushion.min > 0);
  const text = strip(E.thinCushionText(true, E.workingCapitalTotal(p)));
  assert.ok(/ההון החוזר/.test(text), `בענף הזה ההפניה נכונה ואסור שתיעלם: ${text}`);
});

test('QA6 סעיף 8: סבירות – התזרים, המס וה-DSCR מתיישבים עם חישוב ידני', () => {
  const res = E.computePlan(cafe());
  const y1 = res.years[0];
  // מחזור שנה 1 בהרצה של 3 חודשים
  let rev = 0;
  for (let m = 1; m <= 12; m++) rev += 150000 * Math.min(1, m / 4);
  assert.equal(R(y1.revenue), R(rev));
  assert.equal(R(y1.ebitda), R(rev * 0.7 - 264000 - 420000));
  assert.ok(close(y1.tax, myOsekTax(y1.preTax).total, 1), 'המס במסמך = החישוב הידני');
  assert.ok(y1.net > 0 && y1.net < y1.preTax, 'רווח נקי חיובי וקטן מהרווח לפני מס');
  // DSCR ידני
  const cfads = y1.ebitda - y1.tax - 144000;
  assert.ok(close(y1.dscr, cfads / (E.amortization(200000, 7.5, 5, 0).slice(0, 12).reduce((s, r) => s + r.payment, 0)), 0.01));
  assert.ok(res.minDscr > 1.25, `DSCR מינימלי ${res.minDscr.toFixed(2)} – עדיין מעל הסף גם אחרי תיקון המס`);
  // פריסת המס (27.09.2026): כל יתרה = הטבלה בלי מס פחות המס שנגבה עד אותו חודש, לא פחות.
  // בחודשים 1–2 העסק בהפסד תפעולי ואין מקדמה, ולכן המינוס שנבע מ-1/12 קבוע נעלם.
  const paidBy = (i) => res.cash.slice(0, i + 1).reduce((s, c) => s + c.tax, 0);
  assert.equal(R(res.cash[0].tax), 0, 'חודש 1 – אין מקדמת מס בחודש הפסד');
  assert.ok(close(paidBy(11), y1.tax, 0.01), 'וסך המקדמות = המס השנתי במלואו');
  [[0, 33242], [1, 12735], [2, 18477], [11, 306409]].forEach(([i, noTax]) =>
    assert.ok(close(res.cash[i].closing, noTax - paidBy(i), 2),
      `חודש ${i + 1}: ${R(res.cash[i].closing)} = ${noTax} פחות ${R(paidBy(i))} מס`));
  // ורכיב דמי ביטוח הבריאות (QA5 באג חוסם 2) עדיין בתוך המס שנגבה בתזרים
  assert.ok(close(paidBy(11), myOsekTax(y1.preTax).incomeTax + myNi(y1.preTax).paid, 1),
    'המס שנגבה בתזרים = מס הכנסה + דמי ביטוח לאומי ובריאות, בחישוב ידני');
  // התזרים מתיישב עם עצמו
  res.cash.forEach((c, i) => {
    assert.ok(close(c.closing, c.opening + c.inflow - c.outflow, 0.5), `חודש ${i + 1}`);
    if (i) assert.ok(close(c.opening, res.cash[i - 1].closing, 0.5));
  });
});

test('QA6 סעיף 8: אותו מקרה כחברה בע"מ – מספרים סבירים ובלי ביטוח לאומי בתזרים', () => {
  const res = E.computePlan(cafe({ business: { ...cafe().business, entity: 'company' } }));
  assert.equal(res.years[0].ni, 0);
  assert.ok(close(res.years[0].tax, res.years[0].preTax * 0.23, 1));
  assert.ok(close(res.monthlyTax, res.years[0].tax / 12, 0.5), 'monthlyTax הוא הממוצע החודשי בלבד');
  // מס חברות שטוח (23%) חל על הרווח השנתי, אבל המקדמות עדיין נגזרות מהפעילות של כל חודש:
  // בחודשי ההפסד אין מקדמה, וסך המס בתזרים = המס השנתי. הפריסה לא שינתה את הסכום.
  assert.ok(close(res.cash.reduce((s, c) => s + c.tax, 0), res.years[0].tax, 0.01));
  assert.equal(R(res.cash[0].tax), 0, 'חודש הפסד – אין מקדמה גם בחברה');
  assert.ok(res.cash[11].tax > res.years[0].tax / 12, 'ובקצב מלא המקדמה גבוהה מהממוצע');
  const osek = E.computePlan(cafe());
  assert.ok(res.cushion.min > osek.cushion.min && res.cushion.min > 0,
    `מרווח רחב יותר מאשר בעוסק, כי מס החברות נמוך מהמס האישי (${R(res.cushion.min)})`);
  assert.ok(res.minDscr > osek.minDscr, 'DSCR גבוה יותר – פחות מס');
});
