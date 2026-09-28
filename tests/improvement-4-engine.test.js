/**
 * שיפור 4, ספרינט 1 – חלק המנוע (אורי, 28.09.2026).
 * מקור: docs/IMPROVEMENT-4-SOURCE-v2.md (א1–א7, ב1, ב4, ה': taxSpread(null) והערת תרחיש בסיס במינוס).
 * לכל code בדיקה חיובית (מתריע) ושלילית (לא מתריע), ובסוף תרחיש "עיצובים" מהמקור.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');

const strip = (s) => String(s == null ? '' : s).replace(/[⁦-⁩‎‏]/g, '');
const codes = (p) => E.consistencyChecks(p).map((c) => c.code);
const find = (p, code) => E.consistencyChecks(p).find((c) => c.code === code);

/** עסק פועל תקין לגמרי – אף בדיקת עקביות לא אמורה לעלות עליו */
function clean(over) {
  const p = {
    business: { name: 'נגריית הגליל', isNew: false, entity: 'osek', years: 4, employees: 2, field: 'נגרות',
      description: 'נגרייה שמייצרת ומתקינה ארונות מטבח ורהיטים בהזמנה אישית לבתים פרטיים באזור הצפון.' },
    owner: { name: 'דנה', experience: 'שמונה שנות ניסיון כנגרית, מתוכן ארבע שנים בניהול הנגרייה.' },
    market: { customers: 'משפחות שמשפצות דירה, קבלני שיפוצים ומעצבי פנים באזור הצפון.',
      advantage: 'עבודה מדויקת לפי מידה, זמני אספקה קצרים ואחריות של חמש שנים על כל עבודה.' },
    history: { lastYearSales: 900000, lastYearProfit: 120000 },
    forecast: { annualSales: 1000000, rampMonths: 2, growthPct: 5, cogsPct: 40, monthlyFixed: 15000,
      monthlySalaries: 25000, ownerDrawMonthly: 12000, openingCash: 50000 },
    loan: { track: 'general', amount: 200000, ratePct: 7.5, years: 5, graceMonths: 0,
      purpose: 'רכישת מסור CNC שיקצר את זמני הייצור',
      uses: [{ item: 'מכונת CNC', amount: 150000, type: 'capex' }, { item: 'חומרי גלם ומלאי', amount: 50000, type: 'working' }] },
  };
  return over ? over(p) || p : p;
}

test('בסיס: תוכנית תקינה לא מעלה אף בדיקת עקביות', () => {
  assert.deepEqual(E.consistencyChecks(clean()), []);
});

test('מבנה: כל פריט הוא { code, severity, field, message } בעברית, בלי ז\'רגון באנגלית', () => {
  const p = clean((x) => { x.loan.track = 'startup'; x.forecast.cogsPct = 120; x.business.description = 'נגרייה'; });
  const list = E.consistencyChecks(p);
  assert.ok(list.length >= 3);
  list.forEach((c) => {
    assert.deepEqual(Object.keys(c).sort(), ['code', 'field', 'message', 'severity']);
    assert.ok(['block', 'warn'].includes(c.severity));
    assert.ok(/[א-ת]/.test(c.message) && !/DSCR|EBITDA|COGS|capex/i.test(c.message));
  });
});

// ---------- א1 ----------
test('א1 trackVsYears: עסק שפועל שנה ומעלה במסלול הקמה – אזהרה עם הצעה למסלול הכללי', () => {
  const c = find(clean((x) => { x.loan.track = 'startup'; x.business.years = 1; }), 'trackVsYears');
  assert.ok(c);
  assert.equal(c.severity, 'warn');
  assert.equal(c.field, 'loan.track');
  assert.ok(c.message.includes(E.TRACKS.general), c.message);
});
test('א1 trackVsYears: לא עולה במסלול הכללי, ולא בעסק בהקמה', () => {
  assert.ok(!codes(clean()).includes('trackVsYears'));
  const fresh = clean((x) => { x.business.isNew = true; x.business.years = 0; x.loan.track = 'startup'; });
  assert.ok(!codes(fresh).includes('trackVsYears'));
});

