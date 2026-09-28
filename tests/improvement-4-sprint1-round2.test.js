/**
 * שיפור 4, ספרינט 1, סבב 2 (נדב, 28.09.2026) – תיקונים אחרי QA של תמר
 * (docs/QA-improvement-4-sprint1.md, באגים 1–7; באג 8 לידיעה בלבד).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');
const U = require('../app.js');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const strip = (s) => String(s == null ? '' : s).replace(/[⁦-⁩‎‏]/g, '');

function cafe() {
  return {
    business: { name: 'קפה פינת חן', isNew: true, entity: 'osek', employees: 4, years: null, field: 'בית קפה', description: 'בית קפה שכונתי עם מאפים טריים כל בוקר' },
    owner: { name: 'א', experience: 'ניהול משמרת ברשת בתי קפה ארבע שנים', education: '' },
    market: { customers: 'תושבי השכונה ועובדי המשרדים באזור', competitors: '', pricing: '', advantage: 'אפייה במקום כל בוקר ומחיר הוגן' },
    history: { lastYearSales: 0, lastYearProfit: 0 },
    startup: { equity: 150000, openDate: 'יוני 2027', preOpenCosts: 0, deposit: 0, equipmentVat: 0,
      setupCosts: [{ item: 'ציוד ומכונות קפה', amount: 100000 }, { item: 'שיפוץ המקום', amount: 80000 }] },
    forecast: { annualSales: 1800000, rampMonths: 3, growthPct: 5, cogsPct: 30, monthlyFixed: 22000, monthlySalaries: 35000,
      ownerDrawMonthly: 12000, openingCash: 0, salesModel: 'total', daysPerMonth: 26 },
    loan: { track: 'startup', amount: 200000, ratePct: 7.5, years: 5, graceMonths: 0, purpose: 'ציוד ושיפוץ', uses: [] },
  };
}
const running = (years) => ({ business: { isNew: false, years }, history: { lastYearSales: 100 }, forecast: { annualSales: 100 }, loan: {} });

test('באג 1: הרזרבה שלא נוצלה (עסק בהקמה) מוצגת במסמך מתחת לכרטיסי המדדים', () => {
  const app = read('app.js');
  const fn = (app.match(/function metricsHtml\(p, res\)[\s\S]*?\n  \}/) || [''])[0];
  assert.ok(fn.includes('E.reserveNote(p, res)'), 'metricsHtml קורא ל-E.reserveNote');
  assert.ok(fn.includes('id="reserve-note"'));
  const p = cafe(); const note = strip(E.reserveNote(p, E.computePlan(p)));
  assert.match(note, /101,699/);
  assert.match(note, /רזרבה שלא נוצלה/);
});

test('באג 2: ותק בעברית תקינה ובלי עיגול', () => {
  const cases = { 0.5: 'חצי שנה', 1: 'שנה', 1.5: 'שנה וחצי', 2: 'שנתיים', 2.5: 'שנתיים וחצי', 3: '3 שנים', 3.5: '3 שנים וחצי', 12: '12 שנים' };
  for (const [y, t] of Object.entries(cases)) assert.equal(strip(E.yearsText(Number(y))), t, y);
  assert.equal(E.yearsText(0.25), '3 חודשים');
  assert.equal(E.yearsText(null), '');
  assert.equal(strip(E.businessStatus(running(0.5)).value), 'עסק פועל חצי שנה');
  assert.equal(strip(E.businessStatus(running(2.5)).value), 'עסק פועל שנתיים וחצי', 'קודם: "3 שנים"');
});

test('באג 2: אזהרת המסלול (א1) משתמשת באותו ניסוח ותק', () => {
  const p = { business: { isNew: false, years: 1.5, employees: 1 }, history: {}, forecast: {}, loan: { track: 'startup', uses: [] } };
  const w = E.consistencyChecks(p).find((c) => c.code === 'trackVsYears');
  assert.match(strip(w.message), /העסק פועל שנה וחצי\./);
});

test('באג 3: 30% בדיוק לא פותח שדה חובה; מעל 30% – כן', () => {
  const mk = (to) => ({ business: { isNew: false, years: 3 }, history: { lastYearSales: 1000000 }, forecast: { annualSales: to } });
  assert.equal(U.jumpInfo(mk(1300000)).needed, false);
  assert.equal(U.jumpInfo(mk(1300001)).needed, true);
  assert.equal(U.jumpInfo(mk(1300001)).needed, E.salesJump(mk(1300001)).needsReason);
});

test('באג 4: אזהרת עלות מכר אומרת כמה נשאר בפועל', () => {
  const msg = (v) => strip(E.consistencyChecks({ business: { isNew: false, years: 2, employees: 1 }, history: {}, forecast: { cogsPct: v }, loan: { uses: [] } })
    .find((c) => c.code === 'cogsHigh').message);
  assert.match(msg(90), /נשארים רק 10 ₪/);
  assert.match(msg(86), /נשארים רק 14 ₪/);
  assert.match(msg(92.5), /נשארים רק 7\.5 ₪/);
  assert.match(msg(100), /נשארים 0 ₪/);
  assert.ok(!/פחות מ-15/.test(msg(90)));
});

test('באג 5: בשדה הסבר הקפיצה, השגיאה מופיעה בנוסף להסבר למה השדה הופיע', () => {
  const app = read('app.js');
  assert.match(app, /k: U\.JUMP_FIELD[^\n]*keepHint: 1/);
  assert.ok(app.includes('${hint && (!bad || f.keepHint) ? `<span class="hint" data-hint-for'), 'ההסבר נשאר כשיש שגיאה');
});

test('באג 6: בדוגמה, פריט הקפיצה מתאר מה הכלי זיהה ולא נותן הוראה', () => {
  const src = read('app.js');
  const SAMPLE = new Function(`${(src.match(/const SAMPLE = \{[\s\S]*?\n  \};/) || [''])[0]}; return SAMPLE;`)();
  const d = U.sampleDemo(E, SAMPLE, E.computePlan(SAMPLE));
  assert.equal(d.items.length, 2);
  const jump = d.items.find((t) => /גבוה בכ-/.test(t));
  assert.ok(jump, 'פריט הקפיצה קיים');
  assert.ok(!/^כתבו|\. כתבו/.test(jump), 'לא ניסוח של הוראה');
  assert.match(jump, /לא נכתב הסבר/);
  assert.match(jump, /מטרת ההלוואה/);
});

test('באג 7: ההערה מתחת לטבלת התזרים מסבירה את שורת ההון החוזר', () => {
  const app = read('app.js');
  assert.ok(app.includes('שורת "הון חוזר (לפי פירוט השימושים)" היא הכסף מההלוואה שמיועד להוצאות השוטפות'));
  assert.match(app, /res\.cash\.some\(\(r\) => r\.working > 0\) \?/, 'רק כשיש הון חוזר בתזרים');
});
