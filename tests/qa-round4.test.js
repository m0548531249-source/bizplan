/**
 * סבב QA 4 – גל א': חמשת הבאגים החוסמים שמאיר מצא במוצר החי, ועוד שורת המס בתזרים.
 * #1 ההון העצמי נספר פעמיים · #2 ההשקעות בתזרים מול עלויות ההקמה · #3 מקור אמת אחד
 * ושלוש בדיקות חוסמות · #4 מס לפי צורת ההתאגדות · #5 סף היתרה המינימלית · ת1 שורת מס בתזרים.
 *
 * הבדיקות כאן הן בדיקות התאמה מספרית בין פרקי המסמך, ולא בדיקות "האם הקוד מכיל מחרוזת" –
 * זו הסיבה ש-101 בדיקות ירוקות לא תפסו אף אחד מ-24 הסעיפים (ממצא ת4 של תמר).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const ROUND = (n) => Math.round(n);

/**
 * "קפה פינת חן" – מקרה הבדיקה של מאיר, כפי ששוחזר ואומת בדוח QA של תמר.
 * openingCash 60,000 יחד עם equity 60,000 הוא בדיוק התרחיש שחשף את באג #1.
 */
function cafe(over) {
  return {
    business: { name: 'קפה פינת חן', isNew: true, entity: 'osek', employees: 4, city: 'ירושלים', years: 0, field: 'בית קפה', description: 'בית קפה שכונתי' },
    owner: { name: 'אריאל', experience: 'ניהול משמרת ברשת בתי קפה' },
    market: { customers: 'תושבי השכונה', competitors: 'שתי רשתות', advantage: 'אפייה במקום' },
    history: { lastYearSales: 0, lastYearProfit: 0 },
    startup: { equity: 60000, openDate: 'יוני 2027', setupCosts: [{ item: 'ציוד ומכונות קפה', amount: 100000 }, { item: 'שיפוץ ועיצוב', amount: 80000 }] },
    forecast: { annualSales: 1800000, rampMonths: 3, growthPct: 5, cogsPct: 30, monthlyFixed: 22000, monthlySalaries: 35000, ownerDrawMonthly: 12000, openingCash: 60000 },
    loan: {
      track: 'startup', amount: 200000, ratePct: 7.5, years: 5, graceMonths: 0, purpose: 'ציוד ושיפוץ',
      uses: [{ item: 'כישת מכונות קפה וציוד מטבח מתקדם', amount: 120000, type: 'capex' }, { item: 'הון חוזר', amount: 80000, type: 'working' }],
    },
    ...(over || {}),
  };
}

// ---------- באג #1: ההון העצמי נספר פעם אחת בלבד ----------

test('#1 הון עצמי: בעסק בהקמה יתרת הפתיחה בחודש 1 היא 0, וההון נכנס פעם אחת כתקבול', () => {
  const res = E.computePlan(cafe());
  assert.equal(res.cash[0].opening, 0, 'אין יתרת פתיחה לעסק שעוד לא נפתח');
  assert.equal(res.cash[0].equityIn, 60000);
  const equityTimes = res.cash.reduce((s, c) => s + (Number(c.equityIn) || 0), 0);
  // המבחן שתופס את הבאג: הכסף של הבעלים נכנס בסך הכול פעם אחת, לא פעמיים
  assert.equal(res.cash[0].opening + equityTimes, 60000, 'ההון העצמי נספר פעם אחת בלבד');
});

test('#1 הון עצמי: הזנה כפולה של אותו סכום בשני השדות לא מנפחת את התזרים', () => {
  const withOpening = E.computePlan(cafe());
  const withoutOpening = E.computePlan(cafe({
    startup: { equity: 60000, openDate: 'יוני 2027', setupCosts: [{ item: 'ציוד ומכונות קפה', amount: 100000 }, { item: 'שיפוץ ועיצוב', amount: 80000 }] },
    forecast: { ...cafe().forecast, openingCash: 0 },
  }));
  withOpening.cash.forEach((c, i) => near(c.closing, withoutOpening.cash[i].closing, 0.001));
});

test('#1 הון עצמי: בעסק פועל המזומן בחשבון נשאר יתרת פתיחה אמיתית', () => {
  const existing = cafe({ business: { name: 'קפה ותיק', isNew: false, entity: 'osek', years: 5, employees: 4, field: 'בית קפה', description: 'x' } });
  const res = E.computePlan(existing);
  assert.equal(res.cash[0].opening, 60000, 'לעסק פועל יש באמת כסף בחשבון');
  assert.equal(res.cash[0].equityIn, 0, 'ולא שואלים אותו על הון עצמי');
});

