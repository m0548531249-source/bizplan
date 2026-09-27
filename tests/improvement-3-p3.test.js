/**
 * גל ב', סבב שלישי – סעיפים 22–24 (P3: ליטוש) מתוך docs/BUGS-improvement-3.md,
 * ופסקת הביטחונות שחוזרת למסמך (החלטת מאיר, 24.09.2026).
 * 22 ניקוי טקסט שהמשתמש הזין · 23 שטקסט חופשי לא מתעוות בדרך למסמך ·
 * 24 "סטטוס: עסק בהקמה" במקום "ותק: בהקמה" · ביטחונות וערבות בגוף שלישי.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ROUND = (n) => Math.round(n);
const digits = (s) => E.stripBidi(String(s)).replace(/[^\d.,-]/g, '');
/** רק האותיות והספרות – כדי לבדוק שאף אות לא נעלמה בדרך */
const letters = (s) => E.stripBidi(String(s)).replace(/[^\p{L}\p{N}]/gu, '');

/** מקרה הבדיקה של מאיר, זהה לסבבים הקודמים */
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
      uses: [{ item: 'מכונות קפה וציוד מטבח', amount: 120000, type: 'capex' }, { item: 'הון חוזר', amount: 80000, type: 'working' }],
    },
    ...(over || {}),
  };
}
/** עסק פועל, לבדיקות של סטטוס ושל שימושים שהוזנו ישירות */
function running(over) {
  const p = cafe(over);
  p.business = { ...p.business, isNew: false, years: 3 };
  p.startup = { equity: 0, openDate: '', setupCosts: [], deposit: 0, preOpenCosts: 0, equipmentVat: 0 };
  p.history = { lastYearSales: 1200000, lastYearProfit: 150000 };
  p.loan = { ...p.loan, track: 'general' };
  return p;
}
/** הפסקאות שהמשתמש היה רואה במסמך, כמחרוזת אחת */
const collateralText = (p) => E.collateralSection(p).paragraphs.join(' ');

// ---------- 22. ניקוי טקסט שהמשתמש הזין ----------

test('22 ניקוי: נקודתיים ונקודה בסוף כותרת שורה מוסרות', () => {
  assert.equal(E.tidyLabel('רכישת ציוד ומכונות קפה:'), 'רכישת ציוד ומכונות קפה');
  assert.equal(E.tidyLabel('שיפוץ ועיצוב.'), 'שיפוץ ועיצוב');
  assert.equal(E.tidyLabel('מלאי פתיחה:.'), 'מלאי פתיחה');
  assert.equal(E.tidyLabel('ציוד מטבח -'), 'ציוד מטבח');
  assert.equal(E.tidyLabel('רישוי, '), 'רישוי');
});

test('22 ניקוי: פיסוק בתוך הכותרת נשאר, רק הסוף מנוקה', () => {
  assert.equal(E.tidyLabel('ציוד: תנור ומקרר'), 'ציוד: תנור ומקרר');
  assert.equal(E.tidyLabel('מכונת קפה 2.5 ליטר'), 'מכונת קפה 2.5 ליטר');
  assert.equal(E.tidyLabel('ריהוט (שולחנות וכיסאות)'), 'ריהוט (שולחנות וכיסאות)');
  assert.equal(E.tidyLabel('שיפוץ – חשמל ואינסטלציה'), 'שיפוץ – חשמל ואינסטלציה');
});

test('22 ניקוי: רווחים כפולים מתכנסים, והפונקציה אידמפוטנטית', () => {
  assert.equal(E.tidyLabel('  ציוד   ומכונות קפה :  '), 'ציוד ומכונות קפה');
  const once = E.tidyLabel('רכישת ציוד:');
  assert.equal(E.tidyLabel(once), once);
});

test('22 ניקוי: אין מצב שהכותרת נעלמת – פיסוק בלבד מוחזר כפי שהוא', () => {
  assert.equal(E.tidyLabel('...'), '...');
  assert.equal(E.tidyLabel(':'), ':');
  assert.equal(E.tidyLabel(''), '');
  assert.equal(E.tidyLabel(null), '');
  assert.equal(E.tidyLabel(undefined), '');
});

