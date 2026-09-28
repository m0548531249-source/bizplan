/**
 * שיפור 4, ספרינט 1 – חלק הממשק (נדב, 28.09.2026).
 * בודק את הלוגיקה הטהורה של app.js (BizplanUI, מיוצאת ל-node) מול מנוע מדומה (stub),
 * כך שהבדיקות לא תלויות בסדר שבו consistencyChecks / suggestUseCategory נכנסות
 * ל-engine.js; ובנוסף – מול המנוע האמיתי כשהפונקציות כבר קיימות בו.
 * מקור: docs/IMPROVEMENT-4-SOURCE-v2.md, סעיפים א1–א7 ו-ה'.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const U = require('../app.js');
const E = require('../engine.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = (s) => String(s == null ? '' : s).replace(/[⁦-⁩‎‏]/g, '');

/** "עיצובים" – התרחיש מהמקור: עסק פועל, מחזור 120,000 ← 255,000 (112%), "משווק" 80,000 כהשקעה */
function designs(over) {
  const p = {
    business: { name: 'עיצובים', isNew: false, entity: 'osek', years: 2, employees: 0, city: 'חיפה',
      field: 'עיצוב גרפי', description: 'שירות מחיר' },
    owner: { name: 'דנה', experience: '4', education: '' },
    market: { customers: 'עסקים קטנים', competitors: '', pricing: '', advantage: 'שירות מחיר' },
    history: { lastYearSales: 120000, lastYearProfit: 40000 },
    startup: { openDate: '', equity: 0, setupCosts: [{ item: '', amount: 0 }], preOpenCosts: 0, deposit: 0, equipmentVat: 0 },
    forecast: { annualSales: 255000, rampMonths: 0, growthPct: 5, cogsPct: 10, monthlyFixed: 2000, monthlySalaries: 0,
      ownerDrawMonthly: 6000, openingCash: 10000, salesModel: 'total', daysPerMonth: 26, growthReason: '' },
    loan: { track: 'startup', amount: 100000, ratePct: 7.5, years: 5, graceMonths: 0, purpose: 'גיוס עובדים ושכירות מקום',
      uses: [{ item: 'מחשב', amount: 20000, type: 'capex' }, { item: 'משווק', amount: 80000, type: 'capex' }] },
  };
  return over ? over(p) || p : p;
}
function newBiz() {
  return designs((p) => {
    p.business.isNew = true; p.business.years = 0; p.history = { lastYearSales: 0, lastYearProfit: 0 };
    p.loan.track = 'startup';
  });
}

// ---------- מנוע מדומה ----------
function stubEngine(list, suggest) {
  return {
    consistencyChecks: () => list,
    suggestUseCategory: suggest || ((l) => (/משווק|שכר|מלאי/.test(l) ? 'working' : /מחשב|תנור/.test(l) ? 'capex' : null)),
  };
}

// ---------- 1. הצגת תוצאות consistencyChecks ----------

test('checks: בלי consistencyChecks במנוע – מערך ריק ולא קריסה', () => {
  assert.deepEqual(U.checks({}, designs()), []);
  assert.deepEqual(U.checks(null, designs()), []);
  assert.deepEqual(U.checks({ consistencyChecks: () => { throw new Error('x'); } }, designs()), []);
  assert.deepEqual(U.checks({ consistencyChecks: () => null }, designs()), []);
});

test('checks: מפריד block מ-warn, ומנרמל severity לא מוכר ל-warn', () => {
  const list = U.checks(stubEngine([
    { code: 'cogsOver100', severity: 'block', field: 'forecast.cogsPct', message: 'עלות מכר מעל 100%' },
    { code: 'trackVsYears', severity: 'warn', field: 'loan.track', message: 'מסלול לא מתאים' },
    { code: 'x', severity: 'weird', field: 'loan.purpose', message: 'משהו' },
    { code: 'empty', severity: 'block', field: 'x', message: '' },
  ]), designs());
  assert.equal(list.length, 3, 'הודעה ריקה לא מוצגת');
  assert.deepEqual(U.blocking(list).map((c) => c.code), ['cogsOver100']);
  assert.deepEqual(U.warnings(list).map((c) => c.code), ['trackVsYears', 'x']);
});

