/* ===== views-archive.js — الأرشيف والصيانة ===== */
'use strict';

const AR = {
  tab: 'days',
  month: monthKey(todayStr()),
  year: new Date().getFullYear(),
  maintCat: '',
  maintQ: '',
  healthQ: '',
  healthCat: ''
};

Views.archive = async function (root) {
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  const tabs = [
    { k: 'days', l: 'سجل الأيام' },
    { k: 'reports', l: 'التقارير' },
    { k: 'maint', l: 'سجل الصيانة' },
    { k: 'health', l: 'تاريخ الأعطال' }
  ];
  let html = '<div class="subtabs">' + tabs.map(t =>
    '<button class="subtab ' + (AR.tab === t.k ? 'on' : '') + '" data-tab="' + t.k + '">' + t.l + '</button>').join('') + '</div>';
  html += '<div id="ar-body"><div class="loading">جارٍ التحميل…</div></div>';
  root.innerHTML = html;
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { AR.tab = b.dataset.tab; go('archive'); });
  await renderArchiveTab();
};

async function renderArchiveTab() {
  const body = document.getElementById('ar-body');
  if (!body) return;
  if (AR.tab === 'days') await renderDaysTab(body);
  else if (AR.tab === 'reports') await renderReportsTab(body);
  else if (AR.tab === 'maint') await renderMaintTab(body);
  else await renderHealthTab(body);
}

/* ================= 1) daily history ================= */
async function renderDaysTab(body) {
  const sessions = modeSessions(await DB.all('sessions'));
  if (!sessions.length) {
    body.innerHTML = '<div class="card"><div class="empty"><div class="ic">🗂️</div><div class="t">الأرشيف فاضٍ</div><div class="d">كل يوم تسجه يُحفظ هنا للأبد — لا شيء يُحذف عند بداية شهر جديد.</div></div></div>';
    return;
  }
  const byMonth = {};
  for (const s of sessions) {
    const mk = monthKey(s.date);
    if (!byMonth[mk]) byMonth[mk] = [];
    byMonth[mk].push(s);
  }
  const mks = Object.keys(byMonth).sort().reverse();
  body.innerHTML = mks.map(mk => {
    const st = monthStats(sessions, mk);
    const days = sortedDates(byMonth[mk]).reverse();
    return '<div class="card list-card">' +
      '<div class="card-title" style="padding:12px 0 4px">' + esc(monthName(mk)) +
      '<span class="spacer"></span>' + (isDaily()
        ? '<span class="badge gray">كم ' + fmtN(st.km) + '</span><span class="badge orange">تكلفة ' + money(-st.profit) + '</span>'
        : '<span class="badge gray">صافي ' + money(st.net) + '</span>' +
          '<span class="badge ' + (st.profit >= 0 ? 'green' : 'red') + '">ربح ' + money(st.profit) + '</span>') + '</div>' +
      days.map(d => {
        const ds = dayStats(sessions, d);
        return '<div class="row-item" style="cursor:pointer" onclick="openDayDetail(\'' + d + '\')">' +
          '<div class="avatar-dot">' + parseYMD(d).getDate() + '</div>' +
          '<div class="grow"><div class="t1">' + weekdayName(d) + ' ' + dayLabel(d) + '</div>' +
          '<div class="t2">' + fmtN(ds.km) + ' كم • ' + fmtN(ds.hours) + ' س • ' + fmtN(ds.trips) + ' رحلة</div></div>' +
          '<div class="side ' + (isDaily() ? 'res-t' : (ds.profit >= 0 ? 'pos-t' : 'neg-t')) + '">' + money(isDaily() ? -ds.profit : ds.profit) + '</div></div>';
      }).join('') + '</div>';
  }).join('');
}

