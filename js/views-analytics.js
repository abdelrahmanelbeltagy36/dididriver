/* ===== views-analytics.js — التحليلات (charts from saved data only) ===== */
'use strict';

const AF = { from: '', to: '', platform: '', wd: '', hMin: '', hMax: '', pMin: '', pMax: '' };

function filterSessions(list) {
  return list.filter(s => {
    if (AF.from && s.date < AF.from) return false;
    if (AF.to && s.date > AF.to) return false;
    if (AF.platform && s.platform !== AF.platform) return false;
    if (AF.wd !== '' && AF.wd !== null && AF.wd !== undefined && AF.wd !== 'any' && parseYMD(s.date).getDay() !== +AF.wd) return false;
    const h = +s.hours || 0;
    if (AF.hMin !== '' && AF.hMin != null && h < +AF.hMin) return false;
    if (AF.hMax !== '' && AF.hMax != null && h > +AF.hMax) return false;
    const c = calcSession(s).profit;
    if (AF.pMin !== '' && AF.pMin != null && c < +AF.pMin) return false;
    if (AF.pMax !== '' && AF.pMax != null && c > +AF.pMax) return false;
    return true;
  });
}

Views.analytics = async function (root) {
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  const sessions = await DB.all('sessions');

  const filtered = filterSessions(sessions);
  const st = periodStats(filtered);

  let html = '';

  /* filters */
  html += '<div class="card"><div class="card-title">🔍 الفلاتر</div>' +
    '<div class="grid2">' +
    field('من تاريخ', '<input class="input" type="date" data-af="from" value="' + AF.from + '">') +
    field('إلى تاريخ', '<input class="input" type="date" data-af="to" value="' + AF.to + '">') +
    '</div>' +
    '<div class="grid2">' +
    field('التطبيق', '<select class="input" data-af="platform"><option value="">الكل</option>' + options(PLATFORM_KEYS.map(k => ({ v: k, l: PLATFORMS[k] })), AF.platform) + '</select>') +
    field('يوم الأسبوع', '<select class="input" data-af="wd"><option value="any">الكل</option>' +
      WEEKDAY_NAMES.map((n, i) => '<option value="' + i + '"' + (String(AF.wd) === String(i) ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>') +
    '</div>' +
    '<div class="grid2">' +
    field('ساعات من', '<input class="input" type="number" inputmode="decimal" data-af="hMin" value="' + esc(AF.hMin) + '">') +
    field('ساعات إلى', '<input class="input" type="number" inputmode="decimal" data-af="hMax" value="' + esc(AF.hMax) + '">') +
    '</div>' +
    '<div class="grid2">' +
    field('ربح الجلسة من (ج.م)', '<input class="input" type="number" inputmode="decimal" data-af="pMin" value="' + esc(AF.pMin) + '">') +
    field('ربح الجلسة إلى (ج.م)', '<input class="input" type="number" inputmode="decimal" data-af="pMax" value="' + esc(AF.pMax) + '">') +
    '</div>' +
    '<div class="btn-row">' +
    '<button class="btn btn-pri" id="af-apply">تطبيق</button>' +
    '<button class="btn" id="af-clear">مسح الفلاتر</button>' +
    '</div></div>';

  if (!sessions.length) {
    root.innerHTML = html + '<div class="card"><div class="empty"><div class="ic">📊</div><div class="t">لا توجد بيانات محفوظة بعد</div><div class="d">سجّل أيامك أولًا وستظهر كل الرسوم هنا من بياناتك الحقيقية فقط.</div></div></div>';
    return;
  }

  /* KPIs */
  html += '<div class="card"><div class="card-title">📈 مؤشرات الفترة (' + fmtN(st.count) + ' جلسة)</div>' +
    '<div class="stat-grid">' +
    '<div class="stat"><div class="lbl">الدخل الصافي</div><div class="val">' + money(st.net) + '</div></div>' +
    '<div class="stat"><div class="lbl">الربح الشخصي</div><div class="val ' + (st.profit >= 0 ? 'pos-t' : 'neg-t') + '">' + money(st.profit) + '</div></div>' +
    '<div class="stat"><div class="lbl">هامش الربح</div><div class="val">' + fmtPct(st.margin) + '</div></div>' +
    '<div class="stat"><div class="lbl">مخصصات وقود+صيانة</div><div class="val res-t">' + money(st.fuel + st.maint) + '</div></div>' +
    '<div class="stat"><div class="lbl">كيلومترات</div><div class="val">' + fmtN(st.km) + '</div></div>' +
    '<div class="stat"><div class="lbl">ساعات</div><div class="val">' + fmtN(st.hours) + '</div></div>' +
    '<div class="stat"><div class="lbl">ربح/كم</div><div class="val">' + money(st.profitPerKm) + '</div></div>' +
    '<div class="stat"><div class="lbl">ربح/ساعة</div><div class="val">' + money(st.profitPerHour) + '</div></div>' +
    '</div></div>';

  /* charts */
  html += '<div class="card"><div class="chart-head"><span class="chart-title">الدخل مقابل الربح اليومي</span><span class="legend" id="lg1"></span></div>' +
    '<div class="chart-wrap"><canvas class="chart" id="ch-daily"></canvas></div></div>';

  html += '<div class="card"><div class="chart-head"><span class="chart-title">هامش الربح اليومي %</span><span class="legend" id="lg2"></span></div>' +
    '<div class="chart-wrap"><canvas class="chart" id="ch-margin"></canvas></div></div>';

  html += '<div class="card"><div class="chart-head"><span class="chart-title">ربح الأسابيع</span><span class="legend" id="lg3"></span></div>' +
    '<div class="chart-wrap"><canvas class="chart" id="ch-weeks"></canvas></div></div>';

  html += '<div class="card"><div class="chart-head"><span class="chart-title">ربح الأشهر</span><span class="legend" id="lg4"></span></div>' +
    '<div class="chart-wrap"><canvas class="chart" id="ch-months"></canvas></div></div>';

  html += '<div class="card"><div class="chart-head"><span class="chart-title">اتجاه ربح/ساعة و ربح/كم</span><span class="legend" id="lg5"></span></div>' +
    '<div class="chart-wrap"><canvas class="chart" id="ch-trend"></canvas></div></div>';

  /* insights */
  const ins = computeInsights(filtered);
  html += '<div class="card"><div class="card-title">💡 ملاحظات ذكية</div>';
  if (!ins.length) html += '<div class="empty"><div class="d">سجّل أيامًا أكثر لتظهر ملاحظات أعمق</div></div>';
  html += ins.map(i => '<div style="padding:9px 0;border-bottom:1px dashed var(--line)">' +
    '<div style="font-weight:800;font-size:.88rem">' + i.icon + ' ' + esc(i.title) + '</div>' +
    '<div class="t2" style="line-height:1.8;margin-top:3px">' + esc(i.text) + '</div></div>').join('');
  html += '</div>';

  root.innerHTML = html;

  /* filter events */
  root.querySelectorAll('[data-af]').forEach(el => {
    el.addEventListener('change', () => { AF[el.dataset.af] = el.value; });
    el.addEventListener('input', () => { AF[el.dataset.af] = el.value; });
  });
  root.querySelector('#af-apply').onclick = () => go('analytics');
  root.querySelector('#af-clear').onclick = () => {
    Object.keys(AF).forEach(k => AF[k] = '');
    go('analytics');
  };

  drawAnalyticsCharts(filtered);
};

function drawAnalyticsCharts(filtered) {
  const P = Charts.palette();
  const days = sortedDates(filtered);
  const recentDays = days.slice(-31);
  const labels = recentDays.map(dayLabel);
  const dailyNet = recentDays.map(d => dayStats(filtered, d).net);
  const dailyProfit = recentDays.map(d => dayStats(filtered, d).profit);
  const dailyMargin = recentDays.map(d => dayStats(filtered, d).margin);
  const dailyPph = recentDays.map(d => dayStats(filtered, d).profitPerHour);
  const dailyPpk = recentDays.map(d => dayStats(filtered, d).profitPerKm);

  Charts.legend(document.getElementById('lg1'), [{ name: 'الدخل', color: P.pri }, { name: 'الربح الشخصي', color: P.pos }]);
  Charts.bar(document.getElementById('ch-daily'), labels, [
    { name: 'net', color: P.pri, data: dailyNet },
    { name: 'profit', color: P.pos, data: dailyProfit }
  ]);

  Charts.legend(document.getElementById('lg2'), [{ name: 'هامش الربح %', color: P.res }]);
  Charts.line(document.getElementById('ch-margin'), labels, [{ name: 'margin', color: P.res, data: dailyMargin }]);

  /* weekly profit — last 10 weeks */
  const wk0 = weekStartSat(todayStr());
  const wLabels = [], wData = [];
  for (let i = 9; i >= 0; i--) {
    const ws = addDays(wk0, -7 * i);
    wLabels.push(dayLabel(ws));
    wData.push(weekStats(filtered, ws).profit);
  }
  Charts.legend(document.getElementById('lg3'), [{ name: 'ربح أسبوعي', color: P.pos }]);
  Charts.bar(document.getElementById('ch-weeks'), wLabels, [{ name: 'wk', color: P.pos, data: wData }]);

  /* monthly profit — last 12 months */
  let mk0 = monthKey(todayStr());
  const mKeys = [];
  for (let i = 11; i >= 0; i--) {
    const [y, m] = mk0.split('-').map(Number);
    const d = new Date(y, m - 1 - i, 1);
    mKeys.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  Charts.legend(document.getElementById('lg4'), [{ name: 'ربح شهري', color: P.pri }]);
  Charts.bar(document.getElementById('ch-months'), mKeys.map(k => k.replace('-', '/')),
    [{ name: 'mo', color: P.pri, data: mKeys.map(k => monthStats(filtered, k).profit) }]);

  /* per-hour & per-km trends */
  Charts.legend(document.getElementById('lg5'), [
    { name: 'ربح/ساعة', color: P.pri }, { name: 'ربح/كم', color: P.res }
  ]);
  Charts.line(document.getElementById('ch-trend'), labels, [
    { name: 'pph', color: P.pri, data: dailyPph },
    { name: 'ppk', color: P.res, data: dailyPpk }
  ]);
}