test('#1 הממשק: עסק בהקמה לא נשאל יותר "כמה כסף יהיה בחשבון ביום הפתיחה"', () => {
  const app = read('app.js');
  assert.ok(!app.includes('כמה כסף יהיה בחשבון ביום הפתיחה'), 'השאלה הכפולה הוסרה');
  assert.ok(!/k: 'forecast\.openingCash', label: '[^']*', type: 'money', onlyNew/.test(app), 'אין שדה כסף כזה לעסק בהקמה');
  assert.ok(app.includes("if (out.business.isNew === true) out.forecast.openingCash = 0"), 'תוכנית שנשמרה לפני התיקון מנוקה');
  assert.ok(app.includes('plan.forecast.openingCash = 0'), 'בחירת "עסק חדש" מאפסת את המזומן ההתחלתי');
});

// ---------- באג #2: ההשקעות בתזרים = סך עלויות ההקמה ----------

test('#2 השקעות: שורת ההשקעות בתזרים היא 180,000 (עלויות ההקמה), לא 120,000 (שימושי ההלוואה)', () => {
  const p = cafe();
  const res = E.computePlan(p);
  assert.equal(res.cash[0].invest, 180000, 'הציוד והשיפוץ יחד');
  assert.equal(res.setupTotal, 180000);
  assert.equal(res.cash.reduce((s, c) => s + c.invest, 0), res.setupTotal, 'סך ההשקעות בתזרים = סך עלויות ההקמה');
  assert.notEqual(res.cash[0].invest, 120000, 'התזרים לא נגזר עוד משורת ההשקעה בשימושי ההלוואה');
});

test('#2 השקעות: שינוי בטבלת עלויות ההקמה משנה את התזרים, שינוי בשימושי ההלוואה לא', () => {
  const base = E.computePlan(cafe()).cash[0].invest;
  const moreSetup = cafe();
  moreSetup.startup.setupCosts.push({ item: 'רישוי ויעוץ', amount: 20000 });
  moreSetup.loan.amount = 220000; // כדי שהמקורות ימשיכו לכסות את השימושים
  assert.equal(E.computePlan(moreSetup).cash[0].invest, base + 20000, 'עלויות ההקמה הן מקור האמת');
  const otherUses = cafe();
  otherUses.loan.uses = [{ item: 'ציוד', amount: 200000, type: 'capex' }];
  assert.equal(E.computePlan(otherUses).cash[0].invest, base, 'שימושי ההלוואה כבר לא משפיעים על התזרים');
});

// ---------- טבלת היעד של מאיר, והטבלה החדשה עם שורת המס ----------

test('טבלת היעד של מאיר (בלי שורת מס): 33,242 / 12,735 / 18,477 / 306,409', () => {
  const p = cafe();
  const s = E.amortization(p.loan.amount, p.loan.ratePct, p.loan.years, p.loan.graceMonths);
  const f = { ...p.forecast, openingCash: 0, entity: 'osek' };
  const rows = E.cashflow(f, p.loan.amount, E.planUses(p), s, E.equityInflow(p), { capex: E.investmentTotal(p), monthlyTax: 0 });
  assert.equal(ROUND(rows[0].closing), 33242);
  assert.equal(ROUND(rows[1].closing), 12735);
  assert.equal(ROUND(rows[2].closing), 18477);
  assert.equal(ROUND(rows[11].closing), 306409);
});

// הטבלה עם שורת המס עודכנה פעמיים: (1) סבב QA 5 באג חוסם 2 – ביטוח לאומי לעצמאי כולל
// מעכשיו גם דמי ביטוח בריאות, ולכן המס בשנה 1 עלה ב-18,518 ₪; (2) 27.09.2026 – המס נפרס
// בתזרים לפי הפעילות בפועל של כל חודש (taxSpread) ולא ב-1/12 קבוע. בחודשים 1–2 העסק עוד
// בהפסד תפעולי ולכן אין מס כלל, ושתי היתרות הראשונות זהות לטבלת היעד של מאיר (בלי מס).
// סך המס השנתי לא השתנה, ולכן יתרת חודש 12 נשארה 160,376 ₪.
test('טבלת היעד המעודכנת (עם שורת המס, בפריסה לפי הפעילות): 33,242 / 12,735 / 11,699 / 160,376', () => {
  const res = E.computePlan(cafe());
  assert.equal(ROUND(res.cash[0].closing), 33242);
  assert.equal(ROUND(res.cash[1].closing), 12735);
  assert.equal(ROUND(res.cash[2].closing), 11699);
  assert.equal(ROUND(res.cash[11].closing), 160376);
  // הגשר בין שתי הטבלאות: ההפרש הוא בדיוק המס שנגבה עד אותו חודש, ולא שינוי אחר בתזרים
  let paid = 0;
  [[0, 33242], [1, 12735], [2, 18477], [11, 306409]].forEach(([i, target]) => {
    paid = res.cash.slice(0, i + 1).reduce((s, c) => s + c.tax, 0);
    near(res.cash[i].closing + paid, target, 1);
  });
});

