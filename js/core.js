/* ===== core.js — settings, date utils, calculations, comparisons, insights ===== */
'use strict';

/* ---------- constants ---------- */
const PLATFORMS = { didi: 'ديدي', uber: 'أوبر', other: 'أخرى' };
const PLATFORM_KEYS = ['didi', 'uber', 'other'];

const CATS = {
  oil: 'زيت المحرك',
  oilFilter: 'فلتر الزيت',
  airFilter: 'فلتر الهواء',
  fuelFilter: 'فلتر الوقود',
  tires: 'إطارات / كاوتش',
  brakes: 'فحمات وفرامل',
  battery: 'بطارية',
  suspension: 'مساعدين ودراعات',
  mech: 'إصلاح ميكانيكي',
  elec: 'إصلاح كهرباء',
  transmission: 'جير / قير',
  engine: 'المحرك',
  other: 'أخرى'
};
const CAT_LIST = Object.keys(CATS);

const DEFAULT_INTERVALS = {
  oil:         { km: 5000,  months: 6 },
  oilFilter:   { km: 5000,  months: 6 },
  airFilter:   { km: 20000, months: 12 },
  fuelFilter:  { km: 20000, months: 12 },
  tires:       { km: 40000, months: 24 },
  brakes:      { km: 30000, months: 12 },
  battery:     { km: 0,     months: 24 },
  suspension:  { km: 0,     months: 0 },
  mech:        { km: 0,     months: 0 },
  elec:        { km: 0,     months: 0 },
  transmission:{ km: 0,     months: 0 },
  engine:      { km: 0,     months: 0 },
  other:       { km: 0,     months: 0 }
};

const DEFAULT_SETTINGS = {
  mode: 'driver',              /* 'driver' = ديدي/أوبر • 'daily' = قيادة يومية (مصاريف بس) */
  notifications: true,         /* إشعارات الصيانة كل 3 أيام */
  vehicleName: 'تويوتا كورولا 2008',
  plate: '',
  odo: 0,
  photo: '',
  fuelType: 'بنزين 90',
  fuelPrice: 22.25,
  l100: 8,
  maintPerKm: 2,
  commission: { didi: 15, uber: 25, other: 0 },
  targetDays: 26,
  intervals: DEFAULT_INTERVALS,
  theme: 'system'
};

let S = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

async function loadSettings() {
  const r = await DB.get('settings', 'main');
  if (r && r.value) {
    S = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), r.value);
    S.commission = Object.assign({ didi: 15, uber: 25, other: 0 }, r.value.commission || {});
    S.intervals = Object.assign({}, DEFAULT_INTERVALS, r.value.intervals || {});
  }
}

async function saveSettings() {
  await DB.put('settings', { id: 'main', value: S });
}

/* ---------- الوضعان: سائق (دخل) / قيادة يومية (مصاريف بس) ---------- */
function isDaily() { return S.mode === 'daily'; }
/* السجلات القديمة بدون kind تُعتبر سائق — عشان ما تضيعش بيانات حد */
function modeSessions(list) {
  return (list || []).filter(s => (s.kind || 'driver') === S.mode);
}

/* ---------- تقدير المصاريف من المصاريف الفعلية القديمة (بدون زيادة) ---------- */
function actualCostPerKm(sessions, purchases, maints) {
  const km = (sessions || []).reduce((a, s) => a + (+s.km || 0), 0);
  if (!(km > 0)) return null;
  const spent = (purchases || []).reduce((a, p) => a + (+p.amount || 0), 0) +
                (maints || []).reduce((a, m) => a + (+m.cost || 0), 0);
  if (!(spent > 0)) return null;
  return spent / km;
}
/* التقدير: مصاريفك الفعلية أولًا، ولو مفيش تاريخ نستخدم إعدادات الوقود/الصيانة */
function estimatedCostPerKm(sessions, purchases, maints) {
  const actual = actualCostPerKm(sessions, purchases, maints);
  if (actual && actual > 0) return { value: actual, source: 'actual' };
  return { value: (+S.l100 || 0) / 100 * (+S.fuelPrice || 0) + (+S.maintPerKm || 0), source: 'settings' };
}
/* تكلفة يوم في الوضع العادي = كم × التقدير + أي مصروف فعلي كتبه */
function dayCostEstimate(s, estPerKm) {
  return (+s.km || 0) * (estPerKm || 0) + (+s.directExpenses || 0);
}