test('checks: אותו ניסוח פעמיים מוצג פעם אחת', () => {
  const list = U.checks(stubEngine([
    { code: 'a', severity: 'warn', field: 'loan.purpose', message: 'זהה' },
    { code: 'b', severity: 'warn', field: 'loan.purpose', message: 'זהה' },
  ]), designs());
  assert.equal(list.length, 1);
});

test('checksFor: בדיקה של פריט ("loan.uses.1.type") שייכת גם לשדה "loan.uses"', () => {
  const list = [{ field: 'loan.uses.1.type' }, { field: 'loan.track' }, { field: 'loan.usesX' }];
  assert.equal(U.checksFor(list, 'loan.uses').length, 1);
  assert.equal(U.checksFor(list, 'loan.track').length, 1);
});

test('עסק חדש לא מקבל אזהרות של עסק קיים (גם אם המנוע החזיר אותן)', () => {
  const stub = stubEngine([
    { code: 'yearsMissing', severity: 'block', field: 'business.years', message: 'ותק' },
    { code: 'salesJump', severity: 'warn', field: 'forecast.growthReason', message: 'קפיצה' },
    { code: 'h', severity: 'warn', field: 'history.lastYearSales', message: 'היסטוריה' },
    { code: 'cogsHigh', severity: 'warn', field: 'forecast.cogsPct', message: 'עלות מכר' },
  ]);
  assert.deepEqual(U.checks(stub, newBiz()).map((c) => c.code), ['cogsHigh']);
  assert.equal(U.checks(stub, designs()).length, 4, 'בעסק פועל כולן מוצגות');
});

