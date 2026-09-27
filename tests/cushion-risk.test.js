/**
 * דירוג "בקשה חזקה" כשבתזרים יש חודש עם יתרה שלילית (cushion.level === 'risk').
 * (נדב, 27.09.2026 – נקודה פתוחה מסבב QA 6.)
 *
 * יחס כיסוי החוב השנתי יכול להיות טוב, ובכל זאת בחודשים הראשונים לא יהיה בחשבון
 * מספיק כסף. במצב כזה אסור שהמסך או המסמך יאמרו "חזקה" בלי הסתייגות.
 *
 * מקרה הבדיקה: "קפה פינת חן" (docs/test-cases/cafe-pinat-chen.html), ובגרסת
 * ה-risk אותו קלט עם הון עצמי של 40,000 ₪ במקום 60,000 ₪.
 * כל מספר צפוי מחושב כאן מהתזרים עצמו (res.cash) ולא מפונקציית הטקסט הנבדקת.
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

function cafe(equity, over) {
  return {
    business: { name: 'קפה פינת חן', isNew: true, entity: 'osek', employees: 4, city: 'ירושלים', years: 0,
      field: 'בית קפה שכונתי', description: 'בית קפה שכונתי עם אפייה במקום' },
    owner: { name: 'אריאל כהן', experience: 'שבע שנים ברשת בתי קפה', education: '' },
    market: { customers: 'תושבי השכונה', competitors: 'שתי רשתות', pricing: 'מחירים דומים', advantage: 'אפייה במקום' },
    history: { lastYearSales: 0, lastYearProfit: 0 },
    startup: { equity: equity == null ? 60000 : equity, openDate: 'יוני 2027', preOpenCosts: 0, deposit: 0, equipmentVat: 0,
      setupCosts: [{ item: 'רכישת ציוד ומכונות קפה:', amount: 100000 }, { item: 'שיפוץ ועיצוב', amount: 80000 }] },
    forecast: { annualSales: 1800000, rampMonths: 3, growthPct: 5, cogsPct: 30, monthlyFixed: 22000,
      monthlySalaries: 35000, ownerDrawMonthly: 12000, openingCash: 0, salesModel: 'total', daysPerMonth: 26 },
    loan: { track: 'startup', amount: 200000, ratePct: 7.5, years: 5, graceMonths: 0,
      purpose: 'רכישת ציוד ושיפוץ הנכס', uses: [{ item: '', amount: 0, type: 'capex' }] },
    ...(over || {}),
  };
}

// ---------- (1) ok + risk: אזהרה עם חודש וסכום ----------

test('ok+risk: המצב קיים באמת – דירוג שנתי חזק ויתרה שלילית בחודש כלשהו', () => {
  const res = E.computePlan(cafe(40000));
  assert.equal(res.rating.level, 'ok');
  assert.equal(res.cushion.level, 'risk');
  assert.ok(res.negativeMonths.length > 0);
  assert.equal(res.blocking.length, 0, 'התוכנית תקינה ואפשר להפיק ממנה מסמך');
});

test('ok+risk: האזהרה מציינת את החודשים, את החודש הקשה ואת הסכום החסר כמספר חיובי', () => {
  const res = E.computePlan(cafe(40000));
  const worst = res.cash.reduce((a, c) => (c.closing < a.closing ? c : a));
  const neg = res.cash.filter((c) => c.closing < 0).map((c) => c.month);
  const note = strip(E.negativeMonthNote(res.cushion, res.negativeMonths, true));
  assert.ok(note, 'חייבת להיות אזהרה');
  assert.ok(note.includes(`חודש ${worst.month}`), `החודש הקשה ביותר: ${note}`);
  assert.ok(note.includes(`חסרים ${money(-worst.closing)}`), `הסכום החסר, חיובי ועם "חסרים": ${note}`);
  assert.ok(!note.includes(`-${money(-worst.closing)}`) && !note.includes(`‎-`), 'בלי סימן מינוס לפני הסכום');
  assert.ok(note.includes(`${neg[0]}–${neg[neg.length - 1]}`), `רשימת חודשי המינוס: ${note}`);
  assert.ok(/ההון העצמי/.test(note) && /גרייס/.test(note), 'מה אפשר לעשות');
  assert.ok(!/מסגרת/.test(note), 'לעסק בהקמה לא מציעים מסגרת אשראי שלא קיימת בנתונים');
});

test('ok+risk: חודש מינוס בודד מנוסח ביחיד, ועסק פועל מקבל הצעה לבדוק מסגרת – לא הבטחה', () => {
  const one = strip(E.negativeMonthNote({ level: 'risk', min: -8301.4, month: 3, threshold: 57000 }, [3], true));
  assert.ok(one.includes('בחודש 3 של השנה הראשונה') && one.includes('חסרים בו 8,301'), one);
  const biz = strip(E.negativeMonthNote({ level: 'risk', min: -8301, month: 3, threshold: 57000 }, [3], false));
  assert.ok(/לבדוק מול הבנק מסגרת אשראי/.test(biz), biz);
  assert.ok(!/ההון העצמי/.test(biz), 'בעסק פועל לא נשאלת שאלת ההון העצמי');
});

test('ok+risk: כרטיס תמונת המצב לא אומר "חזקה" בלי הסתייגות, ועובר לרמת אזהרה', () => {
  const app = read('app.js');
  const fn = (app.match(/function verdict\(res\)[\s\S]*?\n  \}/) || [''])[0];
  assert.ok(fn.includes('E.negativeMonthNote(res.cushion, res.negativeMonths, isNewBiz())'), 'הטקסט נגזר מהמנוע');
  assert.ok(/if \(minus\) \{\s*return \{ level: 'warn', title: res\.negativeMonths\.length > 1 \? 'בקשה חזקה, אבל יש חודשים במינוס' : 'בקשה חזקה, אבל יש חודש במינוס'/.test(fn),
    'הכותרת כוללת הסתייגות ורמת הכרטיס היא אזהרה');
  assert.ok(fn.indexOf('if (minus)') < fn.indexOf("return { level: 'ok'"), 'ענף המינוס נבדק לפני ענף "בקשה חזקה"');
});

test('ok+risk: בסיכום אין כפילות – שורת חודשי המינוס ב"כדאי לטפל" רק כשהדירוג אינו חזק', () => {
  const app = read('app.js');
  assert.ok(app.includes("if (res.negativeMonths.length && res.rating.level !== 'ok') fixes.push("));
  assert.ok(app.includes("${res.rating.level === 'ok' ? '' : helpsHtml(planHelps(res))}"),
    'המלצות הקטנת ההלוואה (לפי יחס הכיסוי) לא מופיעות כשהיחס טוב');
});

test('ok+risk: תקציר המנהלים במסמך מסתייג, עם חודש וסכום, ומפנה לפרק הסיכונים', () => {
  const res = E.computePlan(cafe(40000));
  const s = strip(E.negativeMonthSummary(res.cushion, res.negativeMonths));
  assert.ok(s.startsWith('עם זאת,'), s);
  assert.ok(s.includes(`חודש ${res.cushion.month}`) && s.includes(`חסרים ${money(-res.cushion.min)}`), s);
  assert.ok(s.includes('פרק 9'), s);
  const app = read('app.js');
  assert.ok(app.includes("res.rating.level === 'ok' && res.cushion && res.cushion.level === 'risk' ? ` ${dt(E.negativeMonthSummary(res.cushion, res.negativeMonths))}`"));
  assert.ok(app.includes('<h2>9. יכולת החזר וסיכונים</h2>'), 'ההפניה לפרק 9 נכונה');
});

// ---------- (2) ok + ok: בלי אזהרה ----------

test('ok+ok: אין אזהרה כשהמרווח תקין', () => {
  const res = E.computePlan(cafe(150000));
  assert.equal(res.rating.level, 'ok');
  assert.equal(res.cushion.level, 'ok');
  assert.equal(E.negativeMonthNote(res.cushion, res.negativeMonths, true), '');
  assert.equal(E.negativeMonthSummary(res.cushion, res.negativeMonths), '');
  assert.equal(E.thinMonthNote(res.cushion), '');
});

// ---------- (3) warn: ממשיך כמו קודם ----------

test('warn: קפה פינת חן הבסיסי – רק משפט המרווח הדק, בלי אזהרת המינוס', () => {
  const res = E.computePlan(cafe());
  assert.equal(res.rating.level, 'ok');
  assert.equal(res.cushion.level, 'warn');
  assert.equal(E.negativeMonthNote(res.cushion, res.negativeMonths, true), '');
  assert.equal(E.negativeMonthSummary(res.cushion, res.negativeMonths), '');
  const thin = strip(E.thinMonthNote(res.cushion));
  assert.ok(thin.includes(`בחודש ${res.cushion.month}`) && thin.includes(money(res.cushion.min)), thin);
  assert.equal(E.negativeMonthNote(null), '');
  assert.equal(E.negativeMonthNote({ level: 'warn', min: 11699, month: 3 }, [], true), '');
});

// ---------- (4) תרחיש הבסיס לא משתנה במספרים ----------

test('קפה פינת חן: המספרים של תרחיש הבסיס לא השתנו', () => {
  const res = E.computePlan(cafe());
  assert.equal(R(res.cushion.min), 11699, 'היתרה הנמוכה ביותר (כמו בסבב QA 6)');
  assert.equal(res.cushion.month, 3);
  assert.equal(res.cushion.threshold, 57000);
  assert.deepEqual(res.negativeMonths, []);
  assert.equal(res.minDscr.toFixed(2), '2.67');
  assert.equal(res.rating.level, 'ok');
  // וגרסת ה-risk: מספרים מהתזרים עצמו
  const risk = E.computePlan(cafe(40000));
  assert.equal(R(risk.cushion.min), -8301);
  assert.deepEqual(risk.negativeMonths, [2, 3]);
});