async function kvGet(key, fallback) {
  const r = await DB.get('kv', key);
  return r ? r.value : fallback;
}
async function kvSet(key, value) {
  await DB.put('kv', { id: key, value });
}

/* ---------- ids & dates ---------- */
function uid() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function toYMD(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function todayStr() { return toYMD(new Date()); }
function parseYMD(s) {
  const p = s.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
function addDays(ymd, n) {
  const d = parseYMD(ymd);
  d.setDate(d.getDate() + n);
  return toYMD(d);
}
const WEEKDAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
function weekdayName(ymd) { return WEEKDAY_NAMES[parseYMD(ymd).getDay()]; }
function weekdayShort(ymd) { return WEEKDAY_NAMES[parseYMD(ymd).getDay()].slice(0, 5); }

/* week starts Saturday (Egypt) */
function weekStartSat(ymd) {
  const d = parseYMD(ymd);
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return toYMD(d);
}
function monthKey(ymd) { return ymd.slice(0, 7); }
function prevMonthKey(mk) {
  const p = mk.split('-').map(Number);
  const d = new Date(p[0], p[1] - 2, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
function monthName(mk) {
  const p = mk.split('-').map(Number);
  return MONTH_NAMES[p[1] - 1] + ' ' + p[0];
}
function dayLabel(ymd) { return ymd.slice(8, 10) + '/' + ymd.slice(5, 7); }
function fullDayLabel(ymd) {
  const p = parseYMD(ymd);
  return weekdayName(ymd) + ' ' + p.getDate() + ' ' + MONTH_NAMES[p.getMonth()] + ' ' + p.getFullYear();
}
function daysBetween(aYmd, bYmd) {
  return Math.round((parseYMD(bYmd) - parseYMD(aYmd)) / 86400000);
}

/* ---------- core calculations ----------
   Full precision internally, rounded only at display time. */
function fuelCostPerKmOf(st) { /* st = settings-like snapshot {l100, fuelPrice} */
  return (st.l100 / 100) * st.fuelPrice;
}

function calcSession(s) {
  const snap = s.snap || { fuelPrice: S.fuelPrice, l100: S.l100, maintKm: S.maintPerKm };
  const km = +s.km || 0;
  const hours = +s.hours || 0;
  const tips = +s.tips || 0;
  const direct = +s.directExpenses || 0;
  const amount = +s.amount || 0;
  const net = s.mode === 'gross' ? amount * (1 - (+s.commissionPct || 0) / 100) : amount;
  const commission = s.mode === 'gross' ? amount * ((+s.commissionPct || 0) / 100) : 0;
  const effNet = net + (s.tipsIncluded ? 0 : tips); /* tips only added when NOT already inside net */
  const fck = fuelCostPerKmOf(snap);
  const mck = +snap.maintKm || 0;
  const fuelRes = km * fck;
  const maintRes = km * mck;
  const profit = effNet - fuelRes - maintRes - direct;
  const margin = effNet ? (profit / effNet) * 100 : 0;
  return {
    net, commission, effNet, tips, direct,
    fuelRes, maintRes, profit, margin,
    profitPerKm: km ? profit / km : 0,
    profitPerHour: hours ? profit / hours : 0,
    revPerHour: hours ? effNet / hours : 0,
    revPerKm: km ? effNet / km : 0,
    perTrip: s.trips ? effNet / s.trips : 0,
    fck, mck, km, hours
  };
}

/* aggregate stats for any list of sessions */
function periodStats(list) {
  let net = 0, profit = 0, km = 0, hours = 0, fuel = 0, maint = 0, direct = 0, trips = 0;
  for (const s of list) {
    const c = calcSession(s);
    net += c.effNet; profit += c.profit; km += c.km; hours += c.hours;
    fuel += c.fuelRes; maint += c.maintRes; direct += c.direct;
    trips += (+s.trips || 0);
  }
  return {
    count: list.length, net, profit, km, hours, fuel, maint, direct, trips,
    margin: net ? (profit / net) * 100 : 0,
    profitPerKm: km ? profit / km : 0,
    profitPerHour: hours ? profit / hours : 0,
    revPerKm: km ? net / km : 0,
    revPerHour: hours ? net / hours : 0,
    perTrip: trips ? net / trips : 0
  };
}

function groupByDate(sessions) {
  const map = {};
  for (const s of sessions) {
    if (!map[s.date]) map[s.date] = [];
    map[s.date].push(s);
  }
  return map;
}
function sortedDates(sessions) {
  return Object.keys(groupByDate(sessions)).sort();
}
function dayStats(sessions, date) {
  return periodStats(sessions.filter(s => s.date === date));
}
function weekStats(sessions, weekStartYmd) {
  const end = addDays(weekStartYmd, 6);
  return periodStats(sessions.filter(s => s.date >= weekStartYmd && s.date <= end));
}
function monthStats(sessions, mk) {
  return periodStats(sessions.filter(s => monthKey(s.date) === mk));
}

/* latest working day + previous working day */
function latestAndPrevDays(sessions) {
  const days = sortedDates(sessions);
  const latest = days.length ? days[days.length - 1] : null;
  const prev = days.length > 1 ? days[days.length - 2] : null;
  return { latest, prev, days };
}

/* safe percentage change — returns null when previous is 0/null */
function pctChange(cur, prev) {
  if (prev === null || prev === undefined || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/* ---------- wallets ---------- */
function walletBalances(sessions, purchases, maints) {
  let fuelIn = 0, maintIn = 0, kmAll = 0;
  for (const s of sessions) {
    const c = calcSession(s);
    fuelIn += c.fuelRes; maintIn += c.maintRes; kmAll += c.km;
  }
  let fuelOut = 0;
  for (const p of purchases) fuelOut += (+p.amount || 0);
  const maintFromWallet = maints.filter(m => m.fromWallet);
  let maintOut = 0;
  for (const m of maintFromWallet) maintOut += (+m.cost || 0);
  return {
    fuelIn, fuelOut,
    fuelBal: fuelIn - fuelOut,
    maintIn, maintOut,
    maintBal: maintIn - maintOut,
    kmAll,
    actualFuelPerKm: kmAll ? fuelOut / kmAll : 0,
    maintFromWallet, purchases
  };
}

/* ---------- monthly working-days target ---------- */
function workedDaysInMonth(sessions, mk) {
  return sortedDates(sessions.filter(s => monthKey(s.date) === mk)).length;
}

/* ---------- maintenance reminders ---------- */
function reminderFor(catKey, lastEntry, interval, currentOdo, today) {
  if (!interval || (!interval.km && !interval.months)) return null;
  if (!lastEntry) {
    return { status: 'none', kmSince: null, daysSince: null, kmLeft: interval.km || 0, daysLeft: interval.months * 30 };
  }
  const entryOdo = +lastEntry.odo || 0;
  const kmSince = currentOdo && entryOdo ? Math.max(0, currentOdo - entryOdo) : null;
  const daysSince = daysBetween(lastEntry.date, today);
  const kmLeft = interval.km ? interval.km - (kmSince || 0) : null;
  const daysLeft = interval.months ? interval.months * 30 - daysSince : null;
  let status = 'ok';
  const overdueKm = interval.km && kmLeft !== null && kmLeft <= 0;
  const overdueDays = interval.months && daysLeft !== null && daysLeft <= 0;
  if (overdueKm || overdueDays) status = 'overdue';
  else if ((interval.km && kmLeft !== null && kmLeft <= interval.km * 0.2) ||
           (interval.months && daysLeft !== null && daysLeft <= interval.months * 30 * 0.2)) status = 'due';
  else if ((interval.km && kmLeft !== null && kmLeft <= interval.km * 0.35) ||
           (interval.months && daysLeft !== null && daysLeft <= interval.months * 30 * 0.35)) status = 'soon';
  return { status, kmSince, daysSince, kmLeft, daysLeft };
}

/* ---------- maintenance due info (shared: wallets / settings / home / weekly nudge) ----------
   level: 'missed' = عدادك عدّى الموعد (أحمر) • 'soon' = فاضل ≤500 كم أو ≤7 أيام (أخضر) • 'ok' */
function maintDueInfo(ck, lastEntry, interval, currentOdo, today) {
  const iv = interval;
  if (!iv || (!iv.km && !iv.months)) return null;
  let nextDueKm = null, nextDueDate = null, kmLeft = null, daysLeft = null;
  if (lastEntry) {
    if (iv.km && +lastEntry.odo > 0) { nextDueKm = +lastEntry.odo + iv.km; kmLeft = currentOdo ? nextDueKm - currentOdo : iv.km; }
    else if (iv.km) kmLeft = iv.km;
    if (iv.months) { nextDueDate = addDays(lastEntry.date, iv.months * 30); daysLeft = daysBetween(today, nextDueDate); }
  } else {
    if (iv.km) { kmLeft = iv.km; nextDueKm = null; }
    if (iv.months) daysLeft = iv.months * 30;
  }
  const missed = (kmLeft !== null && kmLeft <= 0) || (daysLeft !== null && daysLeft <= 0);
  const soon = !missed && ((kmLeft !== null && kmLeft <= 500) || (daysLeft !== null && daysLeft <= 7));
  return { nextDueKm, nextDueDate, kmLeft, daysLeft, level: missed ? 'missed' : (soon ? 'soon' : 'ok'), last: lastEntry || null };
}

/* ---------- insights ---------- */
function computeInsights(sessions) {
  const out = [];
  if (!sessions.length) return out;

  /* 1) best weekday by total profit */
  const byWd = {};
  for (const s of sessions) {
    const wd = parseYMD(s.date).getDay();
    byWd[wd] = (byWd[wd] || 0) + calcSession(s).profit;
  }
  const wdKeys = Object.keys(byWd);
  if (wdKeys.length >= 2) {
    let best = wdKeys[0];
    for (const k of wdKeys) if (byWd[k] > byWd[best]) best = k;
    let worst = wdKeys[0];
    for (const k of wdKeys) if (byWd[k] < byWd[worst]) worst = k;
    out.push({
      icon: '🏆', title: 'أفضل يوم في الأسبوع',
      text: 'يوم ' + WEEKDAY_NAMES[best] + ' هو الأعلى ربحًا إجمالًا (' + fmtN(byWd[best]) + ' ج.م)؛ ويوم ' + WEEKDAY_NAMES[worst] + ' هو الأقل. راقب توزيع أيامك.'
    });
  }

  /* 2) platform that gives more personal profit */
  const byPlat = {};
  for (const s of sessions) {
    if (!byPlat[s.platform]) byPlat[s.platform] = { profit: 0, net: 0, n: 0 };
    const c = calcSession(s);
    byPlat[s.platform].profit += c.profit;
    byPlat[s.platform].net += c.effNet;
    byPlat[s.platform].n++;
  }
  const pKeys = Object.keys(byPlat);
  if (pKeys.length >= 2) {
    pKeys.sort((a, b) => (byPlat[b].profit / byPlat[b].n) - (byPlat[a].profit / byPlat[a].n));
    const top = pKeys[0], second = pKeys[1];
    const diff = (byPlat[top].profit / byPlat[top].n) - (byPlat[second].profit / byPlat[second].n);
    if (diff > 0) {
      out.push({
        icon: '📱', title: 'مقارنة التطبيقات',
        text: PLATFORMS[top] + ' يحقق متوسط ربح شخصي أعلى بنحو ' + fmtN(diff) + ' ج.م لكل جلسة مقارنة بـ ' + PLATFORMS[second] + '. لكن لا تفترض أن دخلًا أعلى يعني ربحًا أعلى — القياس هنا على الربح بعد المخصصات.'
      });
    }
  }

  /* 3) are longer shifts more profitable? (profit per HOUR vs profit per DAY) */
  const withHours = sessions.filter(s => +s.hours > 0).map(s => ({ h: +s.hours, c: calcSession(s) }));
  if (withHours.length >= 4) {
    const hs = withHours.map(x => x.h).sort((a, b) => a - b);
    const med = hs[Math.floor(hs.length / 2)];
    const shortG = withHours.filter(x => x.h <= med);
    const longG = withHours.filter(x => x.h > med);
    if (shortG.length && longG.length) {
      const sPerDay = shortG.reduce((a, x) => a + x.c.profit, 0) / shortG.length;
      const lPerDay = longG.reduce((a, x) => a + x.c.profit, 0) / longG.length;
      const sPerHr = shortG.reduce((a, x) => a + x.c.profitPerHour, 0) / shortG.length;
      const lPerHr = longG.reduce((a, x) => a + x.c.profitPerHour, 0) / longG.length;
      let text;
      if (lPerDay > sPerDay && lPerHr <= sPerHr) {
        text = 'الشفتات الأطول تحقق ربحًا يوميًا أكبر (' + fmtN(lPerDay) + ' مقابل ' + fmtN(sPerDay) + ' ج.م) لكن الربح لكل ساعة ينخفض (' + fmtN(lPerHr) + ' مقابل ' + fmtN(sPerHr) + '). الإرهاق يأكل الكفاءة.';
      } else if (lPerDay > sPerDay && lPerHr > sPerHr) {
        text = 'الشفتات الأطول أفضل فعليًا: ربح أكبر في اليوم (' + fmtN(lPerDay) + ' ج.م) وربح/ساعة أعلى (' + fmtN(lPerHr) + ').';
      } else {
        text = 'الشفتات الأقصر أكثر كفاءة لكل ساعة (' + fmtN(sPerHr) + ' ج.م/ساعة مقابل ' + fmtN(lPerHr) + ' للأطول). قد تكون ساعات أقل بعائد أفضل.';
      }
      out.push({ icon: '⏱️', title: 'هل الشفتات الأطول أربح؟', text });
    }
  }

  /* 4) fuel + maintenance cost trend (per km, last 14 working days vs the 14 before) */
  const days = sortedDates(sessions);
  if (days.length >= 6) {
    const half = Math.min(14, Math.floor(days.length / 2));
    const recent = days.slice(-half);
    const before = days.slice(0, Math.max(0, days.length - half));
    const costPerKm = list => {
      let cost = 0, km = 0;
      for (const s of sessions.filter(x => list.includes(x.date))) {
        const c = calcSession(s); cost += c.fuelRes + c.maintRes; km += c.km;
      }
      return km ? cost / km : null;
    };
    const r = costPerKm(recent), b = before.length ? costPerKm(before) : null;
    if (r !== null && b !== null && b > 0) {
      const ch = ((r - b) / b) * 100;
      if (ch > 10) {
        out.push({ icon: '📈', title: 'تكاليف العربية ترتفع', text: 'تكلفة الوقود + الصيانة لكل كم ارتفعت ~' + fmtN(ch) + '% في آخر ' + recent.length + ' يوم عمل. راقب أسعار اللتر وسجل تغيير الفلاتر والزيت في وقتها.' });
      } else if (ch < -10) {
        out.push({ icon: '📉', title: 'تكاليف العربية تنخفض', text: 'تكلفة التشغيل لكل كم انخفضت ~' + fmtN(-ch) + '% مقارنة بالفترة السابقة. ممتاز — استمر.' });
      } else {
        out.push({ icon: '➖', title: 'تكاليف مستقرة', text: 'تكلفة الوقود والصيانة لكل كم شبه ثابتة (~' + fmtN(r) + ' ج.م/كم) في آخر ' + recent.length + ' يوم عمل.' });
      }
    }
  }
  return out;
}

/* ---------- trash helpers ---------- */
async function moveToTrash(store, rec, describe) {
  await DB.put('trash', {
    id: uid(),
    origId: rec.id,
    store,
    describe: describe || '',
    data: JSON.parse(JSON.stringify(rec)),
    deletedAt: Date.now()
  });
  await DB.del(store, rec.id);
}
async function restoreFromTrash(entry) {
  await DB.put(entry.store, entry.data);
  await DB.del('trash', entry.id);
}
async function purgeExpiredTrash() {
  const items = await DB.all('trash');
  const limit = Date.now() - 30 * 86400000;
  for (const t of items) {
    if (t.deletedAt < limit) await DB.del('trash', t.id);
  }
}