test('app.js: block חוסם הפקה – במסך הסיכום ובלחיצה על "הצגת התוכנית", עם כפתור לשדה', () => {
  const app = read('app.js');
  assert.ok(app.includes("if (U.blocking(currentChecks()).length) { toast("), 'השער האחרון ב-next()');
  assert.ok(/if \(cBlocks\.length\) \{[\s\S]{0,500}\$\('next'\)\.hidden = true;/.test(app), 'מסך הסיכום מסתיר את הכפתור');
  assert.ok(app.includes('data-focus="${esc(c.field)}">לתיקון</button>'), 'כפתור "לתיקון" שמוביל לשדה');
  assert.ok(app.includes('if (t.dataset.focus) focusField(t.dataset.focus)'), 'הכפתור מעביר את הפוקוס לשדה');
  assert.ok(app.includes('checksBoxHtml(f.k)'), 'באשף: ההודעה ליד השדה');
  assert.ok(app.includes("const cWarns = U.warnings(cks)"), 'warn נכנס לרשימת "כדאי לטפל" ולא חוסם');
});

test('בלי דיאלוגים של הדפדפן גם בשיפור 4', () => {
  const app = read('app.js').replace(/\/\/.*$/gm, '');
  assert.ok(!/\b(window\.)?(confirm|alert|prompt)\s*\(/.test(app));
});

// ---------- 2. א3: קפיצת מחזור ----------

test('א3: "עיצובים" 120,000 ← 255,000 (112%) דורש הסבר; 30% בדיוק לא', () => {
  const j = U.jumpInfo(designs());
  assert.equal(j.needed, true);
  assert.equal(Math.round(j.pct), 113); // 112.5%
  assert.ok(j.pct > 112 && j.pct < 113);
  assert.equal(U.jumpInfo(designs((p) => { p.forecast.annualSales = 150000; })).needed, false, '25% – בלי הסבר');
  assert.equal(U.jumpInfo(designs((p) => { p.forecast.annualSales = 157000; })).needed, true, '30.8% – עם הסבר');
});

test('א3: עסק חדש או בלי מחזור שנה שעברה – אין שדה הסבר', () => {
  assert.equal(U.jumpInfo(newBiz()).needed, false);
  assert.equal(U.jumpInfo(designs((p) => { p.history.lastYearSales = 0; })).needed, false);
});

test('א3: ההסבר נכנס למסמך רק כשיש קפיצה וכתוב הסבר', () => {
  assert.equal(U.jumpDocNote(designs()), '', 'בלי הסבר – אין משפט');
  const p = designs((x) => { x.forecast.growthReason = 'לקוח קבוע חדש מתחילת השנה.'; });
  const note = U.jumpDocNote(p, (x) => String(Math.round(x)));
  assert.ok(note.includes('113%') && note.includes('לקוח קבוע חדש מתחילת השנה') && note.endsWith('.'), note);
  assert.ok(!note.includes('..'), 'בלי נקודה כפולה');
  assert.equal(U.jumpDocNote(designs((x) => { x.forecast.growthReason = 'x'; x.forecast.annualSales = 125000; })), '', 'בלי קפיצה – בלי משפט');
});

test('א3: שם השדה זהה לזה של המנוע, ואזהרת א3 נעלמת אחרי שנכתב הסבר', () => {
  assert.equal(U.JUMP_FIELD, 'forecast.growthReason');
  const stub = stubEngine([{ code: 'salesJump', severity: 'block', field: 'forecast.growthReason', message: 'קפיצה' }]);
  assert.equal(U.checks(stub, designs()).length, 1);
  assert.equal(U.checks(stub, designs((p) => { p.forecast.growthReason = 'לקוח חדש'; })).length, 0);
});

test('א3 באשף: שדה חובה שמופיע בתנאי, ומוצג בפרק התחזית במסמך', () => {
  const app = read('app.js');
  assert.ok(/k: U\.JUMP_FIELD,[^\n]*req: 1[^\n]*showIf: \(p\) => U\.jumpInfo\(p\)\.needed/.test(app));
  assert.ok(app.includes('if (!f.req || !visible(f)'), 'שדה מוסתר לא חוסם');
  const i = app.indexOf('<h2>6. תחזית רווח והפסד');
  const j = app.indexOf('U.jumpDocNote(p');
  const k = app.indexOf('<h2>7. תזרים');
  assert.ok(i > 0 && j > i && j < k, 'ההסבר בפרק 6');
});

// ---------- 3. א4: סיווג פריטים ----------

test('א4: הצעה אוטומטית כל עוד המשתמש לא בחר בעצמו', () => {
  const S = stubEngine([]);
  const u = { item: 'משווק', amount: 80000, type: 'capex' };
  assert.equal(U.autoClassify(S, u), true);
  assert.equal(u.type, 'working');
  assert.equal(U.useRowNote(S, u).level, 'suggest');
  const manual = { item: 'משווק', amount: 80000, type: 'capex', typeManual: true };
  assert.equal(U.autoClassify(S, manual), false, 'בחירה ידנית לא נדרסת');
  assert.equal(manual.type, 'capex');
});

test('א4: בחירה שסותרת את ההצעה → אזהרה מתחת לפריט; פריט בלי מילת מפתח – שקט', () => {
  const S = stubEngine([]);
  const n = U.useRowNote(S, { item: 'משווק', type: 'capex', typeManual: true });
  assert.equal(n.level, 'warn');
  assert.ok(n.text.includes('משווק') && n.text.includes('הון חוזר'), n.text);
  assert.equal(U.useRowNote(S, { item: 'רישוי', type: 'capex' }).level, '');
  assert.equal(U.useRowNote({}, { item: 'משווק', type: 'capex' }).level, '', 'בלי suggestUseCategory – שקט');
});

test('א4: useCategory מקבל גם אובייקט מהמנוע, ומתעלם מערך לא מוכר', () => {
  assert.equal(U.useCategory({ suggestUseCategory: () => ({ type: 'working' }) }, 'x'), 'working');
  assert.equal(U.useCategory({ suggestUseCategory: () => 'other' }, 'x'), null);
  assert.equal(U.useCategory({ suggestUseCategory: () => 'capex' }, ''), null, 'שם ריק – אין הצעה');
});

test('א4 מול המנוע האמיתי (כשהפונקציה קיימת)', { skip: typeof E.suggestUseCategory !== 'function' }, () => {
  assert.equal(U.useCategory(E, 'משווק'), 'working');
  assert.equal(U.useCategory(E, 'תנור מסחרי'), 'capex');
  const u = { item: 'משווק', amount: 80000, type: 'capex' };
  assert.equal(U.autoClassify(E, u), true);
  assert.equal(u.type, 'working');
});

test('א4 באשף: בחירה ידנית מסומנת, וההצעה מעדכנת את הרשימה הנפתחת תוך כדי הקלדה', () => {
  const app = read('app.js');
  assert.ok(app.includes('u.typeManual = true'));
  assert.ok(app.includes("t.dataset.f === 'item' && U.autoClassify(E, u)"));
  assert.ok(app.includes('data-use-note='), 'הערה מתחת לכל פריט');
});

// ---------- 4. א6: ותק ועובדים בלי 0 ----------

const YEARS = { req: 1, nullable: 1, positive: 1, errMsg: 'ריק', zeroMsg: 'אפס' };
const EMPL = { req: 1, nullable: 1, errMsg: 'ריק' };

test('א6: שדה ריק הוא שגיאה בעסק פועל; 0 שנים שגיאה; 0 עובדים תקין; חצי שנה תקין', () => {
  assert.equal(U.numberFieldError(YEARS, null), 'ריק');
  assert.equal(U.numberFieldError(YEARS, ''), 'ריק');
  assert.equal(U.numberFieldError(YEARS, 0), 'אפס');
  assert.equal(U.numberFieldError(YEARS, 0.5), '');
  assert.equal(U.numberFieldError(YEARS, 3), '');
  assert.equal(U.numberFieldError(EMPL, null), 'ריק');
  assert.equal(U.numberFieldError(EMPL, 0), '', 'אין עובדים – תשובה תקינה');
  assert.equal(U.numberFieldError({ nullable: 1 }, null), '', 'שדה שאינו חובה (עסק חדש)');
});

test('א6: שדה ריק נשמר כ-null ולא כ-0', () => {
  const parse = (s) => E.parseAmount(s, false);
  assert.equal(U.nullableNumber('', parse), null);
  assert.equal(U.nullableNumber('  ', parse), null);
  assert.equal(U.nullableNumber('0', parse), 0);
  assert.equal(U.nullableNumber('4', parse), 4);
});

test('א6 באשף: ברירת המחדל ריקה, השדות חובה רק בעסק פועל', () => {
  const app = read('app.js');
  assert.ok(app.includes("years: null, employees: null, description: '', isNew: null"), 'EMPTY בלי 0');
  assert.ok(/k: 'business\.years'[^\n]*req: 1, nullable: 1, positive: 1[^\n]*onlyExisting: 1/.test(app));
  assert.ok(/k: 'business\.employees', label: 'כמה עובדים יש\?'[^\n]*req: 1, nullable: 1/.test(app));
  assert.ok(/k: 'business\.employees', label: 'כמה עובדים תעסיקו בהתחלה\?'(?![^\n]*req: 1)/.test(app), 'בעסק חדש לא חובה');
  assert.ok(app.includes("if (f.onlyExisting && plan.business.isNew !== false) return '';"));
});

// ---------- 5. סעיף ה' ----------

test('ה(א): עסק פועל עם חודשי מינוס – המסמך לא קובע שיש אשראי קיים', () => {
  assert.ok(!/קיימת/.test(U.EXISTING_BRIDGE));
  assert.ok(/לבדוק|יבדוק/.test(U.EXISTING_BRIDGE), 'אותו כיוון כמו בכרטיס: לבדוק מול הבנק');
  const app = read('app.js');
  assert.ok(app.includes('${isNew ? E.bridgeText(isNew, E.workingCapitalTotal(p), res.cash) : U.EXISTING_BRIDGE}'));
});

test('ה(ב): חודש דחוק מוצג פעם אחת במסך הסיכום', () => {
  const thin = { level: 'warn', min: 5000, month: 3, threshold: 50000 };
  assert.equal(U.listThinMonth({ cushion: thin, rating: { level: 'ok' } }), false, 'הכרטיס כבר אומר את זה');
  assert.equal(U.listThinMonth({ cushion: thin, rating: { level: 'warn' } }), true, 'בדירוג גבולי הכרטיס לא אומר – הרשימה כן');
  assert.equal(U.listThinMonth({ cushion: { level: 'ok' }, rating: { level: 'warn' } }), false);
  assert.equal(U.listThinMonth(null), false);
  const app = read('app.js');
  assert.ok(app.includes("else if (U.listThinMonth(res)) fixes.push(cushionText(res, 'wizard', plan))"));
});

// ---------- 6. "עיצובים" מול המנוע האמיתי ----------

test('"עיצובים" מול consistencyChecks האמיתי: יש חסימות/אזהרות, ועסק חדש בלי אזהרות עסק קיים',
  { skip: typeof E.consistencyChecks !== 'function' }, () => {
    const list = U.checks(E, designs());
    const codes = list.map((c) => c.code);
    ['trackVsYears', 'salesJump', 'useCategory', 'shortText'].forEach((c) => assert.ok(codes.includes(c), `חסר ${c}: ${codes}`));
    list.forEach((c) => assert.ok(c.field && strip(c.message).length > 10));
    const fresh = U.checks(E, newBiz()).map((c) => c.field);
    assert.ok(!fresh.some((f) => /^history\.|^business\.years$|^forecast\.growthReason$/.test(f)), String(fresh));
    assert.ok(!U.checks(E, newBiz()).some((c) => c.code === 'trackVsYears'));
    // אחרי שכותבים הסבר – אזהרת הקפיצה נעלמת
    const fixed = U.checks(E, designs((p) => { p.forecast.growthReason = 'לקוח גדול חדש חתם על חוזה שנתי'; }));
    assert.ok(!fixed.some((c) => c.code === 'salesJump'));
  });

// ---------- 7. החלטת מאיר: בדוגמה, מה שהכלי זיהה מוצג כהדגמה ולא כטעות ----------

function samplePlan() {
  const m = read('app.js').match(/const SAMPLE = (\{[\s\S]*?\n  \});/);
  return Function(`return (${m[1]});`)();
}

test('דוגמה: מספרי הדוגמה לא שונו ואין בה הסבר צמיחה (החלטת מאיר)', () => {
  const s = samplePlan();
  assert.equal(s.forecast.openingCash, 40000);
  assert.equal(s.forecast.annualSales, 1600000);
  assert.equal(s.history.lastYearSales, 1150000);
  assert.ok(!('growthReason' in s.forecast));
});

test('דוגמה: הודעת ההדגמה מופיעה בדוגמה, עם כל נקודה שהכלי זיהה', () => {
  const s = samplePlan();
  const res = E.computePlan(s);
  const d = U.sampleDemo(E, s, res);
  assert.ok(d, 'יש הודעה');
  assert.ok(d.intro.includes('השארנו בכוונה') && d.intro.includes('לפני הגשה לבנק') && d.intro.includes('זו לא טעות'), d.intro);
  assert.ok(new RegExp(`${d.items.length} נקודות|נקודה אחת`).test(d.intro), 'המספר בהודעה = מספר הנקודות ברשימה');
  if (res.cushion && res.cushion.level === 'warn') {
    assert.ok(d.items.some((t) => strip(t).includes(`בחודש ${res.cushion.month} התזרים דחוק`)), 'החודש הדחוק ברשימה');
    assert.ok(d.items.every((t) => !t.startsWith('שימו לב')), 'בלי "שימו לב" – זו הדגמה, לא התרעה');
  }
  if (typeof E.consistencyChecks === 'function') {
    assert.ok(d.items.some((t) => /39%/.test(strip(t))), 'קפיצת המחזור (39%) ברשימה');
    assert.equal(d.items.length, 2, 'שתי הנקודות שמאיר ציין');
  }
});

test('דוגמה: בתוכנית רגילה (לא דוגמה) אין הודעת הדגמה, גם עם אותם נתונים בדיוק', () => {
  const s = { ...samplePlan(), isSample: false };
  assert.equal(U.sampleDemo(E, s, E.computePlan(s)), null);
  assert.equal(U.sampleDemo(E, designs(), E.computePlan(designs())), null);
});

test('דוגמה ב-app.js: ההודעה והסימונים במסמך מוצגים רק כש-p.isSample', () => {
  const app = read('app.js');
  assert.ok(app.includes('${sampleDemoHtml(p, res)}'), 'בתיבה שמעל המסמך לדוגמה');
  const fn = (app.match(/function sampleDemoHtml\(p, res\)[\s\S]*?\n  \}/) || [''])[0];
  assert.ok(fn.includes('U.sampleDemo(E, p, res)') && fn.includes('✓ הכלי זיהה'));
  const flags = app.match(/p\.isSample && [^\n]*class="sample-flag"/g) || [];
  assert.equal(flags.length, 2, 'שני סימוני "הכלי זיהה" במסמך, שניהם מותנים ב-p.isSample');
});