// ---------- א2 ----------
test('א2 purposeStaff: "עובדים" / "העסקה" / "גיוס" במטרה, והשכר 0', () => {
  ['גיוס שני עובדים לייצור', 'מימון העסקה של מתקין', 'לגיוס צוות'].forEach((purpose) => {
    const c = find(clean((x) => { x.loan.purpose = purpose; x.forecast.monthlySalaries = 0; }), 'purposeStaff');
    assert.ok(c, purpose);
    assert.equal(c.field, 'forecast.monthlySalaries');
  });
});
test('א2 purposeStaff: לא עולה כשיש שכר, או כשאין מילת מפתח', () => {
  assert.ok(!codes(clean((x) => { x.loan.purpose = 'גיוס עובדים'; })).includes('purposeStaff'));
  assert.ok(!codes(clean((x) => { x.forecast.monthlySalaries = 0; })).includes('purposeStaff'));
});
test('א2 purposePremises: "שכירות" / "מתחם" / "מקום" במטרה, והוצאות קבועות מתחת ל-3,000', () => {
  ['שכירות אולם תצוגה', 'מעבר למתחם גדול', 'שיפוץ המקום'].forEach((purpose) => {
    const c = find(clean((x) => { x.loan.purpose = purpose; x.forecast.monthlyFixed = 2000; }), 'purposePremises');
    assert.ok(c, purpose);
    assert.equal(c.field, 'forecast.monthlyFixed');
  });
});
test('א2 purposePremises: לא עולה בהוצאות קבועות של 3,000 ומעלה, ולא על "מקומי"', () => {
  assert.ok(!codes(clean((x) => { x.loan.purpose = 'מעבר למתחם'; x.forecast.monthlyFixed = 3000; })).includes('purposePremises'));
  assert.ok(!codes(clean((x) => { x.loan.purpose = 'ספק מקומי'; x.forecast.monthlyFixed = 0; })).includes('purposePremises'),
    '"מקומי" היא מילה אחרת');
});

// ---------- א3 ----------
test('א3 salesJump: צמיחה מעל 30% בלי הסבר – אזהרה על שדה ההסבר', () => {
  const c = find(clean((x) => { x.history.lastYearSales = 120000; x.forecast.annualSales = 255000; }), 'salesJump');
  assert.ok(c);
  assert.equal(c.field, 'forecast.growthReason');
  assert.equal(c.field, E.GROWTH_REASON_FIELD);
  assert.ok(strip(c.message).includes('113%') || strip(c.message).includes('112%'), c.message);
  assert.equal(Math.round(E.salesJump(clean((x) => { x.history.lastYearSales = 120000; x.forecast.annualSales = 255000; })).pct), 113);
});
test('א3 salesJump: לא עולה עד 30%, כשיש הסבר, או בעסק בהקמה', () => {
  assert.ok(!codes(clean((x) => { x.history.lastYearSales = 100000; x.forecast.annualSales = 130000; })).includes('salesJump'), '30% בדיוק');
  const explained = clean((x) => { x.history.lastYearSales = 120000; x.forecast.annualSales = 255000; x.forecast.growthReason = 'חוזה שנתי חדש עם רשת'; });
  assert.ok(!codes(explained).includes('salesJump'));
  const blankReason = clean((x) => { x.history.lastYearSales = 120000; x.forecast.annualSales = 255000; x.forecast.growthReason = '   '; });
  assert.ok(codes(blankReason).includes('salesJump'), 'רווחים בלבד אינם הסבר');
  assert.equal(E.salesJump(clean((x) => { x.business.isNew = true; x.business.years = 0; })), null);
});

