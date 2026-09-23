// בדיקות לשיפור 2: יכולת החזר, "מה אפשר לעשות", הפסד בשנה שעברה ומסלול עסק בהקמה.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');
const C = require('../calculator.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
// המקרה של מאיר: מחזור 650,000 ₪, בקשה 1,000,000 ₪, ריבית 7.5%, 5 שנים
const MEIR = { amount: 1000000, ratePct: 7.5, years: 5, graceMonths: 0, annualSales: 650000 };

// ---------- 1. אחוז ההחזר מתוך המחזור ----------

test('יכולת החזר: הספים שאושרו – עד 12% תקין, 12–20 אזהרה, מעל 20 אזהרה חזקה', () => {
  assert.equal(E.AFFORD.okPct, 12);
  assert.equal(E.AFFORD.riskPct, 20);
  const sales = 10000; // מחזור חודשי עגול, כדי שהאחוז יהיה ישיר
  assert.equal(E.affordLevel(1199, sales).level, 'ok');
  assert.equal(E.affordLevel(1200, sales).level, 'ok', '12% עצמו עדיין תקין');
  assert.equal(E.affordLevel(1201, sales).level, 'warn');
  assert.equal(E.affordLevel(2000, sales).level, 'warn', '20% עצמו עדיין אזהרה רגילה');
  assert.equal(E.affordLevel(2001, sales).level, 'risk');
  near(E.affordLevel(1500, sales).pct, 15, 0.001);
});

test('יכולת החזר: בלי מחזור אין בדיקה (עסק בהקמה במחשבון) – null, ולא 0%', () => {
  assert.equal(E.affordLevel(5000, 0), null);
  assert.equal(E.affordLevel(5000, null), null);
  assert.equal(C.calculate({ amount: 300000, ratePct: 7.5, years: 5, graceMonths: 0 }, E).afford, null);
  assert.equal(C.advice({ amount: 300000, ratePct: 7.5, years: 5, graceMonths: 0 }, C.calculate({ amount: 300000, ratePct: 7.5, years: 5, graceMonths: 0 }, E), E), null);
});

test('יכולת החזר: המקרה של מאיר – כ-37% מההכנסה החודשית, רמה "לא סביר"', () => {
  const r = C.calculate(MEIR, E);
  assert.equal(r.withinCap, false, '1,000,000 מעל התקרה של 650,000 מחזור');
  near(r.monthlyPayment, 20038, 40);
  near(r.afford.pct, 37, 0.6);
  assert.equal(r.afford.level, 'risk');
});

test('יכולת החזר: גם 500,000 ₪ (בתוך התקרה) על מחזור 650,000 יוצא "גבולי"', () => {
  const r = C.calculate({ ...MEIR, amount: 500000 }, E);
  assert.equal(r.withinCap, true);
  near(r.monthlyPayment, 10019, 40);
  near(r.afford.pct, 18.5, 0.5);
  assert.equal(r.afford.level, 'warn');
});

// ---------- 2. "מה אפשר לעשות" – מספרים אמיתיים ----------

test('שפיצר מהסוף להתחלה: loanForPayment הוא ההופכי של spitzerPayment', () => {
  for (const [p, rate, n] of [[6500, 7.5, 60], [1933.28, 6, 60], [500, 0, 36]]) {
    near(E.loanForPayment(E.spitzerPayment(E.loanForPayment(p, rate, n), rate, n), rate, n), E.loanForPayment(p, rate, n), 0.01);
  }
  near(E.loanForPayment(6500, 7.5, 60), 324396, 200);
  assert.equal(E.loanForPayment(0, 7.5, 60), 0);
  assert.equal(E.loanForPayment(1000, 7.5, 0), 0);
  assert.equal(E.loanForPayment(1000, 0, 36), 36000, 'ריבית 0: סכום = החזר × חודשים');
});

test('מה אפשר לעשות: סכום מומלץ לפי סף 12% – כ-325,000 ₪ בהחזר של כ-6,500 ₪', () => {
  const o = E.repaymentOptions(MEIR, (650000 / 12) * 0.12);
  assert.equal(o.suggestedAmount, 325000, 'מעוגל ל-5,000 הקרובים');
  near(o.suggestedPayment, 6512, 20);
  near(o.suggestedPayment / (650000 / 12) * 100, 12, 0.2);
  assert.equal(o.gap, 675000);
});

test('מה אפשר לעשות: הארכה ל-5 שנים וגרייס – המספרים מה-PRD', () => {
  const short = E.repaymentOptions({ ...MEIR, years: 3 }, 6500);
  near(short.current, 31108, 40);
  near(short.extend.payment, 20038, 40);
  near(short.extend.saving, 11070, 60);
  assert.equal(short.extend.years, 5);

  const g = E.repaymentOptions(MEIR, 6500).grace;
  assert.equal(g.months, 6);
  near(g.during, 6250, 1, 'בגרייס משלמים ריבית בלבד');
  near(g.after, 21876, 40, 'אחרי הגרייס ההחזר גבוה יותר – גרייס קונה זמן, לא פותר');
  assert.ok(g.after > g.current, 'אחרי הגרייס ההחזר גדול מההחזר בלי גרייס');
});

test('מה אפשר לעשות: מי שכבר במקסימום לא מקבל הצעה להאריך או להוסיף גרייס', () => {
  const o = E.repaymentOptions({ ...MEIR, years: 5, graceMonths: 6 }, 6500);
  assert.equal(o.extend, null);
  assert.equal(o.grace, null);
  assert.equal(o.atMaxYears, true);
  assert.equal(o.atMaxGrace, true);
});

test('KPI 1: בכל מקרה שעובר את סף האזהרה מוצגת לפחות הצעה אחת עם מספר מחושב', () => {
  const cases = [
    MEIR,
    { ...MEIR, amount: 500000 },
    { ...MEIR, years: 3, amount: 400000 },
    { amount: 300000, ratePct: 9, years: 5, graceMonths: 6, annualSales: 200000 },
    { amount: 60000, ratePct: 5, years: 2, graceMonths: 0, annualSales: 150000 },
  ];
  for (const c of cases) {
    const r = C.calculate(c, E);
    assert.ok(r.afford && r.afford.level !== 'ok', `${c.amount}: המקרה אמור לעבור את הסף`);
    const a = C.advice(c, r, E);
    assert.ok(a && a.items.length, `${c.amount}: חסר כרטיס "מה אפשר לעשות"`);
    assert.ok(a.items.length <= 4, 'עד 4 פריטים');
    assert.ok(a.items.some((it) => /\d/.test(it.lead)), `${c.amount}: אף הצעה לא כוללת מספר מחושב`);
  }
  // מתחת לסף: אין כרטיס
  const okCase = { amount: 100000, ratePct: 7.5, years: 5, graceMonths: 0, annualSales: 3000000 };
  const okRes = C.calculate(okCase, E);
  assert.equal(okRes.afford.level, 'ok');
  assert.equal(C.advice(okCase, okRes, E), null);
});

test('ניסוח זהיר: אומדן ולא הבטחה, ובלי להציג את הסף ככלל רשמי', () => {
  const js = read('calculator.js');
  assert.ok(C.NOTE_ESTIMATE.includes('לא כלל רשמי של בנק או של הקרן'));
  assert.ok(C.NOTE_ESTIMATE.includes('ביטחונות'), 'ליד התוצאה מוסבר שהאישור תלוי גם בדברים נוספים');
  assert.ok(C.AFFORD_TEXT.ok.startsWith('✓'));
  for (const bad of ['יאושר', 'מובטח', 'בטוח תקבלו']) {
    assert.ok(!js.includes(bad), `ניסוח מבטיח: ${bad}`);
  }
  const a = C.advice(MEIR, C.calculate(MEIR, E), E);
  assert.ok(a.items[0].text.includes('אומדן לבדיקה מול הבנק'), 'הסכום המומלץ מוצג כאומדן, לא כהחלטה');
  const funds = a.items.find((it) => it.href);
  assert.ok(funds && funds.text.includes('כדאי לבדוק זכאות ישירות מול הגוף הרלוונטי'));
});

test('המחשבון מציג את שורת האחוז, את שלוש הרמות ואת הערת האומדן', () => {
  const html = read('calculator.html');
  const js = read('calculator.js');
  assert.ok(js.includes('ההחזר לוקח כ-${pct0(r.afford.pct)} מההכנסה החודשית שלכם'));
  assert.ok(html.includes('id="r-note"'), 'שורת ההערה מתחת ל-verdict');
  assert.ok(html.includes('id="r-help"') && html.includes('calc-card help-card'), 'כרטיס "מה אפשר לעשות" בסגנון calc-card');
  assert.ok(js.includes('מה אפשר לעשות') && !js.includes('<h2>אזהרות'), 'כותרת חיובית');
  const css = read('styles.css');
  assert.match(css, /\.helps li \{[^}]*var\(--ledger-soft\)/, 'ההצעות בטון ledger-soft');
  assert.ok(!/\.helps li \{[^}]*warn-bg/.test(css) && !/\.helps li \{[^}]*risk-bg/.test(css), 'לא צבעי אזהרה');
});

// ---------- 3. הפסד בשנה שעברה ----------

test('KPI 2: מינוס בשדה "רווח שנה שעברה" נשמר, ובשדות כסף אחרים נזרק', () => {
  assert.equal(E.parseAmount('-40,000', true), -40000);
  assert.equal(E.parseAmount('−40000', true), -40000); // מינוס טיפוגרפי מהדבקה
  assert.equal(E.parseAmount('-40,000', false), 40000, 'מחזור או הוצאה לא יכולים להיות שליליים');
  assert.equal(E.parseAmount('40,000', true), 40000);
  assert.equal(E.parseAmount('', true), 0);
  assert.equal(E.parseAmount('-', true), 0);
  assert.equal(E.moneyText(-40000), '-40,000');
  assert.equal(E.moneyText(40000), '40,000');
});

test('KPI 2: הפסד מוצג כ"הפסד של X ₪", לא כ"רווח של -X ₪"', () => {
  assert.ok(E.profitText(-40000).startsWith('הפסד של'));
  assert.ok(E.profitText(-40000).includes('40,000'));
  assert.ok(!E.profitText(-40000).includes('-40,000'));
  assert.ok(E.profitText(160000).startsWith('רווח של'));
  assert.equal(E.profitText(0), 'איזון');
  const app = read('app.js');
  assert.ok(/lastYearProfit'[^}]*signed: 1/.test(app), 'רק שדה הרווח מסומן signed');
  assert.ok(/lastYearProfit'[^}]*עם מינוס/.test(app), 'ההסבר על המינוס מופיע ליד השדה');
  assert.ok(!/lastYearSales'[^}]*signed: 1/.test(app), 'שדה המחזור לא מקבל מינוס');
  assert.ok(app.includes('profitText(p.history.lastYearProfit)'), 'התקציר משתמש בניסוח הפסד/רווח');
  assert.ok(!app.includes('והרווח ב-${ils(p.history.lastYearProfit)}'), 'הניסוח הישן ("רווח של -X") הוסר');
});

// ---------- 4. עסק חדש שעוד לא נפתח ----------

test('עסק בהקמה: הון עצמי מתוך סך ההשקעה, מול 20% הנהוג', () => {
  assert.equal(E.AFFORD.minEquityPct, 20);
  const ok = E.equityShare(100000, 400000);
  near(ok.pct, 20, 0.001);
  assert.equal(ok.below, false);
  assert.equal(ok.total, 500000);
  const low = E.equityShare(50000, 450000);
  near(low.pct, 10, 0.001);
  assert.equal(low.below, true);
  assert.equal(E.equityShare(0, 0), null, 'בלי נתונים אין מה להציג');
  assert.equal(E.equityShare(0, 300000).below, true);
});

test('עסק בהקמה: שלב "הקמת העסק" מחליף את "הכנסות", בלי שאלות על השנה שעברה', () => {
  const app = read('app.js');
  const setup = (app.match(/const STEP_SETUP = \{[\s\S]*?\n  \] \};/) || [''])[0];
  assert.ok(setup, 'חסר שלב "הקמת העסק"');
  assert.ok(!setup.includes('history.'), 'אין בשלב הזה שאלות על השנה שעברה');
  for (const k of ['startup.setupCosts', 'startup.openDate', 'startup.equity', 'forecast.rampMonths', 'owner.experience']) {
    assert.ok(setup.includes(k), `חסר שדה ${k}`);
  }
  assert.ok(setup.includes('מאפס'), 'ה-ramp מנוסח מחדש כהגעה לקצב מלא מאפס');
  assert.ok(setup.includes('ההוכחה העיקרית שהבנק רואה'), 'ניסיון הבעלים מודגש');
  assert.ok(app.includes('i === 2 && isNew ? STEP_SETUP : s'), 'ההחלפה היא של אותו שלב, לא שלב נוסף');
  assert.ok(app.includes('return BASE_STEPS.map('), 'מספר השלבים נשמר (map, לא filter/concat)');
  const base = (app.match(/const BASE_STEPS = \[[\s\S]*?\n  \];/) || [''])[0];
  const count = base.split('name:').length - 1 + (base.includes('STEP_INCOME') ? 1 : 0);
  assert.equal(count, 6, 'נשארו 6 שלבים');
});

test('עסק בהקמה: מסלול "עסקים בהקמה" נבחר אוטומטית', () => {
  const app = read('app.js');
  assert.ok(app.includes("plan.loan.track = isNew ? 'startup' : 'general'"));
  assert.equal(E.TRACKS.startup, 'מסלול לעסקים בהקמה');
  assert.ok(/type: 'static', onlyNew: 1, value: \(\) => E\.TRACKS\.startup/.test(app), 'המשתמש לא נשאל על המסלול');
});

test('KPI 4: המסמך של עסק חדש לא מדבר על היסטוריה שלא קיימת', () => {
  const app = read('app.js');
  assert.ok(app.includes('const isNew = isNewBiz(p)'), 'המסמך מתבסס על הדגל החדש, לא רק על ותק');
  assert.ok(app.includes("b.isNew === true || (b.isNew == null && !b.years)"), 'תוכנית ישנה נופלת חזרה לוותק');
  assert.ok(!app.includes('פועל 0 שנים'));
  assert.ok(app.includes('הוא עסק חדש בתחום'), 'תקציר המנהלים מנוסח לעסק חדש');
  assert.ok(app.includes('העסק טרם נפתח; ההנחות בתחזית מבוססות על תוכנית העסק'), 'הנחות התחזית – פרק 6');
  assert.ok(app.includes('מקורות המימון') && app.includes('סה"כ השקעה'), 'מקורות ושימושים – פרק 5');
  assert.ok(app.includes('בעסק חדש כל התחזית מבוססת על הערכה ולא על ביצועים בפועל'), 'אזהרת אי-ודאות – פרק 9');
  assert.ok(app.includes('טוב לדעת מראש') && app.includes('נהוג לדרוש הון עצמי'), 'תיבת המידע על ההון העצמי');
  assert.ok(app.includes('ערבות אישית של הבעלים'), 'טקסט קבוע על ביטחונות וערבות');
  assert.ok(/COLLATERAL_TEXT[\s\S]{0,400}התנאים המדויקים נקבעים מול הבנק והקרן/.test(app), 'הביטחונות מוצגים כמידע, לא כחישוב של הכלי');
});

test('עסק בהקמה: תיבת ההון העצמי היא מידע (ledger-soft), לא אזהרה', () => {
  const css = read('styles.css');
  assert.match(css, /\.goodtoknow \{[^}]*var\(--ledger-soft\)/);
  assert.ok(!/\.goodtoknow \{[^}]*(warn-bg|risk-bg)/.test(css));
  const app = read('app.js');
  const box = (app.match(/function goodToKnowHtml\(\)[\s\S]*?\n  \}/) || [''])[0];
  assert.ok(!box.includes('class="dot"') && !box.includes('verdict'), 'אין נקודת אזהרה');
  assert.ok(app.includes('בחירת סוג עסק') || css.includes('.choice-cards'), 'שני כרטיסי בחירה בתחילת האשף');
  assert.match(css, /\.choice \{[^}]*min-height: 90px/);
});

test('המנוע מחשב תוכנית של עסק חדש בלי היסטוריה (מכירות מתחילות מאפס)', () => {
  const p = {
    business: { name: 'עסק חדש', isNew: true, years: 0 },
    history: { lastYearSales: 0, lastYearProfit: 0 },
    startup: { equity: 100000, openDate: 'מרץ 2027', setupCosts: [{ item: 'שיפוץ', amount: 150000 }] },
    forecast: { annualSales: 900000, rampMonths: 6, growthPct: 10, cogsPct: 35, monthlyFixed: 12000, monthlySalaries: 8000, ownerDrawMonthly: 8000, taxRatePct: 20, openingCash: 50000 },
    loan: { track: 'startup', amount: 300000, ratePct: 7.5, years: 5, graceMonths: 6, uses: [{ item: 'שיפוץ', amount: 300000, type: 'capex' }] },
  };
  const res = E.computePlan(p);
  assert.ok(res.years[0].revenue < p.forecast.annualSales, 'שנה ראשונה חלקית – ramp מאפס');
  assert.ok(Number.isFinite(res.minDscr));
  assert.equal(res.cap, 500000);
  assert.deepEqual(res.warnings, [], 'תוכנית תקינה של עסק בהקמה לא מייצרת אזהרות שווא');
});

test('בלי דיאלוגים של הדפדפן גם אחרי השיפור', () => {
  for (const f of ['app.js', 'calculator.js', 'engine.js', 'calculator.html', 'index.html']) {
    assert.ok(!/\b(window\.)?(confirm|alert|prompt)\s*\(/.test(read(f)), `${f}: נמצא דיאלוג חוסם`);
  }
});

// ---------- 5. סבב QA שני: ניסוח חודשי המינוס וסתירת עלויות ההקמה ----------

test('חודשי מינוס: כל 12 החודשים מנוסחים כמשפט אחד, ולא כרשימה', () => {
  const all = E.negativeMonthsText([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(all, 'בכל חודשי השנה הראשונה');
  assert.ok(!/\d/.test(all), 'אין מספרי חודשים ברשימה כשכל השנה במינוס');
});

test('חודשי מינוס: רצף מוצג כטווח, חודש בודד בלשון יחיד, ורשימה רק כשאין רצף', () => {
  assert.equal(E.negativeMonthsText([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'בחודשים 2–12 של השנה הראשונה');
  assert.equal(E.negativeMonthsText([3, 4]), 'בחודשים 3–4 של השנה הראשונה');
  assert.equal(E.negativeMonthsText([7]), 'בחודש 7 של השנה הראשונה');
  assert.equal(E.negativeMonthsText([2, 5, 9]), 'בחודשים 2, 5, 9 של השנה הראשונה');
});

test('חודשי מינוס: בלי חודשים שליליים אין טקסט בכלל', () => {
  assert.equal(E.negativeMonthsText([]), '');
  assert.equal(E.negativeMonthsText(null), '');
  assert.equal(E.negativeMonthsText(undefined), '');
});

test('חודשי מינוס: אותו ניסוח משמש גם במסך הסיכום וגם בפרק 9 במסמך', () => {
  const app = read('app.js');
  const hits = app.match(/E\.negativeMonthsText\(res\.negativeMonths\)/g) || [];
  assert.equal(hits.length, 2, 'שני מקומות: מסך הסיכום והמסמך');
  assert.ok(!/negativeMonths\.join\(/.test(app), 'הרשימה הישנה ("1, 2, 3, ...") הוסרה');
});

test('סתירת הקמה: שימושי הלוואה גבוהים מעלויות ההקמה מחזירים הסבר עם שני הסכומים', () => {
  const plan = {
    startup: { setupCosts: [{ item: 'שיפוץ', amount: 150000 }] },
    loan: { uses: [{ item: 'ציוד', amount: 200000 }, { item: 'הון חוזר', amount: 80000 }] },
  };
  const msg = E.setupMismatch(plan);
  assert.ok(msg, 'יש סתירה ולכן יש הודעה');
  assert.ok(msg.includes('150,000') && msg.includes('280,000'), 'שני הסכומים מופיעים בהודעה');
  assert.ok(!/DSCR|רמפ|capex/i.test(msg), 'בלי ז\'רגון');
});

test('סתירת הקמה: אין הודעה כשהעלויות מכסות את השימושים, כשאין עלויות, או על הפרש זניח', () => {
  const mk = (setup, uses) => ({ startup: { setupCosts: [{ item: 'א', amount: setup }] }, loan: { uses: [{ item: 'ב', amount: uses }] } });
  assert.equal(E.setupMismatch(mk(300000, 280000)), null, 'עלויות ההקמה גדולות מהשימושים');
  assert.equal(E.setupMismatch(mk(280000, 280000)), null, 'שווה');
  assert.equal(E.setupMismatch(mk(0, 280000)), null, 'לא מילאו עלויות הקמה – לא מטרידים');
  assert.equal(E.setupMismatch(mk(280000, 280001)), null, 'הפרש של שקל הוא עיגול, לא סתירה');
  assert.equal(E.setupMismatch({}), null);
  assert.equal(E.setupMismatch(null), null);
});

test('סתירת הקמה: האזהרה לא נכנסת ל-validatePlan ולכן לא שוברת תוכנית תקינה', () => {
  const plan = {
    forecast: { annualSales: 900000 },
    startup: { setupCosts: [{ item: 'שיפוץ', amount: 150000 }] },
    loan: { track: 'startup', amount: 300000, ratePct: 7.5, years: 5, graceMonths: 6, uses: [{ item: 'שיפוץ', amount: 300000, type: 'capex' }] },
  };
  assert.deepEqual(E.validatePlan(plan), [], 'validatePlan נשאר נקי');
  assert.ok(E.setupMismatch(plan), 'הסתירה עצמה כן מזוהה בנפרד');
});
