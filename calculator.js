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
    const monthlySales = annualSales / 12;
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
      monthlySales,
      // null כשאין מחזור – בלי מחזור אי אפשר לדעת איזה נתח ההחזר תופס
      afford: E.affordLevel(monthlyPayment, monthlySales),
    };
  }

  // הניסוחים של שורת יכולת ההחזר, לפי אישור מאיר (12% / 20%)
  const AFFORD_TEXT = {
    ok: '✓ ההחזר נראה סביר ביחס למחזור שלכם.',
    warn: 'שימו לב – זה נתח גדול מההכנסה החודשית. יש כמה כיוונים למטה שיכולים לעזור.',
    risk: 'ההחזר הזה כנראה גבוה מדי ביחס להכנסה החודשית. כדאי לבדוק את ההצעות למטה לפני שממשיכים.',
  };
  const NOTE_ESTIMATE = 'אומדן שמרני של הכלי בלבד – לא כלל רשמי של בנק או של הקרן. האישור הסופי תלוי גם בביטחונות, בהיסטוריית האשראי ובמסמכים נוספים שהבנק מבקש.';
  const NOTE_NO_SALES = 'אומדן בלבד. האישור הסופי תלוי גם בביטחונות, בהיסטוריית האשראי ובמסמכים נוספים שהבנק מבקש.';
  const TRACKS_LINK = 'https://www.chamber.org.il/serviceslobby/114637/114726/';

  const pct0 = (n) => `${Math.round(n)}%`;

  /**
   * "מה אפשר לעשות" – עד 4 כיוונים עם מספרים אמיתיים. מחזיר null כשאין צורך (אין מחזור, או ההחזר סביר).
   * כל המספרים מגיעים מ-engine.js; כאן רק הניסוח.
   */
  function advice(input, result, E) {
    if (!result.afford || result.afford.level === 'ok') return null;
    const ils = E.ils;
    const target = (result.monthlySales * E.AFFORD.okPct) / 100;
    const o = E.repaymentOptions(input, target);
    const items = [];
    // פריטים שאין בהם פעולה ("כבר המקסימום") – מוצגים רק כשאין שום הצעה אחרת,
    // כדי שרשימת "מה אפשר לעשות" לא תכלול שורות שאי אפשר לעשות בהן דבר.
    const notes = [];

    const recAmount = Math.min(o.suggestedAmount, result.cap);
    const recPayment = recAmount === o.suggestedAmount
      ? o.suggestedPayment
      : E.spitzerPayment(recAmount, Number(input.ratePct) || 0, Math.max(1, Number(input.years) * 12 - (Number(input.graceMonths) || 0)));
    if (recAmount > 0 && recAmount < Number(input.amount)) {
      items.push({
        lead: `כ-${ils(recAmount)} במקום ${ils(input.amount)}`,
        text: `ההחזר יירד לכ-${ils(recPayment)} בחודש, שהם כ-${pct0((recPayment / result.monthlySales) * 100)} מההכנסה החודשית. זה אומדן לבדיקה מול הבנק, לא המלצה סופית.`,
      });
    }

    if (o.extend) {
      items.push({
        lead: `${o.extend.years} שנים במקום ${input.years}`,
        text: `ההחזר יירד מכ-${ils(o.extend.current)} לכ-${ils(o.extend.payment)} בחודש – הקלה של כ-${ils(o.extend.saving)} בחודש. בסך הכול תשלמו יותר ריבית, כי ההלוואה נפרסת על יותר זמן.`,
      });
    } else if (o.atMaxYears) {
      notes.push({
        lead: '5 שנים – כבר המקסימום',
        text: 'בחרתם את התקופה הארוכה ביותר שהמסלול מאפשר, כך שאי אפשר להקטין את ההחזר על ידי הארכה נוספת.',
      });
    }

    if (o.grace) {
      items.push({
        lead: `${o.grace.months} חודשי גרייס`,
        text: `בחודשים הראשונים תשלמו ריבית בלבד – כ-${ils(o.grace.during)} בחודש. אחר כך ההחזר יעלה לכ-${ils(o.grace.after)} בחודש, כי נשארים פחות חודשים להחזיר בהם את הקרן. גרייס קונה זמן, אבל לא מקטין את הפער בין גודל ההלוואה למחזור.`,
      });
    } else if (o.atMaxGrace) {
      notes.push({
        lead: 'גרייס – כבר המקסימום',
        text: 'בחרתם את הגרייס הארוך ביותר שהמסלול מאפשר (6 חודשים). גרייס ממילא קונה זמן בלבד: אחריו ההחזר עולה.',
      });
    }

    if (o.gap > 0) {
      items.push({
        lead: `כ-${ils(o.gap)} להשלים ממקור אחר`,
        text: 'אפשר להשלים את ההפרש מהון עצמי, משותף או מהמשפחה. אפשר גם לבדוק מסלולים נוספים באותה קרן – יצואנים, חקלאים, עמותות ויזמות חברתית, השקעות ירוקות ומסלולים זמניים – או קרן אחרת כמו קרן קורת, שמיועדת לעסקים שמתקשים באשראי בנקאי רגיל. כדאי לבדוק זכאות ישירות מול הגוף הרלוונטי.',
        linkText: 'רשימת המסלולים בקרן',
        href: TRACKS_LINK,
      });
    }

    if (!items.length) items.push(...notes);

    return { level: result.afford.level, items: items.slice(0, 4) };
  }

  const api = { YEARS, GRACE, MIN_AMOUNT, DEFAULT_RATE, AFFORD_TEXT, NOTE_ESTIMATE, NOTE_NO_SALES, parseMoney, parseRate, validate, calculate, advice };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.Calculator = api;

  // ---------- דפדפן ----------
  const E = root.Engine;
  const doc = root.document;
  if (!E || !doc) return;
  const $ = (id) => doc.getElementById(id);
  const num = (n) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
  const ils = E.ils;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
    const capText = r.hasSales
      ? `לפי מחזור של ${ils(input.annualSales)} בשנה, אפשר לבקש עד ${ils(r.cap)}${r.withinCap ? '' : ' – וביקשתם יותר'}.`
      : `אפשר לבקש עד ${ils(r.cap)}. עסק שמוכר ביותר מ-6.25 מיליון ₪ בשנה יכול לבקש יותר: הזינו את המחזור למעלה.`;
    if (r.afford) {
      // שורה ראשונה תמיד: איזה נתח ההחזר תופס. חריגה מהתקרה מחמירה את הרמה בכל מקרה.
      v.dataset.level = r.withinCap ? r.afford.level : 'risk';
      $('r-verdict-title').textContent = `ההחזר לוקח כ-${pct0(r.afford.pct)} מההכנסה החודשית שלכם`;
      $('r-verdict-text').textContent = `${AFFORD_TEXT[r.afford.level]} ${capText}`;
    } else {
      v.dataset.level = r.withinCap ? 'ok' : 'risk';
      $('r-verdict-title').textContent = r.withinCap
        ? '✓ הסכום בתוך הטווח המקובל להלוואה כזו'
        : 'הסכום גבוה מהטווח המקובל להלוואה כזו';
      $('r-verdict-text').textContent = r.withinCap || !r.hasSales ? capText : `${capText} כדאי להקטין את הסכום.`;
    }
    $('r-note').textContent = r.afford ? NOTE_ESTIMATE : NOTE_NO_SALES;
    renderHelp(advice(input, r, E));
    $('result').hidden = false;
  }

  /** כרטיס "מה אפשר לעשות" – רק כשההחזר גבוה ביחס למחזור */
  function renderHelp(help) {
    const card = $('r-help');
    if (!help || !help.items.length) { card.hidden = true; card.innerHTML = ''; return; }
    card.innerHTML = `<h2>מה אפשר לעשות</h2>
      <ol class="helps">${help.items.map((it, i) => `<li><span class="logo-mark" aria-hidden="true">${i + 1}</span><div><b>${esc(it.lead)}</b>
        <p>${esc(it.text)}${it.href ? ` <a class="btn-text" href="${esc(it.href)}" target="_blank" rel="noopener">${esc(it.linkText)}</a>` : ''}</p></div></li>`).join('')}</ol>
      <p class="help-foot"><a class="btn-text" href="./">לחישוב מדויק יותר – עברו לאשף המלא</a> <span class="hint">שם אפשר להראות גם את הצמיחה בהכנסות אחרי ההשקעה, מה שעשוי לשפר את התמונה.</span></p>`;
    card.hidden = false;
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