test('ת1 שורת מס בתזרים: לפי הפעילות בפועל של כל חודש, וסך השורה = המס של שנה 1', () => {
  const res = E.computePlan(cafe());
  const total = res.cash.reduce((s, c) => s + c.tax, 0);
  // סך המס בתזרים = המס השנתי. זו הזהות שאסור לשבור בשום פריסה
  near(total, res.years[0].tax, 0.01);
  // התזרים ופרק יכולת ההחזר מנכים את אותו מס
  near(total, res.years[0].incomeTax + res.years[0].ni, 0.01);
  // הפריסה עצמה: בחודשי ההרצה נמוכה, ובקצב המלא גבוהה מהממוצע החודשי
  const avg = res.years[0].tax / 12;
  assert.ok(avg > 0);
  assert.equal(ROUND(res.cash[0].tax), 0, 'חודש 1 – הפסד תפעולי, אין מקדמה');
  assert.ok(res.cash[2].tax > 0 && res.cash[2].tax < avg, 'חודש 3 – מס חלקי');
  assert.ok(res.cash[11].tax > avg, 'בקצב מלא המס גבוה מהממוצע');
  const app = read('app.js');
  assert.ok(app.includes('taxCashRowLabel(b.entity)'), 'שורת המס מוצגת בטבלת התזרים');
  assert.ok(app.includes('לפי הפעילות בפועל של אותו חודש'), 'המסמך מסביר את הפריסה');
  assert.ok(app.includes('מקדמות'), 'ומסייג שהתשלום בפועל הוא במקדמות');
});

test('#1+#2 לא נוגעים בפרק 6 ובפרק 9: 1,575,000 / 418,500, ו-DSCR זהה בהינתן אותו מס', () => {
  const res = E.computePlan(cafe());
  assert.equal(ROUND(res.years[0].revenue), 1575000, 'מחזור שנה 1 לא משתנה');
  assert.equal(ROUND(res.years[0].ebitda), 418500, 'רווח תפעולי שנה 1 לא משתנה');
  // תיקוני התזרים לא נוגעים ברו"ה כלל: שינוי מזומן פתיחה ועלויות הקמה משאיר את years זהה
  const other = cafe();
  other.forecast.openingCash = 500000;
  other.startup.setupCosts = [{ item: 'ציוד', amount: 150000 }];
  assert.deepEqual(E.computePlan(other).years, res.years, 'הרו"ה לא תלוי במזומן ובהשקעות');
  // בדיקה דו-כיוונית: עם המס השטוח הישן (80,932) ה-DSCR חוזר להיות 4.03
  const y1 = res.years[0];
  near((y1.ebitda - 80932 - y1.ownerDraw) / y1.debtService, 4.03, 0.01);
  near(res.monthlyPayment, 4007.59, 0.01);
});

// ---------- באג #3: מקור אמת אחד ושלוש בדיקות חוסמות ----------

test('#3 שלוש בדיקות התקינות קיימות בשמן, ועוברות על התוכנית המתוקנת', () => {
  const p = cafe();
  const res = E.computePlan(p);
  assert.deepEqual(res.checks.map((c) => c.code), ['sources', 'invest', 'items']);
  assert.deepEqual(res.blocking, [], 'התוכנית המתוקנת עוברת את שלוש הבדיקות');
  assert.equal(res.sourcesTotal, 260000, 'הלוואה 200,000 והון עצמי 60,000');
  assert.equal(res.usesTotal, 260000, 'ומול זה בדיוק אותו סכום שימושים');
});

