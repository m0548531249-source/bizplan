/**
 * גל ב', סבב שני – סעיפים 16–21 (P2: הצגה) מתוך docs/BUGS-improvement-3.md.
 * 16 כרטיסי מדדים · 17 גרפים · 18 טבלת תזרים · 19 טבלת תרחישים ·
 * 20 יחידות אחידות · 21 שכבת הטקסט ב-PDF (bidi).
 *
 * מה שאפשר לבדוק במספרים נבדק במנוע (engine.js), ומה שהוא הצגה נבדק על המבנה
 * ועל הנתונים שנכנסים לתצוגה – לא על פיקסלים.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const digits = (s) => E.stripBidi(String(s)).replace(/[^\d.,-]/g, '');

/** מקרה הבדיקה של מאיר, זהה לזה שבסבבים הקודמים */
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

// ---------- 16. כרטיסי מדדים בראש הדוח ----------

test('16 מדדים: חמישה כרטיסים – סכום, הון עצמי, DSCR, יתרה מינימלית וחודש איזון', () => {
  const p = cafe();
  const res = E.computePlan(p);
  const cards = E.headlineMetrics(p, res);
  assert.deepEqual(cards.map((c) => c.key), ['loan', 'equity', 'dscr', 'cash', 'breakeven']);
  assert.equal(digits(cards[0].value), '200,000', 'סכום מבוקש');
  assert.equal(cards[1].value, '23%', 'הון עצמי: 60,000 מתוך 260,000');
  assert.equal(cards[2].value, E.stripBidi(cards[2].value));
  near(Number(cards[2].value), res.minDscr, 0.01);
  assert.equal(digits(cards[3].value), digits(E.ils(res.cushion.min)), 'היתרה המינימלית בפועל');
  assert.equal(cards[4].value, `חודש ${E.breakEvenMonth(res.cash)}`);
});

test('16 מדדים: כל כרטיס מסביר את עצמו בעברית פשוטה, בלי ז\'רגון יתום', () => {
  const p = cafe();
  const cards = E.headlineMetrics(p, E.computePlan(p));
  cards.forEach((c) => {
    assert.ok(c.label && c.note, `לכרטיס ${c.key} יש כותרת והסבר`);
    assert.ok(c.note.length > 25, `ההסבר של ${c.key} הוא משפט, לא מילה`);
    assert.ok(['ok', 'warn', 'risk', 'plain'].includes(c.level));
  });
  const dscr = cards.find((c) => c.key === 'dscr');
  assert.ok(/כמה פעמים המזומן הפנוי מכסה/.test(dscr.note), 'DSCR מוסבר ליד המונח');
  const be = cards.find((c) => c.key === 'breakeven');
  assert.ok(/ההכנסות מכסות את ההוצאות השוטפות/.test(be.note), 'חודש האיזון מוסבר');
});

test('16 מדדים: הדירוג משתנה עם המספרים (הון עצמי דק, תזרים במינוס)', () => {
  const thin = cafe({ startup: { equity: 20000, setupCosts: [{ item: 'ציוד', amount: 100000 }] }, loan: { ...cafe().loan, amount: 200000 } });
  const eq = E.headlineMetrics(thin, E.computePlan(thin)).find((c) => c.key === 'equity');
  assert.equal(eq.level, 'warn', 'פחות מ-20% הון עצמי – אזהרה');
  const base = cafe();
  const cash = E.headlineMetrics(base, E.computePlan(base)).find((c) => c.key === 'cash');
  assert.equal(cash.level, E.computePlan(base).cushion.level, 'הדירוג זהה לזה של המנוע');

  // בעסק פועל לא נשאלת שאלת ההון העצמי – ולכן לא מציגים "0%" ולא אזהרה על מה שלא נשאל
  const running = cafe({ business: { ...cafe().business, isNew: false, years: 3 }, startup: { equity: 0, setupCosts: [] } });
  const eqRunning = E.headlineMetrics(running, E.computePlan(running)).find((c) => c.key === 'equity');
  assert.equal(eqRunning.value, '—');
  assert.equal(eqRunning.level, 'plain');
  assert.ok(/דוחות הכספיים/.test(eqRunning.note), 'ההסבר אומר איפה ההון העצמי כן מופיע');
});

