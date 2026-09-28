/**
 * תיקוני שני הבאגים הלא-חוסמים של סבב QA 6 (נדב, 27.09.2026).
 *
 * באג 1 – המשפט על ההון החוזר בענף "מרווח דק" הציג את סך ההון החוזר (80,000 ₪)
 *          גם כשבנקודה הנמוכה נשארו בחשבון 11,699 ₪ בלבד: app.js לא העביר את
 *          מסלול התזרים ל-E.thinCushionText, בשונה מ-E.bridgeText שכן מעביר אותו.
 * באג 2 – מסרים מעורבים בתמונת המצב: דירוג הבקשה (DSCR שנתי) הוא 'ok' ("בקשה חזקה")
 *          בזמן שהמרווח בתזרים (יתרה חודשית) הוא 'warn', והמשתמש גילה את החודש
 *          הדחוק רק במסך הבא.
 *
 * מקרה הבדיקה: "קפה פינת חן" – אותו קלט בדיוק של qa-round5/qa-round6.
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

// ---------- באג 1: הסכום שמוצג הוא היתרה בפועל ----------

test('באג 1: במרווח דק המשפט מציג את היתרה שנשארה בפועל, לא את מלוא ההון החוזר', () => {
  const p = cafe();
  const res = E.computePlan(p);
  const wc = E.workingCapitalTotal(p);
  // התנאים של המקרה: יתרה חיובית אך מתחת לחודש הוצאות, והון חוזר גדול ממנה בהרבה
  assert.equal(res.cushion.level, 'warn');
  assert.deepEqual(res.negativeMonths, [], 'אין חודשי מינוס – זה ענף המרווח הדק');
  assert.equal(wc, 80000, 'ההון החוזר שמוצג בפרק המקורות והשימושים');
  // הציפייה מחושבת מהתזרים עצמו: היתרה הנמוכה ביותר בכל 12 החודשים
  const minClosing = Math.min(...res.cash.map((c) => c.closing));
  assert.ok(minClosing > 0 && minClosing < wc / 2, `היתרה בפועל ${R(minClosing)} מול הון חוזר ${wc}`);

  const text = strip(E.thinCushionText(true, wc, res.cash));
  assert.ok(text.includes(money(minClosing)), `הסכום המוצג אינו היתרה בפועל (${money(minClosing)}): ${text}`);
  assert.ok(!text.includes('80,000'), `המשפט עדיין מציג את מלוא ההון החוזר: ${text}`);
  assert.equal(money(minClosing), '11,699', 'המספר שתמר ראתה במסמך');
});

test('באג 1: app.js מעביר את מסלול התזרים ל-thinCushionText, כמו ב-bridgeText', () => {
  const app = read('app.js');
  assert.ok(app.includes('E.thinCushionText(isNewBiz(p), E.workingCapitalTotal(p || plan), res.cash)'),
    'הקריאה במסמך מעבירה את res.cash כפרמטר שלישי');
  assert.ok(!/E\.thinCushionText\(isNewBiz\(p\), E\.workingCapitalTotal\(p \|\| plan\)\)/.test(app),
    'לא נשארה קריאה בלי מסלול התזרים');
});

test('באג 1: כשההון החוזר קטן מהיתרה – מציגים את ההון החוזר, וברירת המחדל לא זזה', () => {
  const cash = [{ month: 1, closing: 150000 }, { month: 2, closing: 60000 }, { month: 3, closing: 90000 }];
  // ההון החוזר הוא התקרה: אי אפשר "לנצל" יותר ממה שיועד
  assert.ok(strip(E.thinCushionText(true, 40000, cash)).includes('40,000'));
  // היתרה היא התקרה השנייה
  assert.ok(strip(E.thinCushionText(true, 200000, cash)).includes('60,000'));
  // בלי מסלול תזרים – הסכום נשאר סך ההון החוזר (התנהגות סבב 4, שאין סיבה לשנות)
  assert.ok(strip(E.thinCushionText(true, 80000)).includes('80,000'));
  // עסק פועל – מאז שיפור 4 (החלטת מנכ"ל 28.09.2026) בלי הצהרה על מסגרת אשראי שלא נמסרה
  assert.equal(E.thinCushionText(false, 0), 'העסק יתאים את קצב ההשקעות לתקבולים בפועל, ובמידת הצורך יבדוק מול הבנק אשראי לטווח קצר.');
  assert.ok(!/ההון החוזר/.test(E.thinCushionText(true, 0, cash)));
});

// ---------- באג 2: שני האיתותים באותו כרטיס ----------

test('באג 2: "בקשה חזקה" עם חודש דחוק – הכרטיס אומר את שני הדברים', () => {
  const res = E.computePlan(cafe());
  assert.equal(res.rating.level, 'ok', 'הדירוג השנתי חזק (DSCR)');
  assert.equal(res.cushion.level, 'warn', 'אבל יש חודש שבו היתרה דחוקה');
  const note = strip(E.thinMonthNote(res.cushion));
  assert.ok(note, 'במצב הזה חייב להתווסף משפט שקיפות');
  assert.ok(note.includes(`בחודש ${res.cushion.month}`), `המשפט מציין את החודש: ${note}`);
  assert.ok(note.includes(money(Math.min(...res.cash.map((c) => c.closing)))), `ואת היתרה בפועל: ${note}`);
  assert.ok(!/חלשה|גבולית/.test(note), 'המשפט מוסיף שקיפות, לא הופך את הדירוג למפחיד');
});

test('באג 2: כשאין חודש דחוק אין משפט מיותר, וברמת מינוס הדיווח נעשה במקום אחר', () => {
  assert.equal(E.thinMonthNote({ level: 'ok', min: 300000, month: 12, threshold: 57000 }), '');
  assert.equal(E.thinMonthNote({ level: 'risk', min: -18031, month: 3, threshold: 57000 }), '',
    'חודשי מינוס מדווחים בשורת חודשי המינוס, לא כאן');
  assert.equal(E.thinMonthNote(null), '');
  assert.equal(E.thinMonthNote(undefined), '');
  // והמשפט נגזר מהנתונים: באותו מקרה כחברה בע"מ (מס נמוך יותר) החודש והסכום אחרים
  const co = E.computePlan(cafe({ business: { ...cafe().business, entity: 'company' } }));
  const coNote = strip(E.thinMonthNote(co.cushion));
  assert.ok(coNote.includes(`בחודש ${co.cushion.month}`) && coNote.includes(money(co.cushion.min)),
    `המשפט מתאר את התזרים של אותה תוכנית: ${coNote}`);
  assert.notEqual(coNote, strip(E.thinMonthNote(E.computePlan(cafe()).cushion)), 'ולא טקסט קבוע');
});

test('באג 2: כרטיס תמונת המצב ב-app.js משלב את המשפט בענף ה-ok בלבד', () => {
  const app = read('app.js');
  const fn = (app.match(/function verdict\(res\)[\s\S]*?\n  \}/) || [''])[0];
  assert.ok(fn, 'הפונקציה verdict נמצאה');
  assert.ok(fn.includes('E.thinMonthNote(res.cushion)'), 'המשפט נגזר מהמנוע ולא נכתב שוב בממשק');
  assert.ok(fn.includes("title: 'בקשה חזקה'"), 'הכותרת לא שונתה');
  assert.ok(fn.includes("return { level: 'ok', title: 'בקשה חזקה'"), 'וגם רמת הכרטיס נשארה ok');
  assert.equal((fn.match(/thinMonthNote/g) || []).length, 1, 'רק בענף אחד – זה של הדירוג החזק');
  // הספים עצמם לא נגעו
  const engine = read('engine.js');
  assert.ok(/const level = worst\.closing < 0 \? 'risk' : \(threshold > 0 && worst\.closing < threshold \? 'warn' : 'ok'\)/.test(engine),
    'כלל ה-warn/risk של המרווח נשאר כמו שהיה');
});