test('#3 בדיקה 1 (מקורות=שימושים): עלויות הקמה שגבוהות מהמקורות חוסמות הפקת מסמך', () => {
  const p = cafe();
  p.startup.setupCosts = [{ item: 'ציוד', amount: 200000 }, { item: 'שיפוץ', amount: 120000 }]; // 320,000 מול 260,000
  const res = E.computePlan(p);
  const fail = res.blocking.find((c) => c.code === 'sources');
  assert.ok(fail, 'הבדיקה נכשלת');
  assert.ok(fail.message.includes('320,000') && fail.message.includes('260,000'), 'שני הסכומים בהודעה');
  assert.ok(fail.message.includes('60,000'), 'וגם ההפרש');
  assert.ok(!/DSCR|capex|working/i.test(fail.message), 'בלי ז\'רגון');
});

test('#3 בדיקה 2 (השקעה בתזרים=סך ההקמה): הפלט הלא נכון מהגרסה החיה נחסם', () => {
  const p = cafe();
  const s = E.amortization(p.loan.amount, p.loan.ratePct, p.loan.years, p.loan.graceMonths);
  // שחזור ההתנהגות הקודמת: ההשקעה בתזרים נגזרת משורת "השקעה" בשימושי ההלוואה (120,000)
  const legacyCash = E.cashflow({ ...p.forecast, openingCash: 0 }, p.loan.amount, p.loan.uses, s, 60000);
  assert.equal(legacyCash[0].invest, 120000, 'כך זה נראה בגרסה החיה');
  const fail = E.integrityFailures(p, { cash: legacyCash, uses: E.planUses(p) }).find((c) => c.code === 'invest');
  assert.ok(fail, 'הבדיקה תופסת את הפער מול עלויות ההקמה');
  assert.ok(fail.message.includes('120,000') && fail.message.includes('180,000'), 'שני הסכומים בהודעה');
  // ואחרי התיקון אותה בדיקה עוברת
  assert.equal(E.integrityFailures(p).length, 0);
});

test('#3 בדיקה 3 (אותו פריט, אותו סכום): שני סכומים לאותו פריט חוסמים הפקת מסמך', () => {
  const p = cafe({ business: { name: 'קפה ותיק', isNew: false, entity: 'osek', years: 5, employees: 4, field: 'בית קפה', description: 'x' } });
  p.loan.uses = [{ item: 'מכונת קפה', amount: 120000, type: 'capex' }, { item: 'מכונת קפה:', amount: 100000, type: 'capex' }];
  p.loan.amount = 220000;
  const fail = E.computePlan(p).blocking.find((c) => c.code === 'items');
  assert.ok(fail, 'אותו פריט בשני סכומים נתפס גם כשיש נקודתיים בסוף');
  assert.ok(fail.message.includes('120,000') && fail.message.includes('100,000'));
  // אותו פריט באותו סכום בשתי רשימות – תקין
  const ok = cafe();
  ok.loan.uses = [{ item: 'ציוד ומכונות קפה', amount: 100000, type: 'capex' }];
  assert.equal(E.computePlan(ok).blocking.length, 0);
});

test('#3 מקור אמת אחד: הפריטים בעסק בהקמה מוזנים רק בשלב "הקמת העסק"', () => {
  const app = read('app.js');
  assert.ok(/k: 'loan\.uses', label: '[^']*', type: 'uses', wide: 1, onlyExisting: 1/.test(app), 'עורך השימושים נשאר לעסק פועל בלבד');
  assert.ok(/k: 'loan\.uses', label: '[^']*', type: 'sources', wide: 1, onlyNew: 1/.test(app), 'לעסק בהקמה הטבלה נגזרת ואינה מוזנת');
  assert.ok(app.includes('function sourcesBoxHtml'), 'תיבת ההצגה של השימושים הנגזרים');
  const p = cafe();
  const uses = E.planUses(p);
  assert.deepEqual(uses.map((u) => ROUND(u.amount)), [100000, 80000, 80000], 'שני פריטי הקמה ועוד הון חוזר');
  assert.equal(uses[2].type, 'working');
  assert.ok(!uses.some((u) => u.item.includes('כישת')), 'הרשימה הכפולה מהשלב של ההלוואה לא מגיעה למסמך');
});