test('22 ניקוי: הכותרות בטבלת השימושים מוצגות נקיות – בעסק בהקמה ובעסק פועל', () => {
  const p = cafe({
    startup: { equity: 60000, openDate: 'יוני 2027', setupCosts: [{ item: 'רכישת ציוד ומכונות קפה:', amount: 100000 }, { item: 'שיפוץ ועיצוב.', amount: 80000 }] },
  });
  const items = E.planUses(p).map((u) => u.item);
  assert.ok(items.includes('רכישת ציוד ומכונות קפה'), 'בלי נקודתיים בסוף');
  assert.ok(items.includes('שיפוץ ועיצוב'), 'בלי נקודה בסוף');
  assert.ok(!items.some((i) => /[.:]$/.test(i)), 'אף כותרת לא נגמרת בפיסוק');
  const r = running();
  r.loan.uses = [{ item: 'תנור מסחרי:', amount: 120000, type: 'capex' }, { item: 'הון חוזר.', amount: 80000, type: 'working' }];
  assert.deepEqual(E.planUses(r).map((u) => u.item), ['תנור מסחרי', 'הון חוזר']);
  assert.deepEqual(E.planUses(r).map((u) => u.type), ['capex', 'working'], 'סוג הפריט נשמר');
});

test('22 ניקוי: הסכומים והבדיקות לא זזים בגלל הניקוי', () => {
  const dirty = cafe({
    startup: { equity: 60000, openDate: 'יוני 2027', setupCosts: [{ item: 'ציוד ומכונות קפה:', amount: 100000 }, { item: 'שיפוץ ועיצוב.', amount: 80000 }] },
  });
  const a = E.computePlan(cafe());
  const b = E.computePlan(dirty);
  assert.equal(b.usesTotal, a.usesTotal);
  assert.equal(ROUND(b.cash[0].closing), ROUND(a.cash[0].closing));
  assert.deepEqual(E.integrityFailures(dirty, b), [], 'אין בדיקת תקינות שנשברת');
});

test('22 ניקוי: שם העסק ושם הבעלים בפרק 3 נקיים מפיסוק מיותר', () => {
  const p = cafe();
  p.business.name = 'קפה פינת חן:';
  p.owner.name = 'אריאל.';
  const first = E.ownerParagraphs(p)[0].text;
  assert.equal(first, 'הבעלות והניהול של קפה פינת חן בידי אריאל.');
});