test('16 חודש איזון: החודש הראשון שבו ההכנסות מכסות את ההוצאות השוטפות', () => {
  const res = E.computePlan(cafe());
  const m = E.breakEvenMonth(res.cash);
  const row = res.cash[m - 1];
  assert.ok(row.revenue - row.cogs - row.fixed - row.salaries >= 0, 'בחודש האיזון ההכנסות מכסות');
  if (m > 1) {
    const prev = res.cash[m - 2];
    assert.ok(prev.revenue - prev.cogs - prev.fixed - prev.salaries < 0, 'ובחודש שלפניו – עוד לא');
  }
  // עסק שלא מגיע לאיזון בשנה הראשונה מקבל null, ולא חודש מומצא
  const weak = cafe({ forecast: { ...cafe().forecast, annualSales: 300000 } });
  assert.equal(E.breakEvenMonth(E.computePlan(weak).cash), null);
  const card = E.headlineMetrics(weak, E.computePlan(weak)).find((c) => c.key === 'breakeven');
  assert.equal(card.value, 'לא בשנה הראשונה');
  assert.equal(card.level, 'risk');
});

test('16 הכרטיסים מוצגים בראש המסמך, לפני פרק 1', () => {
  const app = read('app.js');
  assert.ok(app.includes('E.headlineMetrics(p, res)'), 'הנתונים מגיעים מהמנוע');
  assert.ok(app.includes('function metricsHtml'), 'רכיב תצוגה ייעודי');
  const doc = (app.match(/\$\('doc'\)\.innerHTML = `[\s\S]*?`;/) || [''])[0];
  assert.ok(doc.includes('${metricsHtml(p, res)}'), 'הכרטיסים בתוך המסמך');
  assert.ok(doc.indexOf('${metricsHtml(p, res)}') < doc.indexOf('1. תקציר מנהלים'), 'ולפני פרק 1');
});

// ---------- 17. גרפים ----------

test('17 סקאלה: הציר מכיל תמיד את האפס, והצעדים עגולים', () => {
  const s = E.niceScale([120, 400, 950]);
  assert.equal(s.min, 0, 'הבסיס הוא אפס גם כשכל הערכים חיוביים');
  assert.ok(s.max >= 950);
  assert.ok(s.ticks.length >= 3 && s.ticks[0] === s.min);
  assert.equal(E.niceStep(1000, 4), 500, 'טווח 1000 בארבעה צעדים → צעד של 500');
  assert.equal(E.niceStep(400, 4), 100);
  assert.equal(E.niceStep(4, 4), 1);
  assert.equal(E.niceStep(0, 4), 1, 'טווח אפס לא מפיל את החישוב');
  const neg = E.niceScale([-500, 300]);
  assert.ok(neg.min <= -500 && neg.max >= 300);
  assert.ok(neg.ticks.includes(0), 'יש סימון על האפס');
});

test('17 גרף קו: נקודה לכל חודש, מימין לשמאל, בתוך גבולות הציור', () => {
  const res = E.computePlan(cafe());
  const c = E.lineChartData(E.cashLineSeries(res));
  assert.equal(c.points.length, 12, 'שתים עשרה נקודות – שנה ראשונה');
  assert.deepEqual(c.points.map((pt) => Math.round(pt.value)), res.cash.map((r) => Math.round(r.closing)));
  assert.ok(c.points[0].x > c.points[11].x, 'חודש 1 בימין, חודש 12 בשמאל (עברית)');
  c.points.forEach((pt) => {
    assert.ok(pt.x >= c.axis.left - 0.01 && pt.x <= c.axis.right + 0.01, 'x בתוך התחום');
    assert.ok(pt.y >= c.axis.top - 0.01 && pt.y <= c.axis.bottom + 0.01, 'y בתוך התחום');
  });
  assert.ok(c.path.startsWith('M'), 'נתיב SVG תקין');
  assert.equal((c.path.match(/L/g) || []).length, 11);
  // ערך נמוך יותר = y גדול יותר (ציר הפוך ב-SVG)
  const min = c.points.reduce((a, b) => (b.value < a.value ? b : a));
  assert.ok(c.points.every((pt) => pt.y <= min.y + 0.01), 'הנקודה הנמוכה ביותר היא הנמוכה בגרף');
  assert.ok(c.points.some((pt) => pt.negative), 'חודש שלילי מסומן ככזה (במקרה הבדיקה יש כאלה)');
});

