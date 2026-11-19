/* ===== views-maint.js — جدول الصيانة: مكان واحد واضح لكل المواعيد والتعديل ===== */
'use strict';

Views.maint = async function (root) {
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  const sessions = modeSessions(await DB.all('sessions'));
  const maints = await DB.all('maintenance');
  const odo = currentOdo(sessions, maints);
  const today = todayStr();

  const rows = CAT_LIST.map(ck => {
    const iv = S.intervals[ck] || {};
    const last = latestMaint(maints, ck);
    const info = maintDueInfo(ck, last, iv, odo, today);
    return { ck, iv, last, info };
  });
  const order = { missed: 0, soon: 1, ok: 2, none: 3 };
  rows.sort((a, b) => (order[a.info ? a.info.level : 'none']) - (order[b.info ? b.info.level : 'none']));
  const missedCount = rows.filter(r => r.info && r.info.level === 'missed').length;
  const soonCount = rows.filter(r => r.info && r.info.level === 'soon').length;

  let html = '';

  /* ---------- عداد سريع ---------- */
  html += '<div class="card" style="border-color:var(--pri)"><div class="card-title">📍 عداد عربيتك' +
    '<span class="spacer"></span>' +
    (missedCount ? '<span class="badge red">🔴 فاتك ' + missedCount + '</span>' : '') +
    (soonCount ? '<span class="badge green">🟢 قربت ' + soonCount + '</span>' : '') + '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between">' +
    '<div><div class="lbl muted">الرقم الحالي</div><div class="big-val">' + fmtN(odo) + ' <span class="small">كم</span></div></div>' +
    '<button class="btn btn-pri" id="maint-edit-odo">✏️ تعديل العداد</button></div>' +
    '<div class="t2" style="margin-top:8px">تعديل العداد بيحدّث كل المواعيد هنا فورًا.</div></div>';

  /* ---------- الجدول ---------- */
  html += '<div class="card list-card"><div class="card-title" style="padding:12px 0 2px">🔧 جدول الصيانة' +
    '<span class="spacer"></span><button class="btn btn-sm btn-pos" id="maint-add">＋ صيانة جديدة</button></div>';

  for (const r of rows) {
    const { ck, iv, last, info } = r;
    const period = [];
    if (iv.km) period.push('كل <bdi dir="ltr">' + fmtN(iv.km) + '</bdi> كم');
    if (iv.months) period.push('أو <bdi dir="ltr">' + iv.months + '</bdi> شهر');
    const line = [];
    if (info && info.nextDueKm !== null) line.push('📏 التغيير الجاي عند <bdi dir="ltr">' + fmtN(info.nextDueKm) + '</bdi> كم');
    if (info && info.kmLeft !== null) line.push('باقي <bdi dir="ltr">' + fmtN(Math.max(0, info.kmLeft)) + '</bdi> كم');
    if (info && info.daysLeft !== null) line.push('أو بعد <bdi dir="ltr">' + Math.max(0, Math.round(info.daysLeft / 30)) + '</bdi> شهر');

    let badge = '<span class="badge gray">بدون تذكير</span>';
    if (info) {
      if (info.level === 'missed') badge = '<span class="badge red">🔴 فاتك!</span>';
      else if (info.level === 'soon') badge = '<span class="badge green">🟢 قربت!</span>';
      else badge = '<span class="badge gray">تمام ✓</span>';
    }

    const actions = [];
    if (iv.km || iv.months) actions.push('<button class="btn btn-sm btn-pos" data-done="' + ck + '">✅ تم التغيير</button>');
    if (last) actions.push('<button class="btn btn-sm" data-editlast="' + ck + '">✏️ تعديل</button>');
    else if (iv.km || iv.months) actions.push('<button class="btn btn-sm" data-done="' + ck + '">＋ سجّل أول مرة</button>');

    html += '<div class="row-item" style="align-items:flex-start">' +
      '<div class="avatar-dot">' + (info && info.level === 'missed' ? '🚨' : info && info.level === 'soon' ? '🟢' : '🔧') + '</div>' +
      '<div class="grow"><div class="t1">' + badge + ' <b>' + esc(CATS[ck]) + '</b></div>' +
      '<div class="t2" style="line-height:1.9">' +
      (period.length ? '⏱️ ' + period.join(' — ') + '<br>' : '') +
      (line.length ? line.join(' — ') + '<br>' : '') +
      (last
        ? 'آخر مرة: ' + esc(last.date) + (last.odo ? ' عند عداد <bdi dir="ltr">' + fmtN(last.odo) + '</bdi> كم' : '') + (last.cost ? ' • ' + money(last.cost) : '')
        : '<span class="muted">لسه مفيش تسجيل — أول ما تغيّر سجّلها هنا</span>') +
      '</div></div>' +
      '<div class="side" style="display:flex;flex-direction:column;gap:4px;min-width:104px">' + actions.join('') + '</div>' +
      '</div>';
  }
  html += '</div>';

  /* ---------- تلميح ---------- */
  html += '<div class="card tight"><div class="t2" style="line-height:1.9">💡 <b>إزاي تستخدمه:</b> كل ما تغيّر حاجة (زيت، فلتر، كاوتش…) اضغط <b>✅ تم التغيير</b>جنبها واكتب العداد والتاريخ — التسجيل الجديد <b>بيستبدل القديم</b> فورًا وبيشيل اللون الأحمر. لو عايز تعدّل بيانات قديمة أو تضيف تكلفة/ورشة، اضغط <b>✏️ تعديل</b>. ولو عايز تغيّر الفترات (مثلاً زيت كل 10,000) روح الإعدادات ← 🔧 فترات الصيانة.</div></div>';

  /* ---------- سجل الصيانات ---------- */
  const recent = maints.slice().sort((a, b) => (+b.updatedAt || +b.createdAt || 0) - (+a.updatedAt || +a.createdAt || 0)).slice(0, 12);
  html += '<div class="card list-card"><div class="card-title" style="padding:12px 0 2px">📋 أحدث الصيانات' +
    '<span class="spacer"></span><button class="linklike" onclick="go(\'archive\')">كل السجل ←</button></div>';
  if (!recent.length) html += '<div class="empty"><div class="d">لا توجد صيانات مسجّلة بعد</div></div>';
  else html += recent.map(m =>
    '<div class="row-item"><div class="avatar-dot">🔧</div>' +
    '<div class="grow"><div class="t1">' + esc(CATS[m.category] || m.category) + '</div>' +
    '<div class="t2">' + esc(m.date || '') + (m.odo ? ' • عداد <bdi dir="ltr">' + fmtN(m.odo) + '</bdi>' : '') +
    (m.cost ? ' • ' + money(m.cost) : '') + '</div></div>' +
    '<div class="side"><button class="btn btn-sm" data-rec="' + m.id + '">🕘</button> ' +
    '<button class="btn btn-sm" data-editrec="' + m.id + '">✏️</button> ' +
    '<button class="btn btn-sm btn-danger" data-delrec="' + m.id + '">🗑️</button></div></div>').join('');
  html += '</div>';

  root.innerHTML = html;

  root.querySelector('#maint-edit-odo').onclick = () => openQuickOdoModal();
  root.querySelector('#maint-add').onclick = () => openMaintForm(null);
  root.querySelectorAll('[data-done]').forEach(b => b.onclick = () => quickMaintDone(b.dataset.done, { backTo: 'maint' }));
  root.querySelectorAll('[data-editlast]').forEach(b => b.onclick = () => {
    const rec = latestMaint(maints, b.dataset.editlast);
    if (rec) openMaintForm(rec);
  });
  root.querySelectorAll('[data-editrec]').forEach(b => b.onclick = () => {
    const rec = maints.find(m => m.id === b.dataset.editrec);
    if (rec) openMaintForm(rec);
  });
  root.querySelectorAll('[data-rec]').forEach(b => b.onclick = () => showRecHistory('maintenance', b.dataset.rec));
  root.querySelectorAll('[data-delrec]').forEach(b => b.onclick = () => {
    const rec = maints.find(m => m.id === b.dataset.delrec);
    if (rec) confirmDelete('maintenance', rec, CATS[rec.category] + ' — ' + (rec.date || ''));
  });
};