/* ================= 2) reports ================= */
async function renderReportsTab(body) {
  const sessions = modeSessions(await DB.all('sessions'));
  const purchases = await DB.all('purchases');
  const maints = await DB.all('maintenance');
  const closed = (await kvGet('closedMonths', [])) || [];

  const mst = monthStats(sessions, AR.month);
  const closedMark = closed.includes(AR.month) ? '<span class="badge orange">شهر مغلق 🔒</span>' : '';

  /* platform breakdown */
  const plats = PLATFORM_KEYS.map(k => {
    const list = sessions.filter(s => monthKey(s.date) === AR.month && s.platform === k);
    return { k, st: periodStats(list) };
  }).filter(p => p.st.count > 0);

  const monthDays = sortedDates(sessions.filter(s => monthKey(s.date) === AR.month));

  let html = '<div class="card">' +
    field('اختر الشهر', '<input class="input" type="month" id="rep-month" value="' + AR.month + '">') +
    '<div class="stat-grid">' +
    '<div class="stat"><div class="lbl">الدخل الصافي</div><div class="val">' + money(mst.net) + '</div></div>' +
    '<div class="stat"><div class="lbl">الربح الشخصي</div><div class="val ' + (mst.profit >= 0 ? 'pos-t' : 'neg-t') + '">' + money(mst.profit) + '</div></div>' +
    '<div class="stat"><div class="lbl">الهامش</div><div class="val">' + fmtPct(mst.margin) + '</div></div>' +
    '<div class="stat"><div class="lbl">أيام العمل</div><div class="val">' + fmtN(monthDays.length) + ' / ' + fmtN(S.targetDays) + '</div></div>' +
    '<div class="stat"><div class="lbl">كيلومترات</div><div class="val">' + fmtN(mst.km) + '</div></div>' +
    '<div class="stat"><div class="lbl">ساعات</div><div class="val">' + fmtN(mst.hours) + '</div></div>' +
    '<div class="stat"><div class="lbl">مخصصات الخزنتين</div><div class="val res-t">' + money(mst.fuel + mst.maint) + '</div></div>' +
    '<div class="stat"><div class="lbl">مصاريف مباشرة</div><div class="val neg-t">' + money(mst.direct) + '</div></div>' +
    '</div>' +
    '<div class="btn-row" style="margin-top:12px">' +
    '<button class="btn btn-sm" id="rep-pdf">📄 تقرير PDF</button>' +
    '<button class="btn btn-sm" id="rep-csv">📥 CSV</button>' +
    '<button class="btn btn-sm" id="rep-xls">📊 Excel</button>' +
    '<button class="btn btn-sm ' + (closedMark ? '' : 'btn-danger') + '" id="rep-close">🔒 إغلاق الشهر</button>' +
    '</div></div>';

  /* platform breakdown table */
  if (plats.length) {
    html += '<div class="card"><div class="card-title">تفصيل التطبيقات</div><div class="tbl-wrap"><table class="tbl">' +
      '<thead><tr><th>التطبيق</th><th>جلسات</th><th>صافي</th><th>ربح شخصي</th><th>هامش</th></tr></thead><tbody>' +
      plats.map(p => '<tr><td>' + PLATFORMS[p.k] + '</td><td>' + p.st.count + '</td><td>' + money(p.st.net) + '</td>' +
        '<td class="' + (p.st.profit >= 0 ? 'pos-t' : 'neg-t') + '">' + money(p.st.profit) + '</td><td>' + fmtPct(p.st.margin) + '</td></tr>').join('') +
      '</tbody></table></div></div>';
  }

  /* per-day table */
  if (monthDays.length) {
    html += '<div class="card"><div class="card-title">تفصيل الأيام</div><div class="tbl-wrap"><table class="tbl">' +
      '<thead><tr><th>اليوم</th><th>صافي</th><th>ربح</th><th>هامش</th><th>كم</th><th>س</th></tr></thead><tbody>' +
      monthDays.map(d => {
        const ds = dayStats(sessions, d);
        return '<tr><td>' + weekdayName(d) + ' ' + dayLabel(d) + '</td><td>' + money(ds.net) + '</td>' +
          '<td class="' + (ds.profit >= 0 ? 'pos-t' : 'neg-t') + '">' + money(ds.profit) + '</td>' +
          '<td>' + fmtPct(ds.margin) + '</td><td>' + fmtN(ds.km) + '</td><td>' + fmtN(ds.hours) + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td>الإجمالي</td><td>' + money(mst.net) + '</td><td>' + money(mst.profit) + '</td><td>' + fmtPct(mst.margin) + '</td><td>' + fmtN(mst.km) + '</td><td>' + fmtN(mst.hours) + '</td></tr></tfoot>' +
      '</table></div></div>';
  } else {
    html += '<div class="card"><div class="empty"><div class="d">لا توجد سجلات في هذا الشهر — اختر شهرًا آخر</div></div></div>';
  }

  /* yearly report — Pro */
  if (isPro()) {
    const yStats = [];
    let yTot = periodStats(sessions.filter(s => s.date.startsWith(AR.year + '-')));
    for (let m = 1; m <= 12; m++) {
      const mk = AR.year + '-' + String(m).padStart(2, '0');
      yStats.push({ mk, st: monthStats(sessions, mk) });
    }
    html += '<div class="card"><div class="card-title">📅 تقرير سنوي' +
      '<span class="spacer"></span><input class="input" type="number" id="rep-year" value="' + AR.year + '" style="width:90px;min-height:36px;padding:6px 8px">' +
      '</div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الشهر</th><th>صافي</th><th>ربح</th><th>هامش</th><th>كم</th></tr></thead><tbody>' +
      yStats.map(r => '<tr><td>' + esc(monthName(r.mk)) + '</td><td>' + money(r.st.net) + '</td>' +
        '<td class="' + (r.st.profit >= 0 ? 'pos-t' : 'neg-t') + '">' + money(r.st.profit) + '</td>' +
        '<td>' + fmtPct(r.st.margin) + '</td><td>' + fmtN(r.st.km) + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td>سنة ' + AR.year + '</td><td>' + money(yTot.net) + '</td><td>' + money(yTot.profit) + '</td><td>' + fmtPct(yTot.margin) + '</td><td>' + fmtN(yTot.km) + '</td></tr></tfoot></table></div></div>';
  } else {
    html += '<div class="card"><div class="empty"><div class="ic">📅🔒</div>' +
      '<div class="t">التقرير السنوي — ميزة Pro</div>' +
      '<div class="d">شاهد أداء العربية سنة كاملة شهرًا بشهر وقارن بالسنوات السابقة.</div>' +
      '<button class="btn btn-pri" id="rep-year-up">💎 افتح النسخة الكاملة</button></div></div>';
  }

  body.innerHTML = html;

  body.querySelector('#rep-month').addEventListener('change', e => { AR.month = e.target.value || AR.month; go('archive'); });
  const yearUp = body.querySelector('#rep-year-up');
  if (yearUp) yearUp.onclick = () => upgradeModal('التقرير السنوي');
  const yearInp = body.querySelector('#rep-year');
  if (yearInp) yearInp.addEventListener('change', e => { AR.year = +e.target.value || AR.year; go('archive'); });
  body.querySelector('#rep-pdf').onclick = () => { if (!requirePro('تقرير PDF')) return; monthPDF(sessions, purchases, maints); };
  body.querySelector('#rep-csv').onclick = () => monthCSV(sessions);
  body.querySelector('#rep-xls').onclick = () => { if (!requirePro('تصدير Excel')) return; monthXLS(sessions); };
  body.querySelector('#rep-close').onclick = async () => {
    const isClosed = closed.includes(AR.month);
    if (isClosed) {
      await kvSet('closedMonths', closed.filter(x => x !== AR.month));
      toast('🔓 تم فتح الشهر للتحرير (البيانات لم تُمس أبدًا)');
    } else {
      const ok = await confirmDlg({
        title: 'إغلاق ' + monthName(AR.month) + '؟',
        body: 'يُعلَم الشهر كمغلق للمراجعة. <b>كل سجلات اليوم تبقى محفوظة كما هي ولا يُحذف أي شيء</b>، وأرصدة الخزنتين تبقى محمولة تلقائيًا للشهر التالي، ويمكن عرض الشهر في أي وقت أو إعادة فتحه.',
        okText: '🔒 إغلاق'
      });
      if (!ok) return;
      await kvSet('closedMonths', closed.concat([AR.month]));
      toast('🔒 تم إغلاق ' + monthName(AR.month));
    }
    go('archive');
  };
}

function monthCSV(sessions) {
  const days = sortedDates(sessions.filter(s => monthKey(s.date) === AR.month));
  const rows = [['التاريخ', 'اليوم', 'صافي', 'ربح شخصي', 'هامش %', 'كم', 'ساعات', 'رحلات', 'مخصص وقود', 'مخصص صيانة', 'مصاريف مباشرة']];
  days.forEach(d => {
    const ds = dayStats(sessions, d);
    rows.push([d, weekdayName(d), Math.round(ds.net * 100) / 100, Math.round(ds.profit * 100) / 100,
      Math.round(ds.margin * 10) / 10, ds.km, ds.hours, ds.trips,
      Math.round(ds.fuel * 100) / 100, Math.round(ds.maint * 100) / 100, Math.round(ds.direct * 100) / 100]);
  });
  download('تقرير-' + AR.month + '.csv', toCSV(rows), 'text/csv;charset=utf-8');
}

function monthXLS(sessions) {
  const days = sortedDates(sessions.filter(s => monthKey(s.date) === AR.month));
  const rows = days.map(d => {
    const ds = dayStats(sessions, d);
    return [d, weekdayName(d), Math.round(ds.net * 100) / 100, Math.round(ds.profit * 100) / 100,
      Math.round(ds.margin * 10) / 10, ds.km, ds.hours, ds.trips];
  });
  download('تقرير-' + AR.month + '.xls', xlsDoc('تقرير ' + monthName(AR.month),
    ['التاريخ', 'اليوم', 'صافي', 'ربح شخصي', 'هامش %', 'كم', 'ساعات', 'رحلات'], rows),
    'application/vnd.ms-excel');
}

function monthPDF(sessions, purchases, maints) {
  const mst = monthStats(sessions, AR.month);
  const days = sortedDates(sessions.filter(s => monthKey(s.date) === AR.month));
  const W = walletBalances(sessions, purchases, maints);
  const b = '<h1>التقرير الشهري — ' + esc(monthName(AR.month)) + '</h1>' +
    '<div class="meta">' + esc(S.vehicleName) + (S.plate ? ' • ' + esc(S.plate) : '') + ' • ' + esc(S.fuelType) +
    ' • ' + fmtN(S.fuelPrice) + ' ج.م/لتر • استهلاك ' + fmtN(S.l100) + ' ل/100كم • مخصص صيانة ' + fmtN(S.maintPerKm) + ' ج.م/كم' + '</div>' +
    '<div class="cards">' +
    '<div class="c"><div class="k">الدخل الصافي</div><div class="v">' + fmtN(mst.net) + '</div></div>' +
    '<div class="c"><div class="k">الربح الشخصي</div><div class="v pos">' + fmtN(mst.profit) + '</div></div>' +
    '<div class="c"><div class="k">الهامش</div><div class="v">' + plainPct(mst.margin) + '</div></div>' +
    '<div class="c"><div class="k">مخصصات</div><div class="v res">' + fmtN(mst.fuel + mst.maint) + '</div></div>' +
    '<div class="c"><div class="k">كم</div><div class="v">' + fmtN(mst.km) + '</div></div>' +
    '<div class="c"><div class="k">ساعات</div><div class="v">' + fmtN(mst.hours) + '</div></div>' +
    '</div>' +
    '<h2>رصيد الخزنتين</h2><table><tr><th>خزنة البنزين</th><td>' + fmtN(W.fuelBal) + ' ج.م</td><th>خزنة الصيانة</th><td>' + fmtN(W.maintBal) + ' ج.م</td></tr></table>' +
    '<h2>تفصيل الأيام</h2><table><tr><th>التاريخ</th><th>صافي</th><th>ربح</th><th>هامش</th><th>كم</th><th>ساعات</th></tr>' +
    days.map(d => {
      const ds = dayStats(sessions, d);
      return '<tr><td>' + d + '</td><td>' + fmtN(ds.net) + '</td><td class="' + (ds.profit >= 0 ? 'pos' : 'neg') + '">' + fmtN(ds.profit) + '</td><td>' + plainPct(ds.margin) + '</td><td>' + fmtN(ds.km) + '</td><td>' + fmtN(ds.hours) + '</td></tr>';
    }).join('') + '</table>' +
    '<div class="meta" style="margin-top:14px">تم إنشاؤه من تطبيق «إدارة دخل السائق» — ' + new Date().toLocaleString('en-GB') + '</div>';
  printHTML('التقرير الشهري ' + AR.month, b);
}

/* ================= 3) maintenance log ================= */
async function renderMaintTab(body) {
  const maints = (await DB.all('maintenance')).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt - a.createdAt));
  const sessions = modeSessions(await DB.all('sessions'));
  const odo = currentOdo(sessions, maints);
  const today = todayStr();

  /* reminders */
  const reminders = CAT_LIST.map(ck => {
    const iv = S.intervals[ck];
    if (!iv || (!iv.km && !iv.months)) return null;
    const last = latestMaint(maints, ck);
    return { ck, iv, last, r: reminderFor(ck, last, iv, odo, today) };
  }).filter(Boolean);
  const active = reminders.filter(x => x.r.status === 'due' || x.r.status === 'overdue' || x.r.status === 'soon');

  let html = '';
  if (active.length) {
    html += '<div class="card"><div class="card-title">🔔 تذكيرات الصيانة</div>' +
      active.map(x => {
        const parts = [];
        if (x.iv.km && x.r.kmLeft !== null) parts.push(x.r.kmLeft > 0 ? 'باقي ' + fmtN(x.r.kmLeft) + ' كم' : 'متأخر ' + fmtN(-x.r.kmLeft) + ' كم');
        if (x.iv.months && x.r.daysLeft !== null) parts.push(x.r.daysLeft > 0 ? 'باقي ' + fmtN(x.r.daysLeft) + ' يوم' : 'متأخر ' + fmtN(-x.r.daysLeft) + ' يوم');
        const cls = x.r.status === 'overdue' ? 'red' : x.r.status === 'due' ? 'red' : 'orange';
        const word = x.r.status === 'overdue' ? 'متأخرة' : 'مستحقة قريبًا';
        return '<div class="kv"><span class="k">' + esc(catLabel(x.ck)) + ' <span class="t2">(' + parts.join(' أو ') + ')</span></span>' +
          '<span class="badge ' + cls + '">' + word + '</span></div>';
      }).join('') + '</div>';
  }

  html += '<div class="btn-row" style="margin-bottom:12px">' +
    '<button class="btn btn-pri" id="mt-add">＋ تسجيل صيانة</button>' +
    '<button class="btn" id="mt-repeat">🔁 تكرار آخر صيانة</button>' +
    '<button class="btn" id="mt-export">📤 تصدير</button>' +
    '</div>';

  /* last workshop per category */
  const lastW = CAT_LIST.map(ck => {
    const last = latestMaint(maints, ck);
    return last ? { ck, last } : null;
  }).filter(Boolean);
  if (lastW.length) {
    html += '<div class="card"><div class="card-title">📍 آخر مكان صيانة لكل نوع</div>' +
      lastW.map(x => '<div class="kv"><span class="k">' + esc(catLabel(x.ck)) + '</span>' +
        '<span class="v" style="text-align:left">' + esc(x.last.workshopName || '—') +
        ' <span class="t2">' + dayLabel(x.last.date) + ' • ' + money(x.last.cost) + '</span></span></div>').join('') +
      '</div>';
  }

  /* filters */
  html += '<div class="card tight"><div class="grid2">' +
    field('بحث', txtInput('q', AR.maintQ, 'اسم ورشة، قطعة، عطل…').replace('data-f', 'data-mq')) +
    field('النوع', '<select class="input" data-mc=""><option value="">الكل</option>' +
      options(allCatKeys().map(k => ({ v: k, l: catLabel(k) })), AR.maintCat).replace('value=""', 'value="" ') + '</select>') +
    '</div></div>';

  /* entries */
  const q = (AR.maintQ || '').trim();
  const list = maints.filter(m => {
    if (AR.maintCat && m.category !== AR.maintCat) return false;
    if (q) {
      const hay = (m.workshopName || '') + ' ' + (m.partBrand || '') + ' ' + (m.faultDesc || '') + ' ' + (m.repairDesc || '') + ' ' + (m.notes || '');
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  html += '<div class="card list-card"><div class="card-title" style="padding:12px 0 2px">🔧 سجل الصيانة (' + fmtN(list.length) + ')</div>';
  if (!list.length) html += '<div class="empty"><div class="d">لا توجد سجلات صيانة بعد — سجل أول عملية (زيت، فلاتر، كاوتش…)</div></div>';
  html += list.map(m =>
    '<div class="row-item" style="align-items:flex-start">' +
    (m.receiptPhoto ? '<img class="photo-thumb" src="' + m.receiptPhoto + '" data-photo>' : '<div class="avatar-dot">🔧</div>') +
    '<div class="grow"><div class="t1">' + esc(maintName(m)) +
    ' <span class="badge gray">' + esc(fullDayLabel(m.date)) + '</span></div>' +
    '<div class="t2">عداد ' + fmtN(m.odo) + (m.workshopName ? ' • 📍 ' + esc(m.workshopName) : '') +
    (m.partBrand ? ' • قطعة: ' + esc(m.partBrand) : '') + '</div>' +
    (m.faultDesc ? '<div class="t2" style="margin-top:4px"><b>وصف العطل:</b> ' + esc(m.faultDesc) + '</div>' : '') +
    (m.repairDesc ? '<div class="t2"><b>ما تم إصلاحه:</b> ' + esc(m.repairDesc) + '</div>' : '') +
    (m.nextDueKm || m.nextDueDate ? '<div class="t2">⏭️ القادم: ' + (m.nextDueKm ? 'عداد ' + fmtN(m.nextDueKm) : '') + (m.nextDueDate ? (m.nextDueKm ? ' أو ' : '') + dayLabel(m.nextDueDate) : '') + '</div>' : '') +
    (m.notes ? '<div class="t2">📝 ' + esc(m.notes) + '</div>' : '') +
    '</div>' +
    '<div class="side">' + money(m.cost) +
    (isDaily() ? '' : (m.fromWallet ? '<div style="margin-top:2px"><span class="badge orange">من خزنة الصيانة</span></div>' : '<div style="margin-top:2px"><span class="badge gray">دفعة خارجية</span></div>')) +
    '<div style="margin-top:4px">' + vBtn('maintenance', m.id) + eBtn('edit-maint') + dBtn('del-maint', m.id) +
    '<input type="hidden" data-mid="' + m.id + '"></div></div>' +
    '</div>').join('');
  html += '</div>';

  body.innerHTML = html;

  body.querySelector('#mt-add').onclick = () => openMaintForm(null);
  body.querySelector('#mt-repeat').onclick = openRepeatLast;
  body.querySelector('#mt-export').onclick = () => showMaintExportMenu(maints);

  body.querySelectorAll('[data-mq]').forEach(el => el.addEventListener('input', () => { AR.maintQ = el.value; }));
  body.querySelectorAll('[data-mq]').forEach(el => el.addEventListener('change', () => { AR.maintQ = el.value; renderArchiveTab(); }));
  const mc = body.querySelector('select[data-mc], select[data-mc=""]');
  if (mc) mc.addEventListener('change', () => { AR.maintCat = mc.value; renderArchiveTab(); });

  body.querySelectorAll('[data-mid]').forEach(inp => {
    const id = inp.dataset.mid;
    const card = inp.closest('.row-item');
    const photo = card.querySelector('[data-photo]');
    if (photo) photo.onclick = () => openModal('<img src="' + photo.src + '" style="width:100%;border-radius:12px">' +
      '<div class="modal-actions"><button class="btn btn-pri" onclick="closeModal()">إغلاق</button></div>');
    const rec = maints.find(x => x.id === id);
    card.querySelector('[data-act="view-rec"]').onclick = () => showRecHistory('maintenance', id);
    card.querySelector('[data-act="edit-maint"]').onclick = () => openMaintForm(rec);
    card.querySelector('[data-act="del-maint"]').onclick = () => {
      confirmDelete('maintenance', rec, 'صيانة ' + maintName(rec) + ' بمبلغ ' + fmtN(rec.cost) + ' ج.م — ' + fullDayLabel(rec.date));
    };
  });
}

function showMaintExportMenu(maints) {
  openModal('<div class="modal-title">📤 تصدير سجل الصيانة</div>' +
    '<div class="btn-row"><button class="btn" id="me-csv">CSV</button>' +
    '<button class="btn" id="me-xls">Excel</button>' +
    '<button class="btn" id="me-pdf">PDF (طباعة)</button></div>' +
    '<div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button></div>',
    { onMount: w => {
      const rows = () => maints.map(m => [m.date, maintKind(m) === 'routine' ? 'صيانة دورية' : 'عطل / إصلاح', maintName(m), m.odo, m.cost,
        m.workshopName || '', m.workshopAddr || '', m.partBrand || '',
        m.faultDesc || '', m.repairDesc || '', m.prevCost !== undefined ? m.prevCost : '', m.nextDueKm || '', m.nextDueDate || '',
        isDaily() ? '—' : (m.fromWallet ? 'من الخزنة' : 'خارجية'), m.notes || '']);
      w.querySelector('#me-csv').onclick = () => {
        download('سجل-الصيانة.csv', toCSV([['التاريخ', 'التصنيف', 'النوع', 'العداد', 'التكلفة', 'الورشة', 'العنوان', 'القطعة', 'وصف العطل', 'ما تم إصلاحه', 'السعر القديم', 'القادم كم', 'القادم تاريخ', 'الدفع', 'ملاحظات'], ...rows()]), 'text/csv;charset=utf-8');
      };
      w.querySelector('#me-xls').onclick = () => {
        if (!requirePro('تصدير Excel')) return;
        download('سجل-الصيانة.xls', xlsDoc('سجل صيانة ' + S.vehicleName,
          ['التاريخ', 'التصنيف', 'النوع', 'العداد', 'التكلفة', 'الورشة', 'العنوان', 'القطعة', 'وصف العطل', 'ما تم إصلاحه', 'السعر القديم', 'القادم كم', 'القادم تاريخ', 'الدفع', 'ملاحظات'], rows()),
          'application/vnd.ms-excel');
      };
      w.querySelector('#me-pdf').onclick = () => {
        if (!requirePro('تقرير PDF')) return;
        const b = '<h1>سجل صيانة و تاريخ ' + esc(S.vehicleName) + '</h1>' +
          '<div class="meta">عداد حالي: ' + fmtN(S.odo) + ' • ' + esc(S.plate || '') + '</div>' +
          '<table><tr><th>التاريخ</th><th>التصنيف</th><th>النوع</th><th>عداد</th><th>تكلفة</th><th>السعر القديم</th><th>الورشة</th><th>العطل</th><th>الإصلاح</th></tr>' +
          maints.map(m => '<tr><td>' + m.date + '</td><td>' + (maintKind(m) === 'routine' ? 'صيانة دورية' : 'عطل / إصلاح') + '</td><td>' + esc(maintName(m)) + '</td><td>' + fmtN(m.odo) + '</td><td>' + fmtN(m.cost) + '</td><td>' + (m.prevCost !== undefined ? fmtN(m.prevCost) : '') + '</td><td>' + esc(m.workshopName || '') + '</td><td>' + esc(m.faultDesc || '') + '</td><td>' + esc(m.repairDesc || '') + '</td></tr>').join('') +
          '</table>';
        printHTML('سجل الصيانة', b);
      };
    } });
}

/* maintenance entry form */
function openMaintForm(existing, prefill) {
  const isEdit = !!existing;
  const base = existing || prefill || {};
  const d = Object.assign({
    date: todayStr(), odo: +S.odo || '', category: 'oil', cost: '',
    workshopName: '', workshopAddr: '', partBrand: '',
    nextDueKm: '', nextDueDate: '', kind: '', customName: '',
    faultDesc: '', repairDesc: '', fromWallet: true, notes: '', receiptPhoto: ''
  }, base);
  if (!isEdit && !prefill) {
    const iv = S.intervals[d.category];
    if (iv) {
      if (iv.km) d.nextDueKm = (+d.odo || 0) + iv.km;
      if (iv.months) d.nextDueDate = addDays(d.date, iv.months * 30);
    }
  }

  function formHTML(d) {
    return field('التاريخ', dateInput('date', d.date)) +
      '<div class="grid2">' +
      field('عداد المسافة', numInput('odo', d.odo, '')) +
      field('نوع الصيانة', '<select class="input" data-f="category">' + options(allCatKeys().map(k => ({ v: k, l: catLabel(k) })), d.category) + '</select>') +
      '</div>' +
      (d.category === 'other'
        ? field('اسم الصيانة (بدل «أخرى» — عشان تعرفها بعدين)', txtInput('customName', d.customName, 'مثلاً: تغيير سير مروحة'))
        : '') +
      field('التكلفة (ج.م)', numInput('cost', d.cost, '0', true)) +
      '<div class="grid2">' +
      field('الورشة / المكان', txtInput('workshopName', d.workshopName, 'الاسم')) +
      field('العنوان أو لينك الخريطة', txtInput('workshopAddr', d.workshopAddr, 'اختياري')) +
      '</div>' +
      '<div class="grid2">' +
      field('ماركة القطعة (اختياري)', txtInput('partBrand', d.partBrand, '')) +
      field('ملاحظات', txtInput('notes', d.notes, '')) +
      '</div>' +
      '<div class="grid2">' +
      field('الصيانة القادمة — عداد', numInput('nextDueKm', d.nextDueKm, 'تُقترح تلقائيًا')) +
      field('الصيانة القادمة — تاريخ', dateInput('nextDueDate', d.nextDueDate)) +
      '</div>' +
      field('وصف العطل 🩺', '<textarea class="input" data-f="faultDesc" rows="2" placeholder="ما كان العطل؟ الأعراض؟ إمتى بدأ؟">' + esc(d.faultDesc || '') + '</textarea>') +
      field('ما تم إصلاحه أو تغييره 🛠️', '<textarea class="input" data-f="repairDesc" rows="2" placeholder="أسماء القطع، الكميات، الشغلانة…">' + esc(d.repairDesc || '') + '</textarea>') +
      (isDaily() ? '' : '<label class="check-row" style="color:var(--txt);font-weight:700">' +
      '<input type="checkbox" data-f="fromWallet" ' + (d.fromWallet ? 'checked' : '') + '> مدفوعة من خزنة الصيانة ' +
      fInfo('الدفع من الخزنة', [
        'لو مفعّلة: يُخصم المبلغ من رصيد خزنة الصيانة فقط.',
        'لو غير مفعّلة (دفعة خارجية من جيبك مباشرة): لا تؤثر على الخزنة ولا على الربح الشخصي.'
      ]) + '</label>') +
      '<div class="field"><label>صورة الفاتورة (اختياري)</label><div style="display:flex;gap:8px;align-items:center">' +
      (d.receiptPhoto ? '<img class="photo-thumb" id="mt-photo-preview" src="' + d.receiptPhoto + '">' : '') +
      '<button class="btn btn-sm" id="mt-photo-btn">📷 ' + (d.receiptPhoto ? 'تغيير الصورة' : 'إضافة صورة') + '</button></div></div>';
  }

  openModal('<div class="modal-title">' + (isEdit ? 'تعديل سجل صيانة' : 'تسجيل صيانة') + '</div>' +
    '<div id="mt-form">' + formHTML(d) + '</div>' +
    '<div class="modal-actions">' +
    '<button class="btn" onclick="closeModal()">إلغاء</button>' +
    '<button class="btn btn-pri" id="mt-save">💾 حفظ</button></div>',
    { onMount: w => {
      let cur = Object.assign({}, d);
      const bind = () => {
        w.querySelectorAll('#mt-form [data-f]').forEach(el => {
          const h = () => {
            if (el.type === 'checkbox') cur[el.dataset.f] = el.checked;
            else cur[el.dataset.f] = el.value;
          };
          el.addEventListener('input', h);
          el.addEventListener('change', () => {
            h();
            /* when category/date/odo changes in add mode, re-suggest next due */
            if (!isEdit && ['category', 'date', 'odo'].includes(el.dataset.f)) {
              const iv = S.intervals[cur.category];
              const nd = Object.assign({}, cur);
              if (iv && iv.km) nd.nextDueKm = (+cur.odo || 0) + iv.km;
              if (iv && iv.months) nd.nextDueDate = addDays(cur.date || todayStr(), iv.months * 30);
              w.querySelector('#mt-form').innerHTML = formHTML(nd);
              cur = nd;
              bind();
            }
          });
        });
      };
      bind();
      w.querySelector('#mt-photo-btn').onclick = () => pickImage(dataUrl => {
        cur.receiptPhoto = dataUrl;
        w.querySelector('#mt-form').innerHTML = formHTML(cur);
        bind();
      });
      w.querySelector('#mt-save').onclick = async () => {
        if (!(+cur.cost > 0)) { toast('أدخل تكلفة أكبر من صفر'); return; }
        if (!(+cur.odo > 0)) { toast('أدخل عداد المسافة'); return; }
        const rec = existing || { id: uid(), createdAt: Date.now(), history: [] };
        rec.date = cur.date || todayStr();
        rec.odo = +cur.odo || 0;
        rec.category = cur.category;
        rec.cost = +cur.cost;
        rec.workshopName = cur.workshopName || '';
        rec.workshopAddr = cur.workshopAddr || '';
        rec.partBrand = cur.partBrand || '';
        rec.nextDueKm = +cur.nextDueKm || null;
        rec.nextDueDate = cur.nextDueDate || null;
        rec.faultDesc = cur.faultDesc || '';
        rec.repairDesc = cur.repairDesc || '';
        rec.fromWallet = !isDaily() && !!cur.fromWallet;
        rec.kind = maintKind({ category: rec.category, kind: cur.kind });
        rec.customName = cur.category === 'other' ? (cur.customName || '') : '';
        rec.notes = cur.notes || '';
        rec.receiptPhoto = cur.receiptPhoto || '';
        rec.updatedAt = Date.now();
        rec.history = (rec.history || []).concat([{ ts: Date.now(), action: isEdit ? 'edit' : 'create' }]);
        await DB.put('maintenance', rec);
        if (rec.odo > (+S.odo || 0)) { S.odo = rec.odo; await saveSettings(); }
        closeModal();
        toast(isEdit ? '✅ تم تعديل السجل' : '✅ تم تسجيل الصيانة');
        go(Nav.current);
      };
    } });
}

/* repeat last maintenance */
function openRepeatLast() {
  DB.all('maintenance').then(maints => {
    const used = CAT_LIST.filter(k => maints.some(m => m.category === k));
    if (!used.length) { toast('لا توجد سجلات صيانة سابقة للتكرار'); return; }
    openModal('<div class="modal-title">🔁 تكرار آخر صيانة</div>' +
      '<div class="t2" style="margin-bottom:10px">اختر النوع لنسخ بيانات آخر مرة (الورشة، القطعة، الأعطال) وتعديل التاريخ والعداد والتكلفة فقط.</div>' +
      field('النوع', '<select class="input" id="rp-cat">' + options(used.map(k => ({ v: k, l: catLabel(k) })), used[0]) + '</select>') +
      '<div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button>' +
      '<button class="btn btn-pri" id="rp-go">متابعة</button></div>',
      { onMount: w => {
        w.querySelector('#rp-go').onclick = () => {
          const ck = w.querySelector('#rp-cat').value;
          const last = latestMaint(maints, ck);
          closeModal();
          openMaintForm(null, {
            category: last.category,
            cost: last.cost, workshopName: last.workshopName, workshopAddr: last.workshopAddr,
            partBrand: last.partBrand, faultDesc: last.faultDesc, repairDesc: last.repairDesc,
            date: todayStr(), odo: +S.odo || ''
          });
        };
      } });
  });
}

/* ================= 4) vehicle health timeline ================= */
async function renderHealthTab(body) {
  const maints = (await DB.all('maintenance')).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt - a.createdAt));
  let html = '<div class="card tight"><div class="grid2">' +
    field('بحث في الأعطال والإصلاحات', '<input class="input" data-hq value="' + esc(AR.healthQ) + '" placeholder="كلمة من العطل أو القطعة…">') +
    field('النوع', '<select class="input" data-hc><option value="">الكل</option>' + options(allCatKeys().map(k => ({ v: k, l: catLabel(k) })), AR.healthCat) + '</select>') +
    '</div>' +
    '<div class="btn-row"><button class="btn btn-sm" id="hh-pdf">📄 PDF</button><button class="btn btn-sm" id="hh-csv">📥 CSV</button></div>' +
    '</div>';

  const q = (AR.healthQ || '').trim();
  const list = maints.filter(m => {
    if (AR.healthCat && m.category !== AR.healthCat) return false;
    if (q) {
      const hay = (m.faultDesc || '') + ' ' + (m.repairDesc || '') + ' ' + (m.workshopName || '') + ' ' + (m.partBrand || '') + ' ' + (m.notes || '');
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  html += '<div class="card"><div class="card-title">🩺 خط زمني للعربية — العطل ثم الإصلاح (' + fmtN(list.length) + ')</div>' +
    (list.length ? '<div class="tl">' + list.map(m =>
      '<div class="tl-item ' + (m.faultDesc ? 'bad' : '') + '">' +
      '<div style="font-weight:800;font-size:.9rem">' + esc(maintName(m)) + ' — ' + esc(fullDayLabel(m.date)) + '</div>' +
      '<div class="t2">عداد ' + fmtN(m.odo) + ' • تكلفة ' + money(m.cost) + (m.workshopName ? ' • ' + esc(m.workshopName) : '') + '</div>' +
      (m.faultDesc ? '<div class="t2" style="margin-top:3px"><b>العطل:</b> ' + esc(m.faultDesc) + '</div>' : '') +
      (m.repairDesc ? '<div class="t2"><b>الإصلاح:</b> ' + esc(m.repairDesc) + '</div>' : '') +
      '</div>').join('') + '</div>' : '<div class="empty"><div class="d">لا توجد سجلات مطابقة</div></div>') +
    '</div>';

  body.innerHTML = html;
  body.querySelectorAll('[data-hq]').forEach(el => el.addEventListener('input', () => { AR.healthQ = el.value; }));
  body.querySelectorAll('[data-hq]').forEach(el => el.addEventListener('change', () => renderArchiveTab()));
  body.querySelectorAll('[data-hc]').forEach(el => el.addEventListener('change', () => { AR.healthCat = el.value; renderArchiveTab(); }));
  body.querySelector('#hh-pdf').onclick = () => {
    if (!requirePro('تصدير PDF')) return;
    const b = '<h1>التاريخ الصحي لـ ' + esc(S.vehicleName) + '</h1><div class="meta">' + esc(S.plate || '') + '</div>' +
      '<table><tr><th>التاريخ</th><th>التصنيف</th><th>النوع</th><th>عداد</th><th>تكلفة</th><th>وصف العطل</th><th>ما تم إصلاحه</th></tr>' +
      maints.map(m => '<tr><td>' + m.date + '</td><td>' + (maintKind(m) === 'routine' ? 'صيانة دورية' : 'عطل / إصلاح') + '</td><td>' + esc(maintName(m)) + '</td><td>' + fmtN(m.odo) + '</td><td>' + fmtN(m.cost) + '</td><td>' + esc(m.faultDesc || '') + '</td><td>' + esc(m.repairDesc || '') + '</td></tr>').join('') + '</table>';
    printHTML('تاريخ العربية الصحي', b);
  };
  body.querySelector('#hh-csv').onclick = () => {
    const rows = maints.map(m => [m.date, maintKind(m) === 'routine' ? 'صيانة دورية' : 'عطل / إصلاح', maintName(m), m.odo, m.cost, m.faultDesc || '', m.repairDesc || '', m.workshopName || '']);
    download('تاريخ-العربية.csv', toCSV([['التاريخ', 'التصنيف', 'النوع', 'العداد', 'التكلفة', 'وصف العطل', 'الإصلاح', 'الورشة'], ...rows]), 'text/csv;charset=utf-8');
  };
}

/* ================= session edit from day modal ================= */
function openSessionEdit(rec) {
  const d = Object.assign({}, rec);
  openModal('<div class="modal-title">تعديل جلسة — ' + esc(PLATFORMS[rec.platform]) + '</div>' +
    field('التاريخ', dateInput('date', d.date)) +
    '<div class="grid2">' +
    field('التطبيق', '<select class="input" data-f="platform">' + options(PLATFORM_KEYS.map(k => ({ v: k, l: PLATFORMS[k] })), d.platform) + '</select>') +
    '<div class="field"><label>نوع الدخل</label><div class="seg" id="se-mode">' +
    '<button type="button" class="' + (d.mode !== 'gross' ? 'on' : '') + '" data-v="net">صافي</button>' +
    '<button type="button" class="' + (d.mode === 'gross' ? 'on' : '') + '" data-v="gross">إجمالي</button></div></div>' +
    '</div>' +
    field(d.mode === 'gross' ? 'الدخل الإجمالي' : 'الدخل الصافي', numInput('amount', d.amount, '', true)) +
    field('نسبة العمولة % <span class="t2">(تُستخدم فقط في وضع إجمالي)</span>', numInput('commissionPct', d.commissionPct, '')) +
    '<div class="grid2">' +
    field('بقشيش/حوافز', numInput('tips', d.tips, '0')) +
    '<div class="field" style="align-self:end"><label class="check-row" style="color:var(--txt)">' +
    '<input type="checkbox" data-f="tipsIncluded" ' + (d.tipsIncluded ? 'checked' : '') + '> البقشيش داخل الدخل</label></div>' +
    '</div>' +
    '<div class="grid2">' +
    field('كم', numInput('km', d.km, '')) +
    field('ساعات', numInput('hours', d.hours, '')) +
    '</div>' +
    '<div class="grid2">' +
    field('رحلات', numInput('trips', d.trips, '')) +
    field('مصاريف مباشرة', numInput('directExpenses', d.directExpenses, '')) +
    '</div>' +
    '<div class="grid2">' +
    field('عداد البداية', numInput('odoStart', d.odoStart, '')) +
    field('عداد النهاية', numInput('odoEnd', d.odoEnd, '')) +
    '</div>' +
    field('ملاحظات', '<textarea class="input" data-f="notes" rows="2">' + esc(d.notes || '') + '</textarea>') +
    '<div class="t2" style="margin:6px 0">⚠️ التعديل لا يغيّر لقطة الإعدادات المحفوظة مع السجل (سعر اللتر ' + fmtN(d.snap ? d.snap.fuelPrice : 0) + '، استهلاك ' + fmtN(d.snap ? d.snap.l100 : 0) + '، صيانة ' + fmtN(d.snap ? d.snap.maintKm : 0) + ' ج.م/كم) — السجلات التاريخية لا تتأثر بتغيير الإعدادات.</div>' +
    '<div class="modal-actions">' +
    '<button class="btn" onclick="closeModal()">إلغاء</button>' +
    '<button class="btn btn-pri" id="se-save">💾 حفظ التعديل</button></div>',
    { onMount: w => {
      const cur = Object.assign({}, d);
      w.querySelectorAll('[data-f]').forEach(el => {
        const h = () => { cur[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; };
        el.addEventListener('input', h);
        el.addEventListener('change', h);
      });
      w.querySelectorAll('#se-mode button').forEach(b => b.onclick = () => {
        cur.mode = b.dataset.v;
        if (cur.mode === 'gross' && !(+cur.commissionPct > 0)) {
          cur.commissionPct = S.commission[cur.platform] || 0;
          const inp = w.querySelector('[data-f="commissionPct"]');
          if (inp) inp.value = cur.commissionPct;
        }
        w.querySelectorAll('#se-mode button').forEach(x => x.classList.toggle('on', x === b));
      });
      w.querySelector('#se-save').onclick = async () => {
        const before = JSON.parse(JSON.stringify(rec));
        rec.date = cur.date || rec.date;
        rec.platform = cur.platform;
        rec.mode = cur.mode;
        rec.amount = +cur.amount || 0;
        rec.commissionPct = cur.mode === 'gross' ? (+cur.commissionPct || 0) : 0;
        rec.tips = +cur.tips || 0;
        rec.tipsIncluded = !!cur.tipsIncluded;
        rec.km = +cur.km || 0;
        rec.hours = +cur.hours || 0;
        rec.trips = +cur.trips || 0;
        rec.directExpenses = +cur.directExpenses || 0;
        rec.odoStart = +cur.odoStart || null;
        rec.odoEnd = +cur.odoEnd || null;
        rec.notes = cur.notes || '';
        rec.updatedAt = Date.now();
        rec.history = (rec.history || []).concat([{ ts: Date.now(), action: 'edit', before }]);
        if (!(rec.amount > 0)) { toast('الدخل يجب أن يكون أكبر من صفر'); return; }
        await DB.put('sessions', rec);
        closeModal();
        toast('✅ تم حفظ التعديل');
        go(Nav.current);
      };
    } });
}
