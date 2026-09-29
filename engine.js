/* מנוע פיננסי – תוכנית עסקית בקליק. פונקציות טהורות, נבדקות ב-node:test. */
(function (root) {
  'use strict';

  // לפי פרסום הסוכנות לעסקים קטנים ובינוניים (sba.org.il). יש לוודא מול הקרן לפני הגשה.
  const FUND = {
    baseCap: 500000,       // תקרה בסיסית במסלול הכללי ובמסלול לעסקים בהקמה
    salesPct: 0.08,        // או 8% מהמחזור השנתי – הגבוה מביניהם
    maxYears: 5,
    maxGraceMonths: 6,
  };
  const INFLATION = 0.03; // עדכון שנתי של הוצאות קבועות ושכר בתחזית

  const TRACKS = {
    general: 'מסלול כללי',
    startup: 'מסלול לעסקים בהקמה',
  };

  /**
   * ביטחונות וערבות אישית – הכללים הנהוגים בקרן ובבנקים המלווים.
   * לפי פרסום הסוכנות לעסקים קטנים ובינוניים (sba.org.il), כמו FUND. זהו אומדן
   * בלבד: ההיקף והסוג המדויקים נקבעים בבנק, ולכן כל הטקסט שנגזר מכאן מסויג.
   */
  const COLLATERAL = {
    tierCap: 300000,   // עד הסכום הזה – השיעור הנמוך
    tierPct: 10,       // אחוז ביטחונות על החלק שעד התקרה
    upperPct: 25,      // אחוז ביטחונות על החלק שמעל התקרה
  };

  /**
   * טבלאות המס – קונפיגורציה שמתעדכנת כל שנה, ולא מספרים מפוזרים בקוד.
   * הערכה בלבד: המדרגות והשיעורים נכונים לשנת המס 2025 ומשמשים גם כהערכה ל-2026.
   * TAX.note הוא הטקסט שמוצג במסמך – חובה לאמת מול רואה חשבון לפני הגשה.
   */
  const TAX = {
    year: 2025,
    // מדרגות מס הכנסה ליחיד, הכנסה שנתית מיגיעה אישית
    brackets: [
      { upTo: 84120, ratePct: 10 },
      { upTo: 120720, ratePct: 14 },
      { upTo: 193800, ratePct: 20 },
      { upTo: 269280, ratePct: 31 },
      { upTo: 560280, ratePct: 35 },
      { upTo: 721560, ratePct: 47 },
      { upTo: Infinity, ratePct: 50 }, // 47% ועוד מס יתר של 3% על החלק שמעל
    ],
    creditPoints: 2.25,        // נקודות זיכוי לתושב ישראל (ברירת מחדל שמרנית)
    creditPointValue: 2904,    // ₪ לשנה לנקודת זיכוי
    // דמי ביטוח לאומי לעצמאי – כולל דמי ביטוח בריאות, כי שני הרכיבים נגבים יחד
    // מאותו עצמאי ושניהם יציאת מזומן (ממצא QA סבב 5, באג חוסם 2: בלי רכיב הבריאות
    // הרווח הנקי מיופה בכ-18,500 ₪ בשנה).
    ni: {
      reducedRatePct: 5.97,    // עד 60% מהשכר הממוצע: 2.87% ביטוח לאומי + 3.10% בריאות
      fullRatePct: 17.83,      // מעל זה ועד התקרה: 12.83% ביטוח לאומי + 5.00% בריאות
      insuranceReducedPct: 2.87, // רכיב הביטוח הלאומי בלבד, בשיעור המופחת
      insuranceFullPct: 12.83,   // רכיב הביטוח הלאומי בלבד, בשיעור המלא
      reducedUpTo: 90264,      // 60% מהשכר הממוצע, בשנה
      ceiling: 588360,         // תקרת ההכנסה לביטוח לאומי, בשנה
      // 52% מדמי הביטוח הלאומי מוכרים כהוצאה לצורכי מס הכנסה. דמי ביטוח הבריאות
      // אינם הוצאה מוכרת, ולכן הניכוי מחושב על רכיב הביטוח הלאומי בלבד.
      deductibleShare: 0.52,
    },
    companyRatePct: 23,        // מס חברות
    vatRatePct: 18,            // מע"מ – לחישוב המע"מ על רכישת ציוד ולהחזר ממנו
    vatRefundMonths: 2,        // כעבור כמה חודשים עוסק מורשה מקבל בחזרה את המע"מ על הציוד
    // ניסוח כללי שנכון לכל צורות ההתאגדות: שיטת החישוב עצמה מוצגת במסמך לפי ההתאגדות
    // (taxMethodText), וההערה הזו הייתה סותרת אותה בחברה בע"מ (ממצא QA סבב 4).
    note: '',
  };
  TAX.note = `חישוב המס הוא הערכה של הכלי לפי כללי המס לשנת ${TAX.year} ולפי צורת ההתאגדות שנבחרה, ואינו מחליף ייעוץ. יש לאמת אותו מול רואה חשבון.`;

  /** מס הכנסה לפי מדרגות, לפני נקודות זיכוי */
  function bracketTax(income) {
    let left = Math.max(0, Number(income) || 0);
    let prev = 0;
    let tax = 0;
    for (const b of TAX.brackets) {
      const slice = Math.min(left, b.upTo - prev);
      if (slice <= 0) break;
      tax += slice * b.ratePct / 100;
      left -= slice;
      prev = b.upTo;
    }
    return tax;
  }

  /** פיצול ההכנסה לשני חלקי השיעור: עד 60% מהשכר הממוצע, ומעליו עד התקרה */
  function niSplit(income) {
    const inc = Math.min(Math.max(0, Number(income) || 0), TAX.ni.ceiling);
    return { reduced: Math.min(inc, TAX.ni.reducedUpTo), full: Math.max(0, inc - TAX.ni.reducedUpTo) };
  }

  /**
   * דמי ביטוח לאומי לעצמאי, כולל דמי ביטוח בריאות: שיעור מופחת עד 60% מהשכר
   * הממוצע, שיעור מלא עד התקרה. זה הסכום שהעצמאי משלם בפועל.
   */
  function nationalInsurance(income) {
    const { reduced, full } = niSplit(income);
    return reduced * TAX.ni.reducedRatePct / 100 + full * TAX.ni.fullRatePct / 100;
  }

  /**
   * החלק מדמי הביטוח שמוכר כהוצאה לצורכי מס הכנסה: 52% מרכיב הביטוח הלאומי בלבד.
   * דמי ביטוח הבריאות אינם הוצאה מוכרת, ולכן אין לנכות 52% מהסכום המשולם כולו.
   */
  function niDeductibleExpense(income) {
    const { reduced, full } = niSplit(income);
    const insuranceOnly = reduced * TAX.ni.insuranceReducedPct / 100 + full * TAX.ni.insuranceFullPct / 100;
    return insuranceOnly * TAX.ni.deductibleShare;
  }

  /**
   * המס על הרווח לפי צורת ההתאגדות.
   * עוסק מורשה ושותפות: מדרגות מס הכנסה (בניכוי נקודות זיכוי) וביטוח לאומי.
   * חברה בע"מ: מס חברות בלבד (משיכת שכר או דיבידנד מהחברה אינה מחושבת כאן).
   * @returns {{incomeTax:number, ni:number, total:number, effectivePct:number, entity:string}}
   */
  function taxFor(preTaxProfit, entity) {
    const profit = Math.max(0, Number(preTaxProfit) || 0);
    const ent = entity === 'company' ? 'company' : entity === 'partnership' ? 'partnership' : 'osek';
    if (!(profit > 0)) return { incomeTax: 0, ni: 0, total: 0, effectivePct: 0, entity: ent };
    if (ent === 'company') {
      const incomeTax = profit * TAX.companyRatePct / 100;
      return { incomeTax, ni: 0, total: incomeTax, effectivePct: (incomeTax / profit) * 100, entity: ent };
    }
    const ni = nationalInsurance(profit);
    const taxable = Math.max(0, profit - niDeductibleExpense(profit));
    const credits = TAX.creditPoints * TAX.creditPointValue;
    const incomeTax = Math.max(0, bracketTax(taxable) - credits);
    const total = incomeTax + ni;
    return { incomeTax, ni, total, effectivePct: (total / profit) * 100, entity: ent };
  }

  /**
   * ספי יכולת החזר (אחוז ההחזר החודשי מתוך המחזור החודשי).
   * אומדן שמרני של הכלי – אין לו מקור רשמי של בנק ישראל או של הקרן.
   * נגזר מ-DSCR 1.25 הנדרש בקרן ומשוליים ריאליים של כ-15.5% מהמחזור: 15.5 / 1.25 ≈ 12.4.
   */
  const AFFORD = { okPct: 12, riskPct: 20, minEquityPct: 20 };

  /** תקרת הלוואה: הגבוה מבין 500,000 ₪ ו-8% מהמחזור השנתי */
  function maxLoan(annualSales) {
    const sales = Math.max(0, Number(annualSales) || 0);
    return Math.round(Math.max(FUND.baseCap, sales * FUND.salesPct));
  }

  /** החזר חודשי בשפיצר */
  function spitzerPayment(principal, annualRatePct, months) {
    if (months <= 0) return 0;
    const r = annualRatePct / 100 / 12;
    if (r === 0) return principal / months;
    return (principal * r) / (1 - Math.pow(1 + r, -months));
  }

  /**
   * לוח סילוקין: חודשי גרייס של ריבית בלבד, ואחריהם שפיצר על יתרת התקופה.
   * @returns {{month:number,payment:number,interest:number,principal:number,balance:number}[]}
   */
  function amortization(principal, annualRatePct, years, graceMonths = 0) {
    const n = Math.round(years * 12);
    const g = Math.min(Math.max(0, Math.round(graceMonths)), n - 1);
    const r = annualRatePct / 100 / 12;
    const rows = [];
    let balance = principal;
    const pay = spitzerPayment(principal, annualRatePct, n - g);
    for (let m = 1; m <= n; m++) {
      const interest = balance * r;
      let principalPart = m <= g ? 0 : pay - interest;
      if (m === n) principalPart = balance; // סגירת אגורות בחודש האחרון
      balance = Math.max(0, balance - principalPart);
      rows.push({ month: m, payment: interest + principalPart, interest, principal: principalPart, balance });
    }
    return rows;
  }

  /** סיכום לוח הסילוקין לפי שנים (1..years) */
  function debtByYear(schedule) {
    const years = [];
    schedule.forEach((row) => {
      const y = Math.ceil(row.month / 12) - 1;
      years[y] = years[y] || { payment: 0, interest: 0, principal: 0 };
      years[y].payment += row.payment;
      years[y].interest += row.interest;
      years[y].principal += row.principal;
    });
    return years;
  }

  /** מקדם מכירות חודשי לעסק שמתחיל בהדרגה: עלייה לינארית עד קצב מלא */
  function rampFactor(month, rampMonths) {
    if (!rampMonths || rampMonths <= 0) return 1;
    return Math.min(1, month / (rampMonths + 1));
  }

  /**
   * שיעור מהקצב המלא בחודש m: עסק קיים מתחיל מהמכירות הנוכחיות שלו (currentSales),
   * עסק חדש מתחיל מאפס, ושניהם עולים בהדרגה עד הקצב המלא.
   */
  function salesLevel(f, month) {
    const start = f.annualSales > 0 ? Math.min(1, Math.max(0, (f.currentSales || 0) / f.annualSales)) : 0;
    return start + (1 - start) * rampFactor(month, f.rampMonths);
  }

  /**
   * תחזית רווח והפסד ל-3 שנים.
   * f: {annualSales, growthPct, cogsPct, monthlyFixed, monthlySalaries, ownerDrawMonthly, entity, rampMonths}
   * המס נגזר מצורת ההתאגדות (f.entity) ומגובה הרווח, ולא משיעור שטוח.
   */
  function forecast(f, schedule) {
    const debt = debtByYear(schedule || []);
    return [1, 2, 3].map((y) => yearFigures(f, y, debt[y - 1]));
  }

  /**
   * רווח והפסד של שנה אחת (y), עם החוב של אותה שנה (d). משותף ל-forecast (שנים 1–3)
   * ולתזרים לכל תקופת ההלוואה (cashflowPeriod, שיפור 4 ב5).
   * levelYear – השנה שלפיה נקבעים המכירות וההוצאות. אחרי אופק התחזית (3 שנים) המכירות
   * וההוצאות נשארות ברמת שנה 3, בלי צמיחה ובלי התייקרות נוספת: הכלי לא מנחש מעבר למה
   * שהמשתמש תחזה. רק החוב (ריבית והחזר) הוא של השנה בפועל.
   */
  function yearFigures(f, y, d0, levelYear) {
    const ly = levelYear || y;
    const growth = Math.pow(1 + (f.growthPct || 0) / 100, ly - 1);
    let revenue;
    if (ly === 1) {
      const monthly = f.annualSales / 12;
      revenue = 0;
      for (let m = 1; m <= 12; m++) revenue += monthly * salesLevel(f, m);
    } else {
      revenue = f.annualSales * growth;
    }
    const inflate = Math.pow(1 + INFLATION, ly - 1);
    const cogs = revenue * (f.cogsPct || 0) / 100;
    const fixed = (f.monthlyFixed || 0) * 12 * inflate;
    const salaries = (f.monthlySalaries || 0) * 12 * inflate;
    const ebitda = revenue - cogs - fixed - salaries;
    const d = d0 || { payment: 0, interest: 0 };
    const preTax = ebitda - d.interest;
    const t = taxFor(preTax, f.entity);
    const tax = t.total;
    const net = preTax - tax;
    const ownerDraw = (f.ownerDrawMonthly || 0) * 12;
    const cfads = ebitda - tax - ownerDraw; // מזומן פנוי לשירות החוב
    return {
      year: y, revenue, cogs, grossProfit: revenue - cogs, fixed, salaries, ebitda,
      interest: d.interest, preTax, tax, incomeTax: t.incomeTax, ni: t.ni, taxEffectivePct: t.effectivePct,
      net, ownerDraw, debtService: d.payment, cfads,
      dscr: d.payment > 0 ? cfads / d.payment : Infinity,
    };
  }

  /**
   * הפריסה החודשית של המס בשנה הראשונה (12 מספרים, שסכומם = המס השנתי).
   *
   * למה לא 1/12 קבוע: מקדמות מס הכנסה אינן חלוקה שווה של המס השנתי החזוי. לפי רשות
   * המסים, המקדמה בכל תקופת דיווח נגזרת מהפעילות בפועל של אותה תקופה (מחזור התקופה
   * מוכפל ביחס המס שנקבע לעסק), ולכן בחודשי הרצה עם מכירות נמוכות המקדמה נמוכה
   * ממילא. פריסה של 1/12 קבוע גבתה מס מלא כבר בחודש הראשון, שבו העסק עוד בהפסד,
   * והציגה מינוס עמוק שלא היה קורה בפועל (מחקר 27.09.2026,
   * company/research/04-tax-advances-new-business.md, וממצא QA סבב 5 באג 3).
   *
   * השיטה: שיעור מס אפקטיבי = המס השנתי חלקי סך הרווח החודשי החייב בפועל, והוא מוחל
   * על הרווח של כל חודש. חודש בהפסד (הוצאות גבוהות מההכנסות) מקבל משקל 0 – אין ממה
   * לגבות מס – והרווח נספר לפי אותו בסיס שעליו חושב המס השנתי: הכנסות פחות עלות מכר,
   * הוצאות קבועות, שכר וריבית. סך המס לא משתנה, רק פריסתו.
   *
   * שיפור 4, ב2 – חודשים עם אותן מכירות משלמים אותו מס: הריבית בשפיצר יורדת מחודש
   * לחודש אחרי הגרייס, ולכן המשקל לבדו העלה את המס ב-10 ₪ בכל חודש גם כשהמכירות
   * קבועות (10,370 → 10,380 → ... → 10,420 בתוכנית לדוגמה). זו מגמה מלאכותית: המקדמה
   * נגזרת מהמחזור של התקופה, לא מיתרת ההלוואה. לכן, אחרי השקלול, כל קבוצת חודשים
   * עם מחזור זהה מקבלת את ממוצע המס של הקבוצה. חודשי ההרצה (מחזור שונה) לא זזים,
   * הסכום השנתי לא משתנה, ומכירות קבועות = מס חודשי קבוע.
   *
   * קירוב, ומודע לכך: ביטוח לאומי נגבה טכנית בסכום קבוע ומתעדכן רק אם העצמאי יוזם
   * בקשת תיקון מקדמות (זכות רגילה כשההכנסה נמוכה ב-10%+, מה שמתקיים בחודשי הרצה).
   * הכלי אינו מדמה את הפנייה הזאת, ומניח שהיא נעשית; ההסתייגות מוצגת למשתמש בהערה
   * שמתחת לטבלת התזרים.
   *
   * @param {object} f הנחות התחזית (annualSales, cogsPct, monthlyFixed, monthlySalaries, rampMonths, currentSales)
   * @param {number} annualTax המס השנתי של שנה 1 (מס הכנסה + ביטוח לאומי, או מס חברות)
   * @param {{interest:number}[]} [schedule] לוח הסילוקין – הריבית של כל חודש, אם יש הלוואה
   * @returns {number[]} 12 סכומי מס חודשיים
   */
  function taxSpread(fIn, annualTax, schedule) {
    // taxSpread(null) קרס ב-salesLevel (ממצא QA סבב 7, שיפור 4 סעיף ה'). בלי הנחות אין
    // מכירות ואין רווח חודשי, ולכן המס נפרס שווה – בדיוק כמו בכל מקרה בלי רווח חיובי.
    const f = fIn || {};
    const total = Math.max(0, Number(annualTax) || 0);
    const monthly = (Number(f && f.annualSales) || 0) / 12;
    const weights = [];
    const revenues = [];
    for (let m = 1; m <= 12; m++) {
      const revenue = monthly * salesLevel(f, m);
      const interest = (schedule && schedule[m - 1]) ? (Number(schedule[m - 1].interest) || 0) : 0;
      const profit = revenue * (1 - (Number(f && f.cogsPct) || 0) / 100)
        - (Number(f && f.monthlyFixed) || 0) - (Number(f && f.monthlySalaries) || 0) - interest;
      weights.push(Math.max(0, profit));
      revenues.push(revenue);
    }
    const sum = weights.reduce((s, w) => s + w, 0);
    // בלי רווח חודשי חיובי בכלל אין על מה לפרוס, וחוזרים לחלוקה שווה כדי לא לאבד את הסכום
    if (!(sum > 0)) return weights.map(() => total / 12);
    const raw = weights.map((w) => (total * w) / sum);
    // ב2: חודשים עם אותו מחזור (עד אגורה) מקבלים את ממוצע המס של הקבוצה שלהם
    const groups = new Map();
    revenues.forEach((r, i) => {
      const key = Math.round(r * 100);
      const g = groups.get(key) || { sum: 0, n: 0 };
      g.sum += raw[i]; g.n += 1;
      groups.set(key, g);
    });
    return revenues.map((r) => { const g = groups.get(Math.round(r * 100)); return g.sum / g.n; });
  }

  /**
   * תזרים חודשי לשנה הראשונה.
   * uses: [{item, amount, type:'capex'|'working'}] – השקעות (capex) יוצאות בחודש 1.
   * equity: הון עצמי שהבעלים מכניס לעסק. נכנס כתקבול בחודש 1, בדיוק כמו ההלוואה,
   * כדי שהתזרים יתיישב עם "סך ההשקעה" שמוצג בפרק המקורות והשימושים.
   * opts.capex: סך ההשקעות שיוצאות בחודש 1. כשהוא מועבר הוא מקור האמת (בעסק בהקמה –
   * טבלת עלויות ההקמה), וכשהוא לא מועבר הוא נגזר משורות ה-capex ב-uses.
   * opts.monthlyTax: תשלום המס בתזרים. מספר – אותו סכום בכל חודש; מערך של 12 מספרים –
   * הפריסה החודשית בפועל (taxSpread), שהיא מה שהמנוע מעביר מאז 27.09.2026, כי מקדמות
   * המס נגזרות מהפעילות של כל חודש ולא מ-1/12 קבוע. בלי שורת מס בכלל התזרים היה מציג
   * מזומן שהעסק לא באמת מחזיק, בזמן שפרק יכולת ההחזר כבר מנכה את המס.
   * opts.vat: {amount, refundMonth} – המע"מ על רכישת הציוד. יוצא בחודש 1 וחוזר מרשות
   * המסים כעבור TAX.vatRefundMonths חודשים. זה לא "שימוש בכספים" (הכסף חוזר), אבל הוא
   * כן צריך להיות בחשבון באותם חודשים – ולכן הוא מוצג בתזרים בלבד (סעיף 13).
   * opts.working: הון חוזר שהמשתמש פירט כפריט שימוש (מלאי, חומרי גלם, שיווק) – יוצא
   * בחודש 1, כמו ההשקעות. ראו workingCapitalOutflow להחלטה החשבונאית (שיפור 4, ב1).
   * תאימות לאחור: מותר להעביר מספר במקום opts, והוא ייקרא כ-capex.
   */
  function cashflow(f, loanAmount, uses, schedule, equity, opts) {
    const o = opts && typeof opts === 'object' ? opts : { capex: opts };
    const workingOut = Math.max(0, Number(o.working) || 0);
    const vatAmount = Math.max(0, Number(o.vat && o.vat.amount) || 0);
    const vatRefundMonth = Math.max(2, Math.round(Number(o.vat && o.vat.refundMonth) || (1 + TAX.vatRefundMonths)));
    let cash = (f.openingCash || 0);
    const monthly = f.annualSales / 12;
    const capex = o.capex != null && Number.isFinite(Number(o.capex))
      ? Math.max(0, Number(o.capex))
      : (uses || []).filter((u) => u.type === 'capex').reduce((s, u) => s + (Number(u.amount) || 0), 0);
    const taxByMonth = Array.isArray(o.monthlyTax) ? o.monthlyTax.map((v) => Math.max(0, Number(v) || 0)) : null;
    const monthlyTax = taxByMonth ? 0 : Math.max(0, Number(o.monthlyTax) || 0);
    const eq = Math.max(0, Number(equity) || 0);
    const rows = [];
    for (let m = 1; m <= 12; m++) {
      const revenue = monthly * salesLevel(f, m);
      const loanIn = m === 1 ? loanAmount : 0;
      const equityIn = m === 1 ? eq : 0;
      const cogs = revenue * (f.cogsPct || 0) / 100;
      const fixed = f.monthlyFixed || 0;
      const salaries = f.monthlySalaries || 0;
      const draw = f.ownerDrawMonthly || 0;
      const debt = (schedule && schedule[m - 1]) ? schedule[m - 1].payment : 0;
      const invest = m === 1 ? capex : 0;
      const working = m === 1 ? workingOut : 0;
      const tax = taxByMonth ? (taxByMonth[m - 1] || 0) : monthlyTax;
      const vatOut = m === 1 ? vatAmount : 0;
      const vatIn = m === vatRefundMonth ? vatAmount : 0;
      const opening = cash;
      const inflow = revenue + loanIn + equityIn + vatIn;
      const outflow = cogs + fixed + salaries + draw + debt + invest + working + tax + vatOut;
      cash = opening + inflow - outflow;
      rows.push({ month: m, opening, revenue, loanIn, equityIn, vatIn, cogs, fixed, salaries, draw, debt, invest, working, tax, vatOut, inflow, outflow, closing: cash });
    }
    return rows;
  }

  /**
   * שיפור 4, ב5 – תזרים חודשי לכל תקופת ההלוואה, לא רק לשנה הראשונה.
   * השנה הקשה היא לרוב שנה 2: הגרייס נגמר, ההחזר קופץ מריבית בלבד לקרן וריבית, והעסק
   * כבר לא נהנה מהכסף שנכנס בחודש 1. טבלת התזרים במסמך נשארת של השנה הראשונה; הפונקציה
   * הזאת משמשת לחישוב היתרה הנמוכה ביותר לאורך כל התקופה (בתרחישים ובתוכנית עצמה).
   *
   * שנה 1 – בדיוק השורות של cashflow (firstYear). משנה 2 – כל חודש הוא 1/12 מהשנה
   * שלו לפי forecast (שנים 2–3), כולל המס של אותה שנה; ההחזר – מלוח הסילוקין בפועל.
   * אחרי שנה 3 (אופק התחזית) המכירות וההוצאות נשארות ברמת שנה 3 (ראו yearFigures).
   * אורך: כל חודשי ההלוואה, ולפחות 12.
   *
   * @returns {object[]} שורות באותו מבנה של cashflow, ועוד year ו-monthInYear. month רץ 1..N.
   */
  function cashflowPeriod(f, schedule, firstYear, years) {
    const sched = schedule || [];
    const rows = (firstYear || []).map((r) => ({ ...r, year: 1, monthInYear: r.month }));
    const total = Math.max(12, sched.length);
    const debt = debtByYear(sched);
    let cash = rows.length ? rows[rows.length - 1].closing : (f.openingCash || 0);
    for (let m = rows.length + 1; m <= total; m++) {
      const y = Math.ceil(m / 12);
      const yf = (years && years[y - 1]) || yearFigures(f, y, debt[y - 1], Math.min(y, 3));
      const revenue = yf.revenue / 12;
      const cogs = yf.cogs / 12;
      const fixed = yf.fixed / 12;
      const salaries = yf.salaries / 12;
      const draw = yf.ownerDraw / 12;
      const tax = Math.max(0, yf.tax) / 12;
      const debtPay = sched[m - 1] ? sched[m - 1].payment : 0;
      const opening = cash;
      const inflow = revenue;
      const outflow = cogs + fixed + salaries + draw + debtPay + tax;
      cash = opening + inflow - outflow;
      rows.push({ month: m, year: y, monthInYear: m - (y - 1) * 12, opening, revenue, loanIn: 0, equityIn: 0, vatIn: 0,
        cogs, fixed, salaries, draw, debt: debtPay, invest: 0, working: 0, tax, vatOut: 0, inflow, outflow, closing: cash });
    }
    return rows;
  }

  /**
   * "חודש 18" בשפה של בנקאי: "חודש 6 בשנה השנייה". בשנה הראשונה – "חודש X" כמו קודם.
   * month רץ לאורך כל התקופה (1..N).
   */
  const YEAR_ORD = ['', 'הראשונה', 'השנייה', 'השלישית', 'הרביעית', 'החמישית', 'השישית', 'השביעית', 'השמינית', 'התשיעית', 'העשירית'];
  function periodMonthText(month) {
    const m = Math.max(1, Math.round(Number(month) || 1));
    if (m <= 12) return `חודש ${m}`;
    const y = Math.ceil(m / 12);
    const inYear = m - (y - 1) * 12;
    return `חודש ${inYear} ${YEAR_ORD[y] ? `בשנה ${YEAR_ORD[y]}` : `בשנה ${y}`}`;
  }

  /** דירוג יכולת החזר לפי DSCR */
  function dscrLevel(dscr) {
    if (!Number.isFinite(dscr)) return { level: 'ok', label: 'אין החזרים בשנה זו' };
    if (dscr >= 1.25) return { level: 'ok', label: 'יכולת החזר טובה' };
    if (dscr >= 1) return { level: 'warn', label: 'יכולת החזר גבולית' };
    return { level: 'risk', label: 'יכולת החזר לא מספיקה' };
  }

  /**
   * איזה נתח ההחזר החודשי תופס מהמחזור החודשי, ובאיזו רמה זה נמצא.
   * מחזיר null כשאין מחזור – בלי מחזור אי אפשר לחשב אחוז, ולא מציגים כלום.
   */
  function affordLevel(monthlyPayment, monthlySales) {
    if (!(monthlySales > 0)) return null;
    const pct = (Math.max(0, monthlyPayment) / monthlySales) * 100;
    const level = pct <= AFFORD.okPct ? 'ok' : pct <= AFFORD.riskPct ? 'warn' : 'risk';
    return { pct, level };
  }

  /** שפיצר "מהסוף להתחלה": איזו קרן מתאימה להחזר חודשי נתון */
  function loanForPayment(payment, annualRatePct, months) {
    const p = Math.max(0, Number(payment) || 0);
    const n = Math.round(Number(months) || 0);
    if (n <= 0 || p <= 0) return 0;
    const r = annualRatePct / 100 / 12;
    if (r === 0) return p * n;
    return (p * (1 - Math.pow(1 + r, -n))) / r;
  }

  /** עיגול סכום להמלצה, כדי שלא יוצג "כ-324,396 ₪" */
  function roundAmount(n) {
    const v = Math.max(0, Number(n) || 0);
    if (v >= 20000) return Math.round(v / 5000) * 5000;
    if (v >= 2000) return Math.round(v / 1000) * 1000;
    return Math.round(v / 100) * 100;
  }

  /**
   * מה אפשר לעשות כשההחזר גבוה מדי – מספרים בלבד, בלי ניסוח (הניסוח בשכבת התצוגה).
   * loan: {amount, ratePct, years, graceMonths}; targetPayment: ההחזר החודשי שהעסק יכול לעמוד בו.
   */
  function repaymentOptions(loan, targetPayment) {
    const amount = Math.max(0, Number(loan.amount) || 0);
    const ratePct = Number(loan.ratePct) || 0;
    const years = Number(loan.years) || 0;
    const grace = Math.max(0, Number(loan.graceMonths) || 0);
    const months = Math.round(years * 12);
    const payMonths = Math.max(1, months - grace);
    const current = spitzerPayment(amount, ratePct, payMonths);
    const suggestedAmount = roundAmount(Math.min(amount, loanForPayment(targetPayment, ratePct, payMonths)));
    const maxMonths = Math.round(FUND.maxYears * 12);
    const atMaxYears = years >= FUND.maxYears;
    const atMaxGrace = grace >= FUND.maxGraceMonths;
    const extend = !atMaxYears && amount > 0
      ? (() => {
        const payment = spitzerPayment(amount, ratePct, Math.max(1, maxMonths - grace));
        return { years: FUND.maxYears, payment, current, saving: current - payment };
      })()
      : null;
    const graceOpt = !atMaxGrace && amount > 0 && months > FUND.maxGraceMonths
      ? {
        months: FUND.maxGraceMonths,
        during: (amount * ratePct) / 100 / 12,
        after: spitzerPayment(amount, ratePct, months - FUND.maxGraceMonths),
        current,
      }
      : null;
    return {
      current,
      targetPayment: Math.max(0, Number(targetPayment) || 0),
      suggestedAmount,
      suggestedPayment: spitzerPayment(suggestedAmount, ratePct, payMonths),
      gap: Math.max(0, amount - suggestedAmount),
      extend, grace: graceOpt, atMaxYears, atMaxGrace,
    };
  }

  /** חלקו של ההון העצמי מסך ההשקעה (הון עצמי + הלוואה), והאם הוא מתחת לנהוג */
  function equityShare(equity, loanAmount) {
    const eq = Math.max(0, Number(equity) || 0);
    const total = eq + Math.max(0, Number(loanAmount) || 0);
    if (!(total > 0)) return null;
    const pct = (eq / total) * 100;
    return { pct, total, below: pct < AFFORD.minEquityPct };
  }

  /** בדיקות תקינות לפני הפקת המסמך; מחזיר אזהרות בעברית */
  function validatePlan(plan) {
    const w = [];
    const cap = maxLoan(plan.forecast.annualSales);
    if (plan.loan.amount > cap) w.push(`סכום ההלוואה (${ils(plan.loan.amount)}) גבוה מהתקרה במסלול (${ils(cap)}).`);
    if (plan.loan.years > FUND.maxYears) w.push(`תקופת ההלוואה במסלול היא עד ${FUND.maxYears} שנים.`);
    if (plan.loan.graceMonths > FUND.maxGraceMonths) w.push(`גרייס של עד ${FUND.maxGraceMonths} חודשים בלבד.`);
    const used = usesTotal(plan);
    const src = sourcesTotal(plan);
    if (Math.abs(used - src) > 1) w.push(`סכום השימושים בכספים (${ils(used)}) שונה ממקורות המימון (${ils(src)}).`);
    return w;
  }

  /**
   * האם זו תוכנית של עסק שעוד לא נפתח. אותו כלל כמו באשף:
   * הדגל קובע, ותוכנית ישנה בלי דגל נקבעת לפי ותק.
   */
  function isNewBusiness(plan) {
    const b = (plan && plan.business) || {};
    return b.isNew === true || (b.isNew == null && !b.years);
  }

  /** ההון העצמי שנכנס לעסק בחודש 1 – רק בעסק בהקמה, שם הוא נשאל בשלב "הקמת העסק" */
  function equityInflow(plan) {
    if (!isNewBusiness(plan)) return 0;
    return Math.max(0, Number(plan && plan.startup && plan.startup.equity) || 0);
  }

  // ---------- מקור אמת אחד לכל פריט ----------

  const sumAmounts = (list) => (list || []).reduce((s, u) => s + (Number(u.amount) || 0), 0);
  const hasContent = (u) => Boolean(String((u && u.item) || '').trim()) || Number(u && u.amount) > 0;

  /**
   * עלויות הקמה שנשאלות בשדה נפרד ולא ברשימה החופשית (סעיף 13):
   * הוצאות לפני הפתיחה ופיקדון או ערבות לשכירות. שתיהן יציאת מזומן חד-פעמית לפני
   * הפתיחה, ולכן הן חלק מעלויות ההקמה ומופיעות בטבלת השימושים כמו כל פריט אחר.
   * שורות עם 0 לא מוצגות בכלל, כדי שלא לנפח את הטבלה למי שלא רלוונטי לו.
   */
  const SETUP_EXTRA_FIELDS = [
    { key: 'preOpenCosts', item: 'הוצאות לפני הפתיחה (שכירות בתקופת ההקמה, רישוי ואגרות)' },
    { key: 'deposit', item: 'פיקדון או ערבות לשכירות' },
  ];
  function setupExtras(plan) {
    const st = (plan && plan.startup) || {};
    return SETUP_EXTRA_FIELDS
      .map((f) => ({ item: f.item, amount: Math.max(0, Number(st[f.key]) || 0), type: 'capex', key: f.key }))
      .filter((u) => u.amount > 0);
  }

  /** המע"מ על רכישת הציוד – יוצא בחודש 1 וחוזר כעבור חודשיים. לא חלק מהשימושים */
  function equipmentVat(plan) {
    return Math.max(0, Number(plan && plan.startup && plan.startup.equipmentVat) || 0);
  }
  /** הצעת ברירת מחדל למע"מ על הציוד: השיעור הקבוע על סך עלויות ההקמה שפורטו ברשימה */
  function suggestedEquipmentVat(plan) {
    return Math.round(sumAmounts(plan && plan.startup && plan.startup.setupCosts) * TAX.vatRatePct / 100);
  }

  /** סך עלויות ההקמה שהמשתמש פירט בשלב "הקמת העסק" – מקור האמת להשקעה בעסק בהקמה */
  function setupCostsTotal(plan) {
    return sumAmounts(plan && plan.startup && plan.startup.setupCosts) + sumAmounts(setupExtras(plan));
  }

  /** מקורות המימון: הלוואה ועוד הון עצמי (בעסק פועל אין הון עצמי, ולכן זה סכום ההלוואה) */
  function sourcesTotal(plan) {
    return Math.max(0, Number(plan && plan.loan && plan.loan.amount) || 0) + equityInflow(plan);
  }

  /** האם עלויות ההקמה הן מקור האמת לשימושים (עסק בהקמה שפירט עלויות) */
  function setupDrivesUses(plan) {
    return isNewBusiness(plan) && setupCostsTotal(plan) > 0;
  }

  /**
   * השימושים בכספים – מקור אמת אחד.
   * עסק בהקמה: הפריטים מטבלת עלויות ההקמה, ועוד הון חוזר שהוא כל מה שנשאר מהמקורות.
   * כך כל פריט מוזן פעם אחת, וסך השימושים שווה תמיד לסך המקורות.
   * עסק פועל: הרשימה שהמשתמש הזין בשלב ההלוואה, כמו קודם.
   */
  function planUses(plan) {
    // סעיף 22: שם הפריט מנוקה כאן, במקום אחד, כדי שכל הטבלאות (ובממשק) יציגו אותו זהה
    if (!setupDrivesUses(plan)) {
      return ((plan && plan.loan && plan.loan.uses) || []).filter(hasContent)
        .map((u) => ({ ...u, item: tidyLabel(u.item) }));
    }
    const items = (plan.startup.setupCosts || []).filter(hasContent)
      .map((u) => ({ item: tidyLabel(u.item), amount: Number(u.amount) || 0, type: 'capex' }))
      .concat(setupExtras(plan).map((u) => ({ item: u.item, amount: u.amount, type: 'capex' })));
    const working = sourcesTotal(plan) - setupCostsTotal(plan);
    if (working > 0.5) items.push({ item: 'הון חוזר – סחורה, מלאי והוצאות שוטפות בתחילת הדרך', amount: working, type: 'working' });
    return items;
  }
  function usesTotal(plan) { return sumAmounts(planUses(plan)); }

  /** סך ההשקעה שיוצאת בחודש הראשון בתזרים: בעסק בהקמה – כל עלויות ההקמה */
  function investmentTotal(plan) {
    if (setupDrivesUses(plan)) return setupCostsTotal(plan);
    return sumAmounts(((plan && plan.loan && plan.loan.uses) || []).filter((u) => u.type === 'capex'));
  }

  /**
   * שיפור 4, ב1 – הון חוזר שנכנס עם ההלוואה ולא יצא אף פעם בתזרים.
   *
   * ההחלטה החשבונאית: מבחינים בין שני סוגי "הון חוזר", לפי מקורם.
   *
   * 1. הון חוזר שהמשתמש פירט כפריט שימוש (loan.uses עם type 'working': "חומרי גלם
   *    ומלאי", "שיווק", "משווק"). זו הצהרה לבנק שהכסף יוצא על משהו מסוים. קנייה של
   *    מלאי היא יציאת מזומן אמיתית: עלות המכר בתזרים מניחה שהקניות השוטפות שוות
   *    לצריכה, ולכן בניית מלאי נוסף (או קמפיין שיווק חד-פעמי) היא תשלום *נוסף* על
   *    עלות המכר. לכן הוא יוצא בחודש 1, בשורה נפרדת בתזרים. בלי זה, בתוכנית לדוגמה
   *    75,000 ₪ נכנסו עם ההלוואה ונשארו בחשבון לתמיד, והיתרה המינימלית (113,142 ₪)
   *    הייתה מנופחת בדיוק בסכום הזה.
   *    חודש 1 ולא פריסה: זה המועד שבו הכסף מתקבל ובו הוא מוצהר כמנוצל, וזו גם
   *    ההנחה השמרנית (היתרה המינימלית לא מיופה).
   *
   * 2. הון חוזר שהכלי גזר בעסק בהקמה (planUses: "כל מה שנשאר מהמקורות מעל עלויות
   *    ההקמה"). זה לא פריט קנייה אלא כרית מזומן לחודשי ההרצה – וההוצאות של החודשים
   *    האלה (שכר, הוצאות קבועות, עלות מכר בזמן שהמכירות נמוכות) כבר נמצאות בתזרים.
   *    הוצאה שלו בחודש 1 הייתה סופרת את אותן הוצאות פעמיים. לכן הוא נשאר בחשבון,
   *    ומה שלא נוצל ממנו בנקודה הנמוכה מוצג במפורש כ"רזרבה שלא נוצלה" (reserveNote).
   *
   * מגבלה ידועה: פריט שסווג כהון חוזר אבל כבר נמצא בהוצאות החודשיות (למשל "שכר
   * עובדים חדשים" שגם נכלל בשכר החודשי) ייספר פעמיים. זו הטעות השמרנית, והבדיקה
   * א4 (suggestUseCategory) מסייעת למשתמש לסווג נכון.
   */
  function workingCapitalOutflow(plan) {
    if (setupDrivesUses(plan)) return 0;
    return sumAmounts(((plan && plan.loan && plan.loan.uses) || []).filter((u) => u.type === 'working'));
  }

  /**
   * סעיף 22 – ניקוי כותרת שורה שהמשתמש הזין. כותרת שורה אינה משפט, ולכן נקודתיים
   * או נקודה בסופה מיותרים במסמך: "רכישת ציוד ומכונות קפה:" → "רכישת ציוד ומכונות קפה".
   * נוגעים רק ברווחים ובפיסוק שבסוף המחרוזת – אף אות אינה נמחקת (סעיף 23), ואם
   * אחרי הניקוי לא נשאר תוכן, מחזירים את המקור כדי לא לאבד מה שהמשתמש כתב.
   */
  const TRAILING_PUNCT = /[\s.:;,־–-]+$/;
  function tidyLabel(s) {
    const base = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    const out = base.replace(TRAILING_PUNCT, '');
    return out || base;
  }

  /** שם פריט להשוואה: בלי רווחים כפולים ובלי פיסוק בסוף */
  function itemKey(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().replace(/[.:,;–-]+$/, '').toLowerCase();
  }

  /**
   * שלוש בדיקות התקינות שחוסמות הפקת מסמך (דרישת מאיר, באג #3):
   * sources – סך המקורות שווה לסך השימושים;
   * invest – שורת ההשקעות בתזרים שווה לסך עלויות ההקמה;
   * items – כל פריט מופיע באותו סכום בכל הטבלאות.
   * הבדיקה נעשית על התוצר (שורות התזרים וטבלת השימושים שיודפסו), ולא על הקלט בלבד,
   * כדי שגם טעות חישוב עתידית תיתפס ולא רק הזנה כפולה.
   */
  function integrityChecks(plan, res) {
    const uses = (res && res.uses) || planUses(plan);
    const cash = (res && res.cash) || [];
    const src = sourcesTotal(plan);
    const used = sumAmounts(uses);
    const setup = setupCostsTotal(plan);
    const expectedInvest = investmentTotal(plan);
    // בלי שורות תזרים אין תוצר להשוות אליו, ולכן ההשוואה היא מול הקלט עצמו
    const investInCash = cash.length ? cash.reduce((s, c) => s + (Number(c.invest) || 0), 0) : expectedInvest;
    const checks = [];

    checks.push({
      code: 'sources',
      label: 'סך מקורות המימון שווה לסך השימושים',
      ok: Math.abs(src - used) <= 1,
      message: used > src
        ? `השימושים בכספים מסתכמים ב-${ils(used)}, אבל המקורות (הלוואה והון עצמי) מסתכמים ב-${ils(src)}. חסרים ${ils(used - src)}. אפשר להגדיל את ההון העצמי או את ההלוואה, או להקטין את עלויות ההקמה.`
        : `המקורות (הלוואה והון עצמי) מסתכמים ב-${ils(src)}, אבל השימושים מסתכמים ב-${ils(used)}. יש לפרט על מה יוצאים ${ils(src - used)} שנותרו.`,
    });
    checks.push({
      code: 'invest',
      label: 'שורת ההשקעות בתזרים שווה לסך עלויות ההקמה',
      ok: Math.abs(investInCash - expectedInvest) <= 1,
      message: `שורת "השקעות" בטבלת התזרים מסתכמת ב-${ils(investInCash)}, אבל ${setup > 0 ? `סך עלויות ההקמה הוא ${ils(setup)}` : `סך ההשקעות בפירוט השימושים הוא ${ils(expectedInvest)}`}. שני המספרים חייבים להיות זהים.`,
    });

    const seen = new Map();
    const clashes = [];
    [...((plan && plan.startup && plan.startup.setupCosts) || []), ...uses].filter(hasContent).forEach((u) => {
      const key = itemKey(u.item);
      if (!key) return;
      const amount = Number(u.amount) || 0;
      if (!seen.has(key)) { seen.set(key, amount); return; }
      if (Math.abs(seen.get(key) - amount) > 1 && !clashes.some((c) => c.key === key)) {
        clashes.push({ key, item: String(u.item || '').trim(), a: seen.get(key), b: amount });
      }
    });
    checks.push({
      code: 'items',
      label: 'כל פריט מופיע באותו סכום בכל הטבלאות',
      ok: clashes.length === 0,
      message: clashes.length
        ? `הפריט "${clashes[0].item}" מופיע בשני סכומים שונים: ${ils(clashes[0].a)} ו-${ils(clashes[0].b)}. יש להזין אותו פעם אחת, בסכום אחד.`
        : '',
    });
    return checks;
  }
  /** רק הבדיקות שנכשלו – אלה שחוסמות הפקת מסמך */
  function integrityFailures(plan, res) {
    return integrityChecks(plan, res).filter((c) => !c.ok);
  }

  /**
   * המרווח בתזרים: היתרה המינימלית בפועל מול סף של "חודש אחד של הוצאות":
   * הוצאות קבועות + שכר + עלות מכר חודשית ממוצעת. 'risk' – החשבון נכנס למינוס;
   * 'warn' – נשאר חיובי אבל מתחת לסף; 'ok' – מעל הסף. במקום ההצהרה "התזרים יישאר
   * חיובי" (באג #5).
   *
   * שיפור 4, ב3: עד עכשיו הסף היה קבועות + שכר בלבד (50,000 ₪ במאפייה לדוגמה), אבל
   * עלות המכר (חומרי גלם, סחורה) היא הוצאה חודשית לכל דבר – עם עלות מכר מדובר בכ-100,000 ₪.
   * עלות המכר החודשית הממוצעת נלקחת משורות התזרים עצמן (c.cogs), כך שחודשי ההרצה
   * נספרים לפי מה שבאמת יצא בהם.
   *
   * @param {object[]} rows שורות התזרים שבהן מחפשים את היתרה הנמוכה ביותר
   * @param {object} f הנחות התחזית (monthlyFixed, monthlySalaries)
   * @param {object[]} [baseRows] השורות שמהן מחושב ממוצע עלות המכר (ברירת מחדל: rows).
   *   משמש לתזרים של כל תקופת ההלוואה, כדי שהסף יהיה זהה לסף של השנה הראשונה.
   * @returns {{min, month, threshold, thresholdParts:{fixed, salaries, cogs}, level, monthsCovered}|null}
   */
  function cashCushion(rows, f, baseRows) {
    const list = rows || [];
    if (!list.length) return null;
    const worst = list.reduce((a, c) => (c.closing < a.closing ? c : a));
    const base = Array.isArray(baseRows) && baseRows.length ? baseRows : list;
    const parts = {
      fixed: Number(f && f.monthlyFixed) || 0,
      salaries: Number(f && f.monthlySalaries) || 0,
      cogs: Math.max(0, base.reduce((s, c) => s + (Number(c && c.cogs) || 0), 0) / base.length),
    };
    const threshold = parts.fixed + parts.salaries + parts.cogs;
    const level = worst.closing < 0 ? 'risk' : (threshold > 0 && worst.closing < threshold ? 'warn' : 'ok');
    return { min: worst.closing, month: worst.month, threshold, thresholdParts: parts, level, monthsCovered: threshold > 0 ? worst.closing / threshold : null };
  }

  /** חישוב מלא של תוכנית */
  function computePlan(plan) {
    const schedule = amortization(plan.loan.amount, plan.loan.ratePct, plan.loan.years, plan.loan.graceMonths);
    const isNew = isNewBusiness(plan);
    const f = {
      ...plan.forecast,
      currentSales: (plan.history && plan.history.lastYearSales) || 0,
      entity: (plan.business && plan.business.entity) || 'osek',
      // עסק בהקמה מתחיל בלי מזומן: הכסף שהבעלים מכניס נספר פעם אחת, כתקבול "הון עצמי" (באג #1)
      openingCash: isNew ? 0 : (plan.forecast.openingCash || 0),
    };
    const years = forecast(f, schedule);
    const uses = planUses(plan);
    const vat = isNew ? equipmentVat(plan) : 0;
    // המס נפרס לפי הפעילות בפועל של כל חודש, ולא 1/12 קבוע (ראו taxSpread)
    const taxByMonth = taxSpread(f, years[0].tax, schedule);
    const cash = cashflow(f, plan.loan.amount, uses, schedule, equityInflow(plan), {
      capex: investmentTotal(plan),
      working: workingCapitalOutflow(plan),
      monthlyTax: taxByMonth,
      vat: { amount: vat, refundMonth: 1 + TAX.vatRefundMonths },
    });
    const minDscr = Math.min(...years.map((y) => y.dscr));
    const firstFull = schedule.find((r) => r.principal > 0);
    const res = {
      cap: maxLoan(plan.forecast.annualSales),
      schedule, years, cash, uses,
      usesTotal: sumAmounts(uses),
      sourcesTotal: sourcesTotal(plan),
      setupTotal: setupCostsTotal(plan),
      investment: investmentTotal(plan),
      workingOut: workingCapitalOutflow(plan),
      vat: { amount: vat, refundMonth: 1 + TAX.vatRefundMonths },
      annualTax: years[0].tax,
      taxByMonth,                      // הפריסה בפועל שבטבלת התזרים
      monthlyTax: years[0].tax / 12,   // ממוצע חודשי בלבד, לטקסט השוואתי – לא מה שנגבה בכל חודש
      monthlyPayment: firstFull ? firstFull.payment : 0,
      graceInterest: plan.loan.graceMonths > 0 ? schedule[0].payment : 0,
      totalInterest: schedule.reduce((s, r) => s + r.interest, 0),
      minDscr, rating: dscrLevel(minDscr),
      negativeMonths: cash.filter((c) => c.closing < 0).map((c) => c.month),
      cushion: cashCushion(cash, f),
      warnings: validatePlan(plan),
      conflicts: conflictWarnings(plan),
    };
    // ב5: התזרים לכל תקופת ההלוואה. הסף ("חודש של הוצאות") נשאר זה של השנה הראשונה.
    res.cashPeriod = cashflowPeriod(f, schedule, cash, years);
    res.cushionPeriod = cashCushion(res.cashPeriod, f, cash);
    res.negativeMonthsPeriod = res.cashPeriod.filter((c) => c.closing < 0).map((c) => c.month);
    res.assumptions = assumptionWarnings(plan);
    res.checks = integrityChecks(plan, res);
    res.blocking = res.checks.filter((c) => !c.ok);
    // שיפור 4, א': בדיקות העקביות. לא ממוזגות ל-res.blocking – שכבת התצוגה מחליטה
    // איך להציג את 'block' (res.blocking נשאר רק לבדיקות התקינות של הטבלאות).
    res.consistency = consistencyChecks(plan);
    return res;
  }

  function ils(n) {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(Math.round(n || 0));
  }
  /** מספר בעברית. d = ספרות אחרי הנקודה (ברירת מחדל: שלם), כמו בשכבת התצוגה */
  function num(n, d = 0) {
    const v = Number.isFinite(Number(n)) ? Number(n) : 0;
    return new Intl.NumberFormat('he-IL', { maximumFractionDigits: d, minimumFractionDigits: d })
      .format(d > 0 ? v : Math.round(v));
  }

  const MINUS = /[-−‒–]/; // מינוס רגיל, וגם מינוסים "טיפוגרפיים" שמגיעים מהדבקה

  /**
   * סכום מטקסט. signed=true רק בשדה שבו מינוס הוא ערך אמיתי (הפסד בשנה שעברה);
   * בשדות כמו מחזור או הוצאה מינוס הוא טעות, ולכן הוא נזרק.
   */
  function parseAmount(s, signed) {
    const str = String(s == null ? '' : s);
    const n = Number(str.replace(/[^\d.]/g, '')) || 0;
    return signed && MINUS.test(str) && n ? -n : n;
  }
  /** "-40,000" להצגה בשדה, עם המינוס */
  function moneyText(n) {
    return (n < 0 ? '-' : '') + num(Math.abs(n || 0));
  }
  /** "הפסד של 40,000 ₪" ולא "רווח של -40,000 ₪" */
  function profitText(n) {
    return n < 0 ? `הפסד של ${ils(-n)}` : n > 0 ? `רווח של ${ils(n)}` : 'איזון';
  }

  /**
   * ניסוח חודשי המינוס בתזרים, כמקטע משפט.
   * כל החודשים – "בכל חודשי השנה הראשונה"; רצף – טווח; אחרת רשימה.
   * נועד למנוע "בחודשים 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12".
   */
  function negativeMonthsText(months, totalMonths) {
    const total = Number(totalMonths) || 12;
    const list = (months || []).map(Number).filter((m) => Number.isFinite(m));
    if (!list.length) return '';
    if (list.length >= total) return 'בכל חודשי השנה הראשונה';
    if (list.length === 1) return `בחודש ${list[0]} של השנה הראשונה`;
    const sequential = list.every((m, i) => i === 0 || m === list[i - 1] + 1);
    const body = sequential ? `${list[0]}–${list[list.length - 1]}` : list.join(', ');
    return `בחודשים ${body} של השנה הראשונה`;
  }

  /**
   * הסבר בשלב ההזנה: מה ייעשה בכסף שנשאר מעל עלויות ההקמה שפורטו.
   * לא שגיאה – בעסק בהקמה כל מה שלא הוגדר כעלות הקמה מוצג כהון חוזר, כדי שסך
   * השימושים יישאר שווה לסך המקורות. מחזיר null כשאין עודף.
   */
  function workingCapitalNote(plan) {
    const setup = setupCostsTotal(plan);
    const src = sourcesTotal(plan);
    if (!isNewBusiness(plan) || !(setup > 0) || !(src > setup + 1)) return null;
    return `פירטתם עלויות הקמה של ${ils(setup)}, ומקורות המימון (ההלוואה וההון העצמי) הם ${ils(src)}. ההפרש, ${ils(src - setup)}, יוצג בתוכנית כהון חוזר – כסף לסחורה, למלאי ולהוצאות השוטפות בתחילת הדרך.`;
  }

  /** סך ההון החוזר שבטבלת השימושים – הכסף שנשאר בחשבון אחרי ההשקעות */
  function workingCapitalTotal(plan) {
    return sumAmounts(planUses(plan).filter((u) => u.type === 'working'));
  }

  /**
   * היתרה הנמוכה ביותר במסלול התזרים שהועבר. מקבלת שורות תזרים, אובייקט cushion
   * או מספר, ומחזירה null כשאין מסלול תזרים להסיק ממנו.
   */
  function minClosingBalance(cashOrCushion) {
    const x = cashOrCushion;
    if (Array.isArray(x)) {
      return x.length ? Math.min(...x.map((r) => Number(r && r.closing) || 0)) : null;
    }
    if (x && typeof x === 'object') {
      return Number.isFinite(Number(x.min)) ? Number(x.min) : null;
    }
    return Number.isFinite(Number(x)) ? Number(x) : null;
  }

  /**
   * כמה מההון החוזר עוד קיים בפועל בחשבון בנקודה הקשה ביותר של התזרים.
   * ההון החוזר אינו כסף נוסף מעל התזרים: הוא נכנס לחשבון בחודש 1 יחד עם ההלוואה
   * וההון העצמי, ולכן היתרה הנמוכה ביותר בתזרים היא מה שבאמת נשאר ממנו. אם היתרה
   * ירדה לאפס או למינוס, הכסף כבר נוצל, ואסור להציג אותו לבנק כמקור גישור נוסף
   * (ממצא QA סבב 5, באג חוסם 1).
   * fallbackWhenUnknown – מה להחזיר כשלא הועבר מסלול תזרים בכלל.
   */
  function unusedWorkingCapital(workingCapital, cashOrCushion, fallbackWhenUnknown) {
    const wc = Math.max(0, Number(workingCapital) || 0);
    const min = minClosingBalance(cashOrCushion);
    if (min == null) return Math.max(0, Math.min(wc, Number(fallbackWhenUnknown) || 0));
    return Math.max(0, Math.min(wc, min));
  }

  /**
   * ניסוח הגישור על חודשי המינוס, בפרק הסיכונים שבמסמך.
   * עסק פועל – גם הוא לא נשאל אם יש לו מסגרת אשראי, ולכן אסור לקבוע "מסגרת אשראי
   * קיימת"; הוא "יבדוק מול הבנק אשראי לטווח קצר" (ממצא QA סבב 7, החלטת מנכ"ל 28.09.2026,
   * באותו ניסוח של הממשק).
   * עסק בהקמה – אין לו מסגרת אשראי, ולא שאלנו אותו על כך; אסור להצהיר לבנק על
   * עובדה שלא קיימת (ממצא QA סבב 4, באג לא-חוסם 1).
   * ההפניה להון החוזר נעשית רק אם הוא באמת עוד קיים בחשבון באותה נקודה: המשפט
   * הזה מודפס דווקא כשהתזרים נכנס למינוס, ובמינוס ההון החוזר שנכנס בחודש 1 כבר
   * נוצל – ולכן ברירת המחדל (בלי מסלול תזרים) היא לא להפנות אליו כלל
   * (ממצא QA סבב 5, באג חוסם 1).
   */
  function bridgeText(isNew, workingCapital, cashOrCushion) {
    if (!isNew) return 'העסק יגשר על כך בדחיית חלק מההשקעות, ובמידת הצורך יבדוק מול הבנק אשראי לטווח קצר לחודשים האלה.';
    const available = unusedWorkingCapital(workingCapital, cashOrCushion, 0);
    return available > 0.5
      ? `הגישור ייעשה מתוך ההון החוזר שנותר בחשבון באותם חודשים (${ils(available)}), ובמידת הצורך גם בדחיית חלק מההשקעות, בהוספת חודשי גרייס או בהגדלת ההון העצמי.`
      : 'הגישור ייעשה בדחיית חלק מההשקעות, בהוספת חודשי גרייס להלוואה, בהקטנת משיכת הבעלים בחודשים הראשונים או בהגדלת ההון העצמי לפני הפתיחה.';
  }

  /**
   * ניסוח המרווח הדק בפרק הסיכונים שבמסמך – מה העסק יעשה כשהיתרה הנמוכה ביותר
   * קטנה מחודש הוצאות, אבל התזרים עדיין לא נכנס למינוס.
   * עסק פועל – לא נשאל על מסגרת אשראי, ולכן לא מצהירים שיש לו; הוא "יבדוק מול הבנק
   * אשראי לטווח קצר" (החלטת מנכ"ל 28.09.2026, כמו bridgeText).
   * עסק בהקמה – אין לו מסגרת אשראי ולא שאלנו אותו עליה; מפנים להון החוזר האמיתי
   * שכבר מוצג במקורות ובשימושים. אותה משפחת ממצאים של bridgeText (QA סבב 4).
   * המשפט מודפס רק כשהיתרה בתזרים עדיין חיובית (level === 'warn'), כלומר ההון החוזר
   * אכן עוד בחשבון – אבל לא בהכרח במלואו: בנקודה הנמוכה נשאר ממנו רק מה שהיתרה בפועל
   * מראה. הסכום המוצג הוא לכן היתרה הנמוכה בפועל ולא סך ההון החוזר, כשיש פער
   * (ממצא QA סבב 6: המסמך הציג 80,000 ₪ בעוד שבחשבון נשארו 11,699 ₪).
   * כשלא מועבר מסלול תזרים בכלל, ברירת המחדל נשארת סך ההון החוזר – בשונה מ-bridgeText,
   * שמודפס דווקא בחודשי מינוס ולכן ברירת המחדל שלו היא לא להפנות להון החוזר כלל.
   */
  function thinCushionText(isNew, workingCapital, cashOrCushion) {
    if (!isNew) return 'העסק יתאים את קצב ההשקעות לתקבולים בפועל, ובמידת הצורך יבדוק מול הבנק אשראי לטווח קצר.';
    const wc = unusedWorkingCapital(workingCapital, cashOrCushion, workingCapital);
    return wc > 0.5
      ? `ההון החוזר שבמקורות ובשימושים נועד בדיוק לחודשים האלה: בנקודה הנמוכה ביותר יישארו ממנו ${ils(wc)} בחשבון, והעסק יתאים את קצב ההשקעות לתקבולים בפועל.`
      : 'העסק יתאים את קצב ההשקעות לתקבולים בפועל, ובמידת הצורך יוסיף חודשי גרייס או הון עצמי לפני הפתיחה.';
  }

  /**
   * משפט השקיפות שנלווה לכרטיס "בקשה חזקה" בתמונת המצב.
   * דירוג הבקשה (rating) נגזר מה-DSCR השנתי, והמרווח (cushion) נגזר מיתרת המזומן
   * החודשית הנמוכה ביותר – שני מדדים נפרדים. אפשר שהשנה כולה תיראה חזקה ובכל זאת
   * יהיה חודש בודד שבו כמעט לא נשאר כסף בחשבון, והמשתמש גילה את זה רק במסך הבא
   * (ממצא QA סבב 6, באג לא-חוסם: מסרים מעורבים).
   * המשפט מוסיף שקיפות בלבד: הוא לא משנה את הדירוג, את הכותרת או את הספים.
   * מוחזר רק כשהמרווח הוא 'warn' (יתרה חיובית אך מתחת לחודש הוצאות); כשהיתרה
   * שלילית ('risk') הדיווח נעשה במקום אחר, בשורת חודשי המינוס.
   */
  function thinMonthNote(cushion) {
    if (!cushion || cushion.level !== 'warn') return '';
    return `שימו לב: בחודש ${cushion.month} התזרים דחוק – בחשבון צפויים להישאר ${ils(Math.max(0, cushion.min))} בלבד, פחות מחודש אחד של הוצאות (${thresholdLabel(cushion)}).`;
  }

  /**
   * שיפור 4 ספרינט 2, ב3 – תיאור הסף של "חודש אחד של הוצאות" (cushion.threshold).
   * מקור יחיד: גם thinMonthNote וגם BizplanUI.thresholdLabel ב-app.js משתמשים בו.
   * כשאין עלות מכר (thresholdParts.cogs = 0) – הניסוח הקצר, בלי "עלות מכר".
   */
  function thresholdLabel(c) {
    const parts = c && c.thresholdParts;
    if (parts && !(Number(parts.cogs) > 0)) return 'הוצאות קבועות ושכר';
    return 'הוצאות קבועות, שכר ועלות מכר, כלומר סחורה וחומרי גלם';
  }

  /**
   * האזהרה שנלווית לדירוג "בקשה חזקה" כשבשנה הראשונה יש חודש שבו היתרה בחשבון
   * שלילית באמת (cushion.level === 'risk'). הדירוג השנתי (DSCR) יכול להיות חזק
   * ובכל זאת בחודשים הראשונים לא יהיה בחשבון מספיק כסף לכל התשלומים – ואסור
   * שמסמך או מסך יאמרו "חזקה" בלי לומר את זה.
   * מציינת: באילו חודשים החשבון במינוס, מה החודש הקשה ביותר, כמה חסר בו (סכום
   * חיובי), ומה אפשר לעשות. לעסק בהקמה אין מסגרת אשראי ולא שאלנו עליה, ולכן היא
   * לא מוצעת לו; לעסק פועל היא מוצעת כדבר לבדוק מול הבנק, לא כעובדה.
   * מחזירה מחרוזת ריקה כשהמרווח אינו 'risk' (ב-'warn' מטפל thinMonthNote).
   */
  function negativeMonthNote(cushion, negativeMonths, isNew) {
    if (!cushion || cushion.level !== 'risk') return '';
    const months = (negativeMonths || []).map(Number).filter((m) => Number.isFinite(m));
    const missing = ils(Math.abs(Math.min(0, Number(cushion.min) || 0)));
    const where = months.length > 1
      ? `${negativeMonthsText(months)} החשבון צפוי להיות במינוס. בחודש הקשה ביותר, חודש ${cushion.month}, חסרים ${missing}`
      : `בחודש ${cushion.month} של השנה הראשונה החשבון צפוי להיות במינוס: חסרים בו ${missing}`;
    const fix = isNew === false
      ? 'כדי לסגור את הפער אפשר להגדיל מעט את סכום ההלוואה, להוסיף חודשי גרייס, לדחות חלק מההשקעות או לבדוק מול הבנק מסגרת אשראי לחודשים האלה.'
      : 'כדי לסגור את הפער אפשר להגדיל את ההון העצמי או מעט את סכום ההלוואה, להוסיף חודשי גרייס, לדחות חלק מההשקעות או להקטין את משיכת הבעלים בחודשים הראשונים.';
    return `שימו לב: ${where} כדי לשלם את כל ההוצאות וההחזרים. ${fix}`;
  }

  /**
   * ההסתייגות שבתקציר המנהלים של המסמך, כשיחס כיסוי החוב "טוב" אבל יש חודש שבו
   * היתרה בתזרים שלילית. נכתבת לקורא בבנק (גוף שלישי), מציינת חודש וסכום חסר,
   * ומפנה לפרק הסיכונים שבו מפורטת דרך הגישור (bridgeText) – בלי לחזור עליה.
   */
  function negativeMonthSummary(cushion, negativeMonths) {
    if (!cushion || cushion.level !== 'risk') return '';
    const months = (negativeMonths || []).map(Number).filter((m) => Number.isFinite(m));
    const missing = ils(Math.abs(Math.min(0, Number(cushion.min) || 0)));
    const when = months.length > 1 ? `${negativeMonthsText(months)} (בחודש הקשה ביותר, חודש ${cushion.month}, חסרים ${missing})` : `בחודש ${cushion.month} של השנה הראשונה (חסרים ${missing})`;
    return `עם זאת, בתזרים החודשי צפויה יתרה שלילית ${when}. דרך הגישור מפורטת בפרק 9.`;
  }

  // ---------- גל ב', סעיפים 6–15: לוגיקה ותוכן ----------

  /**
   * סעיף 6 – התקציר הציג רק את שנה 2, וזה נקרא כהצגת הצד היפה.
   * המשפט מציג את שתי השנים: שנה 1 (עם ההתחלה ההדרגתית) ואחריה שנה 2.
   */
  function outlookText(years) {
    const list = years || [];
    const y1 = list[0];
    const y2 = list[1];
    if (!y1) return '';
    const first = `לפי התחזית, בשנה הראשונה המחזור צפוי להסתכם ב-${ils(y1.revenue)}, ובשורה התפעולית צפוי ${profitText(y1.ebitda)}`;
    if (!y2) return `${first}.`;
    return `${first}. בשנה השנייה, בקצב פעילות מלא, המחזור צפוי להגיע ל-${ils(y2.revenue)} ובשורה התפעולית ${profitText(y2.ebitda)}.`;
  }

  /**
   * סעיף 7 – "רווח תפעולי (לפני פחת)" הופיע בלי שורת פחת. השורה נקראת מעכשיו
   * "רווח תפעולי", והערה אחת מסבירה שהפחת לא נכלל ומה המשמעות.
   */
  const DEPRECIATION_NOTE = 'התחזית אינה כוללת הוצאות פחת. הפחת הוא הוצאה חשבונאית שאינה יציאת מזומן, והוא נקבע בפועל לפי סוג הנכסים ותקופת הפחת שרואה החשבון קובע. אילו נרשם פחת, הרווח לפני מס והמס המשוער היו נמוכים יותר – כלומר הערכת המס שבטבלה שמרנית. התזרים שבפרק 7 אינו מושפע מכך.';

  /**
   * סעיף 8 – משיכת הבעלים מופיעה בתזרים ובחישוב יכולת ההחזר אך לא ברו"ה.
   * זה נכון אצל עוסק מורשה, וצריך הערת שוליים שמסבירה את זה לקורא בבנק.
   */
  function ownerDrawNote(entity, annualDraw) {
    const d = Math.max(0, Number(annualDraw) || 0);
    if (!(d > 0)) return '';
    const base = `משיכת הבעלים (${ils(d)} בשנה) אינה מופיעה בדוח רווח והפסד, אלא בתזרים המזומנים שבפרק 7 ובחישוב יכולת ההחזר שבפרק 9.`;
    if (entity === 'company') {
      return `${base} בחברה בע"מ שכר הבעלים נרשם בדרך כלל כהוצאת שכר בדוח, ומשפיע גם על המס; כאן הוא מוצג כמשיכה בלבד, ולכן הרווח הנקי שבטבלה גבוה מהסכום שנשאר בעסק בפועל. יש לאמת את אופן הרישום מול רואה החשבון.`;
    }
    return `${base} אצל עוסק מורשה ושותפות זו ההצגה המקובלת: המשיכה אינה הוצאה מוכרת אלא חלוקה של הרווח לבעלים, והמס מחושב על הרווח לפני המשיכה.`;
  }

  /**
   * סעיף 10 – במקום הערה מילולית על הפרש שלא פורט, טבלת התאמה פשוטה:
   * מקורות המימון מול עלויות ההקמה ועוד ההון החוזר.
   */
  function reconciliation(plan) {
    const loan = Math.max(0, Number(plan && plan.loan && plan.loan.amount) || 0);
    const equity = equityInflow(plan);
    const items = planUses(plan);
    const capex = sumAmounts(items.filter((u) => u.type !== 'working'));
    const working = sumAmounts(items.filter((u) => u.type === 'working'));
    const sources = [
      { label: 'הלוואה מהקרן', amount: loan },
      { label: 'הון עצמי של הבעלים', amount: equity },
    ];
    const uses = [
      { label: 'עלויות הקמה חד-פעמיות', amount: capex },
      { label: 'הון חוזר לתחילת הפעילות', amount: working },
    ];
    const sourcesSum = sources.reduce((s, r) => s + r.amount, 0);
    const usesSum = uses.reduce((s, r) => s + r.amount, 0);
    return { sources, uses, sourcesTotal: sourcesSum, usesTotal: usesSum, diff: sourcesSum - usesSum, balanced: Math.abs(sourcesSum - usesSum) <= 1 };
  }

  /**
   * סעיף 11 – טקסט חופשי שסותר את המסלול שנבחר.
   * עסק בהקמה שכותב "הרחבת ההיצע" מתאר עסק שכבר פועל, ולהפך. האזהרה מוצגת
   * בממשק בשלב ההזנה (לא במסמך), ואינה חוסמת – המשתמש מחליט.
   */
  const CONFLICT_FIELDS = [
    { key: 'business.description', label: 'תיאור העסק' },
    { key: 'loan.purpose', label: 'מה תעשו עם הכסף' },
    { key: 'owner.experience', label: 'הניסיון שלכם בתחום' },
    { key: 'market.customers', label: 'מי הלקוחות שלכם' },
    { key: 'market.advantage', label: 'למה לקוחות בוחרים בכם' },
  ];
  const NEW_CONFLICT_PATTERNS = [
    /[להבומ]?הרחב(?:ת|ה|ות)|להרחיב|נרחיב/,
    /הגדלת ה(מחזור|ייצור|הכנסות|פעילות)|להגדיל את ה(מחזור|ייצור|פעילות)/,
    /הלקוחות הקיימים|לקוחות קיימים|הסניף הקיים|הקיים שלנו/,
    /בשנה שעברה|בשנים האחרונות|מאז שפתחנו|מחזור נוכחי|המחזור הנוכחי|עד היום מכרנו/,
  ];
  const EXISTING_CONFLICT_PATTERNS = [
    /טרם נפתח|עוד לא נפתח|לפני הפתיחה|עסק חדש שאנחנו|כשנפתח|עם הפתיחה/,
  ];
  function matchIn(text, patterns) {
    const s = String(text || '');
    for (const re of patterns) {
      const m = s.match(re);
      if (m) return m[0];
    }
    return '';
  }
  function conflictWarnings(plan) {
    const p = plan || {};
    const isNew = isNewBusiness(p);
    const patterns = isNew ? NEW_CONFLICT_PATTERNS : EXISTING_CONFLICT_PATTERNS;
    const out = [];
    CONFLICT_FIELDS.forEach((f) => {
      const value = f.key.split('.').reduce((a, k) => (a == null ? a : a[k]), p);
      const phrase = matchIn(value, patterns);
      if (!phrase) return;
      out.push({
        key: f.key,
        label: f.label,
        phrase,
        text: isNew
          ? `בשדה "${f.label}" כתוב "${phrase}" – ניסוח שמתאים לעסק שכבר פועל, בעוד שסימנתם שהעסק עוד לא נפתח. גוף מממן שקורא את שני הדברים יחד רואה סתירה. כדאי לנסח מחדש, או לחזור ולבחור "העסק כבר פועל".`
          : `בשדה "${f.label}" כתוב "${phrase}" – ניסוח שמתאים לעסק שעוד לא נפתח, בעוד שסימנתם שהעסק כבר פועל. כדאי לנסח מחדש, או לחזור ולבחור "עסק חדש שעוד לא נפתח".`,
      });
    });
    return out;
  }

  /**
   * סעיף 12 – אזהרות סבירות על ההנחות. הספים קבועים כאן, במקום אחד, ולא מפוזרים
   * בקוד: רווח תפעולי גבוה, הגעה מהירה מדי לקצב מלא, ומחזור גבוה לעובד.
   * האזהרות מוצגות בממשק בלבד, ואינן חוסמות.
   */
  const ASSUMPTIONS = { ebitdaPct: 35, rampMonths: 3, salesPerWorker: 600000 };

  /** שיעור הרווח התפעולי בקצב מלא (בלי השפעת ההתחלה ההדרגתית ובלי מימון ומס) */
  function operatingMarginPct(f) {
    const sales = Math.max(0, Number(f && f.annualSales) || 0);
    if (!(sales > 0)) return null;
    const cogs = sales * (Number(f.cogsPct) || 0) / 100;
    const fixed = (Number(f.monthlyFixed) || 0) * 12;
    const salaries = (Number(f.monthlySalaries) || 0) * 12;
    return ((sales - cogs - fixed - salaries) / sales) * 100;
  }

  function assumptionWarnings(plan) {
    const p = plan || {};
    const f = p.forecast || {};
    const b = p.business || {};
    const isNew = isNewBusiness(p);
    const out = [];
    const margin = operatingMarginPct(f);
    if (margin != null && margin > ASSUMPTIONS.ebitdaPct) {
      out.push({
        code: 'margin',
        value: margin,
        text: `לפי ההנחות שהזנתם, מכל 100 ₪ מכירה נשארים כ-${num(margin)} ₪ רווח תפעולי (מעל ${num(ASSUMPTIONS.ebitdaPct)} ₪, שזה גבוה לרוב העסקים). כדאי לבדוק שוב את עלות הסחורה, את ההוצאות הקבועות ואת השכר – גוף מממן שיראה שיעור כזה יבקש הסבר.`,
      });
    }
    if (isNew && (Number(f.rampMonths) || 0) < ASSUMPTIONS.rampMonths) {
      out.push({
        code: 'ramp',
        value: Number(f.rampMonths) || 0,
        text: `הנחתם שהעסק יגיע לקצב המכירות המלא תוך ${(Number(f.rampMonths) || 0) === 0 ? 'מיד עם הפתיחה' : `${num(f.rampMonths)} חודשים`}. בעסק חדש מקובל להניח לפחות ${num(ASSUMPTIONS.rampMonths)} חודשים עד קצב מלא. הנחה מהירה מדי מייפה את התזרים בחודשים הראשונים, שהם בדיוק החודשים הקשים.`,
      });
    }
    const workers = Math.max(0, Number(b.employees) || 0) + 1; // הבעלים נספר גם הוא
    const perWorker = (Number(f.annualSales) || 0) / workers;
    if (perWorker > ASSUMPTIONS.salesPerWorker) {
      out.push({
        code: 'perWorker',
        value: perWorker,
        text: `המחזור המתוכנן הוא כ-${ils(perWorker)} לשנה לכל עובד (כולל אתכם), מעל ${ils(ASSUMPTIONS.salesPerWorker)} שנחשבים גבוהים. אם זה נכון – כדאי להסביר במסמך איך מגיעים לזה; אם לא – כדאי לבדוק שוב את תחזית המכירות או את מספר העובדים.`,
      });
    }
    return out;
  }

  // ---------- שיפור 4, ספרינט 1: בדיקות עקביות לפני הפקה (א1–א7) ----------

  /**
   * כל הספים ורשימות מילות המפתח במקום אחד. מילות המפתח לקוחות מילה במילה ממקור
   * השיפור (docs/IMPROVEMENT-4-SOURCE-v2.md); הצורות הנוספות (רבים, סמיכות) רק מאפשרות
   * לזהות את אותה מילה בנטייה אחרת ("מקררים", "מכונת").
   */
  const CONSISTENCY = {
    salesJumpPct: 30,          // א3: צמיחה מעל זה לעומת השנה שעברה דורשת הסבר
    minFixedForPremises: 3000, // א2: מטרה של שכירות/מקום עם הוצאות קבועות נמוכות מזה
    minWords: 5,               // א5: פחות מזה בשדה טקסט חובה
    cogsWarnPct: 85,           // א7: עלות מכר מעל זה – אזהרה
    cogsBlockPct: 100,         // א7: עלות מכר מעל זה – חסימה
  };
  // א2: מילים במטרת ההלוואה
  const PURPOSE_STAFF_WORDS = ['עובדים', 'העסקה', 'גיוס'];
  const PURPOSE_PREMISES_WORDS = ['שכירות', 'מתחם', 'מקום'];
  // א4: מילות המפתח לסיווג פריט (המילה מהמקור, ואחריה נטיות שלה)
  const USE_KEYWORDS = {
    capex: ['מחשב', 'מחשבים', 'תנור', 'תנורים', 'מקרר', 'מקררים', 'ציוד', 'מכונה', 'מכונות', 'מכונת',
      'ריהוט', 'רהיטים', 'רכב', 'רכבים', 'שיפוץ', 'שיפוצים', 'שיפוצי'],
    working: ['שכר', 'משווק', 'משווקים', 'משווקת', 'שיווק', 'פרסום', 'פרסומים', 'מלאי', 'סחורה', 'סחורות',
      'חומרי גלם', 'חומר גלם'],
  };
  const USE_CATEGORY_LABEL = { capex: 'השקעה', working: 'הון חוזר (הוצאות שוטפות)' };
  // א5: שדות הטקסט החובה שהבנק קורא
  const TEXT_FIELDS = [
    { key: 'business.description', label: 'תיאור העסק' },
    { key: 'market.customers', label: 'מי הלקוחות שלכם' },
    { key: 'market.advantage', label: 'למה לקוחות בוחרים בכם' },
    { key: 'owner.experience', label: 'הניסיון שלכם בתחום' },
  ];
  // א3: שם השדה של ההסבר לקפיצת המחזור (נוסף בממשק ומוצג במסמך בפרק התחזית)
  const GROWTH_REASON_FIELD = 'forecast.growthReason';

  const getPath = (obj, key) => key.split('.').reduce((a, k) => (a == null ? a : a[k]), obj);
  const HEB_PREFIX = 'ובכלמשה';

  /**
   * האם המילה (או הצירוף) מופיעה בטקסט כמילה שלמה, עם אותיות שימוש לפניה
   * ("לעובדים", "והמלאי") – ולא כחלק ממילה אחרת ("מקומי" אינה "מקום", "הרכבה" אינה "רכב").
   */
  function hasWord(text, word) {
    const s = String(text == null ? '' : text);
    if (!s || !word) return false;
    const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    const re = new RegExp(`(^|[^\\u05D0-\\u05EA])[${HEB_PREFIX}]{0,3}${esc}(?![\\u05D0-\\u05EA])`);
    return re.test(s);
  }
  const firstWord = (text, words) => words.find((w) => hasWord(text, w)) || '';

  /** מספר המילים בטקסט חופשי (מילה = רצף שיש בו אות או ספרה) */
  function wordCount(text) {
    return String(text == null ? '' : text).split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
  }

  /**
   * א4 – הצעת סיווג לפריט בפירוט השימושים, לפי מילות מפתח בשם הפריט.
   * מחזיר 'capex' (השקעה), 'working' (הון חוזר / שוטף) או null – כשאין מילת מפתח,
   * או כשיש מילים משני הסוגים ("ציוד ומלאי") ואי אפשר להכריע.
   */
  function suggestUseCategory(label) {
    const capex = USE_KEYWORDS.capex.some((w) => hasWord(label, w));
    const working = USE_KEYWORDS.working.some((w) => hasWord(label, w));
    if (capex === working) return null;
    return capex ? 'capex' : 'working';
  }

  /** א3 – הקפיצה במחזור לעומת השנה שעברה. null כשאין נתון של שנה שעברה (עסק בהקמה) */
  function salesJump(plan) {
    const p = plan || {};
    if (isNewBusiness(p)) return null;
    const from = Number(p.history && p.history.lastYearSales) || 0;
    const to = Number(p.forecast && p.forecast.annualSales) || 0;
    if (!(from > 0) || !(to > 0)) return null;
    const pct = (to / from - 1) * 100;
    const reason = String(getPath(p, GROWTH_REASON_FIELD) || '').trim();
    // סובלנות זעירה: 130,000/100,000 − 1 בנקודה צפה הוא 0.30000000000000004, ו-30% בדיוק אינו "מעל 30%"
    return { from, to, pct, reason, needsReason: pct > CONSISTENCY.salesJumpPct + 1e-9 };
  }

  /**
   * שיפור 4, א' – בדיקות עקביות בין הנתונים לפני הפקת המסמך.
   * מחזיר [{ code, severity: 'block'|'warn', field, message }], בעברית פשוטה.
   * 'block' – נתון שאי אפשר להפיק ממנו מסמך אמין; 'warn' – סתירה שהמשתמש מחליט עליה.
   * לא חוזר על אזהרות שכבר קיימות ב-conflictWarnings וב-assumptionWarnings
   * (רווחיות מעל 35%, קצב הגעה, מחזור לעובד, ניסוח של עסק חדש/קיים).
   *
   * codes: trackVsYears (א1), purposeStaff, purposePremises (א2), salesJump (א3),
   * useCategory (א4), shortText (א5), yearsMissing, employeesMissing (א6),
   * cogsOver100, cogsHigh (א7).
   */
  function consistencyChecks(plan) {
    const p = plan || {};
    const b = p.business || {};
    const f = p.forecast || {};
    const loan = p.loan || {};
    const isNew = isNewBusiness(p);
    const out = [];
    const add = (code, severity, field, message) => out.push({ code, severity, field, message });
    const blank = (v) => v == null || String(v).trim() === '';

    // א6 – ותק ועובדים בעסק שכבר פועל: שדה ריק או 0 שנים הם כמעט תמיד דילוג
    if (!isNew) {
      if (blank(b.years) || !(Number(b.years) > 0)) {
        add('yearsMissing', 'block', 'business.years',
          'כתבו כמה שנים העסק פועל. בעסק שכבר פועל אי אפשר להשאיר את השדה ריק או 0 – זה אחד הנתונים הראשונים שהבנק בודק. אם העסק נפתח לפני פחות משנה, כתבו את החלק היחסי (למשל 0.5 לחצי שנה).');
      }
      if (blank(b.employees)) {
        add('employeesMissing', 'block', 'business.employees',
          'כתבו כמה עובדים יש בעסק (לא כולל אתכם). אם אין עובדים, כתבו 0.');
      }
    }

    // א1 – עסק שפועל שנה ומעלה ובחר במסלול לעסקים בהקמה
    if (!isNew && Number(b.years) >= 1 && loan.track === 'startup') {
      add('trackVsYears', 'warn', 'loan.track',
        `בחרתם ב"${TRACKS.startup}", אבל העסק פועל ${yearsText(b.years)}. המסלול הזה מיועד לעסקים שפועלים פחות משנה. עסק שפועל שנה ומעלה מגיש בדרך כלל ב"${TRACKS.general}".`);
    }

    // א2 – מטרת ההלוואה מול התחזית
    const staffWord = firstWord(loan.purpose, PURPOSE_STAFF_WORDS);
    if (staffWord && !(Number(f.monthlySalaries) > 0)) {
      add('purposeStaff', 'warn', 'forecast.monthlySalaries',
        `במטרת ההלוואה כתוב "${staffWord}", אבל בהוצאות השכר החודשי הוא 0. הבנק יראה שהכסף מיועד לעובדים שלא מופיעים בתחזית. כדאי להוסיף את עלות השכר, או לתקן את מטרת ההלוואה.`);
    }
    const premisesWord = firstWord(loan.purpose, PURPOSE_PREMISES_WORDS);
    if (premisesWord && (Number(f.monthlyFixed) || 0) < CONSISTENCY.minFixedForPremises) {
      add('purposePremises', 'warn', 'forecast.monthlyFixed',
        `במטרת ההלוואה כתוב "${premisesWord}", אבל ההוצאות הקבועות בחודש הן רק ${ils(Number(f.monthlyFixed) || 0)}. מקום לעסק עולה בדרך כלל יותר, והבנק יראה סתירה. כדאי לבדוק שהשכירות והוצאות המקום נכללו בהוצאות הקבועות.`);
    }

    // א3 – קפיצה במחזור לעומת השנה שעברה, בלי הסבר
    const jump = salesJump(p);
    if (jump && jump.needsReason && !jump.reason) {
      add('salesJump', 'warn', GROWTH_REASON_FIELD,
        `המחזור בתחזית (${ils(jump.to)}) גבוה ב-${num(jump.pct)}% מהמחזור בשנה שעברה (${ils(jump.from)}). זו קפיצה גדולה, והבנק ישאל מאיפה היא תגיע. כתבו בכמה משפטים מה ישתנה (למשל ציוד חדש, לקוח גדול, סניף נוסף). ההסבר יופיע במסמך בפרק התחזית.`);
    }

    // א4 – סיווג פריטים בפירוט השימושים (רק כשהמשתמש בחר סיווג בעצמו, כלומר לא בעסק
    // בהקמה שבו השימושים נגזרים מעלויות ההקמה)
    if (!setupDrivesUses(p)) {
      (loan.uses || []).forEach((u, i) => {
        if (!hasContent(u) || (u.type !== 'capex' && u.type !== 'working')) return;
        const suggested = suggestUseCategory(u.item);
        if (!suggested || suggested === u.type) return;
        const name = tidyLabel(u.item);
        add('useCategory', 'warn', `loan.uses.${i}.type`,
          `הפריט "${name}"${Number(u.amount) > 0 ? ` (${ils(u.amount)})` : ''} סומן כ${USE_CATEGORY_LABEL[u.type]}, אבל הוא נשמע כמו ${USE_CATEGORY_LABEL[suggested]}. ${suggested === 'working'
            ? 'השקעה היא קנייה של משהו שנשאר בעסק, כמו ציוד או שיפוץ; שכר, שיווק ומלאי הם הוצאות שוטפות.'
            : 'ציוד, ריהוט, רכב ושיפוץ הם השקעה – משהו שנקנה פעם אחת ונשאר בעסק.'} כדאי לבדוק את הסיווג.`);
      });
    }

    // א5 – טקסט חופשי קצר מדי בשדות שהבנק קורא
    TEXT_FIELDS.forEach((fl) => {
      const value = getPath(p, fl.key);
      if (blank(value)) return; // שדה ריק נתפס כבר בבדיקת שדות החובה באשף
      const n = wordCount(value);
      if (n < CONSISTENCY.minWords) {
        add('shortText', 'warn', fl.key,
          `בשדה "${fl.label}" ${n === 1 ? 'כתובה מילה אחת בלבד' : `כתובות ${num(n)} מילים בלבד`}. הבנק יקרא את זה. כדאי להרחיב.`);
      }
    });

    // א7 – עלות מכר לא הגיונית
    const cogs = Number(f.cogsPct) || 0;
    if (cogs > CONSISTENCY.cogsBlockPct) {
      add('cogsOver100', 'block', 'forecast.cogsPct',
        `הזנתם שמכל 100 ₪ מכירה הולכים ${num(cogs)} ₪ על סחורה וחומרי גלם (עלות מכר) – יותר ממה שהמכירה מכניסה. כך כל מכירה מפסידה כסף. כנראה שזו טעות הקלדה; כדאי לבדוק את המספר.`);
    } else if (cogs > CONSISTENCY.cogsWarnPct) {
      add('cogsHigh', 'warn', 'forecast.cogsPct',
        `הזנתם שמכל 100 ₪ מכירה הולכים ${num(cogs)} ₪ על סחורה וחומרי גלם (עלות מכר). נשארים ${100 - cogs === 0 ? '0 ₪' : `רק ${num(100 - cogs, Number.isInteger(100 - cogs) ? 0 : 1)} ₪`} לכל שאר ההוצאות ולהחזר ההלוואה, וזה נמוך מאוד. כדאי לוודא שהמספר נכון.`);
    }
    return out;
  }

  /**
   * שיפור 4, ב1 – "רזרבה שלא נוצלה", בעסק בהקמה בלבד (ראו workingCapitalOutflow).
   * ההון החוזר שהכלי גזר נשאר בחשבון; המשפט אומר במפורש כמה מהיתרה הנמוכה ביותר הוא
   * עדיין הכסף הזה, כדי שלא ייקרא כרווח מהפעילות. בגוף שלישי – מיועד למסמך.
   * מחזיר '' כשאין הון חוזר נגזר, או שהוא כבר נוצל כולו בנקודה הנמוכה.
   */
  function reserveNote(plan, res) {
    if (!setupDrivesUses(plan)) return '';
    const wc = workingCapitalTotal(plan);
    const cash = (res && res.cash) || computePlan(plan).cash;
    const min = minClosingBalance(cash);
    const unused = unusedWorkingCapital(wc, cash, 0);
    if (!(unused > 0.5) || min == null) return '';
    if (unused >= min - 0.5) return `כל היתרה הנמוכה ביותר בתזרים (${ils(min)}) היא הון חוזר שנכנס עם מקורות המימון ועדיין לא נוצל – רזרבה שלא נוצלה, ולא כסף שהעסק הרוויח מהפעילות.`;
    return `מתוך היתרה הנמוכה ביותר בתזרים (${ils(min)}), סכום של ${ils(unused)} הוא הון חוזר שנכנס עם מקורות המימון ועדיין לא נוצל – רזרבה שלא נוצלה, ולא כסף שהעסק הרוויח מהפעילות.`;
  }

  /**
   * סעיף 14 – מחזור שנבנה מלמטה: לקוחות ביום × קנייה ממוצעת × ימי פעילות בחודש.
   * מחזיר גם את החישוב עצמו, כדי שאפשר יהיה להציג אותו במסמך ולא רק את התוצאה.
   */
  function bottomUpSales(f) {
    const customersPerDay = Math.max(0, Number(f && f.customersPerDay) || 0);
    const avgTicket = Math.max(0, Number(f && f.avgTicket) || 0);
    const daysPerMonth = Math.max(0, Number(f && f.daysPerMonth) || 0);
    const monthly = customersPerDay * avgTicket * daysPerMonth;
    return { customersPerDay, avgTicket, daysPerMonth, monthly, annual: Math.round(monthly * 12), ok: customersPerDay > 0 && avgTicket > 0 && daysPerMonth > 0 };
  }
  function bottomUpText(f) {
    const b = bottomUpSales(f);
    if (!b.ok) return '';
    return `המחזור נבנה מלמטה: ${num(b.customersPerDay)} לקוחות ביום × ${ils(b.avgTicket)} קנייה ממוצעת × ${num(b.daysPerMonth)} ימי פעילות בחודש = ${ils(b.monthly)} בחודש, ${ils(b.annual)} בשנה.`;
  }
  /** האם התוכנית בנויה על חישוב מלמטה ולא על סכום שנתי שהוזן ישירות */
  function usesBottomUp(plan) {
    const f = (plan && plan.forecast) || {};
    return f.salesModel === 'bottomUp' && bottomUpSales(f).ok;
  }

  /**
   * סעיף 15 – פרקי הבעלים והשוק היו דלים. מהשאלות המונחות בממשק (ניסיון, השכלה,
   * מתחרים, תמחור) נבנים כאן פרקים מלאים. הטקסט חוזר מפוצל (כותרת/פתיח/גוף)
   * כדי שהמסמך יוכל לברוח מהצגה של טקסט משתמש בלי escaping.
   */
  const clean = (s) => String(s == null ? '' : s).trim();
  function ownerParagraphs(plan) {
    const p = plan || {};
    const o = p.owner || {};
    const b = p.business || {};
    const isNew = isNewBusiness(p);
    // שם הבעלים ושם העסק הם כותרות ולא משפטים: סעיף 22 מנקה פיסוק מיותר בסופם,
    // כדי שלא יתקבל "בידי ישראל ישראלי.." בתוך המשפט
    const name = tidyLabel(o.name);
    const out = [];
    const bizName = tidyLabel(b.name) || 'העסק';
    if (name) out.push({ lead: '', text: `הבעלות והניהול של ${bizName} בידי ${name}.` });
    if (clean(o.experience)) out.push({ lead: 'ניסיון מקצועי:', text: clean(o.experience) });
    if (clean(o.education)) out.push({ lead: 'השכלה והכשרה:', text: clean(o.education) });
    if (isNew) {
      out.push({ lead: '', text: 'העסק טרם נפתח, ולכן אין לו דוחות כספיים היסטוריים. הניסיון וההכשרה של הבעלים הם הבסיס המרכזי להערכת היכולת להפעיל את העסק ולעמוד בהחזרים.' });
    }
    return out;
  }
  function marketSections(plan) {
    const m = (plan && plan.market) || {};
    const out = [];
    if (clean(m.customers)) out.push({ heading: 'לקוחות', texts: [clean(m.customers)] });
    if (clean(m.competitors)) out.push({ heading: 'מתחרים', texts: [clean(m.competitors)] });
    if (clean(m.pricing)) out.push({ heading: 'תמחור', texts: [clean(m.pricing)] });
    if (clean(m.advantage)) out.push({ heading: 'היתרון התחרותי', texts: [clean(m.advantage)] });
    return out;
  }

  // ---------- גל ב', סעיפים 16–21: הצגה ----------

  /**
   * סעיף 21 – שכבת הטקסט ב-PDF. בעברית, מספר או אחוז שיושב בתוך משפט גורר אליו את
   * הפיסוק שלידו, וכך בהעתק-הדבק מהקובץ מתקבל "ל5- שנים" או "ביוני .2027".
   * הפתרון התקני: לעטוף כל מספר בבידוד כיווניות (LRI…PDI, U+2066/U+2069). התווים
   * האלה אינם נראים, הם נשמרים בהעתקה ובקורא מסך, והם מונעים מהפיסוק "להידבק" למספר.
   * הפונקציה אידמפוטנטית: בידודים קיימים מוסרים לפני העטיפה מחדש.
   * חשוב: מפעילים אותה על טקסט בלבד, לפני ה-escaping ל-HTML (אחרת היא תיכנס לתוך
   * ישויות כמו &#39;), ולא על מחרוזת שכבר מכילה תגיות.
   */
  const LRI = '⁦';
  const PDI = '⁩';
  const ISOLATES = /[⁦⁧⁨⁩]/g;
  // מספר עם מפרידי אלפים ונקודה עשרונית, ואחריו אחוז אם יש. תאריך (24.9.2027) נתפס כיחידה אחת.
  const NUMBER_RUN = /\d+(?:[.,:/]\d+)*(?:\s?%)?/g;
  // מספר שלילי: המינוס נכנס לתוך הבידוד רק כשהוא באמת סימן של המספר (בתחילת מקטע,
  // אחרי רווח, סוגר או סימן כיווניות) – ולא מקף עברי כמו ב"ל-5 שנים".
  const SIGNED_RUN = /(^|[\s(‎‏])([-−])(\d+(?:[.,:/]\d+)*(?:\s?%)?)/g;
  const WRAPPED = /(⁦[^⁩]*⁩)/;
  function ltr(s) {
    const t = String(s == null ? '' : s).replace(ISOLATES, '');
    return t ? LRI + t + PDI : '';
  }
  function bidiText(s) {
    const clean = String(s == null ? '' : s).replace(ISOLATES, '');
    const signed = clean.replace(SIGNED_RUN, (m, pre, sign, body) => pre + LRI + sign + body + PDI);
    // שאר המספרים נעטפים גם הם, בלי להיכנס שוב לבידודים שכבר נוצרו
    return signed.split(WRAPPED).map((part, i) => (i % 2 ? part : part.replace(NUMBER_RUN, (m) => LRI + m + PDI))).join('');
  }
  /** טקסט נקי מבידודים – לבדיקות ולהשוואות */
  function stripBidi(s) { return String(s == null ? '' : s).replace(ISOLATES, ''); }

  /**
   * סעיף 20 – יחידות אחידות: הסימן ₪ מופיע בכותרת הטבלה בלבד, והתאים מציגים מספר נקי.
   * הכיתוב הזה הוא הכותרת שמופיעה מעל כל טבלת כספים במסמך.
   */
  const MONEY_CAPTION = 'כל הסכומים בטבלה בשקלים (₪), מעוגלים לשקל';

  /**
   * סעיף 16 – חודש האיזון: החודש הראשון שבו ההכנסות מכסות את ההוצאות השוטפות
   * (עלות המכר, הוצאות קבועות ושכר). זה איזון תפעולי, בלי ההשקעה החד-פעמית ובלי
   * החזר ההלוואה – ולכן הוא נמדד על שורות התזרים ולא על היתרה בבנק.
   * מחזיר null כשהאיזון לא מושג בשנה הראשונה.
   */
  function breakEvenMonth(rows) {
    const hit = (rows || []).find((r) => (r.revenue - r.cogs - r.fixed - r.salaries) >= 0);
    return hit ? hit.month : null;
  }

  /**
   * סעיף 16 – כרטיסי המדדים בראש הדוח: חמישה מספרים שגוף מממן מחפש קודם כול.
   * כל כרטיס מחזיר גם הסבר בשפה פשוטה (note), כדי שלא יופיע מונח מקצועי בלי פירוש,
   * וגם דירוג (level) כדי שהתצוגה תצבע אותו: ok / warn / risk / plain.
   */
  function headlineMetrics(plan, result) {
    const p = plan || {};
    const res = result || computePlan(p);
    const loan = Math.max(0, Number(p.loan && p.loan.amount) || 0);
    const equity = equityInflow(p);
    const share = equityShare(equity, loan);
    const cushion = res.cushion || { min: 0, month: 1, level: 'ok' };
    const be = breakEvenMonth(res.cash);
    const rating = res.rating || dscrLevel(res.minDscr);
    const years = Number(p.loan && p.loan.years) || 0;
    const cards = [];
    cards.push({
      key: 'loan', label: 'סכום מבוקש', value: ils(loan), level: 'plain',
      note: `הלוואה ל-${years} שנים, בהחזר חודשי של ${ils(res.monthlyPayment)}.`,
    });
    // בעסק פועל לא נשאלת שאלת ההון העצמי (הוא כבר בדוחות הכספיים), ולכן אין להציג
    // "0%" ואזהרה על משהו שלא נשאל – הכרטיס מסביר מה כן מוצג.
    const asksEquity = isNewBusiness(p);
    cards.push(asksEquity && share
      ? {
        key: 'equity', label: 'חלק ההון העצמי', value: `${num(share.pct)}%`,
        level: share.below ? 'warn' : 'ok',
        note: `${ils(equity)} מתוך סך השקעה של ${ils(share.total)}. גופים מממנים נוהגים לצפות לכ-${num(AFFORD.minEquityPct)}% ומעלה.`,
      }
      : {
        key: 'equity', label: 'חלק ההון העצמי', value: '—', level: 'plain',
        note: asksEquity
          ? 'התוכנית אינה כוללת הון עצמי של הבעלים; מלוא ההשקעה ממומנת בהלוואה.'
          : 'העסק כבר פועל, וההון העצמי שלו מופיע בדוחות הכספיים. ההשקעה החדשה שבתוכנית ממומנת בהלוואה.',
      });
    cards.push({
      key: 'dscr', label: 'יחס כיסוי חוב מינימלי',
      value: Number.isFinite(res.minDscr) ? num(res.minDscr, 2) : '—',
      level: rating.level,
      note: 'כמה פעמים המזומן הפנוי מכסה את החזרי ההלוואה בשנה הקשה ביותר. 1.25 ומעלה נחשב טוב.',
    });
    cards.push({
      key: 'cash', label: 'יתרת המזומן הנמוכה ביותר', value: ils(cushion.min), level: cushion.level,
      note: `זו היתרה בחשבון בסוף חודש ${cushion.month}, החודש הנמוך ביותר בשנה הראשונה.`,
    });
    // שיפור 4, ג3: "חודש האיזון" רלוונטי רק לעסק בהקמה. בעסק שפועל שנים הוא תמיד
    // "חודש 1" ואין לו משמעות, ולכן הכרטיס לא נכלל בכלל.
    if (!asksEquity) return cards;
    cards.push({
      key: 'breakeven', label: 'חודש האיזון',
      value: be ? `חודש ${num(be)}` : 'לא בשנה הראשונה',
      level: be ? (be <= 6 ? 'ok' : 'warn') : 'risk',
      note: be
        ? 'החודש הראשון שבו ההכנסות מכסות את ההוצאות השוטפות (סחורה, הוצאות קבועות ושכר).'
        : 'בשנה הראשונה ההכנסות עדיין אינן מכסות את ההוצאות השוטפות בשום חודש.',
    });
    return cards;
  }

  // ---------- סעיף 17: גרפים (גאומטריה טהורה, בלי ספריית צד שלישי) ----------

  // padRight הוא המקום לסימוני הציר, שבעברית יושבים בצד ימין. הוא רחב מספיק
  // למספר כמו "1,890,000" בגופן של התצוגה, כדי שהכיתוב לא ייחתך.
  const CHART = { w: 720, h: 250, padTop: 16, padBottom: 34, padLeft: 12, padRight: 96 };
  const r2 = (n) => Math.round(n * 100) / 100;

  /** צעד "עגול" לסימוני הציר: 1, 2, 5 או 10 בכפולות של עשר */
  function niceStep(range, count) {
    const raw = Math.abs(range) / Math.max(1, count || 4);
    if (!(raw > 0)) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * mag;
  }

  /** סקאלה שמכילה תמיד את האפס, כדי שגרף עם ערכים שליליים יציג קו אפס אמיתי */
  function niceScale(values, count) {
    const list = (values || []).map((v) => Number(v) || 0);
    let min = Math.min(0, ...list);
    let max = Math.max(0, ...list);
    if (min === max) max = min + 1;
    const step = niceStep(max - min, count || 4);
    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = min; v <= max + step / 2; v += step) ticks.push(r2(v));
    return { min, max, step, ticks };
  }

  function chartBox(opts) {
    const o = Object.assign({}, CHART, opts || {});
    return {
      o,
      left: o.padLeft,
      right: o.w - o.padRight,   // בעברית סימוני הציר בצד ימין, ולכן השוליים הרחבים שם
      top: o.padTop,
      bottom: o.h - o.padBottom,
    };
  }

  /**
   * גרף קו: סדרה של {label, value}. הציר רץ מימין לשמאל (נקודה ראשונה בימין),
   * כמו שקוראים עברית. מחזיר גאומטריה בלבד – ה-SVG עצמו נבנה בשכבת התצוגה.
   */
  function lineChartData(series, opts) {
    const list = (series || []).map((p) => ({ label: String(p.label), value: Number(p.value) || 0 }));
    const box = chartBox(opts);
    const scale = niceScale(list.map((p) => p.value));
    const span = scale.max - scale.min;
    const y = (v) => r2(box.bottom - ((v - scale.min) / span) * (box.bottom - box.top));
    const n = list.length;
    const x = (i) => r2(n <= 1 ? (box.left + box.right) / 2 : box.right - (i * (box.right - box.left)) / (n - 1));
    const points = list.map((p, i) => ({ label: p.label, value: p.value, x: x(i), y: y(p.value), negative: p.value < 0 }));
    return {
      w: box.o.w, h: box.o.h, min: scale.min, max: scale.max, step: scale.step,
      points,
      path: points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' '),
      zeroY: y(0),
      ticks: scale.ticks.map((v) => ({ value: v, y: y(v), label: num(v) })),
      axis: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
    };
  }

  /**
   * גרף עמודות מקובצות: groups = [{label, bars:[{key,label,value}]}].
   * גם כאן הקבוצה הראשונה בימין. עמודה שלילית יורדת מתחת לקו האפס.
   */
  function barChartData(groups, opts) {
    const list = (groups || []).map((g) => ({ label: String(g.label), bars: (g.bars || []).map((b) => ({ key: b.key, label: b.label, value: Number(b.value) || 0 })) }));
    const box = chartBox(opts);
    const all = list.reduce((acc, g) => acc.concat(g.bars.map((b) => b.value)), []);
    const scale = niceScale(all);
    const span = scale.max - scale.min;
    const y = (v) => r2(box.bottom - ((v - scale.min) / span) * (box.bottom - box.top));
    const zeroY = y(0);
    const gw = (box.right - box.left) / Math.max(1, list.length);
    const maxBars = list.reduce((m, g) => Math.max(m, g.bars.length), 1);
    const bw = r2((gw * 0.72) / maxBars);
    const out = list.map((g, gi) => {
      const gRight = box.right - gi * gw;               // מימין לשמאל
      const gCenter = r2(gRight - gw / 2);
      const startRight = gCenter + (g.bars.length * bw) / 2;
      return {
        label: g.label, x: gCenter, width: r2(gw),
        bars: g.bars.map((b, bi) => {
          const bx = r2(startRight - (bi + 1) * bw);
          const by = Math.min(y(b.value), zeroY);
          return { key: b.key, label: b.label, value: b.value, x: bx, y: r2(by), w: bw, h: r2(Math.abs(y(b.value) - zeroY)), negative: b.value < 0 };
        }),
      };
    });
    return {
      w: box.o.w, h: box.o.h, min: scale.min, max: scale.max, step: scale.step, zeroY,
      groups: out,
      ticks: scale.ticks.map((v) => ({ value: v, y: y(v), label: num(v) })),
      axis: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
    };
  }

  /** הנתונים לשני הגרפים שבמסמך (סעיף 17), מתוך תוצאת החישוב */
  function cashLineSeries(res) {
    return ((res && res.cash) || []).map((c) => ({ label: `חודש ${c.month}`, value: c.closing, month: c.month }));
  }
  function plBarGroups(res) {
    return ((res && res.years) || []).map((yr) => ({
      label: `שנה ${yr.year}`,
      bars: [
        { key: 'revenue', label: 'הכנסות', value: yr.revenue },
        { key: 'ebitda', label: 'רווח תפעולי', value: yr.ebitda },
        { key: 'net', label: 'רווח נקי', value: yr.net },
      ],
    }));
  }

  // ---------- סעיף 18: מבנה טבלת התזרים ----------

  /**
   * שורות התזרים מסודרות לשלוש קבוצות: תקבולים, תשלומים והשורה התחתונה.
   * לכל קבוצה שורת ביניים ("סה"כ תקבולים" / "סה"כ תשלומים"), ואחריהן תזרים נטו
   * ויתרת סגירה. שורה שכולה אפסים לא נכנסת בכלל (למשל מע"מ כשלא הוזן).
   * sparse=true פירושו שבתצוגה מציגים "–" במקום 0 (שורה חד-פעמית כמו קבלת ההלוואה).
   */
  function cashflowSections(res, opts) {
    const rows = (res && res.cash) || [];
    const o = opts || {};
    const entity = o.entity || 'osek';
    const col = (key) => rows.map((r) => Number(r[key]) || 0);
    const any = (values) => values.some((v) => Math.abs(v) > 0.5);
    const mk = (key, label, values, sparse) => ({ key, label, values, sparse: !!sparse });
    const inRows = [
      mk('revenue', 'תקבולים ממכירות', col('revenue')),
      mk('loanIn', 'קבלת ההלוואה', col('loanIn'), true),
      mk('equityIn', 'הכנסת הון עצמי', col('equityIn'), true),
      mk('vatIn', 'החזר מע"מ מרשות המסים', col('vatIn'), true),
    ].filter((r) => any(r.values));
    const outRows = [
      mk('cogs', 'עלות המכר', col('cogs')),
      mk('fixedSalaries', 'הוצאות קבועות ושכר', rows.map((r) => (Number(r.fixed) || 0) + (Number(r.salaries) || 0))),
      mk('draw', 'משיכת בעלים', col('draw')),
      mk('vatOut', 'מע"מ על רכישת הציוד', col('vatOut'), true),
      mk('tax', entity === 'company' ? 'מס חברות' : 'מס הכנסה וביטוח לאומי', col('tax')),
      mk('debt', 'החזר הלוואה', col('debt')),
      mk('invest', 'השקעות', col('invest'), true),
      // שיפור 4, ב1: הון חוזר שפורט כפריט שימוש יוצא בחודש 1 (ראו workingCapitalOutflow)
      mk('working', 'הון חוזר (לפי פירוט השימושים)', col('working'), true),
    ].filter((r) => any(r.values));
    const sum = (list) => rows.map((_, i) => list.reduce((s, r) => s + r.values[i], 0));
    const inTotal = sum(inRows);
    const outTotal = sum(outRows);
    return {
      months: rows.map((r) => r.month),
      opening: mk('opening', 'יתרת פתיחה', col('opening')),
      inflows: { key: 'in', title: 'תקבולים (כסף שנכנס)', rows: inRows, total: mk('inTotal', 'סה"כ תקבולים', inTotal) },
      outflows: { key: 'out', title: 'תשלומים (כסף שיוצא)', rows: outRows, total: mk('outTotal', 'סה"כ תשלומים', outTotal) },
      net: mk('net', 'תזרים נטו בחודש', rows.map((_, i) => inTotal[i] - outTotal[i])),
      closing: mk('closing', 'יתרת סגירה', col('closing')),
    };
  }

  // ---------- סעיף 19: טבלת תרחישים ----------

  const SCENARIOS = [
    { key: 'base', pct: 0, label: 'תרחיש בסיס' },
    { key: 'down10', pct: -10, label: 'ירידה של 10% במכירות' },
    { key: 'down20', pct: -20, label: 'ירידה של 20% במכירות' },
  ];

  /** עותק של התוכנית שבו המכירות (וגם נקודת הפתיחה של עסק פועל) מוכפלות בפקטור */
  function scenarioPlan(plan, pct) {
    const factor = 1 + (Number(pct) || 0) / 100;
    const p = JSON.parse(JSON.stringify(plan || {}));
    p.forecast = p.forecast || {};
    p.forecast.annualSales = Math.round((Number(p.forecast.annualSales) || 0) * factor);
    if (p.history && Number(p.history.lastYearSales)) p.history.lastYearSales = Math.round(p.history.lastYearSales * factor);
    if (Number(p.forecast.customersPerDay)) p.forecast.customersPerDay = (Number(p.forecast.customersPerDay) || 0) * factor;
    return p;
  }

  /**
   * שלושה תרחישים: בסיס, ‎-10% ו-‎-20% במכירות. ההוצאות הקבועות, השכר, ההלוואה
   * וההחזרים נשארים כפי שהם – זו בדיוק הנקודה: מה קורה כשהמכירות מאכזבות.
   * לכל תרחיש: הרווח התפעולי בשנה הראשונה, יחס כיסוי החוב הנמוך ביותר בשלוש השנים,
   * והיתרה הנמוכה ביותר בתזרים לאורך כל תקופת ההלוואה (שיפור 4, ב5 – עד עכשיו רק
   * השנה הראשונה, והשנה הקשה היא לרוב שנה 2, אחרי הגרייס).
   * minCashMonth רץ לאורך כל התקופה (18 = חודש 6 בשנה השנייה); minCashYear ו-
   * minCashText (למשל "חודש 6 בשנה השנייה") – לתצוגה. minCashYear1 – היתרה הנמוכה
   * בשנה הראשונה בלבד, להשוואה. negativeMonths – מספר חודשי המינוס בכל התקופה.
   */
  function scenarios(plan) {
    return SCENARIOS.map((s) => {
      const res = computePlan(s.pct ? scenarioPlan(plan, s.pct) : plan);
      const cushion = res.cushionPeriod || res.cushion || { min: 0, month: 1, level: 'ok' };
      const rating = dscrLevel(res.minDscr);
      return {
        key: s.key, label: s.label, pct: s.pct,
        revenue: res.years[0].revenue,
        ebitda: res.years[0].ebitda,
        net: res.years[0].net,
        minDscr: res.minDscr,
        dscrLevel: rating.level,
        minCash: cushion.min,
        minCashMonth: cushion.month,
        minCashYear: Math.ceil(cushion.month / 12),
        minCashText: periodMonthText(cushion.month),
        minCashYear1: res.cushion ? res.cushion.min : cushion.min,
        periodMonths: (res.cashPeriod || res.cash).length,
        negativeMonths: (res.negativeMonthsPeriod || res.negativeMonths).length,
        level: cushion.min < 0 || res.minDscr < 1 ? 'risk' : (rating.level === 'ok' && cushion.level === 'ok' ? 'ok' : 'warn'),
      };
    });
  }

  /**
   * שיפור 4, ב4 – ניסוח יחס כיסוי החוב לפי שלוש רמות, בדיוק לפי המקור:
   * 1.25 ומעלה – "יכולת החזר טובה"; 1.0 עד 1.25 – "מרווח צר";
   * מתחת ל-1.0 – "העסק לא יעמוד בהחזרים מהתזרים השוטף".
   * לפני כן יחס של 0.04 תואר כ"המרווח מעל ההחזרים מצטמצם", כשבפועל העסק מכסה 4% בלבד.
   * מחזיר null כשאין החזרים (יחס אינסופי).
   */
  const DSCR_PHRASES = { ok: 'יכולת החזר טובה', tight: 'מרווח צר', short: 'העסק לא יעמוד בהחזרים מהתזרים השוטף' };
  function dscrPhrase(dscr) {
    const d = Number(dscr);
    if (!Number.isFinite(d)) return null;
    if (d >= 1.25) return { level: 'ok', text: DSCR_PHRASES.ok };
    if (d >= 1) return { level: 'tight', text: DSCR_PHRASES.tight };
    return { level: 'short', text: DSCR_PHRASES.short };
  }

  /**
   * משפט שמסביר את הטבלה בשפה פשוטה.
   * שיפור 4, ב4 + סעיף ה': ההערה דיברה רק על התרחיש הגרוע, גם כשתרחיש הבסיס עצמו כבר
   * במינוס. עכשיו: אם הבסיס במינוס – זה נאמר ראשון; אחרת, התרחיש הראשון (המתון ביותר)
   * שבו החשבון נכנס למינוס. יחס הכיסוי בתרחיש הגרוע מנוסח לפי שלוש הרמות (dscrPhrase).
   */
  function scenarioNote(list) {
    const rows = list || [];
    const worst = rows[rows.length - 1];
    if (!worst) return '';
    const baseRow = rows.find((r) => r.key === 'base') || rows[0];
    const intro = 'הטבלה בודקת מה קורה אם המכירות יהיו נמוכות מהתחזית, בעוד ההוצאות הקבועות, השכר והחזרי ההלוואה נשארים כפי שהם.';
    const drop = (r) => `בירידה של ${num(-r.pct)}% במכירות`;
    const parts = [intro];

    // 1. יתרת המזומן
    const firstNeg = rows.find((r) => r.minCash < 0);
    if (baseRow && baseRow.minCash < 0) {
      const deeper = worst !== baseRow && worst.minCash < baseRow.minCash
        ? `, ו${drop(worst)} המינוס מעמיק ל-${ils(Math.abs(worst.minCash))}`
        : '';
      parts.push(`כבר בתחזית הבסיס, בלי שום ירידה במכירות, החשבון נכנס למינוס (יתרה נמוכה של ${ils(baseRow.minCash)} ב${periodMonthText(baseRow.minCashMonth)})${deeper}.`);
    } else if (firstNeg) {
      const deeper = worst !== firstNeg && worst.minCash < firstNeg.minCash
        ? `, ו${drop(worst)} היתרה הנמוכה יורדת ${worst.minCash < 0 ? `למינוס של ${ils(Math.abs(worst.minCash))}` : `ל-${ils(worst.minCash)}`}`
        : '';
      parts.push(`${firstNeg === worst ? 'ב' : 'כבר ב'}תרחיש של ירידה של ${num(-firstNeg.pct)}% במכירות החשבון נכנס למינוס (יתרה נמוכה של ${ils(firstNeg.minCash)} ב${periodMonthText(firstNeg.minCashMonth)})${deeper}.`);
    } else {
      parts.push(`גם ${drop(worst)} היתרה הנמוכה ביותר בחשבון, לאורך כל תקופת ההלוואה, נשארת חיובית (${ils(worst.minCash)}).`);
    }

    // 2. יחס כיסוי החוב בתרחיש הגרוע, לפי שלוש הרמות. אם המשפט הקודם כבר נקב
    // בתרחיש הגרוע, לא חוזרים על שמו ("באותו תרחיש").
    const baseNeg = Boolean(baseRow && baseRow.minCash < 0);
    const worstNamed = baseNeg
      ? worst !== baseRow && worst.minCash < baseRow.minCash
      : (!firstNeg || firstNeg === worst || worst.minCash < firstNeg.minCash);
    const where = worstNamed ? 'באותו תרחיש' : drop(worst);
    const ph = dscrPhrase(worst.minDscr);
    if (ph) {
      const d = num(worst.minDscr, 2);
      if (ph.level === 'ok') {
        parts.push(`${where} יחס כיסוי החוב נשאר ${d}: ${ph.text}.`);
      } else if (ph.level === 'tight') {
        parts.push(`${where} יחס כיסוי החוב יורד ל-${d}: ${ph.text}. המזומן הפנוי עדיין מכסה את ההחזרים, אבל עם מעט מקום לטעות.`);
      } else {
        parts.push(worst.minDscr > 0
          ? `${where} יחס כיסוי החוב יורד ל-${d}: ${ph.text}. המזומן הפנוי מכסה רק כ-${num(worst.minDscr * 100)}% מההחזרים.`
          : `${where} יחס כיסוי החוב שלילי: ${ph.text}. אין לעסק מזומן פנוי לכיסוי ההחזרים.`);
      }
    }

    if (firstNeg) parts.push('לכן נדרש מרווח נוסף: הון חוזר גדול יותר, דחיית חלק מההשקעות או חודשי גרייס.');
    return parts.join(' ');
  }

  // ---------- גל ב', סעיפים 22–24 ופסקת הביטחונות ----------

  /**
   * סעיף 24 – התווית "ותק: בהקמה" הייתה מעורפלת. במקומה "סטטוס", עם ערך שאומר
   * במלים מה מצב העסק: "עסק בהקמה" מול "עסק פועל" ועוד הוותק בשנים.
   * הערך נשאר קצר, כדי לא לשבור את רוחב טבלת העובדות במסמך.
   */
  /**
   * ותק בשנים כטקסט עברי תקין, בלי לעגל חלקי שנה (QA שיפור 4 ספרינט 1, באג 2 – 0.5 הודפס "1 שנים").
   * 0.5 → "חצי שנה", 1 → "שנה", 1.5 → "שנה וחצי", 2 → "שנתיים", 2.5 → "שנתיים וחצי",
   * 3 → "3 שנים", 3.5 → "3 שנים וחצי". פחות משנה (שאינו חצי) – בחודשים. '' כשאין ותק.
   */
  function yearsText(y) {
    const v = Number(y);
    if (!Number.isFinite(v) || v <= 0) return '';
    if (v < 1) {
      const m = Math.max(1, Math.round(v * 12));
      if (m === 6) return 'חצי שנה';
      if (m === 12) return 'שנה';
      return m === 1 ? 'חודש' : (m === 2 ? 'חודשיים' : `${m} חודשים`);
    }
    const whole = Math.floor(v + 1e-9);
    const frac = v - whole;
    const base = (n) => (n === 1 ? 'שנה' : (n === 2 ? 'שנתיים' : `${num(n)} שנים`));
    if (frac < 1e-9) return base(whole);
    // שיפור 4 ספרינט 2 (קוסמטי מ-QA סבב 2): שבר שאינו חצי – בחודשים, לא "1.3 שנים".
    // 1.25 → "שנה ו-3 חודשים", 2.1 → "שנתיים וחודש". עיגול ל-12 חודשים עובר לשנה הבאה.
    const months = Math.round(frac * 12);
    if (months === 0) return base(whole);
    if (months === 12) return base(whole + 1);
    if (months === 6) return `${base(whole)} וחצי`;
    const mt = months === 1 ? 'וחודש' : (months === 2 ? 'וחודשיים' : `ו-${months} חודשים`);
    return `${base(whole)} ${mt}`;
  }

  function businessStatus(plan) {
    const b = (plan && plan.business) || {};
    if (isNewBusiness(plan)) return { label: 'סטטוס', value: 'עסק בהקמה', isNew: true, years: 0 };
    const years = Math.max(0, Number(b.years) || 0);
    const yt = yearsText(years);
    return { label: 'סטטוס', value: yt ? `עסק פועל ${yt}` : 'עסק פועל', isNew: false, years };
  }

  /**
   * אומדן הביטחונות הנדרשים, נגזר מסכום ההלוואה שהוזן בפועל:
   * שיעור נמוך על החלק שעד התקרה, ושיעור גבוה על החלק שמעליה.
   */
  function collateralRequirement(amount) {
    const loan = Math.max(0, Number(amount) || 0);
    const lower = Math.min(loan, COLLATERAL.tierCap);
    const upper = Math.max(0, loan - COLLATERAL.tierCap);
    return {
      loan,
      lower, upper,
      tiered: upper > 0,
      amount: Math.round(lower * COLLATERAL.tierPct / 100 + upper * COLLATERAL.upperPct / 100),
    };
  }

  /**
   * פסקת הביטחונות והערבות במסמך שמוגש לבנק (החלטת מאיר, 24.09.2026).
   * בסבב P1 הפסקה הוסרה מהמסמך כי היא פנתה למגיש ("לפי מה שהזנתם"). היא חוזרת
   * כאן בגוף שלישי בלבד, ובכל משפט יש מקור: או חישוב מסכום ההלוואה שהוזן, או
   * סכום שהוזן בפועל (הון עצמי, פיקדון), או קביעה על צורת ההתאגדות שנבחרה.
   * אין כאן אמירה עובדתית על ביטחונות שהמשתמש לא הזין – הכלי אינו אוסף רשימת
   * נכסים או ערבים, והמשפט האחרון אומר את זה במפורש.
   */
  const ENTITY_GUARANTEE = {
    company: 'הבקשה מוגשת על ידי חברה בע"מ, שבה נכסי החברה מופרדים מנכסי הבעלים. לצד הביטחונות נהוג שהבנק מחתים את הבעלים על ערבות אישית למלוא ההלוואה.',
    partnership: 'הבקשה מוגשת על ידי שותפות, והשותפים חבים בחובות העסק באופן אישי. נהוג שהבנק מחתים את השותפים על ערבות אישית למלוא ההלוואה.',
    osek: 'הבקשה מוגשת על ידי עוסק מורשה, ואין הפרדה בין נכסי העסק לנכסי הבעלים: הבעלים חב בחוב באופן אישי, ונהוג שהבנק מחתים אותו גם על ערבות אישית למלוא ההלוואה.',
  };
  const COLLATERAL_SCOPE_NOTE = 'פירוט הנכסים והערבים שיוצעו כביטחון אינו חלק ממסמך זה, והוא מוגש לבנק בנפרד. היקף הביטחונות וסוגם נקבעים מול הבנק המלווה ומול הקרן, והסכום שלמעלה הוא אומדן לפי הכללים הנהוגים ולא התחייבות של אחד מהם.';
  function collateralSection(plan) {
    const p = plan || {};
    const req = collateralRequirement(p.loan && p.loan.amount);
    const paragraphs = [];
    if (req.loan > 0) {
      paragraphs.push(req.tiered
        ? `על הלוואה בסך ${ils(req.loan)} נהוגה דרישת ביטחונות של כ-${num(COLLATERAL.tierPct)}% מהחלק שעד ${ils(COLLATERAL.tierCap)} וכ-${num(COLLATERAL.upperPct)}% מהחלק שמעליו – כ-${ils(req.amount)} – או ערב נוסף במקומם.`
        : `על הלוואה בסך ${ils(req.loan)} נהוגה דרישת ביטחונות של כ-${num(COLLATERAL.tierPct)}% מסכום ההלוואה – כ-${ils(req.amount)} – או ערב נוסף במקומם.`);
    }
    const guarantee = ENTITY_GUARANTEE[(p.business && p.business.entity)] || ENTITY_GUARANTEE.osek;
    paragraphs.push(guarantee);

    // עובדות שנגזרות מסכומים שהוזנו בפועל. סכום שלא הוזן – אין עליו משפט.
    const equity = equityInflow(p);
    const share = equityShare(equity, p.loan && p.loan.amount);
    if (equity > 0) {
      paragraphs.push(share
        ? `ההון העצמי שמעמידים הבעלים בבקשה זו הוא ${ils(equity)}, כ-${num(share.pct)}% מסך מקורות המימון (${ils(share.total)}).`
        : `ההון העצמי שמעמידים הבעלים בבקשה זו הוא ${ils(equity)}.`);
    }
    const deposit = Math.max(0, Number(p.startup && p.startup.deposit) || 0);
    if (deposit > 0) {
      paragraphs.push(`בעלויות ההקמה נכלל פיקדון או ערבות לשכירות בסך ${ils(deposit)} לטובת בעל הנכס. הוא משמש את חוזה השכירות ואינו ביטחון להלוואה.`);
    }
    paragraphs.push(COLLATERAL_SCOPE_NOTE);
    return { heading: 'ביטחונות וערבויות', paragraphs, requirement: req };
  }

  const api = { FUND, TRACKS, AFFORD, TAX, maxLoan, spitzerPayment, amortization, debtByYear, rampFactor, salesLevel, bracketTax, nationalInsurance, niDeductibleExpense, taxFor, taxSpread, forecast, cashflow, dscrLevel, affordLevel, loanForPayment, roundAmount, repaymentOptions, equityShare, validatePlan, isNewBusiness, equityInflow, setupCostsTotal, sourcesTotal, planUses, usesTotal, investmentTotal, integrityChecks, integrityFailures, cashCushion, cashflowPeriod, periodMonthText, computePlan, ils, parseAmount, moneyText, profitText, negativeMonthsText, workingCapitalNote, workingCapitalTotal, unusedWorkingCapital, bridgeText, thinCushionText, thinMonthNote, thresholdLabel, negativeMonthNote, negativeMonthSummary,
    // גל ב' (סעיפים 6–15)
    outlookText, DEPRECIATION_NOTE, ownerDrawNote, reconciliation, conflictWarnings, CONFLICT_FIELDS,
    ASSUMPTIONS, operatingMarginPct, assumptionWarnings, setupExtras, SETUP_EXTRA_FIELDS, equipmentVat,
    suggestedEquipmentVat, bottomUpSales, bottomUpText, usesBottomUp, ownerParagraphs, marketSections,
    // גל ב' (סעיפים 16–21): הצגה
    headlineMetrics, breakEvenMonth, MONEY_CAPTION, ltr, bidiText, stripBidi, LRI, PDI,
    CHART, niceStep, niceScale, lineChartData, barChartData, cashLineSeries, plBarGroups,
    cashflowSections, SCENARIOS, scenarioPlan, scenarios, scenarioNote, num,
    // גל ב' (סעיפים 22–24) ופסקת הביטחונות
    tidyLabel, businessStatus, yearsText, COLLATERAL, collateralRequirement, collateralSection,
    ENTITY_GUARANTEE, COLLATERAL_SCOPE_NOTE,
    // שיפור 4, ספרינט 1 (א1–א7, ב1, ב4)
    CONSISTENCY, USE_KEYWORDS, PURPOSE_STAFF_WORDS, PURPOSE_PREMISES_WORDS, GROWTH_REASON_FIELD,
    consistencyChecks, suggestUseCategory, salesJump, wordCount,
    workingCapitalOutflow, reserveNote, dscrPhrase, DSCR_PHRASES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
