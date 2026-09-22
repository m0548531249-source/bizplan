// בדיקות לשיפור 1: מחשבון הלוואה, footer אחיד, sitemap ו-robots.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');
const C = require('../calculator.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const MAIL = 'mailto:kodesh.labs.tachlis.ai@gmail.com?subject=';

test('מחשבון: טוען את engine.js לפני calculator.js, ומשתמש בפונקציות המנוע', () => {
  const html = read('calculator.html');
  const js = stripComments(read('calculator.js'));
  const iEngine = html.indexOf('<script src="engine.js">');
  const iCalc = html.indexOf('<script src="calculator.js">');
  assert.ok(iEngine > -1 && iCalc > iEngine, 'engine.js צריך להיטען לפני calculator.js');
  for (const fn of ['maxLoan', 'amortization', 'spitzerPayment']) {
    assert.ok(new RegExp(`E\\.${fn}\\(`).test(js), `calculator.js צריך לקרוא ל-Engine.${fn}`);
  }
  assert.ok(!/Math\.pow/.test(js), 'אין נוסחה פיננסית חדשה במחשבון (Math.pow)');
});

test('מחשבון: התוצאות זהות לתוכנית המלאה (computePlan) על אותם נתונים', () => {
  const cases = [
    { amount: 300000, ratePct: 7.5, years: 5, graceMonths: 6, annualSales: 1600000 },
    { amount: 120000, ratePct: 6, years: 3, graceMonths: 0, annualSales: 0 },
    { amount: 450000, ratePct: 0, years: 4, graceMonths: 3, annualSales: 0 },
    { amount: 90000, ratePct: 9.25, years: 1, graceMonths: 1, annualSales: 800000 },
  ];
  for (const c of cases) {
    const r = C.calculate(c, E);
    const full = E.computePlan({
      forecast: { annualSales: c.annualSales },
      loan: { amount: c.amount, ratePct: c.ratePct, years: c.years, graceMonths: c.graceMonths, uses: [] },
    });
    near(r.monthlyPayment, full.monthlyPayment);
    near(r.totalInterest, full.totalInterest);
    near(r.graceInterest, full.graceInterest);
    assert.equal(r.cap, full.cap);
  }
});

test('מחשבון: ערך ידוע (100,000 ₪, 6%, 5 שנים, בלי גרייס ≈ 1,933.28 ₪ בחודש)', () => {
  const r = C.calculate({ amount: 100000, ratePct: 6, years: 5, graceMonths: 0 }, E);
  near(r.monthlyPayment, 1933.28);
  assert.equal(r.payments, 60);
  near(r.totalInterest, 1933.28 * 60 - 100000, 1);
});

test('מחשבון: בדיקת תקרה – 500 אלף בלי מחזור, 8% מהמחזור כשהוא גבוה', () => {
  const base = { ratePct: 6, years: 5, graceMonths: 0 };
  assert.equal(C.calculate({ ...base, amount: 500000 }, E).withinCap, true);
  assert.equal(C.calculate({ ...base, amount: 500001 }, E).withinCap, false);
  const big = C.calculate({ ...base, amount: 700000, annualSales: 10000000 }, E);
  assert.equal(big.cap, 800000);
  assert.equal(big.withinCap, true);
  assert.equal(big.hasSales, true);
  assert.equal(C.calculate({ ...base, amount: 1 }, E).hasSales, false);
});

test('מחשבון: ולידציה של הקלט', () => {
  const ok = { amount: 100000, ratePct: 6, years: 5, graceMonths: 0 };
  assert.deepEqual(C.validate(ok, E), {});
  assert.ok(C.validate({ ...ok, amount: 0 }, E).amount);
  assert.ok(C.validate({ ...ok, ratePct: '' }, E).ratePct);
  assert.ok(C.validate({ ...ok, ratePct: 45 }, E).ratePct);
  assert.ok(C.validate({ ...ok, ratePct: NaN }, E).ratePct);
  assert.ok(C.validate({ ...ok, years: 6 }, E).years);
  assert.ok(C.validate({ ...ok, graceMonths: 7 }, E).graceMonths);
  assert.deepEqual(C.validate({ ...ok, ratePct: 0 }, E), {}, 'ריבית 0 מותרת');
});

test('מחשבון: עברית, RTL, כותרת ותיאור לגוגל לפי האפיון', () => {
  const html = read('calculator.html');
  assert.match(html, /<html[^>]*lang="he"[^>]*dir="rtl"/);
  assert.ok(html.includes('<title>מחשבון הלוואה בערבות מדינה – החזר חודשי ותקרה | תוכנית עסקית בקליק</title>'));
  assert.ok(html.includes('<meta name="description" content="מחשבון חינמי: הזינו סכום, תקופה, גרייס וריבית וקבלו החזר חודשי, סך ריבית ובדיקת תקרה. בלי הרשמה, בלי שליחת נתונים לשרת.">'));
});

test('מחשבון: בלי דיאלוגים של הדפדפן, בלי שמירה ובלי שליחה לשרת', () => {
  const js = stripComments(read('calculator.js'));
  const html = read('calculator.html').replace(/<!--[\s\S]*?-->/g, '');
  for (const src of [js, html]) {
    assert.ok(!/\b(confirm|alert|prompt)\s*\(/.test(src), 'נמצא דיאלוג חוסם');
  }
  assert.ok(!/localStorage|sessionStorage|indexedDB/.test(js), 'המחשבון לא שומר נתונים');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(js), 'המחשבון לא שולח נתונים');
});

test('מחשבון: שדות כסף מפורמטים עם מפרידי אלפים, וכפתור המשך לתוכנית המלאה', () => {
  const html = read('calculator.html');
  const js = read('calculator.js');
  assert.ok((html.match(/data-money="1"/g) || []).length >= 2, 'סכום ומחזור הם שדות כסף');
  assert.ok(/Intl\.NumberFormat\('he-IL'/.test(js));
  assert.ok(/<a class="btn btn-primary btn-lg" href="\.\/">בנו לי תוכנית עסקית מלאה<\/a>/.test(html));
  assert.ok(html.includes(MAIL) && html.includes('>ספרו לנו מה חסר<'));
});

test('footer אחיד ב-3 העמודים: מייל עם נושא מוכן וקישורים הדדיים', () => {
  const pages = { 'index.html': ['calculator.html', 'legal.html'], 'calculator.html': ['./', 'legal.html'], 'legal.html': ['./', 'calculator.html'] };
  for (const [page, links] of Object.entries(pages)) {
    const html = read(page);
    const foot = (html.match(/<footer class="site-foot">[\s\S]*?<\/footer>/) || [])[0];
    assert.ok(foot, `${page}: חסר footer`);
    assert.ok(foot.includes('תוכנית עסקית בקליק · כלי עזר, לא ייעוץ פיננסי'), `${page}: חסרה שורת ההבהרה`);
    const mail = foot.match(/href="(mailto:[^"]+)"/);
    assert.ok(mail && mail[1].startsWith(MAIL), `${page}: חסר קישור מייל עם נושא`);
    assert.equal(decodeURIComponent(mail[1].split('subject=')[1]), 'משוב על תוכנית עסקית בקליק');
    assert.ok(foot.includes('מצאתם טעות? כתבו לנו'));
    for (const l of links) assert.ok(foot.includes(`href="${l}"`), `${page}: חסר קישור ל-${l}`);
    assert.ok(html.includes('href="styles.css"'), `${page}: חסר styles.css`);
  }
  assert.ok(read('legal.html').includes('לשאלות או בעיות פרטיות:'), 'legal.html: חסרה שורת יצירת קשר לפרטיות');
});

test('שמירת המסמך אוספת גם את styles.css (לא רק תגיות style)', () => {
  const app = read('app.js');
  assert.ok(/document\.styleSheets/.test(app) && /cssRules/.test(app));
  assert.ok(fs.existsSync(path.join(ROOT, 'styles.css')));
  assert.ok(read('styles.css').includes('.doc {'), 'סגנונות המסמך נמצאים ב-styles.css');
});

test('sitemap.xml כולל את 3 העמודים, ו-robots.txt מצביע עליו', () => {
  const BASE = 'https://m0548531249-source.github.io/bizplan/';
  const xml = read('sitemap.xml');
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.ok(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs.sort(), [BASE, `${BASE}calculator.html`, `${BASE}legal.html`].sort());
  assert.equal((xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length, 3);
  const robots = read('robots.txt');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.ok(robots.includes(`Sitemap: ${BASE}sitemap.xml`));
});

// ---------- תיקונים אחרי QA של תמר ----------

test('QA 1: ריבית ברירת מחדל 7.5% – בשדה, בהסבר ובהודעת השגיאה', () => {
  const html = read('calculator.html');
  const rateInput = (html.match(/<input id="c-rate"[^>]*>/) || [''])[0];
  assert.match(rateInput, /value="7\.5"/);
  assert.ok(html.includes('השאירו 7.5% כהערכה'));
  assert.ok(!/השאירו 6%/.test(html));
  assert.equal(C.DEFAULT_RATE, 7.5);
  const err = C.validate({ amount: 100000, ratePct: '', years: 5, graceMonths: 0 }, E).ratePct;
  assert.ok(err.includes('למשל 7.5'), err);
});

test('QA 3: מינוס נשמר בפענוח ומציג שגיאה – לא הופך בשקט לחיובי', () => {
  assert.equal(C.parseMoney('-5,000'), -5000);
  assert.equal(C.parseMoney('−5000'), -5000); // מינוס טיפוגרפי מהדבקה
  assert.equal(C.parseMoney('250,000'), 250000);
  assert.equal(C.parseMoney(''), 0);
  assert.equal(C.parseMoney('-'), 0);
  assert.equal(C.parseRate('-3'), -3);
  assert.equal(C.parseRate('7,5'), 7.5);
  assert.equal(C.parseRate('7.5%'), 7.5);
  assert.equal(C.parseRate('abc'), '');
  assert.equal(C.parseRate(''), '');
  const base = { amount: 100000, ratePct: 7.5, years: 5, graceMonths: 0 };
  assert.equal(C.validate({ ...base, ratePct: C.parseRate('-3') }, E).ratePct, 'הריבית לא יכולה להיות שלילית');
  assert.equal(C.validate({ ...base, amount: C.parseMoney('-5000') }, E).amount, 'הסכום לא יכול להיות שלילי');
  assert.ok(C.validate({ ...base, annualSales: C.parseMoney('-1,000,000') }, E).annualSales);
  const js = stripComments(read('calculator.js'));
  assert.ok(!/parseNum\(/.test(js), 'כל הקלט עובר דרך parseMoney/parseRate ששומרות על המינוס');
});

test('QA 4: סכום מינימלי 1,000 ₪ – אין תוצאה של "החזר 0 ₪"', () => {
  const base = { ratePct: 7.5, years: 5, graceMonths: 0 };
  assert.equal(C.MIN_AMOUNT, 1000);
  for (const amount of [0, 1, 999]) {
    const e = C.validate({ ...base, amount }, E);
    assert.ok(e.amount, `סכום ${amount} צריך שגיאה`);
  }
  assert.equal(C.validate({ ...base, amount: 500 }, E).amount, 'הסכום המינימלי במחשבון הוא 1,000 ₪');
  assert.deepEqual(C.validate({ ...base, amount: 1000 }, E), {});
  assert.ok(Math.round(C.calculate({ ...base, amount: 1000 }, E).monthlyPayment) > 0);
});

test('QA 2+5: "X תשלומים" בלי "שווים", ותוויות גרייס עם "חודשים"', () => {
  const js = read('calculator.js');
  assert.ok(!js.includes('תשלומים שווים'));
  assert.ok(js.includes('`${v} חודשים`'));
  assert.ok(read('app.js').includes("opts: { 0: 'בלי', 3: '3 חודשים', 6: '6 חודשים' }"));
});

test('QA 6: legal.html עם הפס העליון והלוגו', () => {
  assert.match(read('legal.html'), /<header class="appbar">[\s\S]*?class="logo" href="\.\/"/);
});