test('#3 הבדיקות חוסמות בפועל: אין מסמך כשבדיקה נכשלת', () => {
  const app = read('app.js');
  assert.ok(app.includes('if (res.blocking.length)'), 'מסך הסיכום בודק את החסימה');
  assert.ok(app.includes("$('next').hidden = true"), 'כפתור הפקת המסמך נעלם');
  assert.ok(/const blocking = E\.computePlan\(plan\)\.blocking;[\s\S]{0,200}renderSummary\(\); return;/.test(app), 'גם לחיצה ישירה על "הצגת התוכנית" נחסמת');
  assert.ok(app.includes('לא נפיק מסמך שבו אותו כסף מופיע בשני סכומים שונים'), 'הודעה ברורה בעברית');
});

// ---------- באג #4: מס לפי צורת ההתאגדות ----------

test('#4 מס: עוסק מורשה משלם מס פרוגרסיבי וביטוח לאומי, לא 20% שטוח', () => {
  const t = E.taxFor(404662, 'osek');
  assert.ok(t.ni > 0, 'יש ביטוח לאומי');
  assert.ok(t.total > 404662 * 0.2, `${Math.round(t.total)} צריך להיות גבוה מ-20% שטוח (80,932)`);
  near(t.total, t.incomeTax + t.ni, 0.01);
  // הטווח והסכום עודכנו אחרי תיקון באג חוסם 2 של סבב QA 5: דמי ביטוח בריאות נוספו
  // לביטוח הלאומי (61,446 ₪ במקום 42,928 ₪), ורק 52% מרכיב הביטוח הלאומי (בלי הבריאות)
  // מוכרים כהוצאה – ולכן גם מס ההכנסה עלה. הסכום הכולל: 146,034 ₪, 36.1% מהרווח.
  assert.ok(t.effectivePct > 28 && t.effectivePct < 40, `שיעור אפקטיבי סביר, קיבלנו ${t.effectivePct.toFixed(1)}%`);
  near(t.total, 146034, 5);
});

test('#4 מס: חברה בע"מ משלמת מס חברות בלבד', () => {
  const t = E.taxFor(404662, 'company');
  near(t.total, 404662 * 0.23, 1);
  assert.equal(t.ni, 0, 'אין ביטוח לאומי על רווח החברה');
  near(t.effectivePct, 23, 0.01);
  assert.ok(E.taxFor(404662, 'osek').total > t.total, 'עוסק מורשה ברווח כזה משלם יותר מחברה');
});

test('#4 מס: המדרגות, נקודות הזיכוי והתקרות עובדות כמו טבלה ולא כשיעור אחיד', () => {
  near(E.bracketTax(84120), 8412, 1);
  near(E.bracketTax(120720), 8412 + 36600 * 0.14, 1);
  near(E.bracketTax(0), 0);
  // שיעור אפקטיבי עולה עם הרווח – ההוכחה שזה לא שיעור שטוח
  const low = E.taxFor(120000, 'osek').effectivePct;
  const high = E.taxFor(800000, 'osek').effectivePct;
  assert.ok(high > low + 10, `${high.toFixed(1)}% צריך להיות גבוה משמעותית מ-${low.toFixed(1)}%`);
  // תקרת ביטוח לאומי
  near(E.nationalInsurance(2000000), E.nationalInsurance(E.TAX.ni.ceiling), 0.01);
  // רווח קטן: נקודות הזיכוי מבטלות את מס ההכנסה
  assert.equal(E.taxFor(50000, 'osek').incomeTax, 0);
  assert.ok(E.taxFor(50000, 'osek').ni > 0, 'ביטוח לאומי משולם גם ברווח קטן');
  assert.equal(E.taxFor(-100000, 'osek').total, 0, 'הפסד לא מייצר מס');
});

test('#4 מס: צורת ההתאגדות משנה את הרווח הנקי ואת יכולת ההחזר', () => {
  const osek = E.computePlan(cafe());
  const company = E.computePlan(cafe({
    business: { name: 'קפה פינת חן', isNew: true, entity: 'company', employees: 4, city: 'ירושלים', years: 0, field: 'בית קפה', description: 'x' },
  }));
  assert.ok(osek.years[0].tax > company.years[0].tax);
  assert.ok(osek.years[0].net < company.years[0].net);
  assert.ok(osek.minDscr < company.minDscr, 'ה-DSCR מושפע מהמס, כמו שתמר ציפתה');
  near(osek.minDscr, 2.67, 0.01); // ירד מ-3.06 בעקבות תיקון ביטוח לאומי (QA 5, באג חוסם 2)
});

