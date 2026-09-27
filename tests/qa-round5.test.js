/**
 * סבב QA 5 (תמר, 26.09.2026) – בדיקה עצמאית של גל ב' (24 הסעיפים) על התוצר החי.
 *
 * הקובץ מחולק לשניים:
 *   1. בדיקות רגרסיה על מה שנמצא תקין – כדי שלא יישבר בסבב הבא.
 *   2. בדיקות `todo` שמתעדות את הבאגים שנמצאו. הן לא מפילות את npm test,
 *      וכשאורי יתקן – מסירים את הדגל `todo` והן הופכות לבדיקות רגילות.
 *
 * מקרה הבדיקה: "קפה פינת חן" – בדיוק כפי שהוזן דרך הממשק בסבב הזה.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const R = (n) => Math.round(n);
const strip = (s) => String(s == null ? '' : s).replace(/[⁦-⁩‎‏]/g, '');

function cafe(over) {
  return {
    business: { name: 'קפה פינת חן', isNew: true, entity: 'osek', employees: 4, city: 'ירושלים', years: 0,
      field: 'בית קפה שכונתי', description: 'בית קפה שכונתי עם אפייה במקום' },
    owner: { name: 'אריאל כהן', experience: 'שבע שנים ברשת בתי קפה', education: '' },
    market: { customers: 'תושבי השכונה', competitors: 'שתי רשתות', pricing: 'מחירים דומים לרשתות', advantage: 'אפייה במקום' },
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
const existing = () => cafe({
  business: { name: 'קפה פינת חן', isNew: false, entity: 'osek', employees: 4, city: 'ירושלים', years: 5,
    field: 'בית קפה שכונתי', description: 'בית קפה שכונתי' },
  history: { lastYearSales: 1400000, lastYearProfit: -40000 },
  loan: { track: 'general', amount: 200000, ratePct: 7.5, years: 5, graceMonths: 0, purpose: 'ציוד',
    uses: [{ item: 'מכונת קפה מקצועית', amount: 200000, type: 'capex' }] },
  forecast: { ...cafe().forecast, cogsPct: 35, openingCash: 40000 },
});

// ---------- 1. רגרסיה: מה שנמצא תקין בסבב הזה ----------

test('QA5 מה שהוזן דרך הממשק מגיע למנוע ללא עיוות (סעיפים 22–23)', () => {
  const res = E.computePlan(cafe());
  const items = res.uses.map((u) => u.item);
  assert.ok(items.includes('רכישת ציוד ומכונות קפה'), 'נקודתיים בסוף הוסרו, שאר הטקסט בעברית נשמר בדיוק');
  assert.ok(items.includes('שיפוץ ועיצוב'));
  assert.ok(!items.some((i) => /:$/.test(i)), 'אין כותרת שורה שמסתיימת בנקודתיים');
});

test('QA5 סטטוס העסק מנוסח ברור בשני המצבים (סעיף 24)', () => {
  assert.deepEqual(E.businessStatus(cafe()), { label: 'סטטוס', value: 'עסק בהקמה', isNew: true, years: 0 });
  assert.equal(E.businessStatus(existing()).value, 'עסק פועל 5 שנים');
});

test('QA5 התזרים מתיישב עם עצמו בכל חודש, בשתי צורות ההתאגדות', () => {
  [cafe(), cafe({ business: { ...cafe().business, entity: 'company' } })].forEach((p) => {
    const res = E.computePlan(p);
    res.cash.forEach((c, i) => {
      assert.equal(R(c.closing), R(c.opening + c.inflow - c.outflow), `חודש ${i + 1}`);
      if (i > 0) assert.equal(R(c.opening), R(res.cash[i - 1].closing), `פתיחה חודש ${i + 1}`);
    });
    assert.equal(res.cash[0].opening, 0, 'עסק בהקמה מתחיל מ-0 (סעיף 1)');
    assert.equal(res.cash[0].invest, res.setupTotal, 'ההשקעה בתזרים = עלויות ההקמה (סעיף 2)');
  });
});

test('QA5 בדיקות התקינות חוסמות מסמך גם כשהמשתמש מחליף "עסק חדש" ל"עסק פועל"', () => {
  // התרחיש שנבדק בממשק: משתמש מילא עלויות הקמה, ואז שינה את הבחירה לעסק פועל.
  const p = existing();
  p.loan.uses = [{ item: '', amount: 0, type: 'capex' }];
  const res = E.computePlan(p);
  assert.ok(res.blocking.some((c) => c.code === 'sources'), 'שימושים ריקים חוסמים הפקת מסמך');
  assert.ok(/200,000/.test(strip(res.blocking[0].message)), 'ההודעה מכילה את הסכום החסר בפועל');
});

test('QA5 פסקת הביטחונות נכונה לעוסק מורשה ולחברה, ולא ממציאה נכסים (סעיף 26)', () => {
  const osek = E.collateralSection(cafe());
  const co = E.collateralSection(cafe({ business: { ...cafe().business, entity: 'company' } }));
  const all = [...osek.paragraphs, ...co.paragraphs].map(strip);
  assert.ok(osek.paragraphs.some((t) => /אין הפרדה בין נכסי העסק לנכסי הבעלים/.test(strip(t))));
  assert.ok(co.paragraphs.some((t) => /נכסי החברה מופרדים/.test(strip(t))));
  assert.ok(all.every((t) => !/שהזנת|שלכם|אתם /.test(t)), 'גוף שלישי בלבד');
  assert.ok(all.some((t) => /אינו חלק ממסמך זה/.test(t)), 'לא מצהירים על ביטחונות שלא הוזנו');
});

test('QA5 מספרים בטקסט עטופים בבידוד כיווניות, ומקף עברי לא נשבר (סעיף 21)', () => {
  const t = E.bidiText('הלוואה ל-5 שנים בריבית 7.5%, החזר 4,008 ₪, ובחודש 3 יתרה של -13,402 ₪');
  assert.ok(t.includes('ל-⁦5⁩'), 'המקף נשאר לפני הבידוד: "ל-5" ולא "ל5-"');
  assert.ok(t.includes('⁦-13,402⁩'), 'מינוס אמיתי נכנס לתוך הבידוד');
  assert.equal(strip(t).indexOf('⁦'), -1);
});

// ---------- 2. באגים שנמצאו בסבב הזה (todo עד לתיקון) ----------

test('QA5 באג 1: אסור להצהיר שהמינוס ייגושר מההון החוזר שכבר נספר בתזרים', () => {
  const res = E.computePlan(cafe());
  assert.deepEqual(res.negativeMonths, [2, 3], 'התזרים אכן נכנס למינוס בחודשים 2–3');
  const text = strip(E.bridgeText(true, E.workingCapitalTotal(cafe())));
  // ההון החוזר (80,000) כבר נכלל בתקבולי ההלוואה בחודש 1, והיתרה שלילית *אחריו*.
  // לכן אי אפשר להציג אותו כמקור גישור נוסף במסמך שהולך לבנק.
  assert.ok(!/ההון החוזר/.test(text), `המשפט מפנה למקור כסף שכבר נוצל: ${text}`);
});

test('QA5 באג 2: ביטוח לאומי לעצמאי חייב לכלול גם דמי ביטוח בריאות', () => {
  // שיעורי 2025 לעצמאי: 5.97% עד 60% מהשכר הממוצע ו-17.83% מעליו (ביטוח לאומי + בריאות).
  // המנוע משתמש ב-2.87%/12.83% – רק רכיב הביטוח הלאומי, בלי מס בריאות.
  const profit = 404662;
  const low = Math.min(profit, 90264);
  const high = Math.max(0, Math.min(profit, 588360) - 90264);
  const expected = low * 0.0597 + high * 0.1783;
  const got = E.taxFor(profit, 'osek').ni;
  assert.ok(Math.abs(got - expected) < 500, `ביטוח לאומי ${R(got)} במקום ${R(expected)} – חסר מס בריאות`);
});

test('QA5 באג 3: שורת המס בתזרים גובה מס מלא גם בחודשי ההרצה, ומייצרת מינוס', { todo: 'חשוב – ממתין להחלטת מאיר/אורי' }, () => {
  const res = E.computePlan(cafe());
  const monthly = res.years[0].tax / 12;
  // בחודש 1 העסק מוכר 37,500 ₪ (שליש מהקצב) ועדיין משלם 1/12 מהמס השנתי.
  const m1Profit = res.cash[0].revenue - res.cash[0].cogs - res.cash[0].fixed - res.cash[0].salaries;
  assert.ok(res.cash[0].tax <= Math.max(0, m1Profit) * 0.5,
    `מס של ${R(res.cash[0].tax)} בחודש שבו הרווח התפעולי הוא ${R(m1Profit)}`);
  assert.ok(monthly > 0);
});

test('QA5 באג 4: טבלת היעד של מאיר (33,242 / 12,735 / 18,477 / 306,409)', { todo: 'תלוי בהחלטה על שורת המס' }, () => {
  const res = E.computePlan(cafe());
  [[0, 33242], [1, 12735], [2, 18477], [11, 306409]].forEach(([i, want]) => assert.equal(R(res.cash[i].closing), want));
});

test('QA5 באג 5: אחוז עלות מכר לא הגיוני (150%) עובר בלי אזהרה', { todo: 'חשוב – ממתין לתיקון אורי' }, () => {
  const p = cafe();
  p.forecast.cogsPct = 150;
  const res = E.computePlan(p);
  const texts = [...res.warnings, ...E.assumptionWarnings(p).map((a) => a.text)].map(strip).join(' ');
  assert.ok(/עלות מכר|סחורה/.test(texts), `רווח גולמי שלילי (${R(res.years[0].grossProfit)}) בלי אזהרה על ההנחה`);
});