// ---------- א4 ----------
test('א4 suggestUseCategory: מילות המפתח מהמקור', () => {
  ['מחשב נייד', 'תנור מסחרי', 'מקרר תעשייתי', 'ציוד צילום', 'מכונה', 'מכונת קפה', 'ריהוט למשרד', 'רכב מסחרי', 'שיפוץ החנות', 'מקררים']
    .forEach((s) => assert.equal(E.suggestUseCategory(s), 'capex', s));
  ['שכר', 'משווק', 'שיווק דיגיטלי', 'פרסום בפייסבוק', 'מלאי', 'סחורה', 'חומרי גלם', 'הון חוזר (חומרי גלם ומלאי)']
    .forEach((s) => assert.equal(E.suggestUseCategory(s), 'working', s));
});
test('א4 suggestUseCategory: אין הצעה בלי מילת מפתח, כשיש מילים משני הסוגים, או כשהמילה חלק ממילה אחרת', () => {
  assert.equal(E.suggestUseCategory('ייעוץ משפטי'), null);
  assert.equal(E.suggestUseCategory('ציוד ומלאי'), null);
  assert.equal(E.suggestUseCategory('הרכבה באתר'), null, '"הרכבה" אינה "רכב"');
  assert.equal(E.suggestUseCategory(''), null);
  assert.equal(E.suggestUseCategory(null), null);
});
test('א4 useCategory: "משווק" 80,000 שסומן כהשקעה – אזהרה על שדה הסיווג של הפריט', () => {
  const p = clean((x) => { x.loan.uses = [{ item: 'מכונת CNC', amount: 120000, type: 'capex' }, { item: 'משווק', amount: 80000, type: 'capex' }]; });
  const c = find(p, 'useCategory');
  assert.ok(c);
  assert.equal(c.field, 'loan.uses.1.type');
  assert.ok(strip(c.message).includes('משווק') && strip(c.message).includes('80,000'), c.message);
});
test('א4 useCategory: לא עולה כשהסיווג תואם, וגם לא בעסק בהקמה שהשימושים שלו נגזרים', () => {
  assert.ok(!codes(clean()).includes('useCategory'));
  const startup = clean((x) => {
    x.business.isNew = true; x.business.years = 0; x.loan.track = 'startup';
    x.startup = { equity: 0, setupCosts: [{ item: 'שיפוץ', amount: 100000 }] };
    x.loan.uses = [{ item: 'משווק', amount: 80000, type: 'capex' }];
  });
  assert.ok(!codes(startup).includes('useCategory'));
});

// ---------- א5 ----------
test('א5 shortText: פחות מ-5 מילים – "הבנק יקרא את זה. כדאי להרחיב."', () => {
  const p = clean((x) => { x.market.advantage = 'שירות מחיר'; x.owner.experience = '4'; });
  const list = E.consistencyChecks(p).filter((c) => c.code === 'shortText');
  assert.deepEqual(list.map((c) => c.field).sort(), ['market.advantage', 'owner.experience']);
  list.forEach((c) => assert.ok(c.message.includes('הבנק יקרא את זה. כדאי להרחיב.'), c.message));
  ['business.description', 'market.customers'].forEach((k) => {
    const q = clean((x) => { const [a, b] = k.split('.'); x[a][b] = 'ארבע מילים בלבד כאן'; });
    assert.ok(E.consistencyChecks(q).some((c) => c.code === 'shortText' && c.field === k), k);
  });
});
test('א5 shortText: 5 מילים ומעלה עוברות, ושדה ריק נשאר לבדיקת החובה של האשף', () => {
  assert.ok(!codes(clean((x) => { x.market.advantage = 'שירות אישי ומחיר הוגן תמיד'; })).includes('shortText'));
  assert.ok(!codes(clean((x) => { x.market.advantage = ''; })).includes('shortText'));
  assert.equal(E.wordCount('  שירות   מחיר '), 2);
  assert.equal(E.wordCount('4'), 1);
  assert.equal(E.wordCount('- –'), 0);
});

