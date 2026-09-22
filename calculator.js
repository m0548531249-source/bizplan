/* מחשבון הלוואה בערבות מדינה – תוכנית עסקית בקליק.
 * כל החישוב דרך engine.js (maxLoan, amortization, spitzerPayment). אין כאן נוסחה פיננסית משלנו.
 * לא שומרים כלום: אין localStorage ואין שליחה לשרת. */
(function (root) {
  'use strict';

  const YEARS = [1, 2, 3, 4, 5];
  const GRACE = [0, 1, 2, 3, 4, 5, 6];
  const MAX_RATE = 30;
  const MIN_AMOUNT = 1000;
  const DEFAULT_RATE = 7.5;
  const MINUS = /[-−‒–]/; // מינוס רגיל, וגם מינוסים "טיפוגרפיים" שמגיעים מהדבקה

  /** סכום בשקלים מטקסט: "250,000" → 250000, "-5,000" → -5000 (המינוס נשמר כדי להציג שגיאה), ריק → 0 */
  function parseMoney(s) {
    const str = String(s == null ? '' : s);
    const n = Number(str.replace(/[^\d.]/g, '')) || 0;
    return MINUS.test(str) && n ? -n : n;
  }

  /** ריבית מטקסט: "7,5" / "7.5%" → 7.5, "-3" → -3, ריק או טקסט בלי ספרות → '' (שגיאה, לא 0%) */
  function parseRate(s) {
    const str = String(s == null ? '' : s);
    const digits = str.replace(',', '.').replace(/[^\d.]/g, '');
    if (digits === '') return '';
    const n = Number(digits);
    return MINUS.test(str) && n ? -n : n;
  }

  /** בדיקת קלט. מחזיר אובייקט שגיאות לפי שם שדה (ריק = תקין). */
  function validate(input, E) {
    const errors = {};
    const amount = Number(input.amount) || 0;
    if (amount < 0) errors.amount = 'הסכום לא יכול להיות שלילי';
    else if (amount === 0) errors.amount = 'כתבו כמה כסף אתם רוצים ללוות';
    else if (amount < MIN_AMOUNT) errors.amount = 'הסכום המינימלי במחשבון הוא 1,000 ₪';
    const rate = Number(input.ratePct);
    if (input.ratePct === '' || input.ratePct == null || !Number.isFinite(rate)) errors.ratePct = `כתבו את הריבית השנתית (למשל ${DEFAULT_RATE})`;
    else if (rate < 0) errors.ratePct = 'הריבית לא יכולה להיות שלילית';
    else if (rate > MAX_RATE) errors.ratePct = `ריבית של עד ${MAX_RATE} אחוז`;
    if (Number(input.annualSales) < 0) errors.annualSales = 'המחזור לא יכול להיות שלילי';
    const maxYears = E ? E.FUND.maxYears : 5;
    const maxGrace = E ? E.FUND.maxGraceMonths : 6;
    if (!(input.years >= 1 && input.years <= maxYears)) errors.years = `תקופה של 1 עד ${maxYears} שנים`;
    if (!(input.graceMonths >= 0 && input.graceMonths <= maxGrace)) errors.graceMonths = `גרייס של 0 עד ${maxGrace} חודשים`;
    return errors;
  }

  /**
   * החישוב עצמו – רק הרכבה של פונקציות המנוע.
   * input: {amount, years, graceMonths, ratePct, annualSales?}
   */
  function calculate(input, E) {
    const amount = Number(input.amount) || 0;
    const ratePct = Number(input.ratePct) || 0;
    const years = Number(input.years);
    const graceMonths = Number(input.graceMonths) || 0;
    const annualSales = Number(input.annualSales) || 0;

    const schedule = E.amortization(amount, ratePct, years, graceMonths);
    const months = schedule.length;
    const monthlyPayment = E.spitzerPayment(amount, ratePct, months - graceMonths);
    const graceInterest = graceMonths > 0 ? schedule[0].payment : 0;
    const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
    const cap = E.maxLoan(annualSales);
    return {
      monthlyPayment,
      graceInterest,
      graceMonths,
      payments: months - graceMonths,
      totalInterest,
      totalRepaid: amount + totalInterest,
      cap,
      hasSales: annualSales > 0,
      withinCap: amount <= cap,
    };
  }

  const api = { YEARS, GRACE, MIN_AMOUNT, DEFAULT_RATE, parseMoney, parseRate, validate, calculate };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.Calculator = api;

  // ---------- דפדפן ----------
  const E = root.Engine;
  const doc = root.document;
  if (!E || !doc) return;
  const $ = (id) => doc.getElementById(id);
  const num = (n) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
  const ils = E.ils;

  const state = { years: 5, graceMonths: 0 };
  let calculated = false; // אחרי החישוב הראשון התוצאה מתעדכנת תוך כדי הקלדה

  function readInput() {
    return {
      amount: parseMoney($('c-amount').value),
      ratePct: parseRate($('c-rate').value),
      years: state.years,
      graceMonths: state.graceMonths,
      annualSales: parseMoney($('c-sales').value),
    };
  }

  function showErrors(errors) {
    doc.querySelectorAll('.calc-card .field').forEach((f) => {
      const key = f.dataset.field;
      f.classList.toggle('invalid', Boolean(errors[key]));
      const old = f.querySelector('.err');
      if (old) old.remove();
      const input = f.querySelector('input');
      if (input) input.setAttribute('aria-invalid', String(Boolean(errors[key])));
      if (errors[key]) {
        const p = doc.createElement('p');
        p.className = 'err';
        p.id = `${key}-err`;
        p.style.margin = '0';
        p.textContent = errors[key];
        f.appendChild(p);
        if (input) input.setAttribute('aria-describedby', p.id);
      } else if (input) input.removeAttribute('aria-describedby');
    });
  }

  function render(r, input) {
    $('r-monthly').textContent = ils(r.monthlyPayment);
    $('r-monthly-sub').textContent = `${r.payments} תשלומים`;
    $('r-interest').textContent = ils(r.totalInterest);
    $('r-interest-sub').textContent = `סך הכול תחזירו ${ils(r.totalRepaid)}`;
    const grace = $('r-grace-item');
    grace.hidden = !r.graceMonths;
    if (r.graceMonths) {
      $('r-grace').textContent = ils(r.graceInterest);
      $('r-grace-sub').textContent = r.graceMonths === 1 ? 'בחודש הראשון: ריבית בלבד' : `ב-${r.graceMonths} החודשים הראשונים: ריבית בלבד`;
    }
    const v = $('r-verdict');
    v.dataset.level = r.withinCap ? 'ok' : 'risk';
    $('r-verdict-title').textContent = r.withinCap
      ? '✓ הסכום בתוך הטווח המקובל להלוואה כזו'
      : 'הסכום גבוה מהטווח המקובל להלוואה כזו';
    let text;
    if (r.hasSales) {
      text = `לפי מחזור של ${ils(input.annualSales)} בשנה, אפשר לבקש עד ${ils(r.cap)}.`;
      if (!r.withinCap) text += ' כדאי להקטין את הסכום.';
    } else {
      text = `אפשר לבקש עד ${ils(r.cap)}. עסק שמוכר ביותר מ-6.25 מיליון ₪ בשנה יכול לבקש יותר: הזינו את המחזור למעלה.`;
    }
    $('r-verdict-text').textContent = text;
    $('result').hidden = false;
  }

  function run(scroll) {
    const input = readInput();
    const errors = validate(input, E);
    showErrors(errors);
    if (Object.keys(errors).length) {
      $('result').hidden = true;
      if (scroll) {
        const first = doc.querySelector('.calc-card .field.invalid input');
        if (first) first.focus();
      }
      return;
    }
    calculated = true;
    render(calculate(input, E), input);
    if (scroll) {
      const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      $('result').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function chips(containerId, values, label, key) {
    $(containerId).innerHTML = values.map((v) =>
      `<button type="button" class="chip" data-key="${key}" data-val="${v}" aria-pressed="${state[key] === v}">${label(v)}</button>`).join('');
  }
  chips('c-years', YEARS, (v) => (v === 1 ? 'שנה' : v === 2 ? 'שנתיים' : `${v} שנים`), 'years');
  chips('c-grace', GRACE, (v) => (v === 0 ? 'בלי' : v === 1 ? 'חודש' : v === 2 ? 'חודשיים' : `${v} חודשים`), 'graceMonths');

  doc.addEventListener('click', (e) => {
    const t = e.target.closest('.chip[data-key]');
    if (!t) return;
    state[t.dataset.key] = Number(t.dataset.val);
    t.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === t)));
    if (calculated) run(false);
  });

  doc.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.money) {
      // מפריד אלפים תוך כדי הקלדה. המינוס נשאר גלוי, כדי שיהיה ברור מה הוקלד ולמה יש שגיאה
      const n = parseMoney(t.value);
      if (n) t.value = (n < 0 ? '-' : '') + num(Math.abs(n));
      else t.value = MINUS.test(t.value) ? '-' : '';
    }
    if (!t.closest('.calc-card')) return;
    const field = t.closest('.field');
    if (field && field.classList.contains('invalid') && t.value.trim()) {
      field.classList.remove('invalid');
      const er = field.querySelector('.err'); if (er) er.remove();
    }
    if (calculated) run(false);
  });

  // Enter בשדה = "חשבו", בלי להסתמך על שליחת טופס אוטומטית של הדפדפן
  $('calc-form').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); run(true); }
  });
  $('calc-form').addEventListener('submit', (e) => {
    e.preventDefault();
    run(true);
  });
})(typeof window !== 'undefined' ? window : globalThis);
