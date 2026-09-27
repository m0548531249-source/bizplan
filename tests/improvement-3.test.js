/**
 * גל ב', סבב ראשון – סעיפים 6–15 (P1: לוגיקה ותוכן) מתוך docs/BUGS-improvement-3.md.
 * 6 תקציר · 7 פחת · 8 משיכת בעלים · 9 "טוב לדעת מראש" · 10 טבלת התאמה ·
 * 11 סתירה בין הטקסט למסלול · 12 אזהרות על ההנחות · 13 שדות חסרים ·
 * 14 מחזור מלמטה · 15 פרקי הבעלים והשוק.
 *
 * כמו בסבב הקודם: בדיקות התנהגות ומספרים, ולא "האם הקוד מכיל מחרוזת" – חוץ ממקומות
 * שבהם התוצר הוא HTML של המסמך, ושם נבדק שהניסוח נגזר מהמנוע ולא מקודד קשיח.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

/** מקרה הבדיקה של מאיר, זהה לזה שבסבב QA 4 – כדי שהרגרסיה תישמר */
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

// ---------- 6. התקציר מציג את שנה 1, לא רק את שנה 2 ----------

test('6 תקציר: המשפט מציג את שנה 1 ואת שנה 2, עם המספרים של שתיהן', () => {
  const res = E.computePlan(cafe());
  const t = E.outlookText(res.years);
  assert.ok(/שנה הראשונה/.test(t), 'שנה 1 מוצגת');
  assert.ok(/שנה השנייה/.test(t), 'ולצידה שנה 2');
  // המספרים בפועל, ולא רק הכותרות: 1,575,000 בשנה 1 ו-1,890,000 בשנה 2
  assert.ok(t.includes('1,575,000'), `המחזור של שנה 1 בטקסט: ${t}`);
  assert.ok(t.includes('1,890,000'), `והמחזור של שנה 2: ${t}`);
  assert.ok(t.indexOf('1,575,000') < t.indexOf('1,890,000'), 'שנה 1 מופיעה לפני שנה 2');
  assert.ok(t.includes('רווח של') || t.includes('הפסד של'), 'גם השורה התפעולית מנוסחת בעברית');
});

test('6 תקציר: המסמך משתמש בניסוח המחושב, ולא בשורה שמציגה רק את שנה 2', () => {
  const app = read('app.js');
  assert.ok(app.includes('E.outlookText(y)'), 'התקציר נגזר מהמנוע');
  assert.ok(!app.includes('לפי התחזית, בשנה השנייה המחזור יגיע'), 'המשפט שהציג רק את שנה 2 הוסר');
  // עסק בלי שנה שנייה (מקרה קצה) לא מפיל את הניסוח
  assert.equal(E.outlookText([]), '');
  assert.ok(E.outlookText([{ revenue: 100000, ebitda: 20000 }]).includes('שנה הראשונה'));
});

// ---------- 7. "רווח תפעולי" בלי הבטחה לשורת פחת ----------