test('17 גרף עמודות: שלוש שנים × שלוש סדרות, גובה יחסי לערך', () => {
  const res = E.computePlan(cafe());
  const c = E.barChartData(E.plBarGroups(res));
  assert.equal(c.groups.length, 3);
  assert.deepEqual(c.groups.map((g) => g.label), ['שנה 1', 'שנה 2', 'שנה 3']);
  assert.deepEqual(c.groups[0].bars.map((b) => b.key), ['revenue', 'ebitda', 'net']);
  near(c.groups[0].bars[0].value, res.years[0].revenue, 1);
  assert.ok(c.groups[0].x > c.groups[2].x, 'שנה 1 בימין');
  const [rev, ebitda, net] = c.groups[0].bars;
  assert.ok(rev.h > ebitda.h && ebitda.h > net.h, 'הכנסות > רווח תפעולי > רווח נקי');
  c.groups.forEach((g) => g.bars.forEach((b) => {
    assert.ok(b.y >= c.axis.top - 0.01 && b.y + b.h <= c.axis.bottom + 0.01, 'העמודה בתוך שטח הציור');
    assert.ok(b.w > 0 && b.h >= 0);
  }));
  // עמודה שלילית יורדת מקו האפס ולא "נתלית" באוויר
  const loss = E.barChartData([{ label: 'שנה 1', bars: [{ key: 'net', label: 'רווח נקי', value: -50000 }, { key: 'revenue', label: 'הכנסות', value: 200000 }] }]);
  const negBar = loss.groups[0].bars.find((b) => b.negative);
  near(negBar.y, loss.zeroY, 0.5);
});

test('17 הגרפים מצוירים ב-SVG בקוד, בלי ספריית צד שלישי', () => {
  const app = read('app.js');
  const html = read('index.html');
  assert.ok(app.includes('E.lineChartData(E.cashLineSeries(res))'), 'גרף הקו נגזר מהמנוע');
  assert.ok(app.includes('E.barChartData(E.plBarGroups(res))'), 'גרף העמודות נגזר מהמנוע');
  assert.ok(app.includes('<svg class="ch ch-line"') && app.includes('<svg class="ch ch-bars"'), 'שני גרפים ב-SVG');
  assert.ok(/role="img" aria-label="\$\{esc\(bd\(label\)\)\}"/.test(app), 'לכל גרף תיאור נגיש');
  // אין תלות חיצונית חדשה: אין script חיצוני חוץ מהקבצים המקומיים
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ['engine.js', 'app.js'], 'רק הקבצים של המוצר');
  assert.ok(!/cdn\.|unpkg|jsdelivr|chart\.js/i.test(app + html), 'בלי ספריית גרפים חיצונית');
});

// ---------- 18. טבלת התזרים ----------

test('18 תזרים: תקבולים ותשלומים בקבוצות נפרדות, עם שורות ביניים', () => {
  const p = cafe();
  const res = E.computePlan(p);
  const s = E.cashflowSections(res, { entity: 'osek' });
  assert.equal(s.months.length, 12);
  assert.equal(s.inflows.title, 'תקבולים (כסף שנכנס)');
  assert.equal(s.outflows.title, 'תשלומים (כסף שיוצא)');
  assert.equal(s.inflows.total.label, 'סה"כ תקבולים');
  assert.equal(s.outflows.total.label, 'סה"כ תשלומים');
  assert.deepEqual(s.inflows.rows.map((r) => r.key), ['revenue', 'loanIn', 'equityIn']);
  assert.deepEqual(s.outflows.rows.map((r) => r.key), ['cogs', 'fixedSalaries', 'draw', 'tax', 'debt', 'invest']);
  // הסיכומים תואמים למנוע, חודש אחר חודש
  res.cash.forEach((row, i) => {
    near(s.inflows.total.values[i], row.inflow, 1);
    near(s.outflows.total.values[i], row.outflow, 1);
    near(s.net.values[i], row.inflow - row.outflow, 1);
    near(s.opening.values[i] + s.net.values[i], s.closing.values[i], 1);
  });
});

test('18 תזרים: שורות שאין בהן סכום לא מופיעות, ושם שורת המס לפי ההתאגדות', () => {
  const noEquity = cafe({ startup: { equity: 0, setupCosts: [{ item: 'ציוד', amount: 100000 }] } });
  const s = E.cashflowSections(E.computePlan(noEquity), { entity: 'osek' });
  assert.equal(s.inflows.rows.find((r) => r.key === 'equityIn'), undefined, 'אין הון עצמי – אין שורה');
  assert.equal(s.outflows.rows.find((r) => r.key === 'vatOut'), undefined, 'לא הוזן מע"מ – אין שורה');

  const withVat = cafe();
  withVat.startup.equipmentVat = 18000;
  withVat.loan.amount = 200000;
  const s2 = E.cashflowSections(E.computePlan(withVat), { entity: 'osek' });
  assert.ok(s2.outflows.rows.some((r) => r.key === 'vatOut'), 'מע"מ ששולם');
  assert.ok(s2.inflows.rows.some((r) => r.key === 'vatIn'), 'והחזר המע"מ');

  const company = E.cashflowSections(E.computePlan(cafe()), { entity: 'company' });
  assert.equal(company.outflows.rows.find((r) => r.key === 'tax').label, 'מס חברות');
  assert.equal(s.outflows.rows.find((r) => r.key === 'tax').label, 'מס הכנסה וביטוח לאומי');
});