test('22 ניקוי: שדות הכותרת במסמך עוברים דרך tidyLabel, וטקסט חופשי לא', () => {
  const app = read('app.js');
  assert.ok(app.includes('const dtl = (s) => dt(E.tidyLabel(s));'), 'יש עוטף אחד לכותרות קצרות');
  const doc = (app.match(/function renderDocument\(p\) \{[\s\S]*?\$\('edit'\)\.hidden/) || [''])[0];
  assert.ok(doc.length > 1000, 'נמצא גוף המסמך');
  ['dtl(b.name)', 'dtl(b.field)', 'dtl(b.city)', 'dtl(p.owner.name)', 'dtl(st.openDate)'].forEach((call) => {
    assert.ok(doc.includes(call), `${call} – כותרת קצרה, מנוקה`);
  });
  // טקסט חופשי ארוך נשאר בדיוק כפי שנכתב, כולל הנקודה בסוף המשפט
  assert.ok(doc.includes('dt(b.description)'), 'תיאור העסק לא מנוקה');
  assert.ok(doc.includes('dt(p.loan.purpose)'), 'מטרת ההלוואה לא מנוקה');
  assert.ok(!doc.includes('dtl(b.description)') && !doc.includes('dtl(p.loan.purpose)'));
});

// ---------- 23. טקסט חופשי לא מתעוות בדרך למסמך ----------

test('23 טקסט חופשי: אין באשף שום מניפולציה על ערך של שדה טקסט', () => {
  const app = read('app.js');
  // שדה טקסט/textarea נשמר כפי שהוא; רק שדות מספר עוברים פענוח
  assert.ok(app.includes("set(plan, t.dataset.key, isNum ? (signed ? parseSigned(t.value) : parseNum(t.value)) : t.value)"),
    'טקסט נשמר כ-t.value, בלי replace ובלי trim');
  assert.ok(app.includes("u[t.dataset.f] = t.dataset.f === 'amount' ? parseNum(t.value) : t.value"),
    'גם שם פריט ברשימה נשמר כפי שהוא');
  // האינפוט עצמו נדרס רק בשדה כספי, ולא בשדה טקסט
  const money = (app.match(/if \(t\.dataset\.money\) \{[\s\S]*?\n {4}\}/) || [''])[0];
  assert.ok(money.includes('t.value = n ?'), 'העיצוב מחדש של הערך קורה רק בשדה כספי');
});

test('23 טקסט חופשי: כל האותיות עוברות שלמות דרך שכבת הבידוד וההצגה', () => {
  const samples = [
    'רכישת ציוד ומכונות קפה',
    'רכישת 2 מכונות אספרסו ל-3 עמדות',
    'שיפוץ ועיצוב, כולל חשמל (16 אמפר) ואינסטלציה',
    'ניסיון: 12 שנים באפייה, מתוכן 3 בניהול',
    'עוסק מורשה מס\' 123456789',
    'ציוד ב-25% הנחה ב-1.3.2027',
  ];
  samples.forEach((s) => {
    assert.equal(E.stripBidi(E.bidiText(s)), s, `הטקסט חוזר זהה: ${s}`);
    assert.equal(letters(E.bidiText(s)), letters(s), 'אין אות או ספרה שנעלמה');
    assert.equal(letters(E.tidyLabel(s)), letters(s), 'tidyLabel לא נוגע באותיות');
  });
});

test('23 טקסט חופשי: "רכישת" נשאר "רכישת" בכל הדרך אל המסמך', () => {
  const p = cafe({
    startup: { equity: 60000, openDate: 'יוני 2027', setupCosts: [{ item: 'רכישת ציוד ומכונות קפה', amount: 100000 }, { item: 'שיפוץ ועיצוב', amount: 80000 }] },
  });
  const item = E.planUses(p)[0].item;
  assert.equal(item, 'רכישת ציוד ומכונות קפה', 'שם הפריט זהה לקלט');
  assert.equal(E.stripBidi(E.bidiText(item)), item, 'וגם אחרי שכבת הבידוד של המסמך');
  assert.ok(item.startsWith('רכישת'), 'האות הראשונה במקום – לא "כישת"');
});

test('23 טקסט חופשי: פרקי הבעלים והשוק מציגים את הטקסט מלה במלה', () => {
  const exp = 'ניהול משמרת ברשת בתי קפה, 4 שנים; אחריות על הזמנות ספקים.';
  const cust = 'תושבי השכונה ועובדי אזור התעשייה (כ-300 איש).';
  const p = cafe();
  p.owner = { ...p.owner, experience: `  ${exp}  ` };
  p.market = { ...p.market, customers: cust };
  const par = E.ownerParagraphs(p).find((x) => x.lead === 'ניסיון מקצועי:');
  assert.equal(par.text, exp, 'רק רווחי הקצה הוסרו');
  assert.equal(E.marketSections(p)[0].texts[0], cust);
});

test('23 טקסט חופשי: גרש, גרשיים וסימנים מיוחדים לא שוברים את ההצגה', () => {
  const s = 'מכונת קפה "לה מרזוקו" ב-45,000 ₪ & ספל 5% <מיוחד>';
  assert.equal(E.stripBidi(E.bidiText(s)), s);
  assert.equal(E.tidyLabel(s), s);
});

// ---------- 24. "סטטוס: עסק בהקמה" ----------

test('24 סטטוס: עסק בהקמה מוצג "סטטוס: עסק בהקמה"', () => {
  const s = E.businessStatus(cafe());
  assert.equal(s.label, 'סטטוס');
  assert.equal(s.value, 'עסק בהקמה');
  assert.equal(s.isNew, true);
});

test('24 סטטוס: עסק קיים מוצג "עסק פועל" ועוד הוותק', () => {
  assert.equal(E.businessStatus(running()).value, 'עסק פועל 3 שנים');
  const oneYear = running(); oneYear.business.years = 1;
  assert.equal(E.businessStatus(oneYear).value, 'עסק פועל שנה');
  const many = running(); many.business.years = 12;
  assert.equal(E.businessStatus(many).value, 'עסק פועל 12 שנים');
  assert.equal(E.businessStatus(many).isNew, false);
});

test('24 סטטוס: תוכנית ישנה בלי הדגל נקבעת לפי ותק, כמו בכל שאר הכלי', () => {
  const noFlag = running();
  delete noFlag.business.isNew;
  assert.equal(E.businessStatus(noFlag).value, 'עסק פועל 3 שנים');
  const noFlagNew = running();
  delete noFlagNew.business.isNew; noFlagNew.business.years = 0;
  assert.equal(E.businessStatus(noFlagNew).value, 'עסק בהקמה');
});

test('24 סטטוס: התווית "ותק" ירדה מהמסמך, והערך נשאר קצר לטבלת העובדות', () => {
  const app = read('app.js');
  assert.ok(!app.includes('<dt>ותק</dt>'), 'התווית המעורפלת לא מופיעה יותר');
  assert.ok(app.includes('const status = E.businessStatus(p);'), 'הערך מגיע מהמנוע');
  assert.ok(app.includes('<dt>${dt(status.label)}</dt><dd>${dt(status.value)}</dd>'), 'והוא מוצג בטבלת העובדות');
  [cafe(), running()].forEach((p) => {
    assert.ok(E.businessStatus(p).value.length <= 20, 'ערך קצר, כדי לא לשבור את רוחב הטבלה');
  });
});

// ---------- פסקת הביטחונות: עובדתית, בגוף שלישי ----------

test('ביטחונות: האומדן נגזר מסכום ההלוואה שהוזן, לפי שתי המדרגות', () => {
  assert.equal(E.collateralRequirement(200000).amount, 20000, '10% על החלק שעד 300,000');
  assert.equal(E.collateralRequirement(200000).tiered, false);
  assert.equal(E.collateralRequirement(300000).amount, 30000);
  assert.equal(E.collateralRequirement(500000).amount, 30000 + 50000, 'ועוד 25% על החלק שמעליהם');
  assert.equal(E.collateralRequirement(500000).tiered, true);
  assert.equal(E.collateralRequirement(0).amount, 0);
  assert.equal(E.collateralRequirement(null).amount, 0);
});

test('ביטחונות: הפסקה חזרה למסמך, עם המספרים של מקרה הבדיקה', () => {
  const s = E.collateralSection(cafe());
  assert.equal(s.heading, 'ביטחונות וערבויות');
  const txt = s.paragraphs.join(' ');
  assert.ok(txt.includes(E.ils(200000)), 'סכום ההלוואה שהוזן');
  assert.ok(txt.includes(E.ils(20000)), 'אומדן הביטחונות שנגזר ממנו');
  assert.ok(txt.includes('ערבות אישית'), 'הערבות האישית חזרה למסמך');
  assert.ok(txt.includes(E.ils(60000)) && txt.includes('23%'), 'ההון העצמי שהוזן, וחלקו מהמקורות');
});

test('ביטחונות: גוף שלישי בלבד – אין פנייה למגיש', () => {
  const texts = [cafe(), running(), cafe({ business: { ...cafe().business, entity: 'company' } })].map(collateralText);
  const banned = ['שהזנתם', 'הזנתם', 'שתזינו', 'שלכם', 'אתם', 'לכם', 'תזכרו', 'פירטתם', 'תוכלו', 'עליכם', 'הזנת', 'שלך'];
  texts.forEach((t) => banned.forEach((w) => assert.ok(!t.includes(w), `"${w}" לא אמור להופיע בפסקת הביטחונות`)));
});

test('ביטחונות: הניסוח מתאים לצורת ההתאגדות שנבחרה', () => {
  const ent = (e) => collateralText(cafe({ business: { ...cafe().business, entity: e } }));
  assert.ok(ent('osek').includes('עוסק מורשה') && ent('osek').includes('אין הפרדה בין נכסי העסק לנכסי הבעלים'));
  assert.ok(ent('company').includes('חברה בע"מ') && ent('company').includes('נכסי החברה מופרדים'));
  assert.ok(ent('partnership').includes('שותפות') && ent('partnership').includes('השותפים'));
  assert.ok(!ent('company').includes('עוסק מורשה'), 'חברה בע"מ לא מקבלת את הנוסח של עוסק מורשה');
  // צורת התאגדות לא מוכרת – ברירת מחדל ולא קריסה
  assert.ok(collateralText(cafe({ business: { ...cafe().business, entity: 'xyz' } })).includes('ערבות אישית'));
});

test('ביטחונות: אין אמירה עובדתית על מה שלא הוזן', () => {
  // אין בכלי שדה קלט לנכסים או לערבים, ולכן הפסקה אומרת במפורש שהפירוט אינו במסמך
  const s = E.collateralSection(cafe());
  const last = s.paragraphs[s.paragraphs.length - 1];
  assert.ok(last.includes('אינו חלק ממסמך זה'), 'המסמך לא מתיימר לפרט ביטחונות');
  assert.ok(last.includes('אומדן'), 'והסכום מסויג כאומדן');
  // עסק פועל בלי הון עצמי – אין משפט על הון עצמי
  const r = collateralText(running());
  assert.ok(!r.includes('ההון העצמי שמעמידים הבעלים'), 'לא מצהירים על הון עצמי שלא הוזן');
  // פיקדון: משפט רק כשהוזן סכום, ועם הבהרה שהוא לא ביטחון לבנק
  assert.ok(!collateralText(cafe()).includes('פיקדון'), 'בלי פיקדון – בלי משפט');
  const withDeposit = cafe();
  withDeposit.startup = { ...withDeposit.startup, deposit: 15000 };
  const wd = collateralText(withDeposit);
  assert.ok(wd.includes('פיקדון או ערבות לשכירות בסך') && wd.includes(E.ils(15000)));
  assert.ok(wd.includes('אינו ביטחון להלוואה'), 'הפיקדון לא מוצג כביטחון להלוואה');
  // הלוואה שלא הוזנה – אין משפט על דרישת ביטחונות בסכום
  const noLoan = cafe(); noLoan.loan = { ...noLoan.loan, amount: 0 };
  assert.ok(!collateralText(noLoan).includes('נהוגה דרישת ביטחונות'));
});

test('ביטחונות: הפסקה מוצגת בפרק 8 של המסמך, אחרי לוח הסילוקין', () => {
  const app = read('app.js');
  assert.ok(app.includes('function collateralHtml(p)'), 'יש פונקציית הצגה');
  assert.ok(/8\. ההלוואה ולוח הסילוקין[\s\S]{0,900}\$\{am\}\s*\$\{collateralHtml\(p\)\}/.test(app),
    'היא יושבת בפרק 8, אחרי טבלת הסילוקין');
  assert.ok(app.includes('E.collateralSection(p)'), 'וכל הטקסט מגיע מהמנוע');
  // הפסקה בממשק ("טוב לדעת מראש") נשארת כפי שהיא, למגיש
  assert.ok(app.includes('const COLLATERAL_TEXT ='), 'טקסט הממשק לא בוטל');
});

// ---------- ניקוי: העיצוב של גל ב' עבר ל-styles.css ----------

test('ניקוי: אין יותר בלוק <style> ב-index.html, והעיצוב יושב ב-styles.css', () => {
  const html = read('index.html');
  const css = read('styles.css');
  assert.ok(!/<style[\s>]/.test(html), 'index.html בלי CSS פנימי');
  assert.ok(html.includes('<link rel="stylesheet" href="styles.css">'), 'והוא טוען את הגיליון');
  ['.doc-metrics {', '.doc .metric {', '.doc .ch-path {', '.doc table.cf tr.grp th', '.doc table.scenarios tr.sub th', '.doc caption {']
    .forEach((sel) => assert.ok(css.includes(sel), `${sel} הועבר ל-styles.css`));
});

// ---------- רגרסיה: מקרה הבדיקה "קפה פינת חן" ----------

test('רגרסיה: יתרות הסגירה של "קפה פינת חן" לא זזו בסבב הזה', () => {
  const res = E.computePlan(cafe());
  // עודכן אחרי תיקון באג חוסם 2 של סבב QA 5 (ביטוח לאומי כולל דמי ביטוח בריאות):
  // רק שורת המס בתזרים גדלה, ולכן היתרות ירדו. טבלת היעד בלי המס (למטה) לא זזה.
  assert.equal(ROUND(res.cash[0].closing), 21073);
  assert.equal(ROUND(res.cash[1].closing), -11604);
  assert.equal(ROUND(res.cash[2].closing), -18031);
  assert.equal(ROUND(res.cash[11].closing), 160376);
  // וגם טבלת היעד המקורית של מאיר (בלי שורת המס)
  const p = cafe();
  const s = E.amortization(p.loan.amount, p.loan.ratePct, p.loan.years, p.loan.graceMonths);
  const f = { ...p.forecast, openingCash: 0, entity: 'osek' };
  const rows = E.cashflow(f, p.loan.amount, E.planUses(p), s, E.equityInflow(p), { capex: E.investmentTotal(p), monthlyTax: 0 });
  assert.deepEqual([0, 1, 2, 11].map((i) => ROUND(rows[i].closing)), [33242, 12735, 18477, 306409]);
});

test('רגרסיה: הפקת המסמך של "קפה פינת חן" עוברת את בדיקות התקינות', () => {
  const p = cafe();
  const res = E.computePlan(p);
  assert.deepEqual(res.blocking, []);
  assert.equal(res.usesTotal, 260000);
  assert.equal(E.businessStatus(p).value, 'עסק בהקמה');
  assert.equal(digits(E.collateralSection(p).requirement.amount), '20000');
});