test('7 פחת: השורה נקראת "רווח תפעולי", ויש הערה שמסבירה שהפחת לא נכלל', () => {
  const app = read('app.js');
  assert.ok(!app.includes('רווח תפעולי (לפני פחת)'), 'הכותרת שהבטיחה שורת פחת שלא קיימת הוסרה');
  assert.ok(/cells: \['רווח תפעולי', \.\.\.y\.map/.test(app), 'ברו"ה נשארה שורת "רווח תפעולי"');
  assert.ok(app.includes('E.DEPRECIATION_NOTE'), 'ההערה מוצגת מתחת לטבלה');
  assert.match(E.DEPRECIATION_NOTE, /פחת/);
  assert.match(E.DEPRECIATION_NOTE, /אינה כוללת/);
  assert.match(E.DEPRECIATION_NOTE, /רואה החשבון/, 'מי קובע את הפחת בפועל');
  assert.ok(/שמרנית/.test(E.DEPRECIATION_NOTE), 'ומה זה אומר על הערכת המס');
});

// ---------- 8. הערת שוליים על משיכת הבעלים ----------

test('8 משיכת בעלים: הערה שמסבירה למה היא בתזרים וב-DSCR ולא ברו"ה', () => {
  const res = E.computePlan(cafe());
  assert.equal(res.years[0].ownerDraw, 144000, '12,000 בחודש');
  const note = E.ownerDrawNote('osek', res.years[0].ownerDraw);
  assert.ok(note.includes('144,000'), 'הסכום השנתי בהערה');
  assert.ok(/פרק 7/.test(note) && /פרק 9/.test(note), 'ההפניה לשני הפרקים שבהם היא כן מופיעה');
  assert.ok(/אינה מופיעה בדוח רווח והפסד/.test(note));
  assert.ok(/עוסק מורשה/.test(note), 'ההסבר החשבונאי');
  // הרו"ה באמת לא כולל אותה, וה-DSCR כן – זה מה שההערה מתארת
  const y1 = res.years[0];
  near(y1.net, y1.preTax - y1.tax, 0.01);
  near(y1.cfads, y1.ebitda - y1.tax - y1.ownerDraw, 0.01);
});

test('8 משיכת בעלים: בחברה בע"מ ההערה שונה, ובלי משיכה אין הערה בכלל', () => {
  const company = E.ownerDrawNote('company', 144000);
  assert.ok(/חברה בע"מ/.test(company) && /שכר/.test(company), 'בחברה זה נרשם אחרת');
  assert.ok(/רואה החשבון/.test(company), 'ומפנים לאימות');
  assert.notEqual(company, E.ownerDrawNote('osek', 144000));
  assert.equal(E.ownerDrawNote('osek', 0), '', 'בלי משיכה אין הערת שוליים מיותרת');
  const app = read('app.js');
  assert.ok(app.includes('E.ownerDrawNote(b.entity, y[0].ownerDraw)'), 'ההערה נגזרת מצורת ההתאגדות ומהסכום');
});

// ---------- 9. "טוב לדעת מראש" – בממשק בלבד ----------

test('9 "טוב לדעת מראש": הפרק הוסר מהמסמך ונשאר בממשק', () => {
  const app = read('app.js');
  assert.ok(!app.includes('<div class="doc-info"><h3>טוב לדעת מראש</h3>'), 'הפרק כבר לא נכנס למסמך');
  assert.ok(app.includes('function goodToKnowHtml'), 'הוא נשאר כתיבת מידע בממשק');
  assert.ok(/step === 2 && isNewBiz\(\) \? goodToKnowHtml\(\)/.test(app), 'מוצג בשלב ההקמה');
  assert.ok(/isNewBiz\(\) \? goodToKnowHtml\(\) : ''\)/.test(app), 'ומוצג גם במסך הסיכום, לפני ההגשה');
});

test('9 המסמך לא פונה למגיש: אין "לפי מה שהזנתם" ואין ניסוח שמדבר אל המשתמש', () => {
  const app = read('app.js');
  const doc = (app.match(/function renderDocument\(p\) \{[\s\S]*?\$\('edit'\)\.hidden/) || [''])[0];
  assert.ok(doc.length > 1000, 'נמצא גוף המסמך');
  ['שהזנתם', 'שתזינו', 'פירטתם', 'תזכרו', 'כדאי לכם', 'אתם יכולים'].forEach((phrase) => {
    assert.ok(!doc.includes(phrase), `"${phrase}" לא אמור להופיע במסמך שמיועד לגוף המממן`);
  });
  // הניסוח "מוזן"/"הזנה" הוחלף בניסוח שמתאר את המסמך ולא את המשתמש
  assert.ok(!doc.includes('מוזן פעם אחת'), 'תיאור של תהליך ההזנה אינו חלק מהמסמך');
  assert.ok(doc.includes('מופיע פעם אחת בלבד'), 'ובמקומו – תיאור של המסמך עצמו');
});

// ---------- 10. טבלת התאמה במקום הערה על הפרש ----------

test('10 התאמה: מקורות מול עלויות הקמה ועוד הון חוזר, שני הצדדים באותו סכום', () => {
  const rec = E.reconciliation(cafe());
  assert.deepEqual(rec.sources.map((r) => [r.label, r.amount]), [['הלוואה מהקרן', 200000], ['הון עצמי של הבעלים', 60000]]);
  assert.deepEqual(rec.uses.map((r) => [r.label, r.amount]), [['עלויות הקמה חד-פעמיות', 180000], ['הון חוזר לתחילת הפעילות', 80000]]);
  assert.equal(rec.sourcesTotal, 260000);
  assert.equal(rec.usesTotal, 260000);
  assert.equal(rec.diff, 0);
  assert.ok(rec.balanced, 'אין הפרש שדורש הערה מתנצלת');
  // ההפרש של 20,000 מהדוגמה של מאיר: אחרי התיקון הוא פשוט שורת הון חוזר בטבלה
  const other = E.reconciliation(cafe({
    startup: { equity: 60000, openDate: 'יוני 2027', setupCosts: [{ item: 'ציוד', amount: 100000 }, { item: 'שיפוץ', amount: 140000 }] },
  }));
  assert.equal(other.uses[0].amount, 240000);
  assert.equal(other.uses[1].amount, 20000, 'ההפרש מוצג כהון חוזר, בטבלה, ולא כהערה');
  assert.ok(other.balanced);
});

test('10 התאמה: הטבלה היא טבלה במסמך, ולא פסקה', () => {
  const app = read('app.js');
  assert.ok(app.includes('const rec = E.reconciliation(p)'), 'החישוב במנוע');
  assert.ok(/const recTable = table\(\['מקורות המימון', 'סכום', 'שימושים', 'סכום'\]/.test(app), 'ארבע עמודות: מקור, סכום, שימוש, סכום');
  assert.ok(app.includes('<h3>התאמה בין מקורות לשימושים</h3>${recTable}'), 'הטבלה מוצגת בפרק 5');
  assert.ok(!app.includes('סך המקורות (${ils(res.sourcesTotal)}) שווה'), 'ההערה הישנה על ההפרש הוסרה');
});

// ---------- 11. טקסט חופשי שסותר את המסלול ----------

test('11 סתירה: עסק בהקמה שכותב "הרחבת ההיצע" מקבל אזהרה בממשק', () => {
  const p = cafe();
  p.business.description = 'בית קפה שכונתי. ההלוואה נועדה להרחבת ההיצע ולשיפור השירות.';
  const w = E.conflictWarnings(p);
  assert.equal(w.length, 1, 'אזהרה אחת, על השדה שבו נמצא הניסוח');
  assert.equal(w[0].key, 'business.description');
  assert.equal(w[0].phrase, 'להרחבת', 'הציטוט כולל את התחילית, כמו שזה כתוב אצל המשתמש');
  assert.ok(w[0].text.includes('תיאור העסק'), 'שם השדה בשפה של המשתמש');
  assert.ok(/עוד לא נפתח/.test(w[0].text), 'ההסבר מזכיר את הבחירה שנעשתה');
  assert.ok(!/DSCR|capex/i.test(w[0].text), 'בלי ז\'רגון');
  // התוכנית המקורית נקייה
  assert.deepEqual(E.conflictWarnings(cafe()), []);
});

test('11 סתירה: גם בכיוון ההפוך, ובכל השדות הרלוונטיים', () => {
  const p = cafe();
  p.loan.purpose = 'להגדיל את המחזור של הלקוחות הקיימים';
  assert.equal(E.conflictWarnings(p).length, 1, 'שדה מטרת ההלוואה נבדק גם הוא');
  const existing = cafe({ business: { name: 'קפה ותיק', isNew: false, entity: 'osek', years: 4, employees: 4, field: 'בית קפה', description: 'העסק טרם נפתח, ואנחנו בשלב התכנון' } });
  const w = E.conflictWarnings(existing);
  assert.equal(w.length, 1);
  assert.ok(/כבר פועל/.test(w[0].text), 'לעסק פועל – ההסבר ההפוך');
  // עסק פועל שכותב "הרחבה" הוא תקין לגמרי ולא מקבל אזהרת שווא
  const ok = cafe({ business: { name: 'קפה ותיק', isNew: false, entity: 'osek', years: 4, employees: 4, field: 'בית קפה', description: 'הרחבת ההיצע והוספת מאפייה' } });
  assert.deepEqual(E.conflictWarnings(ok), []);
  const app = read('app.js');
  assert.ok(app.includes('E.conflictWarnings(plan)'), 'האזהרה מוצגת בממשק');
  assert.ok(app.includes('function stepAlertsHtml'), 'כתיבת אזהרות בשלב ההזנה');
  assert.ok(!read('app.js').match(/\$\('doc'\)\.innerHTML[\s\S]*conflictWarnings/), 'ולא במסמך עצמו');
});

// ---------- 12. אזהרות סבירות על ההנחות ----------

test('12 הנחות: שלושת הספים קיימים כקונפיגורציה, ותוכנית סבירה לא מקבלת אזהרות', () => {
  assert.equal(typeof E.ASSUMPTIONS.ebitdaPct, 'number');
  assert.equal(typeof E.ASSUMPTIONS.rampMonths, 'number');
  assert.equal(typeof E.ASSUMPTIONS.salesPerWorker, 'number');
  const res = E.computePlan(cafe());
  assert.deepEqual(res.assumptions, [], 'מקרה הבדיקה של מאיר סביר בכל שלושת המדדים');
  near(E.operatingMarginPct(cafe().forecast), 32, 0.5);
});

test('12 הנחות: רווח תפעולי גבוה מדי מפעיל אזהרה עם המספר עצמו', () => {
  const p = cafe();
  p.forecast.cogsPct = 10; // 90% רווח גולמי, עם אותן הוצאות
  const w = E.assumptionWarnings(p).find((x) => x.code === 'margin');
  assert.ok(w, 'האזהרה קיימת');
  assert.ok(w.value > E.ASSUMPTIONS.ebitdaPct);
  assert.ok(/100 ₪/.test(w.text), 'מנוסח בשפה של בעל עסק, לא כאחוז מופשט');
  assert.ok(!/EBITDA|margin/i.test(w.text), 'בלי ז\'רגון');
});

test('12 הנחות: הגעה מהירה מדי לקצב מלא, ומחזור גבוה לעובד', () => {
  const fast = cafe();
  fast.forecast.rampMonths = 0;
  const ramp = E.assumptionWarnings(fast).find((x) => x.code === 'ramp');
  assert.ok(ramp, 'עסק חדש שמניח קצב מלא מיד – אזהרה');
  assert.ok(ramp.text.includes('מיד עם הפתיחה'));
  // בעסק פועל זו הנחה לגיטימית, ואין אזהרה
  const existing = cafe({ business: { name: 'קפה ותיק', isNew: false, entity: 'osek', years: 4, employees: 4, field: 'בית קפה', description: 'x' } });
  existing.forecast.rampMonths = 0;
  assert.equal(E.assumptionWarnings(existing).find((x) => x.code === 'ramp'), undefined);

  const thin = cafe();
  thin.business.employees = 0; // רק הבעלים, מול מחזור של 1.8 מיליון
  const perWorker = E.assumptionWarnings(thin).find((x) => x.code === 'perWorker');
  assert.ok(perWorker, 'מחזור לעובד גבוה – אזהרה');
  assert.ok(perWorker.text.includes('1,800,000'), 'המספר שחושב מוצג');
  const app = read('app.js');
  assert.ok(app.includes('E.assumptionWarnings(plan)'), 'האזהרות מוצגות בממשק');
  assert.ok(app.includes('const ASSUMPTION_STEP'), 'כל אזהרה מוצגת בשלב שבו מתקנים אותה');
});

// ---------- 13. שדות חסרים בהזנה ----------

function cafeWithExtras() {
  const p = cafe();
  p.startup.preOpenCosts = 24000;   // שכירות בתקופת השיפוץ
  p.startup.deposit = 18000;        // פיקדון לשכירות
  p.startup.equipmentVat = 18000;   // מע"מ על הציוד
  p.loan.amount = 242000;           // כדי שהמקורות ימשיכו לכסות את השימושים
  return p;
}

test('13 הוצאות לפני פתיחה ופיקדון: נכנסים לעלויות ההקמה, לשימושים ולתזרים', () => {
  const p = cafeWithExtras();
  assert.equal(E.setupCostsTotal(p), 180000 + 24000 + 18000, 'סך ההקמה כולל את שני השדות החדשים');
  const uses = E.planUses(p);
  assert.ok(uses.some((u) => /הוצאות לפני הפתיחה/.test(u.item) && u.amount === 24000));
  assert.ok(uses.some((u) => /פיקדון/.test(u.item) && u.amount === 18000));
  const res = E.computePlan(p);
  assert.equal(res.cash[0].invest, 222000, 'הכול יוצא בחודש הראשון');
  assert.deepEqual(res.blocking, [], 'בדיקות התקינות עוברות: מקורות = שימושים, השקעה = הקמה');
  assert.equal(res.sourcesTotal, res.usesTotal);
  // בלי השדות החדשים שום דבר לא משתנה – אין רגרסיה למי שלא ממלא אותם
  assert.equal(E.setupCostsTotal(cafe()), 180000);
  assert.deepEqual(E.setupExtras(cafe()), []);
});

test('13 מע"מ על הציוד: יוצא בחודש 1, חוזר בחודש 3, ומתאפס על פני השנה', () => {
  const res = E.computePlan(cafeWithExtras());
  assert.equal(res.vat.amount, 18000);
  assert.equal(res.vat.refundMonth, 3);
  assert.equal(res.cash[0].vatOut, 18000);
  assert.equal(res.cash[2].vatIn, 18000);
  assert.equal(res.cash.reduce((s, c) => s + c.vatOut - c.vatIn, 0), 0, 'הכסף חוזר, ולכן אינו עלות');
  // אבל הוא כן חסר בחשבון בחודשים 1–2, וזו בדיוק הנקודה
  const without = E.computePlan({ ...cafeWithExtras(), startup: { ...cafeWithExtras().startup, equipmentVat: 0 } });
  near(res.cash[0].closing, without.cash[0].closing - 18000, 0.01);
  near(res.cash[1].closing, without.cash[1].closing - 18000, 0.01);
  near(res.cash[11].closing, without.cash[11].closing, 0.01);
  assert.equal(E.TAX.vatRatePct, 18, 'שיעור המע"מ הוא קונפיגורציה');
  assert.equal(E.suggestedEquipmentVat(cafe()), 32400, 'הצעה: 18% מעלויות ההקמה שפורטו');
});

test('13 השדות קיימים באשף, וגם תקופת הגרייס', () => {
  const app = read('app.js');
  assert.ok(app.includes("k: 'startup.preOpenCosts'"), 'הוצאות לפני פתיחה');
  assert.ok(app.includes("k: 'startup.deposit'"), 'פיקדון או ערבות לשכירות');
  assert.ok(app.includes("k: 'startup.equipmentVat'"), 'מע"מ על רכישת ציוד');
  assert.ok(app.includes("k: 'loan.graceMonths'"), 'תקופת גרייס בהלוואה');
  assert.ok(app.includes('שכירות בתקופת השיפוץ'), 'ההסבר בשפה של בעל עסק');
  assert.ok(app.includes('res.vat.amount > 0'), 'שורות המע"מ בתזרים רק כשהוא רלוונטי');
});

// ---------- 14. מחזור שנבנה מלמטה ----------

test('14 מחזור מלמטה: לקוחות ביום × קנייה ממוצעת × ימי פעילות', () => {
  const f = { customersPerDay: 120, avgTicket: 48, daysPerMonth: 26 };
  const b = E.bottomUpSales(f);
  assert.equal(b.monthly, 149760);
  assert.equal(b.annual, 1797120);
  assert.ok(b.ok);
  const t = E.bottomUpText(f);
  assert.ok(t.includes('120') && t.includes('48') && t.includes('26'), 'שלושת הנתונים בחישוב');
  assert.ok(t.includes('1,797,120'), 'והתוצאה השנתית');
  // נתון חסר – אין חישוב ואין טקסט
  assert.equal(E.bottomUpSales({ customersPerDay: 120, avgTicket: 0, daysPerMonth: 26 }).ok, false);
  assert.equal(E.bottomUpText({ customersPerDay: 120 }), '');
});

test('14 מחזור מלמטה: כל התוכנית נגזרת מהמספר שיצא מהחישוב, והוא מוצג במסמך', () => {
  const p = cafe();
  p.forecast.salesModel = 'bottomUp';
  p.forecast.customersPerDay = 120;
  p.forecast.avgTicket = 48;
  p.forecast.daysPerMonth = 26;
  p.forecast.annualSales = E.bottomUpSales(p.forecast).annual;
  assert.ok(E.usesBottomUp(p), 'התוכנית מסומנת כבנויה מלמטה');
  const res = E.computePlan(p);
  near(res.years[1].revenue, 1797120 * 1.05, 1, 'הרו"ה נגזר מאותו מחזור');
  assert.equal(E.usesBottomUp(cafe()), false, 'ברירת המחדל נשארה סכום שנתי');
  const app = read('app.js');
  assert.ok(app.includes('function syncBottomUp'), 'המחזור השנתי מתעדכן מהחישוב');
  assert.ok(app.includes("SALES_MODEL_OPTS = { total: 'סכום שנתי', bottomUp: 'לפי לקוחות ביום' }"), 'הבחירה בממשק');
  assert.ok(app.includes("k: 'forecast.customersPerDay'") && app.includes("k: 'forecast.avgTicket'") && app.includes("k: 'forecast.daysPerMonth'"), 'שלושת השדות');
  assert.ok(app.includes('E.usesBottomUp(p) ?') && app.includes('E.bottomUpText(p.forecast)'), 'החישוב מוצג גם במסמך');
});

// ---------- 15. פרקי הבעלים והשוק ----------

test('15 פרק הבעלים: נבנה מהשאלות המונחות, כולל השכלה', () => {
  const p = cafe();
  p.owner.education = 'קורס ברייה מקצועי ותעודת ניהול מזון';
  const ps = E.ownerParagraphs(p);
  const all = ps.map((x) => `${x.lead} ${x.text}`).join(' | ');
  assert.ok(all.includes('אריאל') && all.includes('קפה פינת חן'), 'שם הבעלים ושם העסק');
  assert.ok(all.includes('ניהול משמרת ברשת בתי קפה'), 'הניסיון');
  assert.ok(all.includes('קורס ברייה מקצועי'), 'וההשכלה');
  assert.ok(ps.some((x) => x.lead === 'ניסיון מקצועי:') && ps.some((x) => x.lead === 'השכלה והכשרה:'), 'כל תשובה עם כותרת משלה');
  assert.ok(/טרם נפתח/.test(all), 'ובעסק בהקמה – למה הפרק הזה חשוב');
  // בלי השכלה אין פסקה ריקה
  assert.ok(!E.ownerParagraphs(cafe()).some((x) => x.lead === 'השכלה והכשרה:'));
  // הטקסט חוזר מפוצל, כדי שהמסמך יוכל לעשות escaping לתוכן של המשתמש
  assert.ok(ps.every((x) => typeof x.lead === 'string' && typeof x.text === 'string'));
});

test('15 פרק השוק: לקוחות, מתחרים, תמחור ויתרון – כל אחד בכותרת משלו', () => {
  const p = cafe();
  p.market.pricing = 'מחיר כוס קפה 12 ₪, כמו ברשתות, והמאפים ב-10% פחות';
  const secs = E.marketSections(p);
  assert.deepEqual(secs.map((s) => s.heading), ['לקוחות', 'מתחרים', 'תמחור', 'היתרון התחרותי']);
  assert.ok(secs[2].texts[0].includes('12 ₪'));
  // שדה ריק לא יוצר כותרת ריקה במסמך
  const bare = E.marketSections({ market: { customers: 'תושבי השכונה', advantage: 'אפייה במקום' } });
  assert.deepEqual(bare.map((s) => s.heading), ['לקוחות', 'היתרון התחרותי']);
  assert.deepEqual(E.marketSections({}), []);
  const app = read('app.js');
  assert.ok(app.includes('E.ownerParagraphs(p)') && app.includes('E.marketSections(p)'), 'המסמך נבנה מהם');
  assert.ok(app.includes("k: 'owner.education'") && app.includes("k: 'market.pricing'"), 'השאלות המונחות באשף');
  // סבב שני (סעיף 21): טקסט המסמך עובר דרך dt() – בידוד כיווניות למספרים ואז אותו escaping
  assert.ok(/dt\(par\.text\)/.test(app) && /dt\(t\)/.test(app), 'טקסט של המשתמש עובר דרך dt');
  assert.ok(app.includes('const dt = (s) => esc(bd(s))'), 'ו-dt עושה escaping מלא');
});

// ---------- רגרסיה: גל א' לא נשבר ----------

test('רגרסיה: "קפה פינת חן" – אותן יתרות סגירה ואותן בדיקות תקינות כמו אחרי גל א\'', () => {
  const res = E.computePlan(cafe());
  // עודכן פעמיים: (1) סבב QA 5 באג חוסם 2 – המס בשנה 1 עלה מ-127,515 ₪ ל-146,033 ₪
  // (רכיב ביטוח הבריאות, 18,518 ₪); (2) 27.09.2026 – פריסת המס בתזרים לפי הפעילות
  // בפועל של כל חודש (taxSpread) במקום 1/12 קבוע: בחודשים 1–2 העסק בהפסד ולכן אין מס,
  // והיתרות חזרו לערכי טבלת היעד בלי מס. סך המס השנתי לא השתנה (חודש 12 זהה).
  assert.equal(Math.round(res.cash[0].closing), 33242);
  assert.equal(Math.round(res.cash[1].closing), 12735);
  assert.equal(Math.round(res.cash[2].closing), 11699);
  assert.equal(Math.round(res.cash[11].closing), 160376);
  assert.deepEqual(res.checks.map((c) => c.code), ['sources', 'invest', 'items']);
  assert.deepEqual(res.blocking, []);
  assert.equal(res.sourcesTotal, 260000);
  assert.equal(res.usesTotal, 260000);
  assert.equal(res.cash[0].invest, 180000);
  near(res.minDscr, 2.67, 0.01); // ירד מ-3.06 בעקבות תיקון ביטוח לאומי (QA 5, באג חוסם 2)
});