test('18 הטבלה במסמך בנויה מהקבוצות, עם כותרת קבוצה ושורת סיכום', () => {
  const app = read('app.js');
  assert.ok(app.includes('function cashflowHtml'), 'רכיב תצוגה ייעודי');
  assert.ok(app.includes('E.cashflowSections(res, { entity })'), 'המבנה מגיע מהמנוע');
  const fn = (app.match(/function cashflowHtml[\s\S]*?\n  \}/) || [''])[0];
  assert.ok(/<tbody class="\$\{cls\}"><tr class="grp">/.test(fn), 'כל קבוצה ב-tbody משלה, עם שורת כותרת');
  assert.ok(fn.includes('cf-in') && fn.includes('cf-out'), 'תקבולים ותשלומים מופרדים');
  assert.ok(fn.includes("row(g.total, 'sub')"), 'שורת ביניים לכל קבוצה');
  assert.ok(fn.includes("row(s.net, 'sub')") && fn.includes("row(s.closing, 'total')"), 'תזרים נטו ויתרת סגירה');
  // העיצוב עבר מתגית <style> ב-index.html אל styles.css (סבב P3, בלי שינוי תוכן)
  const css = read('styles.css');
  assert.ok(css.includes('.doc table.cf tbody.cf-out tr.grp th'), 'הפרדה ויזואלית גם בעיצוב');
});

// ---------- 19. טבלת תרחישים ----------

test('19 תרחישים: בסיס, ‎-10% ו-‎-20%, עם רווח תפעולי, DSCR ויתרה מינימלית', () => {
  const p = cafe();
  const base = E.computePlan(p);
  const list = E.scenarios(p);
  assert.deepEqual(list.map((s) => s.pct), [0, -10, -20]);
  assert.deepEqual(list.map((s) => s.key), ['base', 'down10', 'down20']);
  list.forEach((s) => ['revenue', 'ebitda', 'minDscr', 'minCash'].forEach((k) => assert.ok(typeof s[k] === 'number', `${s.key}.${k}`)));
  near(list[0].ebitda, base.years[0].ebitda, 1);
  near(list[0].minDscr, base.minDscr, 0.001);
  near(list[0].minCash, base.cushion.min, 1);
  near(list[1].revenue, base.years[0].revenue * 0.9, 2);
  near(list[2].revenue, base.years[0].revenue * 0.8, 2);
  assert.ok(list[0].ebitda > list[1].ebitda && list[1].ebitda > list[2].ebitda, 'הרווח יורד עם המכירות');
  assert.ok(list[0].minDscr > list[2].minDscr, 'וגם יכולת ההחזר');
  assert.ok(list[0].minCash > list[2].minCash, 'וגם היתרה המינימלית');
});

test('19 תרחישים: ההוצאות וההחזרים לא יורדים יחד עם המכירות, והתוכנית לא משתנה', () => {
  const p = cafe();
  const before = JSON.stringify(p);
  const down = E.scenarioPlan(p, -20);
  assert.equal(JSON.stringify(p), before, 'התוכנית המקורית לא השתנתה');
  assert.equal(down.forecast.annualSales, Math.round(p.forecast.annualSales * 0.8));
  assert.equal(down.forecast.monthlyFixed, p.forecast.monthlyFixed, 'ההוצאות הקבועות נשארות');
  assert.equal(down.forecast.monthlySalaries, p.forecast.monthlySalaries, 'והשכר');
  assert.equal(down.loan.amount, p.loan.amount, 'וההלוואה');
  const note = E.scenarioNote(E.scenarios(p));
  assert.ok(note.includes('20%'), 'ההסבר מתייחס לתרחיש הגרוע ביותר');
  assert.ok(!/DSCR|EBITDA/i.test(note), 'בלי ז\'רגון באנגלית');
});