test('#4 מס: הטבלאות הן קונפיגורציה, עם הערה שזו הערכה לאימות מול רו"ח', () => {
  assert.ok(Array.isArray(E.TAX.brackets) && E.TAX.brackets.length >= 5, 'מדרגות כקונפיגורציה');
  assert.equal(E.TAX.brackets[E.TAX.brackets.length - 1].upTo, Infinity, 'המדרגה האחרונה פתוחה');
  E.TAX.brackets.reduce((prev, b) => { assert.ok(b.upTo > prev, 'המדרגות בסדר עולה'); return b.upTo; }, 0);
  assert.ok(E.TAX.year >= 2025, 'שנת הטבלאות מתועדת');
  assert.ok(E.TAX.ni.ceiling > E.TAX.ni.reducedUpTo);
  assert.ok(E.TAX.companyRatePct === 23);
  assert.match(E.TAX.note, /רואה חשבון/, 'ההערה שצריך לאמת מול רו"ח');
  assert.match(E.TAX.note, /הערכה/);
  const app = read('app.js');
  assert.ok(!app.includes("k: 'forecast.taxRatePct'"), 'שאלת "שיעור המס" הקבועה הוסרה מהאשף');
  assert.ok(!app.includes('מס משוער של ${num(p.forecast.taxRatePct'), 'ההנחה על שיעור שטוח הוסרה מהמסמך');
  assert.ok(app.includes('E.TAX.note'), 'ההערה על רו"ח מוצגת במסמך');
  assert.ok(app.includes('מס הכנסה משוער') && app.includes('ביטוח לאומי משוער'), 'שתי שורות נפרדות ברו"ה');
  assert.ok(app.includes('מס חברות משוער'), 'ולחברה – מס חברות');
  assert.ok(app.includes('function taxMethodText'), 'הסבר איך מחושב המס');
});

// ---------- באג #5: סף היתרה המינימלית ----------

test('#5 מרווח תזרים: הסף הוא חודש הוצאות קבועות ושכר, לא "אין חודש שלילי"', () => {
  const res = E.computePlan(cafe());
  assert.equal(res.cushion.threshold, 57000, 'הוצאות קבועות 22,000 ושכר 35,000');
  assert.equal(res.cushion.month, 3, 'החודש הנמוך ביותר');
  near(res.cushion.min, ROUND(res.cash[2].closing), 1);
  // מאז פריסת המס לפי הפעילות בפועל (27.09.2026) התזרים לא נכנס למינוס, אבל היתרה
  // הנמוכה (11,699 ₪) עדיין קטנה מחודש הוצאות – וזה בדיוק מה שהבאג הזה בא למדוד:
  // "אין חודש שלילי" הוא לא הסף.
  assert.equal(res.cushion.level, 'warn', 'יתרה חיובית אך דקה – אזהרה, לא הצהרה שהתזרים חיובי');
  assert.ok(res.cushion.min > 0 && res.cushion.min < res.cushion.threshold);
  assert.deepEqual(res.negativeMonths, [], 'ובפריסת המס החדשה אין חודש שלילי');
});

test('#5 מרווח תזרים: יתרה חיובית אך דקה מסומנת כאזהרה, ולא כ"התזרים יישאר חיובי"', () => {
  const rows = [{ month: 1, closing: 40000 }, { month: 2, closing: 12735 }, { month: 3, closing: 60000 }];
  const thin = E.cashCushion(rows, { monthlyFixed: 22000, monthlySalaries: 35000 });
  assert.equal(thin.level, 'warn');
  assert.equal(thin.min, 12735);
  assert.equal(thin.month, 2);
  assert.ok(thin.monthsCovered < 0.25, 'פחות מרביע חודש הוצאות – בדיוק המקרה שתמר תיארה');
  // מעל הסף – מותר להצהיר שהתזרים חיובי
  const wide = E.cashCushion([{ month: 1, closing: 90000 }], { monthlyFixed: 22000, monthlySalaries: 35000 });
  assert.equal(wide.level, 'ok');
  // מינוס – הרמה הגבוהה ביותר
  const neg = E.cashCushion([{ month: 1, closing: -5 }], { monthlyFixed: 22000, monthlySalaries: 35000 });
  assert.equal(neg.level, 'risk');
  // בלי הוצאות קבועות אין סף, ולכן אין אזהרת שווא
  assert.equal(E.cashCushion([{ month: 1, closing: 100 }], {}).level, 'ok');
  assert.equal(E.cashCushion([], {}), null);
});

