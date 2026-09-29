/**
 * שיפור 4, ספרינט 2 – צד הממשק/המסמך (נדב, 29.09.2026).
 * מקור: docs/IMPROVEMENT-4-SOURCE-v2.md (ג2, ג3) וקוסמטיים פתוחים מ-docs/QA-improvement-4-sprint1.md.
 * engine.js בעבודה אצל אורי במקביל – כאן רק app.js/styles.css.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');
const U = require('../app.js');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const strip = (s) => String(s == null ? '' : s).replace(/[⁦-⁩‎‏]/g, '');
function sample() {
  return new Function(`${(read('app.js').match(/const SAMPLE = \{[\s\S]*?\n  \};/) || [''])[0]}; return SAMPLE;`)();
}
function cafe() {
  return {
    business: { name: 'קפה פינת חן', isNew: true, entity: 'osek', employees: 4, years: null, field: 'בית קפה', description: 'בית קפה שכונתי' },
    owner: {}, market: {}, history: { lastYearSales: 0, lastYearProfit: 0 },
    startup: { equity: 150000, preOpenCosts: 0, deposit: 0, equipmentVat: 0,
      setupCosts: [{ item: 'ציוד ומכונות קפה', amount: 100000 }, { item: 'שיפוץ המקום', amount: 80000 }] },
    forecast: { annualSales: 1800000, rampMonths: 3, growthPct: 5, cogsPct: 30, monthlyFixed: 22000, monthlySalaries: 35000,
      ownerDrawMonthly: 12000, openingCash: 0, salesModel: 'total', daysPerMonth: 26 },
    loan: { track: 'startup', amount: 200000, ratePct: 7.5, years: 5, graceMonths: 0, purpose: 'ציוד ושיפוץ', uses: [] },
  };
}
const sc = (base, down10) => [{ key: 'base', minDscr: base }, { key: 'down10', minDscr: down10 }, { key: 'down20', minDscr: 0.5 }];
const fnSrc = (name) => (read('app.js').match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`)) || [''])[0];

// ---------- ג2 ----------
test('ג2: במאפייה לדוגמה – משפט רגישות עם 1.16 ורף 1.25', () => {
  const s = sample();
  const note = strip(U.sensitivityNote(E.scenarios(s), E.dscrPhrase));
  assert.match(note, /ירידה|נמוכות ב-10%/);
  assert.ok(note.includes('1.16'), note);
  assert.ok(note.includes('1.25'), note);
  assert.ok(note.includes('מרווח צר'), 'הרמה לפי ב4 (1.0–1.25)');
  assert.equal((note.match(/[.!?](\s|$)/g) || []).length, 1, 'משפט אחד');
  assert.equal(strip(U.sensitivityNote(E, s)), note, 'חתימה (E, plan) – אותו משפט');
});

test('ג2: אין משפט כשהיחס אחרי ירידה של 10% הוא 1.25 ומעלה', () => {
  assert.equal(U.sensitivityNote(sc(1.9, 1.25)), '');
  assert.equal(U.sensitivityNote(sc(1.9, 1.4)), '');
  assert.equal(U.sensitivityNote(sc(2, 1.2496)), '', '1.2496 מוצג 1.25 – לא נכתוב "1.25, מתחת ל-1.25"');
  assert.notEqual(U.sensitivityNote(sc(2, 1.2449)), '');
});

test('ג2: אין משפט כשתרחיש הבסיס כבר מתחת ל-1.25, או כשאין נתונים', () => {
  assert.equal(U.sensitivityNote(sc(1.1, 0.9)), '');
  assert.equal(U.sensitivityNote(sc(Infinity, Infinity)), '', 'בלי החזרים');
  assert.equal(U.sensitivityNote([]), '');
  assert.equal(U.sensitivityNote(null), null, 'קלט לא תקין');
});

test('ג2: מתחת ל-1.0 – הניסוח של ב4 ("לא יעמוד בהחזרים")', () => {
  const note = U.sensitivityNote(sc(1.5, 0.8), E.dscrPhrase);
  assert.ok(note.includes('0.80') && note.includes('לא יעמוד בהחזרים'), note);
});

test('ג2: המשפט נכנס לתקציר המנהלים במסמך (פסקת יחס הכיסוי)', () => {
  const fn = fnSrc('renderDocument');
  assert.ok(fn.includes('U.sensitivityNote(E.scenarios(p), E.dscrPhrase)'));
  const summary = fn.slice(fn.indexOf('1. תקציר מנהלים'), fn.indexOf('2. תיאור העסק'));
  assert.ok(summary.includes('${sensitivity ? ` ${dt(sensitivity)}` : \'\'}'), 'המשפט בתוך פרק 1');
});

test('ג2: בקפה פינת חן (בהקמה, יחס גבוה) אין משפט רגישות', () => {
  const list = E.scenarios(cafe());
  assert.ok(list.find((s) => s.key === 'down10').minDscr >= 1.25, 'בקפה הירידה של 10% נשארת מעל 1.25 (כ-1.54)');
  assert.equal(U.sensitivityNote(list, E.dscrPhrase), '');
});

// ---------- ג3 ----------
test('ג3: בעסק פועל אין כרטיס "חודש האיזון"; בעסק בהקמה יש', () => {
  const s = sample();
  const existing = U.visibleMetrics(E.headlineMetrics(s, E.computePlan(s)), s);
  assert.ok(!existing.some((m) => m.key === 'breakeven' || /חודש האיזון/.test(m.label)));
  assert.equal(existing.length, 4);
  const c = cafe();
  const fresh = U.visibleMetrics(E.headlineMetrics(c, E.computePlan(c)), c);
  assert.ok(fresh.some((m) => m.key === 'breakeven'));
  assert.equal(fresh.length, 5);
});

test('ג3: המסמך משתמש בכרטיסים המסוננים, ומספר העמודות לפי מספר הכרטיסים', () => {
  const fn = fnSrc('metricsHtml');
  assert.ok(fn.includes('U.visibleMetrics(E.headlineMetrics(p, res), p)'));
  assert.ok(fn.includes('style="--cols:${cards.length}"'));
  assert.match(read('styles.css'), /\.doc-metrics \{[^}]*repeat\(var\(--cols, 5\)/);
});

// ---------- קוסמטיים ----------
test('קוסמטי: משפט הרזרבה צמוד לכרטיס היתרה – הכרטיס עובר לסוף השורה כשיש רזרבה', () => {
  const fn = fnSrc('metricsHtml');
  assert.ok(fn.includes("has-reserve") && fn.includes('metric-key-${m.key}'));
  assert.match(read('styles.css'), /\.doc-metrics\.has-reserve \.metric-key-cash \{ order: 1; \}/);
  assert.ok(E.reserveNote(cafe(), E.computePlan(cafe())), 'בקפה יש משפט רזרבה');
});

test('ג1: בתקציר של עסק פועל – "העסק ... פועל", לא "[שם העסק] פועל"', () => {
  const fn = fnSrc('renderDocument');
  assert.ok(!fn.includes('`${dtl(b.name)} פועל'), 'אין יותר "מאפיית השכונה פועל"');
  assert.ok(fn.includes("${dtl(b.name) ? `העסק, ${dtl(b.name)},` : 'העסק'} פועל ${dt(E.yearsText(b.years))}"));
});

test('קוסמטי: שדה הסבר הקפיצה שומר את ההסבר גם כשמוצגת שגיאה', () => {
  const app = read('app.js');
  assert.match(app, /k: U\.JUMP_FIELD,[^\n]*keepHint: 1/);
  assert.ok(app.includes('hint && (!bad || f.keepHint)'));
});

test('קוסמטי: שורת "הון חוזר" בתזרים מוסברת בהערה שמתחת לטבלה', () => {
  assert.ok(fnSrc('renderDocument').includes('שורת "הון חוזר (לפי פירוט השימושים)" היא'));
});

test('ה: עסק פועל עם מינוס – המסמך לא אומר "מסגרת אשראי קיימת"', () => {
  assert.ok(!/מסגרת אשראי קיימת/.test(read('app.js')));
  assert.ok(!/מסגרת אשראי/.test(U.EXISTING_BRIDGE));
});

// ---------- ב3: ניסוח הסף ----------
test('ב3: המשפט על הסף כבר לא אומר "הוצאות קבועות ושכר" כשהסף כולל עלות מכר', () => {
  const app = read('app.js');
  assert.ok(!/חודש אחד של הוצאות קבועות ושכר \(/.test(app));
  const fn = fnSrc('cushionText');
  assert.equal((fn.match(/U\.thresholdLabel\(c\)/g) || []).length, 2, 'בשני הענפים (דחוק ותקין)');
  const c = E.computePlan(sample()).cushion;
  assert.ok(c.thresholdParts.cogs > 0);
  assert.match(U.thresholdLabel(c), /עלות מכר/);
  assert.match(U.thresholdLabel(c), /סחורה וחומרי גלם/, 'עם הסבר בשפה פשוטה');
  assert.equal(U.thresholdLabel({ thresholdParts: { fixed: 1, salaries: 1, cogs: 0 } }), 'הוצאות קבועות ושכר', 'בלי עלות מכר – הניסוח הקצר');
});

// ---------- ב5: טבלת התרחישים ----------
test('ב5: כותרת העמודה "לאורך כל תקופת ההלוואה", ומתחת לסכום – החודש והשנה', () => {
  const fn = fnSrc('scenariosHtml');
  assert.ok(fn.includes('יתרת מזומן מינימלית (לאורך כל תקופת ההלוואה)'));
  assert.ok(fn.includes('<span class="sc-when">${dt(s.minCashText)}</span>'));
  assert.match(read('styles.css'), /\.doc table\.scenarios \.sc-when \{/);
  const list = E.scenarios(sample());
  assert.ok(list.every((s) => typeof s.minCashText === 'string' && /^חודש \d+/.test(strip(s.minCashText))), list.map((s) => s.minCashText).join(' | '));
});

test('ב5: משפט כשהשנה הראשונה חיובית ושנה מאוחרת במינוס; אחרת ריק', () => {
  const res = { cushion: { min: 20000, month: 3 }, cushionPeriod: { min: -99351, month: 60 } };
  const note = strip(U.laterNegativeNote(res, E.periodMonthText, E.ils));
  assert.ok(note.includes(strip(E.periodMonthText(60))), note);
  assert.match(note, /99,351/);
  assert.match(note, /מינוס של 99,351/);
  assert.ok(!/-99/.test(note), "בלי סימן מינוס");
  assert.equal((note.match(/[.!?](\s|$)/g) || []).length, 1, 'משפט אחד');
  assert.equal(U.laterNegativeNote({ cushion: { min: -5 }, cushionPeriod: { min: -9, month: 20 } }), '', 'שנה 1 כבר במינוס – יש לזה משפט משלו');
  assert.equal(U.laterNegativeNote({ cushion: { min: 5 }, cushionPeriod: { min: 5, month: 20 } }), '');
  assert.equal(U.laterNegativeNote({ cushion: { min: 5 } }), '', 'בלי נתוני תקופה');
  assert.equal(U.laterNegativeNote(E.computePlan(sample()), E.periodMonthText, E.ils), '', 'המאפייה: כל התקופה חיובית');
});

test('ב5: המשפט נכנס גם לסיכום באשף וגם לסיכונים במסמך', () => {
  const app = read('app.js');
  // באשף פעם אחת; במסמך: בדיקה, ואז הניסוח העובדתי ('doc') – תיקון באג 3 של QA ספרינט 2
  assert.equal((app.match(/U\.laterNegativeNote\(res, E\.periodMonthText, ils\)/g) || []).length, 2);
  assert.equal((app.match(/U\.laterNegativeNote\(res, E\.periodMonthText, ils, 'doc'\)/g) || []).length, 1);
});

test('בלי alert/confirm/prompt', () => {
  assert.ok(!/\b(alert|confirm|prompt)\s*\(/.test(read('app.js')));
});
