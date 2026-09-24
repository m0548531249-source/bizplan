/* תוכנית עסקית בקליק – גרסה 2: מסך פתיחה, אשף בשפה פשוטה, סיכום ומסמך. כל הנתונים נשארים בדפדפן. */
(function () {
  'use strict';
  const E = window.Engine;
  const STORE_KEY = 'bizplan-v2';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n, d = 0) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n || 0);
  const ils = E.ils;
  // פענוח והצגה של סכומים – ב-engine.js, כדי שאפשר יהיה לבדוק אותם ב-node
  const MINUS = /[-−‒–]/;
  const parseNum = (s) => E.parseAmount(s, false);
  /** רק בשדה "רווח שנה שעברה": המינוס נשמר, כי הפסד הוא מספר שלילי אמיתי ולא טעות הקלדה */
  const parseSigned = (s) => E.parseAmount(s, true);
  const moneyText = E.moneyText;
  const profitText = E.profitText;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

  // ---------- נתונים ----------
  const SAMPLE = {
    isSample: true,
    business: { name: 'מאפיית השכונה', entity: 'osek', field: 'מאפייה ומכירת מאפים טריים', city: 'בית שמש', years: 3, employees: 4, isNew: false,
      description: 'מאפייה שכונתית שמוכרת לחמים, חלות ומאפים טריים ללקוחות פרטיים, ומספקת לשלוש מכולות באזור.' },
    owner: { name: 'ישראל ישראלי', experience: '12 שנות ניסיון כאופה, מתוכן 3 שנים בניהול המאפייה.' },
    market: { customers: 'משפחות בשכונה, מכולות ומוסדות באזור. ביקוש גבוה במיוחד לקראת שבת וחגים.',
      competitors: 'שתי מאפיות רשת באזור התעשייה ורשתות שיווק.',
      advantage: 'מוצרים טריים שנאפים באותו יום, כשרות מהודרת, ומשלוחים עד הבית בערבי שבת.' },
    history: { lastYearSales: 1150000, lastYearProfit: 160000 },
    startup: { openDate: '', equity: 0, setupCosts: [{ item: '', amount: 0 }] },
    forecast: { annualSales: 1600000, rampMonths: 2, growthPct: 8, cogsPct: 38, monthlyFixed: 20000, monthlySalaries: 30000, ownerDrawMonthly: 12000, openingCash: 40000 },
    loan: { track: 'general', amount: 300000, ratePct: 7.5, years: 5, graceMonths: 6,
      purpose: 'רכישת תנור מסחרי שני ומקרר תעשייתי, כדי להגדיל את כושר הייצור ב-40% ולעמוד בהזמנות מהמכולות.',
      uses: [{ item: 'תנור מסחרי', amount: 180000, type: 'capex' }, { item: 'מקרר תעשייתי', amount: 45000, type: 'capex' }, { item: 'הון חוזר (חומרי גלם ומלאי)', amount: 75000, type: 'working' }] },
  };
  const EMPTY = {
    isSample: false,
    // isNew = null עד שבוחרים: "העסק כבר פועל" או "עסק חדש שעוד לא נפתח"
    business: { name: '', entity: 'osek', field: '', city: '', years: 0, employees: 0, description: '', isNew: null },
    owner: { name: '', experience: '' },
    market: { customers: '', competitors: '', advantage: '' },
    history: { lastYearSales: 0, lastYearProfit: 0 },
    startup: { openDate: '', equity: 0, setupCosts: [{ item: '', amount: 0 }] },
    forecast: { annualSales: 0, rampMonths: 0, growthPct: 5, cogsPct: 30, monthlyFixed: 0, monthlySalaries: 0, ownerDrawMonthly: 0, openingCash: 0 },
    loan: { track: 'general', amount: 0, ratePct: 7.5, years: 5, graceMonths: 0, purpose: '', uses: [{ item: '', amount: 0, type: 'capex' }] },
  };
  const ENTITIES = { osek: 'עוסק מורשה', company: 'חברה בע"מ', partnership: 'שותפות' };

  // ---------- שלבים ----------
  // שדה: {k, label, type, req, hint, ph, opts, wide, signed}
  const CHOICE_FIELD = { k: 'business.isNew', label: 'העסק כבר פועל, או שעוד לא נפתח?', type: 'choice', req: 1, wide: 1, errMsg: 'בחרו אחת משתי האפשרויות כדי להמשיך', opts: [
    { val: false, title: 'העסק כבר פועל', hint: 'יש לכם היסטוריית מכירות' },
    { val: true, title: 'עסק חדש שעוד לא נפתח', hint: 'אתם עדיין בתכנון' },
  ] };
  const RAMP_OPTS = { 0: 'כבר עכשיו', 1: 'חודש', 2: 'חודשיים', 3: '3 חודשים', 6: 'חצי שנה' };
  const GROWTH_OPTS = { 0: 'לא נגדל', 5: '5%', 10: '10%', 15: '15%', 20: '20%' };

  /** שלב "הכנסות" של עסק פועל – מחליפים אותו כולו כשמדובר בעסק בהקמה */
  const STEP_INCOME = { name: 'הכנסות', kicker: 'הכנסות', title: 'כמה העסק מוכר?', intro: 'הערכה סבירה מספיקה. אפשר לחזור ולתקן בכל שלב. כל הסכומים בלי מע"מ.', fields: [
    { k: 'history.lastYearSales', label: 'כמה מכרתם בשנה שעברה?', type: 'money', hint: 'המחזור השנתי, לפני הוצאות' },
    { k: 'history.lastYearProfit', label: 'כמה הרווחתם בשנה שעברה?', type: 'money', signed: 1, hint: 'אם הפסדתם, כתבו את ההפסד עם מינוס (למשל -40,000)' },
    { k: 'forecast.annualSales', label: 'כמה תמכרו בשנה, אחרי שתקבלו את ההלוואה?', type: 'money', req: 1, wide: 1, hint: 'ההערכה שלכם למכירות בשנה מלאה, כשהכול עובד כמו שצריך' },
    { k: 'forecast.rampMonths', label: 'תוך כמה זמן תגיעו לקצב המכירות הזה?', type: 'chips', wide: 1, opts: RAMP_OPTS },
    { k: 'forecast.growthPct', label: 'בכמה תגדלו כל שנה אחר כך?', type: 'chips', wide: 1, opts: GROWTH_OPTS },
  ] };

  /** אותו מקום באשף, לעסק שעוד לא נפתח: אין "שנה שעברה", יש הקמה */
  const STEP_SETUP = { name: 'הקמת העסק', kicker: 'הקמת העסק', title: 'מה צריך כדי לפתוח?', intro: 'אין לכם עדיין מספרים מהשנה שעברה, ולכן כאן מספרים על התכנון: כמה עולה לפתוח, מתי, ומה אתם מביאים מהבית.', fields: [
    { k: 'startup.setupCosts', label: 'עלויות ההקמה החד-פעמיות', type: 'uses', wide: 1, noType: 1, hint: 'כל מה שצריך כדי לפתוח: שיפוץ, רישוי, ציוד ראשוני, מלאי פתיחה – גם מה שלא ממומן מההלוואה' },
    { k: 'startup.openDate', label: 'מתי אתם מתכננים לפתוח?', type: 'text', ph: 'למשל: מרץ 2027' },
    { k: 'startup.equity', label: 'כמה כסף משלכם אתם מכניסים לעסק?', type: 'money', hint: 'הון עצמי: חסכונות, כסף של שותף, הלוואת בעלים' },
    { k: 'forecast.annualSales', label: 'כמה אתם צופים למכור בשנה, כשהעסק יעבוד בקצב מלא?', type: 'money', req: 1, wide: 1, hint: 'ההערכה שלכם לשנה מלאה, אחרי שהעסק כבר רץ' },
    { k: 'forecast.rampMonths', label: 'כמה זמן ייקח, מהיום שתפתחו, להגיע לקצב המכירות הזה – מאפס?', type: 'chips', wide: 1, hint: 'בעסק חדש מתחילים מאפס לקוחות, ולכן ההגעה לקצב מלא לוקחת זמן',
      opts: { 0: 'מיד עם הפתיחה', 1: 'חודש', 2: 'חודשיים', 3: '3 חודשים', 6: 'חצי שנה' } },
    { k: 'forecast.growthPct', label: 'בכמה תגדלו כל שנה אחר כך?', type: 'chips', wide: 1, opts: GROWTH_OPTS },
    { k: 'owner.experience', label: 'הניסיון שלכם בתחום', type: 'textarea', req: 1, wide: 1, ph: 'כמה שנים אתם בתחום, איפה עבדתם, מה ניהלתם, הכשרות',
      hint: 'בעסק בהקמה אין דוח כספי שמוכיח הצלחה, ולכן הניסיון שלכם הוא ההוכחה העיקרית שהבנק רואה. פרטו כמה שיותר.' },
  ] };

  const BASE_STEPS = [
    { name: 'העסק', kicker: 'נתחיל מההתחלה', title: 'ספרו לנו על העסק', intro: 'הפרטים האלה פותחים את התוכנית ומציגים את העסק לבנק.', fields: [
      CHOICE_FIELD,
      { k: 'business.name', label: 'שם העסק', type: 'text', req: 1, ph: 'למשל: מאפיית השכונה' },
      { k: 'business.city', label: 'עיר', type: 'text', ph: 'למשל: בית שמש' },
      { k: 'business.field', label: 'במה העסק עוסק?', type: 'text', req: 1, wide: 1, ph: 'במשפט אחד, למשל: מאפייה ומכירת מאפים טריים' },
      { k: 'business.entity', label: 'סוג העסק', type: 'chips', opts: ENTITIES, wide: 1 },
      { k: 'business.years', label: 'כמה שנים העסק פועל?', type: 'number', onlyExisting: 1 },
      { k: 'business.employees', label: 'כמה עובדים יש?', type: 'number', hint: 'לא כולל אתכם', onlyExisting: 1 },
      { k: 'business.employees', label: 'כמה עובדים תעסיקו בהתחלה?', type: 'number', hint: 'לא כולל אתכם. בלי עובדים: 0', onlyNew: 1 },
      { k: 'business.description', label: 'תארו את העסק בכמה משפטים', type: 'textarea', req: 1, wide: 1, ph: 'מה אתם מוכרים, למי, ואיך העסק עובד ביום-יום' },
    ] },
    { name: 'אתם והשוק', kicker: 'האנשים והלקוחות', title: 'מי עומד מאחורי העסק?', intro: 'הבנק מלווה לאנשים, לא רק לעסקים. כמה משפטים על הניסיון שלכם ועל הלקוחות עושים הבדל.', fields: [
      { k: 'owner.name', label: 'השם שלכם', type: 'text', req: 1 },
      { k: 'owner.experience', label: 'הניסיון שלכם בתחום', type: 'textarea', req: 1, wide: 1, ph: 'כמה שנים אתם בתחום, מה עשיתם קודם, הכשרות', onlyExisting: 1 },
      { k: 'market.customers', label: 'מי הלקוחות שלכם?', type: 'textarea', req: 1, wide: 1, ph: 'למשל: משפחות בשכונה, מכולות ומוסדות באזור' },
      { k: 'market.competitors', label: 'מי המתחרים?', type: 'textarea', wide: 1, ph: 'עסקים דומים באזור או ברשת' },
      { k: 'market.advantage', label: 'למה לקוחות בוחרים דווקא בכם?', type: 'textarea', req: 1, wide: 1, ph: 'למשל: מחיר, איכות, שירות, מיקום, זמינות' },
    ] },
    STEP_INCOME,
    { name: 'הוצאות', kicker: 'הוצאות', title: 'כמה עולה להפעיל את העסק?', intro: 'סכומים ממוצעים לחודש, בלי מע"מ.', fields: [
      { k: 'forecast.cogsPct', label: 'מכל 100 ₪ מכירה, כמה הולך על סחורה וחומרי גלם?', type: 'pct', wide: 1, hint: 'בערך: נותן שירות 5–15, מאפייה או מסעדה 30–40, חנות 50–65' },
      { k: 'forecast.monthlyFixed', label: 'הוצאות קבועות בחודש', type: 'money', hint: 'שכירות, חשמל, ביטוח, רכב, הנהלת חשבונות' },
      { k: 'forecast.monthlySalaries', label: 'שכר עובדים בחודש', type: 'money', hint: 'עלות כוללת למעסיק. בלי עובדים: 0' },
      { k: 'forecast.ownerDrawMonthly', label: 'כמה אתם לוקחים הביתה בחודש?', type: 'money', hint: 'הבנק רוצה לראות שגם אתם מתפרנסים' },
      { k: 'forecast.openingCash', label: 'כמה כסף יש היום בחשבון העסק?', type: 'money', onlyExisting: 1 },
      // בעסק בהקמה אין "כסף בחשבון" לפני הפתיחה: הכסף שהבעלים מכניס נשאל פעם אחת,
      // כ"הון עצמי" בשלב "הקמת העסק", והוא נכנס לתזרים כתקבול בחודש 1 (באג #1).
      { k: 'forecast.openingCash', label: 'מזומן פתיחה', type: 'static', onlyNew: 1, value: () => 'ההון העצמי שהזנתם בשלב "הקמת העסק"',
        hint: 'בעסק שעוד לא נפתח, הכסף שאתם מכניסים נספר פעם אחת בלבד – כתקבול "הכנסת הון עצמי" בחודש הראשון בתזרים.' },
      { k: 'business.entity', label: 'איך מחושב המס', type: 'static', wide: 1, value: () => taxMethodText(plan.business.entity),
        hint: 'המס נגזר מצורת העסק שבחרתם ומגובה הרווח, ולא משיעור אחיד. זו הערכה בלבד – יש לאמת אותה מול רואה חשבון.' },
    ] },
    { name: 'ההלוואה', kicker: 'ההלוואה', title: 'כמה אתם צריכים, ולמה?', intro: 'כאן רואים מיד כמה תחזירו בחודש, והאם העסק עומד בזה.', fields: [
      { k: 'loan.amount', label: 'סכום ההלוואה', type: 'money', req: 1 },
      { k: 'loan.track', label: 'מסלול בקרן', type: 'chips', opts: E.TRACKS, hint: 'עסק שפועל פחות משנה: "עסקים בהקמה"', onlyExisting: 1 },
      { k: 'loan.track', label: 'מסלול בקרן', type: 'static', onlyNew: 1, value: () => E.TRACKS.startup, hint: 'נבחר אוטומטית, כי אמרתם שהעסק עוד לא נפתח' },
      { k: 'loan.purpose', label: 'מה תעשו עם הכסף, ואיך זה יגדיל את ההכנסות?', type: 'textarea', req: 1, wide: 1, ph: 'למשל: רכישת תנור שני כדי להגדיל את הייצור ב-40%' },
      { k: 'loan.uses', label: 'פירוט: על מה בדיוק יוצא הכסף', type: 'uses', wide: 1, onlyExisting: 1 },
      // עסק בהקמה כבר פירט את עלויות ההקמה בשלב 3. במקום להזין אותן שוב (וליצור שני
      // מספרים סותרים לאותו פריט) הטבלה כאן נגזרת מהן – מקור אמת אחד (באג #3).
      { k: 'loan.uses', label: 'על מה יוצא הכסף', type: 'sources', wide: 1, onlyNew: 1 },
      { k: 'loan.years', label: 'לכמה שנים?', type: 'chips', opts: { 3: '3 שנים', 4: '4 שנים', 5: '5 שנים' } },
      { k: 'loan.graceMonths', label: 'חודשים ראשונים עם ריבית בלבד (גרייס)', type: 'chips', opts: { 0: 'בלי', 3: '3 חודשים', 6: '6 חודשים' }, hint: 'נותן לעסק זמן להתחיל להרוויח מההשקעה' },
      { k: 'loan.ratePct', label: 'ריבית שנתית משוערת', type: 'pct', hint: 'הבנק קובע. להערכה: פריים ועוד 1%–2%, בערך 7.5%' },
    ] },
    { name: 'סיכום', kicker: 'סיכום', title: '', intro: '', fields: [] },
  ];

  // ---------- מצב ----------
  let plan = normalize(load() || clone(EMPTY));
  let step = 0;
  let showErrors = false;
  let viewingSample = false;

  /** האם זה עסק שעוד לא נפתח. תוכניות ישנות (בלי הדגל) נקבעות לפי ותק, כמו קודם. */
  function isNewBiz(p) {
    const b = (p || plan).business || {};
    return b.isNew === true || (b.isNew == null && !b.years);
  }
  /** השלמת מפתחות חדשים לתוכנית שנשמרה בדפדפן לפני השיפור */
  function normalize(p) {
    const base = clone(EMPTY);
    const out = { ...base, ...p };
    Object.keys(base).forEach((k) => {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = { ...base[k], ...(p[k] || {}) };
    });
    // תוכנית שנשמרה לפני השיפור: משלימים את הבחירה לפי הוותק, כדי לא לחסום משתמש חוזר
    if (out.business.isNew == null && String(out.business.name || '').trim()) out.business.isNew = !out.business.years;
    if (!Array.isArray(out.loan.uses) || !out.loan.uses.length) out.loan.uses = clone(EMPTY.loan.uses);
    if (!Array.isArray(out.startup.setupCosts) || !out.startup.setupCosts.length) out.startup.setupCosts = clone(EMPTY.startup.setupCosts);
    // עסק בהקמה: המזומן ההתחלתי הוא ההון העצמי בלבד. תוכנית שנשמרה לפני התיקון
    // עשויה להחזיק את אותו סכום בשני השדות, ואז הוא נספר פעמיים בתזרים (באג #1).
    if (out.business.isNew === true) out.forecast.openingCash = 0;
    return out;
  }

  /** איך מחושב המס, לפי צורת ההתאגדות – לתצוגה באשף ובמסמך */
  function taxMethodText(entity) {
    if (entity === 'company') return `מס חברות של ${num(E.TAX.companyRatePct)}% על הרווח`;
    if (entity === 'partnership') return 'מדרגות מס הכנסה וביטוח לאומי לפי גובה הרווח (בחישוב של שותף אחד)';
    return 'מדרגות מס הכנסה וביטוח לאומי לפי גובה הרווח';
  }

  /** השלבים בפועל: אותם 6 שלבים, אבל שלב "הכנסות" מוחלף ב"הקמת העסק" לעסק חדש */
  function steps() {
    const isNew = plan.business.isNew === true;
    return BASE_STEPS.map((s, i) => {
      const src = i === 2 && isNew ? STEP_SETUP : s;
      return { ...src, fields: src.fields.filter((f) => !(f.onlyExisting && isNew) && !(f.onlyNew && !isNew)) };
    });
  }

  function load() { try { const s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(plan)); $('saved').hidden = false; } catch (e) { /* פרטי/חסום */ }
  }

  function isMissing(f) {
    const v = get(plan, f.k);
    if (typeof v === 'boolean') return false;
    return typeof v === 'number' ? !(v > 0) : !String(v ?? '').trim();
  }
  function stepErrors(i) {
    const ST = steps();
    const errs = ST[i].fields.filter((f) => f.req && f.type !== 'uses' && isMissing(f)).map((f) => f.k);
    ST[i].fields.filter((f) => f.type === 'uses').forEach((f) => {
      const list = get(plan, f.k) || [];
      if (list.some((u) => Number(u.amount) > 0 && !String(u.item || '').trim())) errs.push(f.k);
    });
    return errs;
  }
  function allErrors() { return steps().map((s, i) => ({ i, errs: stepErrors(i) })).filter((x) => x.errs.length); }

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
    if (f.type === 'sources') return sourcesBoxHtml(f);
    if (f.type === 'choice') {
      input = `<div class="choice-cards" role="group" aria-labelledby="${id}-l">${f.opts.map((o) =>
        `<button type="button" class="choice" data-choice="${String(o.val)}" aria-pressed="${v === o.val}"><b>${esc(o.title)}</b><span>${esc(o.hint)}</span></button>`).join('')}</div>`;
    } else if (f.type === 'static') {
      input = `<div class="static-value">${esc(typeof f.value === 'function' ? f.value() : f.value)}</div>`;
    } else if (f.type === 'chips') {
      input = `<div class="chips" role="group" aria-labelledby="${id}-l">${Object.entries(f.opts).map(([val, l]) =>
        `<button type="button" class="chip" data-chip="${f.k}" data-val="${val}" aria-pressed="${String(v) === String(val)}">${esc(l)}</button>`).join('')}</div>`;
    } else if (f.type === 'textarea') {
      input = `<textarea id="${id}" data-key="${f.k}" rows="3" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`;
    } else if (f.type === 'money') {
      // signed: רק "רווח שנה שעברה" – שם מינוס הוא הפסד אמיתי, לא טעות הקלדה
      input = `<div class="money"><input id="${id}" data-key="${f.k}" data-money="1"${f.signed ? ' data-signed="1"' : ''} type="text" inputmode="${f.signed ? 'text' : 'numeric'}" autocomplete="off" value="${v ? moneyText(v) : ''}" placeholder="0"><span class="cur">₪</span></div>`;
    } else if (f.type === 'pct') {
      input = `<div class="money"><input id="${id}" data-key="${f.k}" data-num="1" type="text" inputmode="decimal" autocomplete="off" value="${v ?? ''}"><span class="cur">%</span></div>`;
    } else if (f.type === 'number') {
      input = `<input id="${id}" data-key="${f.k}" data-num="1" type="text" inputmode="numeric" autocomplete="off" value="${v ?? ''}" style="max-width:160px">`;
    } else {
      input = `<input id="${id}" data-key="${f.k}" type="text" autocomplete="off" value="${esc(v)}" placeholder="${esc(f.ph || '')}">`;
    }
    const group = f.type === 'choice' || f.type === 'static' || f.type === 'chips';
    return `<div class="field${f.wide ? ' wide' : ''}${bad ? ' invalid' : ''}">
      <label id="${id}-l"${group ? '' : ` for="${id}"`}>${esc(f.label)}${f.req ? '<span class="req" aria-label="חובה">*</span>' : ''}</label>
      ${input}
      ${bad ? `<span class="err">${esc(f.errMsg || 'צריך למלא את השדה הזה')}</span>` : f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}
    </div>`;
  }

  /** עורך רשימת פריטים (שימושי ההלוואה, וגם עלויות ההקמה של עסק חדש) */
  function usesHtml(f) {
    const key = f.k;
    const safeId = key.replace(/\./g, '-');
    const rows = (get(plan, key) || []).map((u, i) => `
      <div class="use-row${f.noType ? ' no-type' : ''}">
        <input class="u-item" id="${safeId}-item-${i}" data-uses="${key}" data-use="${i}" data-f="item" type="text" placeholder="${esc(f.ph || 'על מה? למשל: תנור')}" value="${esc(u.item)}" aria-label="פריט ${i + 1}">
        <div class="money"><input id="${safeId}-amt-${i}" data-uses="${key}" data-use="${i}" data-f="amount" type="text" inputmode="numeric" data-money="1" placeholder="0" value="${u.amount ? num(u.amount) : ''}" aria-label="סכום פריט ${i + 1}"><span class="cur">₪</span></div>
        ${f.noType ? '' : `<select id="${safeId}-type-${i}" data-uses="${key}" data-use="${i}" data-f="type" aria-label="סוג פריט ${i + 1}"><option value="capex"${u.type === 'capex' ? ' selected' : ''}>ציוד / השקעה</option><option value="working"${u.type === 'working' ? ' selected' : ''}>הון חוזר</option></select>`}
        <button type="button" class="icon-btn" data-uses="${key}" data-del="${i}" aria-label="מחיקת פריט ${i + 1}">✕</button>
      </div>`).join('');
    const bad = showErrors && stepErrors(step).includes(key);
    const hint = f.hint || '"הון חוזר" = כסף לסחורה, מלאי והוצאות שוטפות עד שההשקעה מחזירה את עצמה';
    return `<div class="field wide${bad ? ' invalid' : ''}"><label>${esc(f.label)}</label><div class="uses">${rows}</div>
      <div class="uses-foot"><button type="button" class="btn-text" data-add="${key}">+ הוספת פריט</button><span data-total="${key}">${usesTotalHtml(key)}</span></div>
      ${bad ? '<span class="err">לכל פריט עם סכום צריך לכתוב על מה הוא</span>' : `<span class="hint">${esc(hint)}</span>`}</div>`;
  }
  /**
   * עסק בהקמה: השימושים בכספים נגזרים מעלויות ההקמה שהוזנו פעם אחת בשלב 3,
   * ועוד הון חוזר שהוא כל מה שנשאר מהמקורות. לכן אין כאן שדות להזנה – רק הצגה
   * ובדיקה שהמקורות מכסים את השימושים (באג #3).
   */
  function sourcesBoxHtml(f) {
    const items = E.planUses(plan);
    const setup = E.setupCostsTotal(plan);
    const src = E.sourcesTotal(plan);
    const used = E.usesTotal(plan);
    if (!(setup > 0)) {
      return `<div class="field wide" id="sources-box"><label>${esc(f.label)}</label>
        <span class="hint">כאן יופיע פירוט השימושים, מתוך עלויות ההקמה שתזינו בשלב "${steps()[2].name}". כך כל פריט מוזן פעם אחת בלבד.
        <button type="button" class="btn-text" data-go="2">למילוי עלויות ההקמה</button></span></div>`;
    }
    const rows = items.map((u) => `<tr><th scope="row">${esc(u.item)}</th><td>${ils(u.amount)}</td></tr>`).join('');
    const short = used - src;
    const status = short > 1
      ? `<p class="warn-text">עלויות ההקמה (${ils(setup)}) גבוהות ממקורות המימון (${ils(src)}) ב-${ils(short)}. אפשר להגדיל את ההלוואה או את ההון העצמי, או להקטין את עלויות ההקמה. בלי זה לא נוכל להפיק את התוכנית.</p>`
      : `<p class="ok-text">✓ מקורות המימון (הלוואה ${ils(plan.loan.amount)} והון עצמי ${ils(E.equityInflow(plan))}) שווים בדיוק לסך השימושים: ${ils(src)}.</p>`;
    return `<div class="field wide" id="sources-box"><label>${esc(f.label)}</label>
      <div class="tbl-wrap"><table><thead><tr><th>שימוש</th><th>סכום</th></tr></thead><tbody>${rows}
        <tr class="total"><th scope="row">סה"כ שימושים</th><td>${ils(used)}</td></tr></tbody></table></div>
      ${status}
      <span class="hint">הפריטים נלקחים מעלויות ההקמה שהזנתם, כדי שלא יופיעו שני סכומים שונים לאותו פריט.
      <button type="button" class="btn-text" data-go="2">לעריכת עלויות ההקמה</button></span></div>`;
  }

  function usesTotal(key) { return (get(plan, key) || []).reduce((s, u) => s + (Number(u.amount) || 0), 0); }
  function usesTotalHtml(key = 'loan.uses') {
    const total = usesTotal(key);
    if (key !== 'loan.uses') {
      // ההשוואה מוצגת רק כששני הצדדים ידועים – סכום ההלוואה נשאל רק בשלב מאוחר יותר
      const budget = (Number(plan.startup.equity) || 0) + (Number(plan.loan.amount) || 0);
      if (!total || !(plan.loan.amount > 0)) return `<span class="hint">סה"כ ${ils(total)}</span>`;
      return total > budget + 1
        ? `<span class="warn-text">סה"כ ${ils(total)}: יותר מההלוואה וההון העצמי יחד ב-${ils(total - budget)}</span>`
        : `<span class="ok-text">✓ סה"כ ${ils(total)}, בתוך ההלוואה וההון העצמי</span>`;
    }
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

  // טקסט מידע קבוע (לא מחושב) לעסק בהקמה – דרישות שהכלי לא יכול לחשב מהנתונים שהוא אוסף
  const COLLATERAL_TEXT = 'בנוסף להון העצמי, בדרך כלל נדרשים גם ביטחונות – כ-10% מסכום ההלוואה עד 300,000 ₪, וכ-25% מהחלק שמעליהם (או ערב נוסף במקום) – וכן ערבות אישית של הבעלים על מלוא ההלוואה. התנאים המדויקים נקבעים מול הבנק והקרן, ולא כאן.';
  const TRACKS_LINK = 'https://www.chamber.org.il/serviceslobby/114637/114726/';

  /** שורת ההון העצמי: מידע, לא אזהרה (החלטת מאיר) */
  function equityLine(p) {
    const eq = Number(p.startup.equity) || 0;
    const share = E.equityShare(eq, p.loan.amount);
    if (!share || !(p.loan.amount > 0)) {
      return 'בעסקים חדשים נהוג לדרוש הון עצמי של כ-20% מסך ההשקעה (הון עצמי + הלוואה). אחרי שתזינו את סכום ההלוואה בשלב "ההלוואה", נראה כאן איזה חלק ההון העצמי שלכם מהווה.';
    }
    const base = `בעסקים חדשים נהוג לדרוש הון עצמי של כ-20% מסך ההשקעה. לפי מה שהזנתם יש לכם כ-${num(share.pct, 0)}% – ${ils(eq)} מתוך השקעה כוללת של ${ils(share.total)}.`;
    return share.below ? `${base} הגדלת ההון העצמי, או הקטנת ההלוואה, יקרבו אתכם לשיעור הנהוג.` : base;
  }

  function goodToKnowHtml() {
    return `<div class="goodtoknow" id="goodtoknow"><h3>טוב לדעת מראש</h3>
      <p>${esc(equityLine(plan))}</p><p>${esc(COLLATERAL_TEXT)}</p></div>`;
  }

  /** המלצות עם מספרים מחושבים כשהבקשה גבולית או חלשה. אותן נוסחאות של המחשבון, על נתוני האשף. */
  function planHelps(res) {
    const target = Math.min(...res.years.map((y) => y.cfads)) / 1.25 / 12; // ההחזר שמשאיר DSCR 1.25
    const o = E.repaymentOptions(plan.loan, target);
    const items = [];
    const payMonths = Math.max(1, plan.loan.years * 12 - plan.loan.graceMonths);
    if (target > 0 && o.suggestedAmount > 0 && o.suggestedAmount < plan.loan.amount) {
      const rec = Math.min(o.suggestedAmount, res.cap);
      const pay = rec === o.suggestedAmount ? o.suggestedPayment : E.spitzerPayment(rec, plan.loan.ratePct, payMonths);
      items.push({ lead: `סכום מומלץ: כ-${ils(rec)}`, text: `במקום ${ils(plan.loan.amount)} – החזר של כ-${ils(pay)} בחודש במקום ${ils(res.monthlyPayment)}. זה אומדן לבדיקה מול הבנק, לא המלצה סופית.` });
    } else if (target <= 0) {
      items.push({ lead: 'לפני שמקטינים את ההלוואה', text: 'לפי התחזית הנוכחית, אחרי ההוצאות ומשיכת הבעלים לא נשאר מזומן פנוי להחזר כלל. כדאי לבדוק שוב את תחזית המכירות, את ההוצאות הקבועות או את הסכום שאתם לוקחים הביתה.' });
    }
    if (o.extend) {
      items.push({ lead: `${o.extend.years} שנים במקום ${plan.loan.years}`, text: `ההחזר יירד מכ-${ils(o.extend.current)} לכ-${ils(o.extend.payment)} בחודש – הקלה של כ-${ils(o.extend.saving)} בחודש. בסך הכול תשלמו יותר ריבית.` });
    }
    if (o.grace) {
      items.push({ lead: `${o.grace.months} חודשי גרייס`, text: `בחודשים הראשונים תשלמו ריבית בלבד – כ-${ils(o.grace.during)} בחודש. אחר כך ההחזר יעלה לכ-${ils(o.grace.after)} בחודש. גרייס קונה זמן, אבל לא מקטין את הפער.` });
    }
    if (o.gap > 0 && items.length < 4) {
      items.push({ lead: `כ-${ils(o.gap)} להשלים ממקור אחר`, text: 'אפשר להשלים את ההפרש מהון עצמי, משותף או מהמשפחה, או לבדוק מסלולים נוספים באותה קרן (יצואנים, חקלאים, עמותות, מסלולים זמניים) וקרנות אחרות כמו קרן קורת. כדאי לבדוק זכאות ישירות מול הגוף הרלוונטי.', href: TRACKS_LINK, linkText: 'רשימת המסלולים בקרן' });
    }
    return items.slice(0, 4);
  }
  function helpsHtml(items) {
    if (!items.length) return '';
    return `<h3 class="helps-title">מה אפשר לעשות</h3><ol class="helps">${items.map((it, i) =>
      `<li><span class="logo-mark" aria-hidden="true">${i + 1}</span><div><b>${esc(it.lead)}</b><p>${esc(it.text)}${it.href ? ` <a class="btn-text" href="${esc(it.href)}" target="_blank" rel="noopener">${esc(it.linkText)}</a>` : ''}</p></div></li>`).join('')}</ol>`;
  }

  function snapshotHtml() {
    if (!(plan.loan.amount > 0) || !(plan.forecast.annualSales > 0)) {
      return `<div class="snapshot" id="snapshot"><h2>תמונת מצב</h2><p class="hint" style="margin:0">הזינו סכום הלוואה (ואת תחזית המכירות בשלב "${steps()[2].name}"), ונראה לכם מיד כמה תחזירו בחודש והאם העסק עומד בזה.</p></div>`;
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
      ${v.level === 'ok' ? '' : helpsHtml(planHelps(res))}
    </div>`;
  }

  // ---------- אשף ----------
  function renderStep() {
    const ST = steps();
    const s = ST[step];
    $('step-num').textContent = step + 1;
    $('step-total').textContent = ST.length;
    $('step-name').textContent = s.name;
    $('bar').style.width = `${Math.round(((step + 1) / ST.length) * 100)}%`;
    $('step-left').textContent = step < ST.length - 1 ? `עוד כ-${Math.max(1, (ST.length - 1 - step) * 3)} דקות` : '';
    $('step-kicker').textContent = s.kicker;
    $('prev').hidden = step === 0;
    $('prev').textContent = 'חזרה';

    if (step === ST.length - 1) return renderSummary();
    $('step-title').textContent = s.title;
    $('step-intro').textContent = s.intro;
    const extra = step === 4 ? snapshotHtml() : (step === 2 && isNewBiz() ? goodToKnowHtml() : '');
    $('form').innerHTML = `<div class="fields">${s.fields.map(fieldHtml).join('')}</div>${extra}`;
    $('next').textContent = step === ST.length - 2 ? 'לסיכום' : 'המשך';
    $('next').hidden = false;
  }

  function renderSummary() {
    const ST = steps();
    const missing = allErrors();
    $('next').textContent = 'הצגת התוכנית המלאה';
    if (missing.length) {
      $('step-title').textContent = 'כמעט מוכן';
      $('step-intro').textContent = 'חסרים עוד כמה פרטים כדי שהתוכנית תהיה שלמה:';
      $('form').innerHTML = `<ul class="fixes missing">${missing.map(({ i, errs }) => {
        const labels = errs.map((k) => {
          const f = ST[i].fields.find((x) => x.k === k);
          if (!f) return k;
          return f.type === 'uses' ? `שם לכל פריט ב"${f.label}"` : f.label;
        });
        return `<li><b>${esc(ST[i].name)}:</b> ${labels.map(esc).join(' · ')} <button type="button" class="btn-text" data-go="${i}">להשלמה</button></li>`;
      }).join('')}</ul>`;
      $('next').hidden = true;
      return;
    }
    const res = E.computePlan(plan);
    // שלוש בדיקות התקינות חוסמות הפקת מסמך: כשהמספרים לא מתיישבים, אין מסמך (באג #3)
    if (res.blocking.length) {
      $('step-title').textContent = 'המספרים לא מתיישבים';
      $('step-intro').textContent = 'לא נפיק מסמך שבו אותו כסף מופיע בשני סכומים שונים. אחרי התיקון הכפתור יחזור:';
      $('form').innerHTML = `<ul class="fixes blocking">${res.blocking.map((c) =>
        `<li><b>${esc(c.label)}</b><br>${esc(c.message)} <button type="button" class="btn-text" data-go="${blockingStep(c.code)}">לתיקון</button></li>`).join('')}</ul>`;
      $('next').hidden = true;
      return;
    }
    const fixes = [...res.warnings];
    if (res.negativeMonths.length) fixes.push(`${E.negativeMonthsText(res.negativeMonths)} יהיה מינוס בחשבון. אפשר להוסיף גרייס, לדחות חלק מההשקעות או להתחיל עם יותר מזומן.`);
    else if (res.cushion && res.cushion.level === 'warn') fixes.push(cushionText(res, 'wizard', plan));
    const wc = E.workingCapitalNote(plan);
    if (wc) fixes.push(wc);
    $('step-title').textContent = `התוכנית של ${plan.business.name} מוכנה`;
    $('step-intro').textContent = 'ככה הבקשה נראית במספרים. אפשר לחזור לכל שלב ולשנות.';
    $('form').innerHTML = snapshotHtml() + (fixes.length ? `<h2 style="font-family:var(--serif);font-size:22px;margin:28px 0 0">כדאי לטפל לפני ההגשה</h2><ul class="fixes">${fixes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
    $('next').hidden = false;
  }

  /** לאיזה שלב לשלוח את המשתמש כדי לתקן בדיקת תקינות שנכשלה */
  function blockingStep(code) {
    if (code === 'items') return 2;
    return isNewBiz() ? 2 : 4;
  }

  /**
   * המרווח בתזרים – משפט שנגזר מהיתרה המינימלית בפועל מול סף של חודש הוצאות
   * קבועות ושכר, ולא מהצהרה קבועה "התזרים יישאר חיובי" (באג #5).
   * ניסוח המענה בענף האזהרה שבמסמך נגזר מסוג העסק (E.thinCushionText), כדי שלא
   * נצהיר לבנק על אשראי בנקאי שאין לעסק שעוד לא נפתח.
   */
  function cushionText(res, where, p) {
    const c = res.cushion;
    if (!c) return '';
    const min = `${ils(Math.max(0, c.min))} בחודש ${c.month}`;
    if (c.level === 'warn') {
      const base = `היתרה הנמוכה ביותר בתזרים היא ${min} – פחות מחודש אחד של הוצאות קבועות ושכר (${ils(c.threshold)}).`;
      return where === 'wizard'
        ? `${base} התזרים לא נכנס למינוס, אבל המרווח דק: עיכוב בתקבולים או הוצאה לא מתוכננת יכניסו את החשבון למינוס. כדאי להתחיל עם יותר מזומן, להוסיף גרייס או לדחות חלק מההשקעות.`
        : `${base} התזרים אינו נכנס למינוס בתחזית, אך המרווח דק; ${E.thinCushionText(isNewBiz(p), E.workingCapitalTotal(p || plan))}`;
    }
    return `היתרה הנמוכה ביותר בתזרים היא ${min}, יותר מחודש אחד של הוצאות קבועות ושכר (${ils(c.threshold)}). התזרים החודשי צפוי להישאר חיובי לאורך כל השנה הראשונה.`;
  }

  function go(i) { step = Math.max(0, Math.min(steps().length - 1, i)); showErrors = false; renderStep(); window.scrollTo(0, 0); }

  function next() {
    if (step === steps().length - 1) {
      // שער אחרון: בדיקות התקינות חוסמות הפקת מסמך, גם אם המשתמש הגיע לכאן עם דף פתוח
      const blocking = E.computePlan(plan).blocking;
      if (blocking.length) { toast('המספרים בתוכנית לא מתיישבים. יש לתקן לפני הפקת המסמך.'); renderSummary(); return; }
      viewingSample = false; renderDocument(plan); show('doc'); return;
    }
    const errs = stepErrors(step);
    if (errs.length) {
      showErrors = true; renderStep();
      const first = document.querySelector('.field.invalid input, .field.invalid textarea, .field.invalid .choice');
      if (first) first.focus();
      toast(errs.includes('business.isNew') ? 'בחרו אם העסק כבר פועל או שעוד לא נפתח' : 'יש כמה שדות חובה שעוד לא מולאו');
      return;
    }
    go(step + 1);
  }

  function refreshLive() {
    if (step === 4) {
      const snap = $('snapshot'); if (snap) snap.outerHTML = snapshotHtml();
      const box = $('sources-box');
      if (box) { const f = steps()[4].fields.find((x) => x.type === 'sources'); if (f) box.outerHTML = sourcesBoxHtml(f); }
    }
    if (step === 2 && isNewBiz()) {
      const box = $('goodtoknow'); if (box) box.outerHTML = goodToKnowHtml();
    }
    document.querySelectorAll('[data-total]').forEach((el) => { el.innerHTML = usesTotalHtml(el.dataset.total); });
  }

  // ---------- מסמך ----------
  function table(head, rows, cls = '') {
    return `<div class="tbl-wrap"><table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${r.cells.map((c, i) => `<${i === 0 ? 'th scope="row"' : 'td'}>${c}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  /** שם שורת המס בתזרים, לפי צורת ההתאגדות */
  function taxCashRowLabel(entity) {
    return entity === 'company' ? 'מס חברות' : 'מס הכנסה וביטוח לאומי';
  }

  function renderDocument(p) {
    const res = E.computePlan(p), b = p.business, y = res.years;
    const today = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    const isNew = isNewBiz(p);
    const st = p.startup || { openDate: '', equity: 0, setupCosts: [] };
    const equity = Number(st.equity) || 0;
    const share = E.equityShare(equity, p.loan.amount);
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
      // המס מפורק לשורות אמיתיות: עוסק מורשה משלם מס הכנסה וגם ביטוח לאומי (באג #4)
      ...(b.entity === 'company'
        ? [{ cells: ['מס חברות משוער', ...y.map((r) => ils(r.tax))] }]
        : [{ cells: ['מס הכנסה משוער', ...y.map((r) => ils(r.incomeTax))] },
          { cells: ['ביטוח לאומי משוער', ...y.map((r) => ils(r.ni))] }]),
      { cells: ['רווח נקי', ...y.map((r) => ils(r.net))], cls: 'total' },
    ]);
    // שורת ההון העצמי מוצגת רק כשיש כזה, כדי שהתזרים יתיישב עם "סך ההשקעה" בפרק 5
    const equityRow = res.cash.some((c) => c.equityIn)
      ? [{ cells: ['הכנסת הון עצמי', ...res.cash.map((c) => (c.equityIn ? num(c.equityIn) : '–'))] }]
      : [];
    const cf = table(['חודש', ...res.cash.map((c) => c.month)], [
      { cells: ['יתרת פתיחה', ...res.cash.map((c) => num(c.opening))] },
      { cells: ['תקבולים ממכירות', ...res.cash.map((c) => num(c.revenue))] },
      { cells: ['קבלת ההלוואה', ...res.cash.map((c) => (c.loanIn ? num(c.loanIn) : '–'))] },
      ...equityRow,
      { cells: ['עלות המכר', ...res.cash.map((c) => num(c.cogs))] },
      { cells: ['הוצאות קבועות ושכר', ...res.cash.map((c) => num(c.fixed + c.salaries))] },
      { cells: ['משיכת בעלים', ...res.cash.map((c) => num(c.draw))] },
      // תשלומי המס יוצאים גם מהתזרים, ולא רק מחישוב יכולת ההחזר שבפרק 9
      { cells: [taxCashRowLabel(b.entity), ...res.cash.map((c) => num(c.tax))] },
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
      { cells: [b.entity === 'company' ? 'פחות מס חברות ומשיכת בעלים' : 'פחות מס, ביטוח לאומי ומשיכת בעלים', ...y.map((r) => ils(r.tax + r.ownerDraw))] },
      { cells: ['מזומן פנוי להחזר', ...y.map((r) => ils(r.cfads))], cls: 'sub' },
      { cells: ['החזרי הלוואה בשנה', ...y.map((r) => ils(r.debtService))] },
      { cells: ['יחס כיסוי חוב (DSCR)', ...y.map((r) => (Number.isFinite(r.dscr) ? num(r.dscr, 2) : '—'))], cls: 'total' },
    ]);
    // מקור אמת אחד: טבלת השימושים נגזרת מהמנוע (בעסק בהקמה – מעלויות ההקמה) ולא מרשימה
    // נפרדת שהוזנה שוב בשלב ההלוואה, כדי שלא יופיעו שני סכומים לאותו פריט (באג #3)
    const usesTotalSum = res.usesTotal;
    const uses = table(['פריט', 'סוג', 'סכום'], [
      ...res.uses.map((u) => ({ cells: [esc(u.item), u.type === 'capex' ? 'השקעה' : 'הון חוזר', ils(u.amount)] })),
      { cells: ['סה"כ', '', ils(usesTotalSum)], cls: 'total' },
    ]);
    const setupTotal = res.setupTotal;
    const sources = table(['מקור המימון', 'סכום', 'חלק מסך ההשקעה'], [
      { cells: ['הלוואה מהקרן', ils(p.loan.amount), share ? `${num(100 - share.pct, 0)}%` : '—'] },
      { cells: ['הון עצמי של הבעלים', ils(equity), share ? `${num(share.pct, 0)}%` : '—'] },
      { cells: ['סה"כ מקורות', ils(share ? share.total : p.loan.amount + equity), '100%'], cls: 'total' },
    ]);
    // טבלת ההתאמה: מקורות מול שימושים, שניהם באותו סכום, במקום הערה על הפרש שלא פורט
    const reconcile = `סך המקורות (${ils(res.sourcesTotal)}) שווה לסך השימושים (${ils(usesTotalSum)}). מתוכם ${ils(setupTotal)} עלויות הקמה חד-פעמיות, שיוצאות בחודש הראשון בתזרים שבפרק 7, והיתר הון חוזר שנשאר בחשבון העסק.`;
    const n = p.loan.years * 12 - p.loan.graceMonths;
    const risks = [
      res.negativeMonths.length ? `בתזרים צפויה יתרה שלילית ${E.negativeMonthsText(res.negativeMonths)}, והיתרה הנמוכה ביותר היא ${ils(res.cushion.min)} בחודש ${res.cushion.month}. ${E.bridgeText(isNew, E.workingCapitalTotal(p))}` : cushionText(res, 'doc', p),
      `רגישות למכירות: ירידה של 10% במכירות תקטין את הרווח התפעולי בשנה הראשונה בכ-${ils(y[0].revenue * 0.1 * (1 - p.forecast.cogsPct / 100))}.`,
      `ריבית: התחזית מניחה ריבית שנתית של ${num(p.loan.ratePct, 1)}%. עלייה של 1% בריבית תגדיל את ההחזר החודשי בכ-${ils(E.spitzerPayment(p.loan.amount, p.loan.ratePct + 1, n) - E.spitzerPayment(p.loan.amount, p.loan.ratePct, n))}.`,
    ];
    if (isNew) risks.unshift('בעסק חדש כל התחזית מבוססת על הערכה ולא על ביצועים בפועל. יש לשמור על הנחות זהירות, ולבדוק גם את התרחיש הגרוע ביותר.');

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
        <p>${isNew
    ? `${esc(b.name)} הוא עסק חדש בתחום ${esc(b.field)}${b.city ? ' ב' + esc(b.city) : ''}, שטרם נפתח${st.openDate ? ` ומתוכנן להיפתח ב${esc(st.openDate)}` : ''}. ${b.employees > 0 ? `בתכנון להעסיק ${b.employees === 1 ? 'עובד אחד' : b.employees + ' עובדים'}.` : 'בשלב הראשון ללא עובדים שכירים.'}`
    : `${esc(b.name)} פועל ${b.years === 1 ? 'שנה' : b.years + ' שנים'} בתחום ${esc(b.field)}${b.city ? ' ב' + esc(b.city) : ''}, ${staff}.`} ${isNew || !p.history.lastYearSales ? '' : `בשנה האחרונה הסתכם המחזור ב-${ils(p.history.lastYearSales)}, והעסק סיים אותה ב${profitText(p.history.lastYearProfit)}. `}העסק מבקש הלוואה בסך ${ils(p.loan.amount)} ל-${p.loan.years} שנים${p.loan.graceMonths ? `, עם גרייס של ${p.loan.graceMonths} חודשים` : ''}${isNew && equity > 0 ? `, לצד הון עצמי של ${ils(equity)}` : ''}.</p>
        <p>לפי התחזית, בשנה השנייה המחזור יגיע ל-${ils(y[1].revenue)}, ובשורה התפעולית צפוי ${profitText(y[1].ebitda)}. יחס כיסוי החוב הנמוך ביותר בתקופה הוא <strong>${Number.isFinite(res.minDscr) ? num(res.minDscr, 2) : '—'}</strong> (${res.rating.label}).</p>
      </section>
      <section><h2>2. תיאור העסק</h2><p>${esc(b.description)}</p>
        <dl class="facts"><div><dt>צורת התאגדות</dt><dd>${esc(ENTITIES[b.entity])}</dd></div><div><dt>ותק</dt><dd>${isNew ? 'בהקמה' : b.years + ' שנים'}</dd></div><div><dt>עובדים</dt><dd>${b.employees}</dd></div><div><dt>מיקום</dt><dd>${esc(b.city || '—')}</dd></div>
          ${isNew
    ? `<div><dt>פתיחה מתוכננת</dt><dd>${esc(st.openDate || 'טרם נקבע')}</dd></div><div><dt>הון עצמי</dt><dd>${ils(equity)}</dd></div>`
    : (p.history.lastYearSales ? `<div><dt>מחזור שנה שעברה</dt><dd>${ils(p.history.lastYearSales)}</dd></div><div><dt>תוצאת שנה שעברה</dt><dd${p.history.lastYearProfit < 0 ? ' class="neg"' : ''}>${profitText(p.history.lastYearProfit)}</dd></div>` : '')}</dl></section>
      <section><h2>3. הבעלים</h2><p><strong>${esc(p.owner.name)}</strong>. ${esc(p.owner.experience)}</p></section>
      <section><h2>4. השוק והתחרות</h2>
        <h3>לקוחות</h3><p>${esc(p.market.customers)}</p>
        ${p.market.competitors ? `<h3>מתחרים</h3><p>${esc(p.market.competitors)}</p>` : ''}
        <h3>היתרון התחרותי</h3><p>${esc(p.market.advantage)}</p></section>
      <section><h2>5. ${isNew ? 'מקורות ושימושים' : 'מטרת ההלוואה והשימוש בכספים'}</h2><p>${esc(p.loan.purpose)}</p>
        ${isNew ? `<h3>מקורות המימון</h3>${sources}<h3>השימוש בכספים</h3>` : ''}${uses}
        ${isNew ? `<p class="note">${esc(reconcile)}</p>${share && equity > 0 ? `<p class="note">ההון העצמי מהווה כ-${num(share.pct, 0)}% מסך המקורות. הוא נכנס לעסק בחודש הראשון ומוצג כתקבול בתזרים שבפרק 7. כל פריט בטבלה מוזן פעם אחת, וכל הטבלאות במסמך נגזרות ממנו.</p>` : ''}` : ''}</section>
      <section><h2>6. תחזית רווח והפסד ל-3 שנים</h2>
        <p class="note">הנחות: מחזור שנתי בקצב מלא של ${ils(p.forecast.annualSales)}${p.forecast.rampMonths ? `, שמושג בהדרגה בתוך ${p.forecast.rampMonths} חודשים${isNew ? ' מיום הפתיחה, מאפס מכירות' : ''}` : ''}; צמיחה של ${num(p.forecast.growthPct, 1)}% בשנה; עלות מכר (הסחורה וחומרי הגלם שנכנסים למכירה) של ${num(p.forecast.cogsPct, 1)}%; עדכון הוצאות קבועות ושכר ב-3% בשנה.</p>
        <p class="note">המס מחושב לפי צורת ההתאגדות (${esc(ENTITIES[b.entity])}): ${esc(taxMethodText(b.entity))}. בשנה הראשונה, על רווח של ${ils(y[0].preTax)}, ההערכה היא ${ils(y[0].tax)} – כ-${num(y[0].taxEffectivePct, 1)}% מהרווח. ${esc(E.TAX.note)}</p>
        ${isNew ? '<p class="note">העסק טרם נפתח; ההנחות בתחזית מבוססות על תוכנית העסק ועל ניסיון הבעלים, ולא על נתונים היסטוריים – רמת אי-הוודאות גבוהה יותר מאשר בעסק פעיל.</p>' : ''}${pl}</section>
      <section class="page-break"><h2>7. תזרים מזומנים חודשי – שנה ראשונה (₪)</h2>${cf}
        <p class="note">שורת "${esc(taxCashRowLabel(b.entity))}" היא הערכה חודשית: 1/12 מהמס השנתי המשוער של השנה הראשונה (${ils(res.years[0].tax)}). בפועל המס משולם במקדמות לפי מועדי רשות המסים, ולכן הפיזור בין החודשים עשוי להיות שונה. שורת "השקעות" היא ${isNew ? 'סך עלויות ההקמה' : 'סך פריטי ההשקעה (רכש ציוד ונכסים)'} שבפרק 5 (${ils(res.investment)}).</p></section>
      <section><h2>8. ההלוואה ולוח הסילוקין</h2>
        <p>הלוואה של ${ils(p.loan.amount)} בריבית שנתית משוערת של ${num(p.loan.ratePct, 1)}%, בשיטת שפיצר, ל-${p.loan.years * 12} חודשים${p.loan.graceMonths ? `, מתוכם ${p.loan.graceMonths} חודשי גרייס (ריבית בלבד, ${ils(res.graceInterest)} בחודש)` : ''}. ההחזר החודשי: <strong>${ils(res.monthlyPayment)}</strong>. סך הריבית לכל התקופה: ${ils(res.totalInterest)}.</p>${am}</section>
      <section><h2>9. יכולת החזר וסיכונים</h2>${dscr}
        <p class="note">יחס כיסוי חוב (DSCR) הוא המזומן הפנוי חלקי החזרי ההלוואה. יחס של 1.25 ומעלה נחשב בדרך כלל טוב.</p>
        <ul>${risks.map((r) => `<li>${r}</li>`).join('')}</ul>
        ${isNew ? `<div class="doc-info"><h3>טוב לדעת מראש</h3><p>${esc(equityLine(p))}</p><p>${esc(COLLATERAL_TEXT)}</p></div>` : ''}</section>
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
  document.addEventListener('input', (e) => {
    const t = e.target;
    const signed = Boolean(t.dataset.signed);
    if (t.dataset.money) {
      const n = signed ? parseSigned(t.value) : parseNum(t.value);
      t.value = n ? moneyText(n) : (signed && MINUS.test(t.value) ? '-' : '');
    }
    if (t.dataset.key) {
      const isNum = t.dataset.money || t.dataset.num;
      set(plan, t.dataset.key, isNum ? (signed ? parseSigned(t.value) : parseNum(t.value)) : t.value);
    } else if (t.dataset.use !== undefined) {
      const u = (get(plan, t.dataset.uses) || [])[Number(t.dataset.use)];
      if (u) u[t.dataset.f] = t.dataset.f === 'amount' ? parseNum(t.value) : t.value;
    } else return;
    plan.isSample = false;
    const field = t.closest('.field');
    if (field && field.classList.contains('invalid') && String(t.value).trim()) { field.classList.remove('invalid'); const er = field.querySelector('.err'); if (er) er.remove(); }
    save();
    refreshLive();
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.use !== undefined && t.dataset.f === 'type') {
      const u = (get(plan, t.dataset.uses) || [])[Number(t.dataset.use)];
      if (u) { u.type = t.value; save(); }
    }
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
    else if (t.dataset.choice !== undefined) {
      const isNew = t.dataset.choice === 'true';
      plan.business.isNew = isNew;
      // מסלול "עסקים בהקמה" נבחר אוטומטית, כדי שלא יתברר מאוחר מדי שנבחר מסלול לא נכון
      plan.loan.track = isNew ? 'startup' : 'general';
      if (isNew) {
        plan.business.years = 0; plan.history.lastYearSales = 0; plan.history.lastYearProfit = 0;
        // אין "כסף בחשבון" לפני הפתיחה – ההון העצמי הוא המזומן ההתחלתי, ונשאל פעם אחת
        plan.forecast.openingCash = 0;
        // ברירת מחדל סבירה לעסק שמתחיל מאפס לקוחות; המשתמש יכול לשנות
        if (!plan.forecast.rampMonths) plan.forecast.rampMonths = 3;
      }
      plan.isSample = false; save(); showErrors = false; renderStep();
    }
    else if (t.dataset.go !== undefined) go(Number(t.dataset.go));
    else if (t.dataset.add) {
      const list = get(plan, t.dataset.add);
      list.push(t.dataset.add === 'loan.uses' ? { item: '', amount: 0, type: 'capex' } : { item: '', amount: 0 });
      save(); renderStep();
    }
    else if (t.dataset.del !== undefined) {
      const key = t.dataset.uses || 'loan.uses';
      const list = get(plan, key);
      list.splice(Number(t.dataset.del), 1);
      if (!list.length) list.push(key === 'loan.uses' ? { item: '', amount: 0, type: 'capex' } : { item: '', amount: 0 });
      save(); renderStep();
    }
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
      case 'edit': show('wizard'); go(steps().length - 1); break;
      case 'print': window.print(); break;
      case 'save-file': saveFile(); break;
    }
  });

  show('home');
})();