test('#5 המשפט במסמך נגזר מהיתרה המינימלית, ולא מודפס ללא תנאי', () => {
  const app = read('app.js');
  assert.ok(app.includes('function cushionText'), 'המשפט מחושב בפונקציה אחת');
  const fn = (app.match(/function cushionText[\s\S]*?\n  \}/) || [''])[0];
  assert.ok(fn.includes('c.threshold') && fn.includes('c.min'), 'הסף והיתרה המינימלית נכנסים לניסוח');
  assert.ok(fn.includes('התזרים החודשי צפוי להישאר חיובי'), 'ההצהרה החיובית קיימת – אבל רק בענף הבטוח');
  const hits = app.match(/התזרים החודשי צפוי להישאר חיובי/g) || [];
  assert.equal(hits.length, 1, 'ההצהרה מופיעה פעם אחת בלבד, בתוך cushionText');
  assert.ok(!/res\.negativeMonths\.length \? [^:]*: 'התזרים החודשי/.test(app), 'התנאי הישן ("אין חודש שלילי") הוסר');
  assert.ok(app.includes("cushionText(res, 'doc'"), 'המסמך משתמש בו');
  assert.ok(app.includes("cushionText(res, 'wizard'"), 'וגם מסך הסיכום');
});

// ---------- גל א', שלושת הממצאים הלא-חוסמים מסבב QA 4 ----------

test('ל1 גישור על חודשי מינוס: לעסק בהקמה לא מצהירים על "מסגרת אשראי קיימת"', () => {
  // מאז פריסת המס לפי הפעילות בפועל (27.09.2026) "קפה פינת חן" עצמו כבר לא נכנס למינוס,
  // ולכן התרחיש נבדק עם משיכת בעלים גבוהה יותר – אותו עסק, תזרים שלילי בחודשים 2–4.
  const negative = cafe();
  negative.forecast = { ...negative.forecast, ownerDrawMonthly: 20000 };
  const res = E.computePlan(negative);
  assert.ok(res.negativeMonths.length > 0, 'זה בדיוק התרחיש שבו המשפט מודפס');
  const wc = E.workingCapitalTotal(negative);
  assert.equal(wc, 80000, 'ההון החוזר שכבר מוצג בפרק 5');
  // עדכון אחרי סבב QA 5, באג חוסם 1: הדרישה מסבב 4 ("לא להמציא מסגרת אשראי") נשארת,
  // אבל ההפניה להון החוזר בענף הזה בוטלה – ההון החוזר נכנס לחשבון בחודש 1 יחד עם
  // ההלוואה, ובחודשי המינוס (2–3) הוא כבר נוצל, ולכן אינו מקור גישור נוסף.
  const forNew = E.bridgeText(true, wc, res.cash);
  assert.ok(!/מסגרת אשראי/.test(forNew), 'עסק בהקמה – אין לו מסגרת, ולא נשאל עליה');
  assert.ok(!/ההון החוזר/.test(forNew), 'לא מפנים לכסף שכבר נוצל בתזרים (QA 5)');
  assert.ok(/גרייס/.test(forNew) && /ההון העצמי/.test(forNew), 'מפנים לפעולות אמיתיות: גרייס, דחיית השקעות, הון עצמי');
  // הון חוזר שבנקודה הנמוכה עוד קיים בחשבון בפועל – כן אפשר להפנות אליו
  const stillThere = E.bridgeText(true, wc, [{ month: 1, closing: 80000 }]);
  assert.ok(stillThere.includes('80,000'), 'כשהכסף עוד בחשבון, ההפניה אליו נכונה');
  // בלי הון חוזר אין מה להפנות אליו, ועדיין אין המצאת עובדה
  const noWc = E.bridgeText(true, 0);
  assert.ok(!/מסגרת אשראי/.test(noWc) && /גרייס|הון העצמי/.test(noWc));
  // עסק פועל: ההצהרה הקיימת נשארת כמות שהיא
  assert.equal(E.bridgeText(false, 0), 'העסק יגשר על כך באמצעות מסגרת אשראי קיימת או דחיית חלק מההשקעות.');
  const app = read('app.js');
  assert.ok(!app.includes('העסק יגשר על כך באמצעות מסגרת אשראי קיימת'), 'המשפט הקשיח הוסר מהמסמך');
  assert.ok(app.includes('E.bridgeText(isNew, E.workingCapitalTotal(p), res.cash)'), 'הניסוח נגזר מסוג העסק וממסלול התזרים בפועל');
});