// ---------- א6 ----------
test('א6 yearsMissing: עסק קיים עם 0 או ריק בשנות פעילות – חסימה', () => {
  [0, '', null, undefined].forEach((v) => {
    const c = find(clean((x) => { x.business.years = v; }), 'yearsMissing');
    assert.ok(c, String(v));
    assert.equal(c.severity, 'block');
    assert.equal(c.field, 'business.years');
  });
});
test('א6 yearsMissing: לא עולה בעסק שפועל, ולא בעסק בהקמה', () => {
  assert.ok(!codes(clean((x) => { x.business.years = 0.5; })).includes('yearsMissing'));
  assert.ok(!codes(clean((x) => { x.business.isNew = true; x.business.years = 0; })).includes('yearsMissing'));
});
test('א6 employeesMissing: עסק קיים עם שדה עובדים ריק – חסימה; 0 מותר', () => {
  ['', null, undefined].forEach((v) => {
    const c = find(clean((x) => { x.business.employees = v; }), 'employeesMissing');
    assert.ok(c, String(v));
    assert.equal(c.severity, 'block');
  });
  assert.ok(!codes(clean((x) => { x.business.employees = 0; })).includes('employeesMissing'), '0 עובדים זו תשובה');
  assert.ok(!codes(clean((x) => { x.business.isNew = true; x.business.years = 0; x.business.employees = ''; })).includes('employeesMissing'));
});

// ---------- א7 ----------
test('א7 cogsOver100 / cogsHigh: מעל 100% חסימה, מעל 85% אזהרה', () => {
  const over = find(clean((x) => { x.forecast.cogsPct = 150; }), 'cogsOver100');
  assert.equal(over.severity, 'block');
  assert.equal(over.field, 'forecast.cogsPct');
  assert.ok(!codes(clean((x) => { x.forecast.cogsPct = 150; })).includes('cogsHigh'), 'לא שתיהן יחד');
  const high = find(clean((x) => { x.forecast.cogsPct = 90; }), 'cogsHigh');
  assert.equal(high.severity, 'warn');
});
test('א7: 85% ו-100% בדיוק עוברים לפי הספים (מעל, לא "עד")', () => {
  assert.ok(!codes(clean((x) => { x.forecast.cogsPct = 85; })).some((c) => c.startsWith('cogs')));
  assert.deepEqual(codes(clean((x) => { x.forecast.cogsPct = 100; })).filter((c) => c.startsWith('cogs')), ['cogsHigh']);
});

test('computePlan מחזיר את בדיקות העקביות ב-res.consistency, בלי לגעת ב-res.blocking', () => {
  const p = clean((x) => { x.forecast.cogsPct = 150; });
  const res = E.computePlan(p);
  assert.deepEqual(res.consistency, E.consistencyChecks(p));
  assert.ok(!res.blocking.some((c) => c.code === 'cogsOver100'));
});

// ---------- ב1 ----------
test('ב1: הון חוזר שפורט כפריט יוצא בתזרים בחודש 1, בשורה נפרדת', () => {
  const p = clean();
  const res = E.computePlan(p);
  assert.equal(E.workingCapitalOutflow(p), 50000);
  assert.equal(res.workingOut, 50000);
  assert.equal(res.cash[0].working, 50000);
  assert.ok(res.cash.slice(1).every((c) => c.working === 0));
  res.cash.forEach((c) => assert.ok(Math.abs(c.closing - (c.opening + c.inflow - c.outflow)) < 0.01));
  const s = E.cashflowSections(res, { entity: 'osek' });
  const row = s.outflows.rows.find((r) => r.key === 'working');
  assert.ok(row && row.sparse && row.values[0] === 50000);
  // בלי הון חוזר ברשימה אין שורה ריקה בטבלה
  const noWc = clean((x) => { x.loan.uses = [{ item: 'מכונת CNC', amount: 200000, type: 'capex' }]; });
  assert.equal(E.cashflowSections(E.computePlan(noWc), { entity: 'osek' }).outflows.rows.find((r) => r.key === 'working'), undefined);
});
test('ב1: התוכנית לדוגמה – 75,000 ₪ הון חוזר כבר לא מנפחים את היתרה המינימלית (113,142 → 38,142)', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const m = app.match(/const SAMPLE = (\{[\s\S]*?\n  \});/);
  const sample = Function(`return (${m[1]});`)();
  const res = E.computePlan(sample);
  assert.equal(res.workingOut, 75000);
  assert.equal(Math.round(res.cushion.min), 38142);
  assert.equal(Math.round(res.cushion.min) + 75000, 113142, 'ההפרש הוא בדיוק ההון החוזר');
});
test('ב1: בעסק בהקמה ההון החוזר הנגזר נשאר רזרבה בחשבון, ומוצג במפורש כ"רזרבה שלא נוצלה"', () => {
  const p = clean((x) => {
    x.business.isNew = true; x.business.years = 0; x.loan.track = 'startup';
    x.startup = { equity: 50000, setupCosts: [{ item: 'ציוד', amount: 150000 }] };
  });
  const res = E.computePlan(p);
  assert.equal(E.workingCapitalOutflow(p), 0, 'לא יוצא – הוצאות ההרצה כבר בתזרים');
  assert.ok(res.cash.every((c) => c.working === 0));
  const note = strip(E.reserveNote(p, res));
  assert.ok(/רזרבה שלא נוצלה/.test(note), note);
  assert.ok(!/שהזנתם|שלכם/.test(note), 'גוף שלישי – למסמך');
  assert.equal(E.reserveNote(clean(), E.computePlan(clean())), '', 'עסק פועל – אין רזרבה נגזרת');
});

