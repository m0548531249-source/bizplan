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
   * f: {annualSales, growthPct, cogsPct, monthlyFixed, monthlySalaries, ownerDrawMonthly, taxRatePct, rampMonths}
   */
  function forecast(f, schedule) {
    const debt = debtByYear(schedule || []);
    const monthly = f.annualSales / 12;
    return [1, 2, 3].map((y) => {
      const growth = Math.pow(1 + (f.growthPct || 0) / 100, y - 1);
      let revenue;
      if (y === 1) {
        revenue = 0;
        for (let m = 1; m <= 12; m++) revenue += monthly * salesLevel(f, m);
      } else {
        revenue = f.annualSales * growth;
      }
      const inflate = Math.pow(1 + INFLATION, y - 1);
      const cogs = revenue * (f.cogsPct || 0) / 100;
      const fixed = (f.monthlyFixed || 0) * 12 * inflate;
      const salaries = (f.monthlySalaries || 0) * 12 * inflate;
      const ebitda = revenue - cogs - fixed - salaries;
      const d = debt[y - 1] || { payment: 0, interest: 0 };
      const preTax = ebitda - d.interest;
      const tax = Math.max(0, preTax) * (f.taxRatePct || 0) / 100;
      const net = preTax - tax;
      const ownerDraw = (f.ownerDrawMonthly || 0) * 12;
      const cfads = ebitda - tax - ownerDraw; // מזומן פנוי לשירות החוב
      return {
        year: y, revenue, cogs, grossProfit: revenue - cogs, fixed, salaries, ebitda,
        interest: d.interest, preTax, tax, net, ownerDraw, debtService: d.payment, cfads,
        dscr: d.payment > 0 ? cfads / d.payment : Infinity,
      };
    });
  }

  /**
   * תזרים חודשי לשנה הראשונה.
   * uses: [{item, amount, type:'capex'|'working'}] – השקעות (capex) יוצאות בחודש 1.
   * equity: הון עצמי שהבעלים מכניס לעסק. נכנס כתקבול בחודש 1, בדיוק כמו ההלוואה,
   * כדי שהתזרים יתיישב עם "סך ההשקעה" שמוצג בפרק המקורות והשימושים.
   */
  function cashflow(f, loanAmount, uses, schedule, equity) {
    let cash = (f.openingCash || 0);
    const monthly = f.annualSales / 12;
    const capex = (uses || []).filter((u) => u.type === 'capex').reduce((s, u) => s + (Number(u.amount) || 0), 0);
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
      const opening = cash;
      const inflow = revenue + loanIn + equityIn;
      const outflow = cogs + fixed + salaries + draw + debt + invest;
      cash = opening + inflow - outflow;
      rows.push({ month: m, opening, revenue, loanIn, equityIn, cogs, fixed, salaries, draw, debt, invest, inflow, outflow, closing: cash });
    }
    return rows;
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
    const usesTotal = (plan.loan.uses || []).reduce((s, u) => s + (Number(u.amount) || 0), 0);
    if (Math.abs(usesTotal - plan.loan.amount) > 1) w.push(`סכום השימושים בכספים (${ils(usesTotal)}) שונה מסכום ההלוואה (${ils(plan.loan.amount)}).`);
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

  /** חישוב מלא של תוכנית */
  function computePlan(plan) {
    const schedule = amortization(plan.loan.amount, plan.loan.ratePct, plan.loan.years, plan.loan.graceMonths);
    const f = { ...plan.forecast, currentSales: (plan.history && plan.history.lastYearSales) || 0 };
    const years = forecast(f, schedule);
    const cash = cashflow(f, plan.loan.amount, plan.loan.uses, schedule, equityInflow(plan));
    const minDscr = Math.min(...years.map((y) => y.dscr));
    const firstFull = schedule.find((r) => r.principal > 0);
    return {
      cap: maxLoan(plan.forecast.annualSales),
      schedule, years, cash,
      monthlyPayment: firstFull ? firstFull.payment : 0,
      graceInterest: plan.loan.graceMonths > 0 ? schedule[0].payment : 0,
      totalInterest: schedule.reduce((s, r) => s + r.interest, 0),
      minDscr, rating: dscrLevel(minDscr),
      negativeMonths: cash.filter((c) => c.closing < 0).map((c) => c.month),
      warnings: validatePlan(plan),
    };
  }

  function ils(n) {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(Math.round(n || 0));
  }
  function num(n) {
    return new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
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
   * עסק בהקמה מזין את אותו מידע פעמיים: עלויות ההקמה ושימושי ההלוואה.
   * כששימושי ההלוואה גדולים מעלות ההקמה שפורטה, המסמך מציג שני מספרים סותרים זה לצד זה.
   * מחזיר טקסט הסבר, או null כשאין סתירה. לא נכנס ל-validatePlan, כי זו שאלת שלמות ולא שגיאה.
   */
  function setupMismatch(plan) {
    const sum = (list) => (list || []).reduce((s, u) => s + (Number(u.amount) || 0), 0);
    const setup = sum(plan && plan.startup && plan.startup.setupCosts);
    const uses = sum(plan && plan.loan && plan.loan.uses);
    if (!(setup > 0) || !(uses > setup + 1)) return null;
    return `פירטתם עלויות הקמה של ${ils(setup)}, אבל שימושי ההלוואה מסתכמים ב-${ils(uses)}. שני המספרים מופיעים באותו פרק במסמך, ולכן כדאי להשלים את עלויות ההקמה שחסרות בשלב "הקמת העסק", או להקטין את פירוט השימושים.`;
  }

  const api = { FUND, TRACKS, AFFORD, maxLoan, spitzerPayment, amortization, debtByYear, rampFactor, salesLevel, forecast, cashflow, dscrLevel, affordLevel, loanForPayment, roundAmount, repaymentOptions, equityShare, validatePlan, isNewBusiness, equityInflow, computePlan, ils, parseAmount, moneyText, profitText, negativeMonthsText, setupMismatch };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