test('19 טבלת התרחישים מוצגת בפרק 9, עם ההסבר שמתחתיה', () => {
  const app = read('app.js');
  assert.ok(app.includes('function scenariosHtml'), 'רכיב תצוגה ייעודי');
  assert.ok(app.includes('E.scenarios(p)') && app.includes('E.scenarioNote(list)'), 'הנתונים וההסבר מהמנוע');
  const doc = (app.match(/\$\('doc'\)\.innerHTML = `[\s\S]*?`;/) || [''])[0];
  assert.ok(doc.includes('${scenariosHtml(p)}'), 'הטבלה במסמך');
  assert.ok(doc.indexOf('9. יכולת החזר וסיכונים') < doc.indexOf('${scenariosHtml(p)}'), 'בתוך פרק 9');
  assert.ok(/'תרחיש', 'מחזור שנה 1', 'רווח תפעולי שנה 1', 'יחס כיסוי חוב מינימלי', 'יתרת מזומן מינימלית'/.test(app), 'חמש עמודות בעברית');
});

// ---------- 20. יחידות אחידות ----------

test('20 יחידות: הסימן ₪ בכותרת הטבלה, והתאים מציגים מספר נקי', () => {
  assert.ok(E.MONEY_CAPTION.includes('₪'), 'הכותרת מצהירה על היחידה');
  const app = read('app.js');
  assert.ok(/function table\(head, rows, cls = '', caption = ''\)/.test(app), 'לטבלה יש כותרת יחידות');
  assert.ok(app.includes('<caption>${dt(caption)}</caption>'), 'הכותרת נכנסת כ-caption');
  ['pl', 'am', 'dscr', 'uses', 'sources', 'recTable'].forEach((name) => {
    const block = (app.match(new RegExp(`const ${name} = table\\(([\\s\\S]*?)\\n    \\]`)) || [''])[0];
    assert.ok(block, `נמצאה הטבלה ${name}`);
    assert.ok(!/\bils\(/.test(block), `בטבלה ${name} אין ₪ בתאים`);
  });
  assert.ok(app.includes("const M = (n) => bd(num(n));"), 'תא כספי = מספר בלבד');
  // כותרת פרק התזרים כבר לא נושאת (₪) – היחידה מוצהרת בכותרת הטבלה
  assert.ok(!app.includes('תזרים מזומנים חודשי – שנה ראשונה (₪)'));
  const fn = (app.match(/function cashflowHtml[\s\S]*?\n  \}/) || [''])[0];
  assert.ok(fn.includes('<caption>${dt(E.MONEY_CAPTION)}</caption>'), 'גם בטבלת התזרים');
  assert.ok(!/\bils\(/.test(fn), 'ובלי ₪ בתאים שלה');
});

test('20 יחידות: טבלה שמערבת סכומים ויחסים אומרת את זה בכותרת', () => {
  const app = read('app.js');
  assert.ok(app.includes('${E.MONEY_CAPTION}. השורה האחרונה היא יחס בין מספרים, ולא סכום'), 'טבלת יכולת ההחזר');
  assert.ok(app.includes('${E.MONEY_CAPTION}. עמודת יחס כיסוי החוב היא יחס בין מספרים, ולא סכום'), 'טבלת התרחישים');
  assert.ok(app.includes('${E.MONEY_CAPTION}. העמודה האחרונה באחוזים'), 'טבלת המקורות');
});

// ---------- 21. שכבת הטקסט ב-PDF (bidi) ----------

test('21 bidi: מספר בתוך משפט עברי נעטף בבידוד כיווניות', () => {
  const t = E.bidiText('הלוואה ל-5 שנים, ביוני 2027.');
  assert.ok(t.includes('⁦5⁩'), 'המספר עטוף');
  assert.ok(t.includes('⁦2027⁩'), 'וגם השנה');
  assert.ok(t.includes('ל-⁦5⁩'), 'המקף נשאר מחוץ לבידוד, צמוד ל-ל');
  assert.ok(t.endsWith('⁩.'), 'הנקודה נשארת אחרי הבידוד, בסוף המשפט');
  assert.equal(E.stripBidi(t), 'הלוואה ל-5 שנים, ביוני 2027.', 'הטקסט עצמו לא השתנה');
});

test('21 bidi: אחוזים, מספרים עשרוניים ותאריכים נשמרים כיחידה אחת', () => {
  assert.ok(E.bidiText('שיעור של 35% מהמחזור').includes('⁦35%⁩'), 'האחוז בתוך הבידוד');
  assert.ok(E.bidiText('יחס של 1.25 ומעלה').includes('⁦1.25⁩'), 'המספר העשרוני לא נשבר');
  assert.ok(E.bidiText('פתיחה ב-1.6.2027').includes('⁦1.6.2027⁩'), 'התאריך כיחידה אחת');
  assert.ok(E.bidiText('סכום של 1,800,000 ₪').includes('⁦1,800,000⁩'), 'מפרידי האלפים בפנים');
});

test('21 bidi: במספר שלילי המינוס נכנס לבידוד, אבל מקף עברי נשאר בחוץ', () => {
  const neg = E.bidiText(E.ils(-13402));
  assert.ok(neg.includes('⁦-13,402⁩'), `המינוס בתוך הבידוד: ${JSON.stringify(neg)}`);
  assert.equal(E.stripBidi(neg), E.ils(-13402), 'והטקסט עצמו לא השתנה');
  assert.ok(E.bidiText('הפסד של -40,000 בשנה').includes('⁦-40,000⁩'), 'גם בתוך משפט');
  assert.ok(E.bidiText('הלוואה ל-5 שנים').includes('ל-⁦5⁩'), 'המקף של "ל-" נשאר מחוץ לבידוד');
  assert.equal(E.stripBidi(E.bidiText('יתרה של -13,402 ₪')), 'יתרה של -13,402 ₪', 'הטקסט עצמו לא השתנה');
});

test('21 bidi: הפעולה אידמפוטנטית, ולא נוגעת בטקסט בלי מספרים', () => {
  const once = E.bidiText('החזר של 4,008 בחודש');
  assert.equal(E.bidiText(once), once, 'הפעלה שנייה לא מוסיפה בידודים');
  assert.equal(E.bidiText('בלי מספרים כאן'), 'בלי מספרים כאן');
  assert.equal(E.bidiText(''), '');
  assert.equal(E.bidiText(null), '');
  assert.equal(E.ltr('12.5'), '⁦12.5⁩');
});

test('21 bidi: המנוע ממשיך להחזיר מספרים נקיים – העטיפה היא בשכבת התצוגה', () => {
  assert.equal(E.stripBidi(E.ils(200000)), E.ils(200000), 'ils נקי מבידודים');
  assert.equal(E.stripBidi(E.num(1.25, 2)), E.num(1.25, 2));
  const res = E.computePlan(cafe());
  assert.equal(E.stripBidi(E.outlookText(res.years)), E.outlookText(res.years), 'גם הניסוחים של המנוע');
});

test('21 המסמך עוטף כל טקסט ומספר לפני ה-escaping', () => {
  const app = read('app.js');
  assert.ok(app.includes('const bd = E.bidiText;'), 'העטיפה מגיעה מהמנוע');
  assert.ok(app.includes('const dt = (s) => esc(bd(s));'), 'קודם בידוד, ואז escaping – כדי לא לשבור ישויות HTML');
  assert.ok(app.includes('const MS = (n) => bd(ils(n));') && app.includes('const N = (n, d = 0) => bd(num(n, d));'), 'סכומים ומספרים במשפטים');
  const doc = (app.match(/\$\('doc'\)\.innerHTML = `[\s\S]*?`;/) || [''])[0];
  assert.ok(doc.length > 1000, 'נמצא גוף המסמך');
  assert.ok(!/\$\{esc\(/.test(doc), 'אין יותר esc ישיר במסמך – הכול עובר דרך dt');
  assert.ok(!/\$\{ils\(/.test(doc), 'ואין ils ישיר – הכול עובר דרך MS');
});

// ---------- רגרסיה: גל א' וגל ב' סבב ראשון לא נשברו ----------

test('רגרסיה: "קפה פינת חן" – יתרות הסגירה ובדיקות התקינות לא השתנו', () => {
  const res = E.computePlan(cafe());
  const closing = res.cash.map((c) => Math.round(c.closing));
  // הערכים עודכנו אחרי תיקון באג חוסם 2 של סבב QA 5 (ביטוח לאומי לעצמאי כולל מעכשיו
  // גם דמי ביטוח בריאות): המס בשנה 1 עלה, ולכן כל יתרות הסגירה ירדו. שאר התזרים לא נגע.
  assert.deepEqual([closing[0], closing[1], closing[2], closing[11]], [21073, -11604, -18031, 160376]);
  assert.deepEqual(res.checks.map((c) => c.ok), [true, true, true]);
  assert.equal(res.blocking.length, 0);
  near(res.years[0].revenue, 1575000, 1);
  near(res.years[0].ebitda, 418500, 1);
});