// ---------- ב4 ----------
test('ב4 dscrPhrase: שלוש הרמות בדיוק כמו במקור', () => {
  assert.equal(E.dscrPhrase(1.25).text, 'יכולת החזר טובה');
  assert.equal(E.dscrPhrase(2).text, 'יכולת החזר טובה');
  assert.equal(E.dscrPhrase(1.24).text, 'מרווח צר');
  assert.equal(E.dscrPhrase(1).text, 'מרווח צר');
  assert.equal(E.dscrPhrase(0.99).text, 'העסק לא יעמוד בהחזרים מהתזרים השוטף');
  assert.equal(E.dscrPhrase(Infinity), null);
});
const row = (key, pct, minDscr, minCash) => ({ key, pct, minDscr, minCash, minCashMonth: 3 });
test('ב4 scenarioNote: יחס 0.04 מתואר כ"העסק לא יעמוד בהחזרים" ו-4%, לא "המרווח מצטמצם"', () => {
  const note = strip(E.scenarioNote([row('base', 0, 1.9, 40000), row('down10', -10, 1.2, 30000), row('down20', -20, 0.04, 10000)]));
  assert.ok(note.includes('העסק לא יעמוד בהחזרים מהתזרים השוטף'), note);
  assert.ok(note.includes('4%'), note);
  assert.ok(!/מצטמצם/.test(note));
});
test('ב4 scenarioNote: מרווח צר ויכולת טובה', () => {
  const tight = strip(E.scenarioNote([row('base', 0, 1.9, 40000), row('down20', -20, 1.1, 10000)]));
  assert.ok(tight.includes('מרווח צר') && !tight.includes('לא יעמוד'), tight);
  const good = strip(E.scenarioNote([row('base', 0, 2.5, 40000), row('down20', -20, 1.6, 10000)]));
  assert.ok(good.includes('יכולת החזר טובה') && !good.includes('מרווח צר'), good);
});
test('ב4 scenarioNote: יחס שלילי לא מודפס כ"ל--0.28"', () => {
  const note = strip(E.scenarioNote([row('base', 0, 1.5, 10000), row('down20', -20, -0.28, -5000)]));
  assert.ok(!/--/.test(note) && note.includes('שלילי'), note);
});
test('ב4 scenarioNote: שם התרחיש הגרוע לא חוזר פעמיים ברצף', () => {
  const note = strip(E.scenarioNote([row('base', 0, 1.9, 40000), row('down10', -10, 1.2, 30000), row('down20', -20, 0.04, -8533)]));
  assert.equal((note.match(/20%/g) || []).length, 1, note);
  assert.ok(note.includes('באותו תרחיש'), note);
});
test('ה: הערת התרחישים אומרת שכבר תרחיש הבסיס במינוס', () => {
  const note = strip(E.scenarioNote([row('base', 0, 1.3, -8000), row('down10', -10, 0.9, -20000), row('down20', -20, 0.3, -40000)]));
  assert.ok(note.includes('כבר בתחזית הבסיס'), note);
  const onlyWorst = strip(E.scenarioNote([row('base', 0, 1.9, 40000), row('down10', -10, 1.5, 5000), row('down20', -20, 1.1, -3000)]));
  assert.ok(!onlyWorst.includes('בסיס,') && onlyWorst.includes('20%'), onlyWorst);
  const mildFirst = strip(E.scenarioNote([row('base', 0, 1.9, 40000), row('down10', -10, 1.3, -600), row('down20', -20, 0.9, -9000)]));
  assert.ok(mildFirst.includes('כבר בתרחיש של ירידה של 10%'), 'מזכירים את התרחיש המתון ביותר שנכנס למינוס');
});

