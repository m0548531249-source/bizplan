/* תוכנית עסקית בקליק – גרסה 2: מסך פתיחה, אשף בשפה פשוטה, סיכום ומסמך. כל הנתונים נשארים בדפדפן. */
(function () {
  'use strict';
  const E = window.Engine;
  const STORE_KEY = 'bizplan-v2';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n, d = 0) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n || 0);
  const ils = E.ils;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

  // ---------- נתונים ----------
  const SAMPLE = {
    isSample: true,
    business: { name: 'מאפיית השכונה', entity: 'osek', field: 'מאפייה ומכירת מאפים טריים', city: 'בית שמש', years: 3, employees: 4,
      description: 'מאפייה שכונתית שמוכרת לחמים, חלות ומאפים טריים ללקוחות פרטיים, ומספקת לשלוש מכולות באזור.' },
    owner: { name: 'ישראל ישראלי', experience: '12 שנות ניסיון כאופה, מתוכן 3 שנים בניהול המאפייה.' },
    market: { customers: 'משפחות בשכונה, מכולות ומוסדות באזור. ביקוש גבוה במיוחד לקראת שבת וחגים.',
      competitors: 'שתי מאפיות רשת באזור התעשייה ורשתות שיווק.',
      advantage: 'מוצרים טריים שנאפים באותו יום, כשרות מהודרת, ומשלוחים עד הבית בערבי שבת.' },
    history: { lastYearSales: 1150000, lastYearProfit: 160000 },
    forecast: { annualSales: 1600000, rampMonths: 2, growthPct: 8, cogsPct: 38, monthlyFixed: 20000, monthlySalaries: 30000, ownerDrawMonthly: 12000, taxRatePct: 20, openingCash: 40000 },
    loan: { track: 'general', amount: 300000, ratePct: 7.5, years: 5, graceMonths: 6,
      purpose: 'רכישת תנור מסחרי שני ומקרר תעשייתי, כדי להגדיל את כושר הייצור ב-40% ולעמוד בהזמנות מהמכולות.',
      uses: [{ item: 'תנור מסחרי', amount: 180000, type: 'capex' }, { item: 'מקרר תעשייתי', amount: 45000, type: 'capex' }, { item: 'הון חוזר (חומרי גלם ומלאי)', amount: 75000, type: 'working' }] },
  };
  const EMPTY = {
    isSample: false,
    business: { name: '', entity: 'osek', field: '', city: '', years: 0, employees: 0, description: '' },
    owner: { name: '', experience: '' },
    market: { customers: '', competitors: '', advantage: '' },
    history: { lastYearSales: 0, lastYearProfit: 0 },
    forecast: { annualSales: 0, rampMonths: 0, growthPct: 5, cogsPct: 30, monthlyFixed: 0, monthlySalaries: 0, ownerDrawMonthly: 0, taxRatePct: 20, openingCash: 0 },
    loan: { track: 'general', amount: 0, ratePct: 7.5, years: 5, graceMonths: 0, purpose: '', uses: [{ item: '', amount: 0, type: 'capex' }] },
  };
  const ENTITIES = { osek: 'עוסק מורשה', company: 'חברה בע"מ', partnership: 'שותפות' };

  // ---------- שלבים ----------
  // שדה: {k, label, type, req, hint, ph, opts, wide}
  const STEPS = [
    { name: 'העסק', kicker: 'נתחיל מההתחלה', title: 'ספרו לנו על העסק', intro: 'הפרטים האלה פותחים את התוכנית ומציגים את העסק לבנק.', fields: [
      { k: 'business.name', label: 'שם העסק', type: 'text', req: 1, ph: 'למשל: מאפיית השכונה' },
      { k: 'business.city', label: 'עיר', type: 'text', ph: 'למשל: בית שמש' },
      { k: 'business.field', label: 'במה העסק עוסק?', type: 'text', req: 1, wide: 1, ph: 'במשפט אחד, למשל: מאפייה ומכירת מאפים טריים' },
      { k: 'business.entity', label: 'סוג העסק', type: 'chips', opts: ENTITIES, wide: 1 },
      { k: 'business.years', label: 'כמה שנים העסק פועל?', type: 'number', hint: '0 אם העסק עוד בהקמה' },
      { k: 'business.employees', label: 'כמה עובדים יש?', type: 'number', hint: 'לא כולל אתכם' },
      { k: 'business.description', label: 'תארו את העסק בכמה משפטים', type: 'textarea', req: 1, wide: 1, ph: 'מה אתם מוכרים, למי, ואיך העסק עובד ביום-יום' },
    ] },
    { name: 'אתם והשוק', kicker: 'האנשים והלקוחות', title: 'מי עומד מאחורי העסק?', intro: 'הבנק מלווה לאנשים, לא רק לעסקים. כמה משפטים על הניסיון שלכם ועל הלקוחות עושים הבדל.', fields: [
      { k: 'owner.name', label: 'השם שלכם', type: 'text', req: 1 },
      { k: 'owner.experience', label: 'הניסיון שלכם בתחום', type: 'textarea', req: 1, wide: 1, ph: 'כמה שנים אתם בתחום, מה עשיתם קודם, הכשרות' },
      { k: 'market.customers', label: 'מי הלקוחות שלכם?', type: 'textarea', req: 1, wide: 1, ph: 'למשל: משפחות בשכונה, מכולות ומוסדות באזור' },
      { k: 'market.competitors', label: 'מי המתחרים?', type: 'textarea', wide: 1, ph: 'עסקים דומים באזור או ברשת' },
      { k: 'market.advantage', label: 'למה לקוחות בוחרים דווקא בכם?', type: 'textarea', req: 1, wide: 1, ph: 'למשל: מחיר, איכות, שירות, מיקום, זמינות' },
    ] },
    { name: 'הכנסות', kicker: 'הכנסות', title: 'כמה העסק מוכר?', intro: 'הערכה סבירה מספיקה. אפשר לחזור ולתקן בכל שלב. כל הסכומים בלי מע"מ.', fields: [
      { k: 'history.lastYearSales', label: 'כמה מכרתם בשנה שעברה?', type: 'money', hint: 'המחזור השנתי. לעסק בהקמה: 0' },
      { k: 'history.lastYearProfit', label: 'כמה הרווחתם בשנה שעברה?', type: 'money', hint: 'אפשר לקחת מהדוח השנתי' },
      { k: 'forecast.annualSales', label: 'כמה תמכרו בשנה, אחרי שתקבלו את ההלוואה?', type: 'money', req: 1, wide: 1, hint: 'ההערכה שלכם למכירות בשנה מלאה, כשהכול עובד כמו שצריך' },
      { k: 'forecast.rampMonths', label: 'תוך כמה זמן תגיעו לקצב המכירות הזה?', type: 'chips', wide: 1, opts: { 0: 'כבר עכשיו', 1: 'חודש', 2: 'חודשיים', 3: '3 חודשים', 6: 'חצי שנה' } },
      { k: 'forecast.growthPct', label: 'בכמה תגדלו כל שנה אחר כך?', type: 'chips', wide: 1, opts: { 0: 'לא נגדל', 5: '5%', 10: '10%', 15: '15%', 20: '20%' } },
    ] },
    { name: 'הוצאות', kicker: 'הוצאות', title: 'כמה עולה להפעיל את העסק?', intro: 'סכומים ממוצעים לחודש, בלי מע"מ.', fields: [
      { k: 'forecast.cogsPct', label: 'מכל 100 ₪ מכירה, כמה הולך על סחורה וחומרי גלם?', type: 'pct', wide: 1, hint: 'בערך: נותן שירות 5–15, מאפייה או מסעדה 30–40, חנות 50–65' },
      { k: 'forecast.monthlyFixed', label: 'הוצאות קבועות בחודש', type: 'money', hint: 'שכירות, חשמל, ביטוח, רכב, הנהלת חשבונות' },
      { k: 'forecast.monthlySalaries', label: 'שכר עובדים בחודש', type: 'money', hint: 'עלות כוללת למעסיק. בלי עובדים: 0' },
      { k: 'forecast.ownerDrawMonthly', label: 'כמה אתם לוקחים הביתה בחודש?', type: 'money', hint: 'הבנק רוצה לראות שגם אתם מתפרנסים' },
      { k: 'forecast.openingCash', label: 'כמה כסף יש היום בחשבון העסק?', type: 'money' },
      { k: 'forecast.taxRatePct', label: 'שיעור המס שלכם', type: 'chips', wide: 1, opts: { 10: '10%', 20: '20%', 23: '23% (חברה)', 31: '31%' }, hint: 'לא בטוחים? השאירו 20%' },
    ] },
    { name: 'ההלוואה', kicker: 'ההלוואה', title: 'כמה אתם צריכים, ולמה?', intro: 'כאן רואים מיד כמה תחזירו בחודש, והאם העסק עומד בזה.', fields: [
      { k: 'loan.amount', label: 'סכום ההלוואה', type: 'money', req: 1 },
      { k: 'loan.track', label: 'מסלול בקרן', type: 'chips', opts: E.TRACKS, hint: 'עסק שפועל פחות משנה: "עסקים בהקמה"' },
      { k: 'loan.purpose', label: 'מה תעשו עם הכסף, ואיך זה יגדיל את ההכנסות?', type: 'textarea', req: 1, wide: 1, ph: 'למשל: רכישת תנור שני כדי להגדיל את הייצור ב-40%' },
      { k: 'loan.uses', label: 'פירוט: על מה בדיוק יוצא הכסף', type: 'uses', wide: 1 },
      { k: 'loan.years', label: 'לכמה שנים?', type: 'chips', opts: { 3: '3 שנים', 4: '4 שנים', 5: '5 שנים' } },
      { k: 'loan.graceMonths', label: 'חודשים ראשונים עם ריבית בלבד (גרייס)', type: 'chips', opts: { 0: 'בלי', 3: '3 חודשים', 6: '6 חודשים' }, hint: 'נותן לעסק זמן להתחיל להרוויח מההשקעה' },
      { k: 'loan.ratePct', label: 'ריבית שנתית משוערת', type: 'pct', hint: 'הבנק קובע. להערכה: פריים ועוד 1%–2%, בערך 7.5%' },
    ] },
    { name: 'סיכום', kicker: 'סיכום', title: '', intro: '', fields: [] },
  ];

  // ---------- מצב ----------
  let plan = load() || clone(EMPTY);
  let step = 0;
  let showErrors = false;
  let viewingSample = false;

  function load() { try { const s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(plan)); $('saved').hidden = false; } catch (e) { /* פרטי/חסום */ }
  }

  function isMissing(f) {
    const v = get(plan, f.k);
    return typeof v === 'number' ? !(v > 0) : !String(v || '').trim();
  }
  function stepErrors(i) {
    const errs = STEPS[i].fields.filter((f) => f.req && isMissing(f)).map((f) => f.k);
    if (i === 4 && plan.loan.uses.some((u) => Number(u.amount) > 0 && !String(u.item || '').trim())) errs.push('loan.uses');
    return errs;
  }
  function allErrors() { return STEPS.map((s, i) => ({ i, errs: stepErrors(i) })).filter((x) => x.errs.length); }

  // ---------- תצוגות ----------
  function show(view) {
    $('home').hidden = view !== 'home';
    $('wizard').hidden = view !== 'wizard';
    $('docview').hidden = view !== 'doc';
    $('saved').hidden = view !== 'wizard' || !load();
    window.scrollTo(0, 0);
    if (view === 'home') renderHome();
  }

  function renderHome() {
    const res = E.computePlan(SAMPLE);
    $('pv-pay').textContent = ils(res.monthlyPayment);
    $('pv-left').textContent = ils(Math.max(0, worstMonthlyLeft(res)));
    $('pv-table').innerHTML = `<tr><th></th><td>שנה 1</td><td>שנה 2</td><td>שנה 3</td></tr>` +
      [['הכנסות', 'revenue'], ['רווח תפעולי', 'ebitda'], ['רווח נקי', 'net']].map(([l, k]) =>
        `<tr><th>${l}</th>${res.years.map((y) => `<td>${num(y[k] / 1000)}K</td>`).join('')}</tr>`).join('');
    const stored = load();
    const hasProgress = stored && !stored.isSample && stored.business && stored.business.name;
    $('resume').hidden = !hasProgress;
    if (hasProgress) $('resume-name').textContent = stored.business.name;
    $('start').textContent = hasProgress ? 'להמשיך בתוכנית שלי' : 'בניית התוכנית שלי';
  }

  /** כמה נשאר בחודש אחרי ההחזר, בשנה הקשה ביותר */
  function worstMonthlyLeft(res) {
    return Math.min(...res.years.map((y) => (y.cfads - y.debtService) / 12));
  }

  // ---------- שדות ----------
  function fieldHtml(f) {
    const id = 'f-' + f.k.replace(/\./g, '-');
    const v = get(plan, f.k);
    const bad = showErrors && f.req && isMissing(f);
    let input;
    if (f.type === 'uses') return usesHtml(f);
    if (f.type === 'chips') {
      input = `<div class="chips" role="group" aria-labelledby="${id}-l">${Object.entries(f.opts).map(([val, l]) =>
        `<button type="button" class="chip" data-chip="${f.k}" data-val="${val}" aria-pressed="${String(v) === String(val)}">${esc(l)}</button>`).join('')}</div>`;
    } else if (f.type === 'textarea') {
      input = `<textarea id="${id}" data-key="${f.k}" rows="3" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`;
    } else if (f.type === 'money') {
      input = `<div class="money"><input id="${id}" data-key="${f.k}" data-money="1" type="text" inputmode="numeric" autocomplete="off" value="${v ? num(v) : ''}" placeholder="0"><span class="cur">₪</span></div>`;
    } else if (f.type === 'pct') {
      input = `<div class="money"><input id="${id}" data-key="${f.k}" data-num="1" type="text" inputmode="decimal" autocomplete="off" value="${v ?? ''}"><span class="cur">%</span></div>`;
    } else if (f.type === 'number') {
      input = `<input id="${id}" data-key="${f.k}" data-num="1" type="text" inputmode="numeric" autocomplete="off" value="${v ?? ''}" style="max-width:160px">`;
    } else {
      input = `<input id="${id}" data-key="${f.k}" type="text" autocomplete="off" value="${esc(v)}" placeholder="${esc(f.ph || '')}">`;
    }
    return `<div class="field${f.wide ? ' wide' : ''}${bad ? ' invalid' : ''}">
      <label id="${id}-l" for="${id}">${esc(f.label)}${f.req ? '<span class="req" aria-label="חובה">*</span>' : ''}</label>
      ${input}
      ${bad ? '<span class="err">צריך למלא את השדה הזה</span>' : f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}
    </div>`;
  }

  function usesHtml(f) {
    const rows = plan.loan.uses.map((u, i) => `
      <div class="use-row">
        <input class="u-item" id="use-item-${i}" data-use="${i}" data-f="item" type="text" placeholder="על מה? למשל: תנור" value="${esc(u.item)}" aria-label="פריט ${i + 1}">
        <div class="money"><input id="use-amt-${i}" data-use="${i}" data-f="amount" type="text" inputmode="numeric" data-money="1" placeholder="0" value="${u.amount ? num(u.amount) : ''}" aria-label="סכום פריט ${i + 1}"><span class="cur">₪</span></div>
        <select id="use-type-${i}" data-use="${i}" data-f="type" aria-label="סוג פריט ${i + 1}"><option value="capex"${u.type === 'capex' ? ' selected' : ''}>ציוד / השקעה</option><option value="working"${u.type === 'working' ? ' selected' : ''}>הון חוזר</option></select>
        <button type="button" class="icon-btn" data-del="${i}" aria-label="מחיקת פריט ${i + 1}">✕</button>
      </div>`).join('');
    const bad = showErrors && stepErrors(4).includes('loan.uses');
    return `<div class="field wide${bad ? ' invalid' : ''}"><label>${esc(f.label)}</label><div class="uses">${rows}</div>
      <div class="uses-foot"><button type="button" class="btn-text" id="add-use">+ הוספת פריט</button><span id="uses-total">${usesTotalHtml()}</span></div>
      ${bad ? '<span class="err">לכל פריט עם סכום צריך לכתוב על מה הוא</span>' : '<span class="hint">"הון חוזר" = כסף לסחורה, מלאי והוצאות שוטפות עד שההשקעה מחזירה את עצמה</span>'}</div>`;
  }
  function usesTotalHtml() {
    const total = plan.loan.uses.reduce((s, u) => s + (Number(u.amount) || 0), 0);
    const diff = total - plan.loan.amount;
    if (!plan.loan.amount) return `<span class="hint">סה"כ ${ils(total)}</span>`;
    if (Math.abs(diff) <= 1) return `<span class="ok-text">✓ סה"כ ${ils(total)}, בדיוק סכום ההלוואה</span>`;
    return `<span class="warn-text">סה"כ ${ils(total)}: ${diff > 0 ? 'יותר' : 'פחות'} מההלוואה ב-${ils(Math.abs(diff))}</span>`;
  }

  // ---------- תמונת מצב ----------
  function verdict(res) {
    const left = worstMonthlyLeft(res);
    const worstYear = res.years.reduce((a, y) => ((y.cfads - y.debtService) < (a.cfads - a.debtService) ? y : a));
    if (res.rating.level === 'ok') return { level: 'ok', title: 'בקשה חזקה', text: `גם בשנה הקשה ביותר יישארו לכם בערך ${ils(left)} בחודש אחרי ההחזר. זה המרווח שקרנות רוצות לראות.` };
    if (res.rating.level === 'warn') return { level: 'warn', title: 'בקשה גבולית', text: `ההכנסות מכסות את ההחזר, אבל בדוחק: בשנה ${worstYear.year} יישארו רק כ-${ils(Math.max(0, left))} בחודש. כדאי להקטין מעט את הסכום, להאריך את התקופה או להוסיף גרייס.` };
    return { level: 'risk', title: 'הבקשה חלשה כרגע', text: `לפי הנתונים, בשנה ${worstYear.year} יחסרו לכם כ-${ils(Math.abs(left))} בחודש כדי לעמוד בהחזר. כדאי להקטין את ההלוואה, לבדוק שוב את ההוצאות או את משיכת הבעלים.` };
  }

  function snapshotHtml() {
    if (!(plan.loan.amount > 0) || !(plan.forecast.annualSales > 0)) {
      return `<div class="snapshot" id="snapshot"><h2>תמונת מצב</h2><p class="hint" style="margin:0">הזינו סכום הלוואה (וההכנסות משלב 3), ונראה לכם מיד כמה תחזירו בחודש והאם העסק עומד בזה.</p></div>`;
    }
    const res = E.computePlan(plan);
    const v = verdict(res);
    const over = plan.loan.amount > res.cap;
    return `<div class="snapshot" id="snapshot"><h2>תמונת מצב · מתעדכנת תוך כדי הקלדה</h2>
      <div class="snap-grid">
        <div class="snap-item"><div class="label">החזר חודשי</div><div class="value accent">${ils(res.monthlyPayment)}</div><div class="sub">${res.graceInterest ? `בחודשי הגרייס: ${ils(res.graceInterest)}` : `${plan.loan.years * 12} תשלומים`}</div></div>
        ${(() => { const left = worstMonthlyLeft(res); return left >= 0
          ? `<div class="snap-item"><div class="label">נשאר בחודש אחרי ההחזר</div><div class="value">${ils(left)}</div><div class="sub">בשנה הקשה ביותר</div></div>`
          : `<div class="snap-item"><div class="label">חסר בחודש כדי לעמוד בהחזר</div><div class="value" style="color:var(--risk)">${ils(-left)}</div><div class="sub">בשנה הקשה ביותר</div></div>`; })()}
        <div class="snap-item"><div class="label">הסכום המקסימלי במסלול</div><div class="value">${ils(res.cap)}</div><div class="sub ${over ? 'warn-text' : ''}">${over ? 'ביקשתם יותר מהמותר' : 'אתם בתוך התקרה ✓'}</div></div>
      </div>
      <div class="verdict" data-level="${v.level}"><span class="dot"></span><div><b>${v.title}</b><p>${v.text}</p></div></div>
    </div>`;
  }

  // ---------- אשף ----------
  function renderStep() {
    const s = STEPS[step];
    $('step-num').textContent = step + 1;
    $('step-total').textContent = STEPS.length;
    $('step-name').textContent = s.name;
    $('bar').style.width = `${Math.round(((step + 1) / STEPS.length) * 100)}%`;
    $('step-left').textContent = step < STEPS.length - 1 ? `עוד כ-${Math.max(1, (STEPS.length - 1 - step) * 3)} דקות` : '';
    $('step-kicker').textContent = s.kicker;
    $('prev').hidden = step === 0;
    $('prev').textContent = 'חזרה';

    if (step === STEPS.length - 1) return renderSummary();
    $('step-title').textContent = s.title;
    $('step-intro').textContent = s.intro;
    $('form').innerHTML = `<div class="fields">${s.fields.map(fieldHtml).join('')}</div>${step === 4 ? snapshotHtml() : ''}`;
    $('next').textContent = step === STEPS.length - 2 ? 'לסיכום' : 'המשך';
    $('next').hidden = false;
  }

  function renderSummary() {
    const missing = allErrors();
    $('next').textContent = 'הצגת התוכנית המלאה';
    if (missing.length) {
      $('step-title').textContent = 'כמעט מוכן';
      $('step-intro').textContent = 'חסרים עוד כמה פרטים כדי שהתוכנית תהיה שלמה:';
      $('form').innerHTML = `<ul class="fixes missing">${missing.map(({ i, errs }) => {
        const labels = errs.map((k) => (k === 'loan.uses' ? 'שם לכל פריט בפירוט' : STEPS[i].fields.find((f) => f.k === k).label));
        return `<li><b>${esc(STEPS[i].name)}:</b> ${labels.map(esc).join(' · ')} <button type="button" class="btn-text" data-go="${i}">להשלמה</button></li>`;
      }).join('')}</ul>`;
      $('next').hidden = true;
      return;
    }
    const res = E.computePlan(plan);
    const fixes = [...res.warnings];
    if (res.negativeMonths.length) fixes.push(`בחודשים ${res.negativeMonths.join(', ')} של השנה הראשונה יהיה מינוס בחשבון. אפשר להוסיף גרייס, לדחות חלק מההשקעות או להתחיל עם יותר מזומן.`);
    $('step-title').textContent = `התוכנית של ${plan.business.name} מוכנה`;
    $('step-intro').textContent = 'ככה הבקשה נראית במספרים. אפשר לחזור לכל שלב ולשנות.';
    $('form').innerHTML = snapshotHtml() + (fixes.length ? `<h2 style="font-family:var(--serif);font-size:22px;margin:28px 0 0">כדאי לטפל לפני ההגשה</h2><ul class="fixes">${fixes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
    $('next').hidden = false;
  }

  function go(i) { step = Math.max(0, Math.min(STEPS.length - 1, i)); showErrors = false; renderStep(); window.scrollTo(0, 0); }

  function next() {
    if (step === STEPS.length - 1) { viewingSample = false; renderDocument(plan); show('doc'); return; }
    const errs = stepErrors(step);
    if (errs.length) {
      showErrors = true; renderStep();
      const first = document.querySelector('.field.invalid input, .field.invalid textarea');
      if (first) first.focus();
      toast('יש כמה שדות חובה שעוד לא מולאו');
      return;
    }
    go(step + 1);
  }

  function refreshLive() {
    if (step === 4) {
      const snap = $('snapshot'); if (snap) snap.outerHTML = snapshotHtml();
      const tot = $('uses-total'); if (tot) tot.innerHTML = usesTotalHtml();
    }
  }

  // ---------- מסמך ----------
  function table(head, rows, cls = '') {
    return `<div class="tbl-wrap"><table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${r.cells.map((c, i) => `<${i === 0 ? 'th scope="row"' : 'td'}>${c}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function renderDocument(p) {
    const res = E.computePlan(p), b = p.business, y = res.years;
    const today = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    const isNew = !b.years;
    const staff = b.employees > 0 ? `ומעסיק ${b.employees === 1 ? 'עובד אחד' : b.employees + ' עובדים'}` : 'ללא עובדים שכירים';
    const pl = table(['', 'שנה 1', 'שנה 2', 'שנה 3'], [
      { cells: ['הכנסות', ...y.map((r) => ils(r.revenue))] },
      { cells: ['עלות המכר', ...y.map((r) => ils(r.cogs))] },
      { cells: ['רווח גולמי', ...y.map((r) => ils(r.grossProfit))], cls: 'sub' },
      { cells: ['הוצאות קבועות', ...y.map((r) => ils(r.fixed))] },
      { cells: ['שכר עובדים', ...y.map((r) => ils(r.salaries))] },
      { cells: ['רווח תפעולי (לפני פחת)', ...y.map((r) => ils(r.ebitda))], cls: 'sub' },
      { cells: ['הוצאות מימון (ריבית)', ...y.map((r) => ils(r.interest))] },
      { cells: ['רווח לפני מס', ...y.map((r) => ils(r.preTax))] },
      { cells: ['מס משוער', ...y.map((r) => ils(r.tax))] },
      { cells: ['רווח נקי', ...y.map((r) => ils(r.net))], cls: 'total' },
    ]);
    const cf = table(['חודש', ...res.cash.map((c) => c.month)], [
      { cells: ['יתרת פתיחה', ...res.cash.map((c) => num(c.opening))] },
      { cells: ['תקבולים ממכירות', ...res.cash.map((c) => num(c.revenue))] },
      { cells: ['קבלת ההלוואה', ...res.cash.map((c) => (c.loanIn ? num(c.loanIn) : '–'))] },
      { cells: ['עלות המכר', ...res.cash.map((c) => num(c.cogs))] },
      { cells: ['הוצאות קבועות ושכר', ...res.cash.map((c) => num(c.fixed + c.salaries))] },
      { cells: ['משיכת בעלים', ...res.cash.map((c) => num(c.draw))] },
      { cells: ['החזר הלוואה', ...res.cash.map((c) => num(c.debt))] },
      { cells: ['השקעות', ...res.cash.map((c) => (c.invest ? num(c.invest) : '–'))] },
      { cells: ['יתרת סגירה', ...res.cash.map((c) => `<span class="${c.closing < 0 ? 'neg' : ''}">${num(c.closing)}</span>`)], cls: 'total' },
    ], 'cf');
    const debt = E.debtByYear(res.schedule);
    const am = table(['שנה', 'תשלומים', 'מתוכם ריבית', 'מתוכם קרן', 'יתרה בסוף שנה'], debt.map((d, i) => ({
      cells: [String(i + 1), ils(d.payment), ils(d.interest), ils(d.principal), ils(res.schedule[Math.min(res.schedule.length, (i + 1) * 12) - 1].balance)],
    })));
    const dscr = table(['', 'שנה 1', 'שנה 2', 'שנה 3'], [
      { cells: ['רווח תפעולי', ...y.map((r) => ils(r.ebitda))] },
      { cells: ['פחות מס ומשיכת בעלים', ...y.map((r) => ils(r.tax + r.ownerDraw))] },
      { cells: ['מזומן פנוי להחזר', ...y.map((r) => ils(r.cfads))], cls: 'sub' },
      { cells: ['החזרי הלוואה בשנה', ...y.map((r) => ils(r.debtService))] },
      { cells: ['יחס כיסוי חוב (DSCR)', ...y.map((r) => (Number.isFinite(r.dscr) ? num(r.dscr, 2) : '—'))], cls: 'total' },
    ]);
    const uses = table(['פריט', 'סוג', 'סכום'], [
      ...p.loan.uses.filter((u) => u.item || u.amount).map((u) => ({ cells: [esc(u.item), u.type === 'capex' ? 'השקעה' : 'הון חוזר', ils(u.amount)] })),
      { cells: ['סה"כ', '', ils(p.loan.uses.reduce((s, u) => s + (Number(u.amount) || 0), 0))], cls: 'total' },
    ]);
    const n = p.loan.years * 12 - p.loan.graceMonths;
    const risks = [
      res.negativeMonths.length ? `בתזרים צפויה יתרה שלילית בחודשים ${res.negativeMonths.join(', ')}. העסק יגשר על כך באמצעות מסגרת אשראי קיימת או דחיית חלק מההשקעות.` : 'התזרים החודשי צפוי להישאר חיובי לאורך כל השנה הראשונה.',
      `רגישות למכירות: ירידה של 10% במכירות תקטין את הרווח התפעולי בשנה הראשונה בכ-${ils(y[0].revenue * 0.1 * (1 - p.forecast.cogsPct / 100))}.`,
      `ריבית: התחזית מניחה ריבית שנתית של ${num(p.loan.ratePct, 1)}%. עלייה של 1% בריבית תגדיל את ההחזר החודשי בכ-${ils(E.spitzerPayment(p.loan.amount, p.loan.ratePct + 1, n) - E.spitzerPayment(p.loan.amount, p.loan.ratePct, n))}.`,
    ];

    $('doc').innerHTML = `
      ${p.isSample ? '<p class="sample-banner">מסמך לדוגמה · נתונים בדויים · לא להגשה</p>' : ''}
      <header class="doc-cover">
        <p class="doc-kicker">תוכנית עסקית · בקשה להלוואה מהקרן בערבות מדינה</p>
        <h1>${esc(b.name || 'העסק')}</h1>
        <p>${esc(b.field)}${b.city ? ' · ' + esc(b.city) : ''}</p>
        <dl class="doc-meta">
          <div><dt>מגיש/ה</dt><dd>${esc(p.owner.name)}</dd></div>
          <div><dt>מסלול</dt><dd>${esc(E.TRACKS[p.loan.track])}</dd></div>
          <div><dt>סכום מבוקש</dt><dd>${ils(p.loan.amount)}</dd></div>
          <div><dt>תאריך</dt><dd>${today}</dd></div>
        </dl>
      </header>
      <section><h2>1. תקציר מנהלים</h2>
        <p>${esc(b.name)} ${isNew ? 'הוא עסק בהקמה' : `פועל ${b.years === 1 ? 'שנה' : b.years + ' שנים'}`} בתחום ${esc(b.field)}${b.city ? ' ב' + esc(b.city) : ''}, ${staff}. ${isNew || !p.history.lastYearSales ? '' : `בשנה האחרונה הסתכם המחזור ב-${ils(p.history.lastYearSales)}, והרווח ב-${ils(p.history.lastYearProfit)}. `}העסק מבקש הלוואה בסך ${ils(p.loan.amount)} ל-${p.loan.years} שנים${p.loan.graceMonths ? `, עם גרייס של ${p.loan.graceMonths} חודשים` : ''}.</p>
        <p>לפי התחזית, בשנה השנייה המחזור יגיע ל-${ils(y[1].revenue)} והרווח התפעולי ל-${ils(y[1].ebitda)}. יחס כיסוי החוב הנמוך ביותר בתקופה הוא <strong>${Number.isFinite(res.minDscr) ? num(res.minDscr, 2) : '—'}</strong> (${res.rating.label}).</p>
      </section>
      <section><h2>2. תיאור העסק</h2><p>${esc(b.description)}</p>
        <dl class="facts"><div><dt>צורת התאגדות</dt><dd>${esc(ENTITIES[b.entity])}</dd></div><div><dt>ותק</dt><dd>${isNew ? 'בהקמה' : b.years + ' שנים'}</dd></div><div><dt>עובדים</dt><dd>${b.employees}</dd></div><div><dt>מיקום</dt><dd>${esc(b.city || '—')}</dd></div></dl></section>
      <section><h2>3. הבעלים</h2><p><strong>${esc(p.owner.name)}</strong>. ${esc(p.owner.experience)}</p></section>
      <section><h2>4. השוק והתחרות</h2>
        <h3>לקוחות</h3><p>${esc(p.market.customers)}</p>
        ${p.market.competitors ? `<h3>מתחרים</h3><p>${esc(p.market.competitors)}</p>` : ''}
        <h3>היתרון התחרותי</h3><p>${esc(p.market.advantage)}</p></section>
      <section><h2>5. מטרת ההלוואה והשימוש בכספים</h2><p>${esc(p.loan.purpose)}</p>${uses}</section>
      <section><h2>6. תחזית רווח והפסד ל-3 שנים</h2>
        <p class="note">הנחות: מחזור שנתי בקצב מלא של ${ils(p.forecast.annualSales)}${p.forecast.rampMonths ? `, שמושג בהדרגה בתוך ${p.forecast.rampMonths} חודשים` : ''}; צמיחה של ${num(p.forecast.growthPct, 1)}% בשנה; עלות מכר של ${num(p.forecast.cogsPct, 1)}%; עדכון הוצאות קבועות ושכר ב-3% בשנה; מס משוער של ${num(p.forecast.taxRatePct, 1)}%.</p>${pl}</section>
      <section class="page-break"><h2>7. תזרים מזומנים חודשי – שנה ראשונה (₪)</h2>${cf}</section>
      <section><h2>8. ההלוואה ולוח הסילוקין</h2>
        <p>הלוואה של ${ils(p.loan.amount)} בריבית שנתית משוערת של ${num(p.loan.ratePct, 1)}%, בשיטת שפיצר, ל-${p.loan.years * 12} חודשים${p.loan.graceMonths ? `, מתוכם ${p.loan.graceMonths} חודשי גרייס (ריבית בלבד, ${ils(res.graceInterest)} בחודש)` : ''}. ההחזר החודשי: <strong>${ils(res.monthlyPayment)}</strong>. סך הריבית לכל התקופה: ${ils(res.totalInterest)}.</p>${am}</section>
      <section><h2>9. יכולת החזר וסיכונים</h2>${dscr}
        <p class="note">יחס כיסוי חוב (DSCR) הוא המזומן הפנוי חלקי החזרי ההלוואה. יחס של 1.25 ומעלה נחשב בדרך כלל טוב.</p>
        <ul>${risks.map((r) => `<li>${r}</li>`).join('')}</ul></section>
      <footer class="doc-foot">המסמך הוכן בכלי עזר ("תוכנית עסקית בקליק") על סמך נתונים שמסר בעל העסק. הוא אינו מהווה ייעוץ פיננסי, ואינו קשור לממשלה או לקרן. התחזיות הן הערכה בלבד.</footer>`;

    $('edit').hidden = !!p.isSample;
    $('next-steps').innerHTML = p.isSample
      ? `<h2>זו תוכנית לדוגמה</h2><p style="margin:0 0 12px">ככה ייראה המסמך שלכם, עם המספרים של העסק שלכם.</p><button type="button" class="btn btn-primary" id="start-from-sample">בניית התוכנית שלי</button>`
      : `<h2>מה עושים עכשיו</h2><ol><li>לוחצים <b>"שמירת המסמך"</b>, פותחים את הקובץ ושומרים כ-PDF.</li><li>נכנסים לאתר הקרן להלוואות בערבות מדינה וממלאים את הבקשה.</li><li>מצרפים את ה-PDF, יחד עם הדוחות הכספיים ודפי החשבון שהקרן מבקשת.</li></ol>`;
  }

  // ---------- שמירה כקובץ ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
  }
  /**
   * כל ה-CSS של הדף, לקובץ השמור: styles.css (קובץ חיצוני) + תגיות <style> אם יש.
   * קוראים מ-document.styleSheets. גיליון שהדפדפן חוסם את קריאתו (למשל Google Fonts, או file://)
   * מוחלף בקישור בכתובת מלאה, כך שהמסמך השמור עדיין מעוצב כשיש רשת.
   */
  function collectCss() {
    const inline = [];
    const links = [];
    [...document.styleSheets].forEach((sheet) => {
      const href = sheet.href || '';
      if (/fonts\.googleapis\.com/.test(href)) return; // הגופנים נטענים בנפרד בקובץ השמור
      try {
        inline.push([...sheet.cssRules].map((r) => r.cssText).join('\n'));
      } catch (e) {
        if (href) links.push(href);
      }
    });
    if (!inline.join('').trim()) {
      [...document.querySelectorAll('style')].forEach((s) => inline.push(s.textContent));
    }
    return { css: inline.join('\n'), links };
  }
  function standaloneHtml() {
    const { css, links } = collectCss();
    const linkTags = links.map((h) => `<link rel="stylesheet" href="${esc(h)}">`).join('');
    const name = $('doc').querySelector('h1')?.textContent || 'העסק';
    return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>תוכנית עסקית – ${esc(name)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700;900&family=Assistant:wght@400;600;700&display=swap">${linkTags}
<style>${css}
body{padding:24px 16px} .print-bar{max-width:840px;margin:0 auto 16px;display:flex;justify-content:flex-end} @media print{.print-bar{display:none}}</style></head>
<body><div class="print-bar"><button class="btn btn-primary" onclick="print()">הדפסה / שמירה כ-PDF</button></div>
<article class="doc">${$('doc').innerHTML}</article></body></html>`;
  }
  async function saveFile() {
    const name = ($('doc').querySelector('h1')?.textContent || 'העסק').replace(/[\\/:*?"<>|]/g, '');
    const filename = `תוכנית עסקית - ${name}.html`;
    const data = standaloneHtml();
    const dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null;
    if (dl) {
      try { await dl.save({ filename, data }); toast('נשמר. פתחו את הקובץ ולחצו "הדפסה / שמירה כ-PDF".'); }
      catch (e) { if (e && e.code !== 'declined') toast('השמירה לא הצליחה כאן. נסו את כפתור ההדפסה.'); }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'text/html' }));
    a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('הקובץ ירד. פתחו אותו ולחצו "הדפסה / שמירה כ-PDF".');
  }

  // ---------- אירועים ----------
  const parseNum = (s) => Number(String(s).replace(/[^\d.]/g, '')) || 0;

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.money) {
      const n = parseNum(t.value);
      t.value = n ? num(n) : '';
    }
    if (t.dataset.key) {
      set(plan, t.dataset.key, t.dataset.money || t.dataset.num ? parseNum(t.value) : t.value);
    } else if (t.dataset.use !== undefined) {
      const u = plan.loan.uses[Number(t.dataset.use)];
      u[t.dataset.f] = t.dataset.f === 'amount' ? parseNum(t.value) : t.value;
    } else return;
    plan.isSample = false;
    const field = t.closest('.field');
    if (field && field.classList.contains('invalid') && String(t.value).trim()) { field.classList.remove('invalid'); const er = field.querySelector('.err'); if (er) er.remove(); }
    save();
    refreshLive();
  });
  document.addEventListener('change', (e) => {
    if (e.target.dataset.use !== undefined && e.target.dataset.f === 'type') { plan.loan.uses[Number(e.target.dataset.use)].type = e.target.value; save(); }
  });

  let discardArmed = null;
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.chip) {
      const cur = get(plan, t.dataset.chip);
      set(plan, t.dataset.chip, typeof cur === 'number' ? Number(t.dataset.val) : t.dataset.val);
      t.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === t)));
      plan.isSample = false; save(); refreshLive();
    }
    else if (t.dataset.go !== undefined) go(Number(t.dataset.go));
    else if (t.dataset.del !== undefined) { plan.loan.uses.splice(Number(t.dataset.del), 1); if (!plan.loan.uses.length) plan.loan.uses.push({ item: '', amount: 0, type: 'capex' }); save(); renderStep(); }
    else switch (t.id) {
      case 'start': step = 0; show('wizard'); renderStep(); break;
      case 'discard':
        // אישור בתוך הדף: דיאלוגים של הדפדפן חסומים ב-claude.ai
        if (discardArmed) { clearTimeout(discardArmed); discardArmed = null; plan = clone(EMPTY); save(); t.textContent = 'להתחיל מחדש'; t.classList.remove('danger'); renderHome(); toast('התוכנית נמחקה. אפשר להתחיל מחדש.'); }
        else { t.textContent = 'לחצו שוב כדי למחוק'; t.classList.add('danger'); discardArmed = setTimeout(() => { discardArmed = null; t.textContent = 'להתחיל מחדש'; t.classList.remove('danger'); }, 4000); }
        break;
      case 'show-sample': renderDocument(SAMPLE); show('doc'); break;
      case 'start-from-sample': step = 0; show('wizard'); renderStep(); break;
      case 'go-home': show('home'); break;
      case 'next': next(); break;
      case 'prev': go(step - 1); break;
      case 'add-use': plan.loan.uses.push({ item: '', amount: 0, type: 'capex' }); save(); renderStep(); break;
      case 'edit': show('wizard'); go(STEPS.length - 1); break;
      case 'print': window.print(); break;
      case 'save-file': saveFile(); break;
    }
  });

  show('home');
})();