test('ל1ב מרווח דק: גם ענף האזהרה של cushionText לא ממציא מסגרת אשראי לעסק בהקמה', () => {
  const wc = E.workingCapitalTotal(cafe());
  // עסק בהקמה: אין מסגרת אשראי, ומפנים להון החוזר שכבר מוצג במקורות ובשימושים
  const forNew = E.thinCushionText(true, wc);
  assert.ok(!/מסגרת אשראי/.test(forNew), 'עסק בהקמה – אין לו מסגרת, ולא נשאל עליה');
  assert.ok(forNew.includes('80,000'), 'מפנים למקור אמיתי שכבר במסמך: ההון החוזר');
  // בלי הון חוזר אין למה להפנות, ועדיין אין המצאת עובדה
  const noWc = E.thinCushionText(true, 0);
  assert.ok(!/מסגרת אשראי/.test(noWc) && /גרייס|הון עצמי/.test(noWc));
  // עסק פועל: ההצהרה הקיימת נשארת כמות שהיא
  assert.equal(E.thinCushionText(false, 0), 'העסק ישמור על מסגרת אשראי זמינה ויתאים את קצב ההשקעות לתקבולים בפועל.');
  const app = read('app.js');
  assert.ok(!/מסגרת אשראי/.test(app), 'שום ניסוח על מסגרת אשראי לא נשאר קשיח ב-app.js');
  assert.ok(app.includes('E.thinCushionText(isNewBiz(p)'), 'הניסוח נגזר מסוג העסק');
});

test('ל2 הערת המס לא סותרת את שיטת החישוב של חברה בע"מ', () => {
  assert.ok(!/מדרגות מס הכנסה|ביטוח לאומי/.test(E.TAX.note), 'ההערה לא מייחסת לחברה שיטה של עוסק מורשה');
  assert.ok(E.TAX.note.includes(String(E.TAX.year)), 'שנת כללי המס עדיין מתועדת');
  assert.match(E.TAX.note, /רואה חשבון/);
  assert.match(E.TAX.note, /הערכה/);
  // המשפט כפי שהוא מורכב במסמך לחברה: שיטת החישוב ואחריה ההערה – בלי סתירה
  const forCompany = `מס חברות של ${E.TAX.companyRatePct}% על הרווח. ${E.TAX.note}`;
  assert.ok(!/ביטוח לאומי/.test(forCompany), 'אין זכר לביטוח לאומי במסמך של חברה בע"מ');
});

test('ל3 הערת התזרים: "עלויות הקמה" רק בעסק בהקמה', () => {
  const app = read('app.js');
  const note = (app.match(/שורת "השקעות" היא[^<]*/) || [''])[0];
  assert.ok(note, 'ההערה קיימת בפרק 7');
  assert.ok(/isNew \?/.test(note), 'הניסוח תלוי בסוג העסק');
  assert.ok(!/^שורת "השקעות" היא סך עלויות ההקמה/.test(note), 'לא מדובר עוד ב"עלויות הקמה" ללא תנאי');
  assert.ok(note.includes('רכש ציוד ונכסים'), 'לעסק פועל – ניסוח של רכש ציוד');
  // בעסק פועל שורת ההשקעות באמת נגזרת מפריטי ההשקעה שבפרק 5, ולא מעלויות הקמה
  const existing = cafe({ business: { name: 'קפה ותיק', isNew: false, entity: 'osek', years: 3, employees: 4, field: 'בית קפה', description: 'x' } });
  assert.equal(E.investmentTotal(existing), 120000, 'פריט ההשקעה שבשימושי ההלוואה');
  assert.equal(E.setupCostsTotal(existing) > 0 && E.computePlan(existing).investment, 120000, 'ולא עלויות ההקמה');
});

// ---------- בדיקת שפיות כללית ----------

test('התזרים מתיישב עם עצמו: פתיחה, תקבולים, תשלומים וסגירה בכל חודש', () => {
  const res = E.computePlan(cafe());
  res.cash.forEach((c, i) => {
    near(c.inflow, c.revenue + c.loanIn + c.equityIn, 0.001);
    near(c.outflow, c.cogs + c.fixed + c.salaries + c.draw + c.debt + c.invest + c.tax, 0.001);
    near(c.closing, c.opening + c.inflow - c.outflow, 0.001);
    if (i > 0) near(c.opening, res.cash[i - 1].closing, 0.001);
  });
});