// ---------- ה: taxSpread(null) ----------
test('ה: taxSpread(null) לא קורס ומחזיר פריסה שווה של אותו סכום', () => {
  const out = E.taxSpread(null, 1200, null);
  assert.equal(out.length, 12);
  assert.ok(out.every((v) => Math.abs(v - 100) < 1e-9));
  assert.deepEqual(E.taxSpread(undefined, 0), Array(12).fill(0));
});

// ---------- ה: מסגרת אשראי בעסק פועל ----------
test('ה: עסק פועל – המסמך לא מצהיר על מסגרת אשראי שלא נמסרה', () => {
  [E.bridgeText(false, 0), E.thinCushionText(false, 0)].forEach((t) => {
    assert.ok(!/מסגרת אשראי/.test(t), t);
    assert.ok(t.includes('יבדוק מול הבנק אשראי לטווח קצר'), t);
  });
});

// ---------- תרחיש "עיצובים" מהמקור ----------
function designs() {
  return {
    business: { name: 'עיצובים', isNew: false, entity: 'osek', years: 2, employees: 0, field: 'עיצוב גרפי',
      description: 'סטודיו לעיצוב גרפי ומיתוג לעסקים קטנים.' },
    owner: { name: 'נועה', experience: '4' },
    market: { customers: 'עסקים קטנים באזור המרכז שצריכים מיתוג', advantage: 'שירות מחיר' },
    history: { lastYearSales: 120000, lastYearProfit: 60000 },
    forecast: { annualSales: 255000, rampMonths: 0, growthPct: 5, cogsPct: 5, monthlyFixed: 2000,
      monthlySalaries: 0, ownerDrawMonthly: 8000, openingCash: 10000 },
    loan: { track: 'startup', amount: 100000, ratePct: 7.5, years: 5, graceMonths: 0,
      purpose: 'גיוס עובדים ומעבר למקום גדול יותר',
      uses: [{ item: 'מחשב ותוכנות', amount: 20000, type: 'capex' }, { item: 'משווק', amount: 80000, type: 'capex' }] },
  };
}
test('עיצובים: כל הסתירות מהמקור מעלות אזהרה (לא רק הרווחיות)', () => {
  const p = designs();
  const got = codes(p);
  ['trackVsYears', 'purposeStaff', 'purposePremises', 'salesJump', 'useCategory', 'shortText'].forEach((c) =>
    assert.ok(got.includes(c), `חסר ${c}: ${got.join(', ')}`));
  assert.ok(E.consistencyChecks(p).some((c) => c.code === 'shortText' && c.field === 'market.advantage'), '"שירות מחיר"');
  assert.ok(E.consistencyChecks(p).some((c) => c.code === 'shortText' && c.field === 'owner.experience'), '"4"');
  assert.ok(E.consistencyChecks(p).some((c) => c.code === 'useCategory' && /משווק/.test(c.message)), '"משווק" כהשקעה');
  // אזהרת הרווחיות הקיימת (לא לגעת) ממשיכה לעלות, ולא משוכפלת בבדיקות העקביות
  const margin = E.assumptionWarnings(p).find((a) => a.code === 'margin');
  assert.ok(margin && margin.value > 80);
  assert.ok(!got.some((c) => /margin/i.test(c)));
  assert.ok(!E.consistencyChecks(p).some((c) => c.severity === 'block'), 'אין כאן נתון חסר – רק סתירות');
});
