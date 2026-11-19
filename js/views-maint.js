/* ===== views-maint.js — جدول الصيانة: صيانة دورية + أعطال، مكان واحد ===== */
'use strict';

const FAULT_CATS = ['fault', 'mech', 'elec', 'transmission', 'engine', 'suspension', 'other'];

Views.maint = async function (root) {
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  const sessions = modeSessions(await DB.all('sessions'));
  const maints = await DB.all('maintenance');
  const odo = currentOdo(sessions, maints);
  const today = todayStr();
  const est = estimatedCostPerKm(sessions, [], maints);

  const routine = ROUTINE_CATS.map(ck => {
    const iv = S.intervals[ck] || {};
    const last = latestMaint(maints, ck);
    const info = maintDueInfo(ck, last, iv, odo, today);
    const before = last ? (last.prevCost !== undefined ? last.prevCost : ((previousMaint(maints, ck, last.id) || {}).cost || 0)) : 0;
    return { ck, iv, last, info, before: +before || 0 };
  });
  const order = { missed: 0, soon: 1, ok: 2, none: 3 };
  routine.sort((a, b) => (order[a.info ? a.info.level : 'none']) - (order[b.info ? b.info.level : 'none']));
  const missedCount = routine.filter(r => r.info && r.info.level === 'missed').length;
  const soonCount = routine.filter(r => r.info && r.info.level === 'soon').length;
  const faults = maints.filter(m => maintKind(m) === 'fault')
    .sort((a, b) => (+b.updatedAt || +b.createdAt || 0) - (+a.updatedAt || +a.createdAt || 0));

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

  /* ---------- تقدير المصاريف (الوضع العادي — من غير خزنة) ---------- */
  if (isDaily()) {
    const spent = maints.reduce((a, m) => a + (+m.cost || 0), 0);
    const kmAll = sessions.reduce((a, s) => a + (+s.km || 0), 0);
    html += '<div class="card"><div class="card-title">📊 مصاريف عربيتك</div>' +
      '<div class="stat-grid">' +
      '<div class="stat"><div class="lbl">إجمالي اللي دفعته</div><div class="val neg-t">' + money(spent) + '</div></div>' +
      '<div class="stat"><div class="lbl">متوسط التكلفة/كم</div><div class="val res-t">' + fmtN(est.value) + ' ج.م</div></div>' +
      '<div class="stat"><div class="lbl">كيلومترات مسجّلة</div><div class="val">' + fmtN(kmAll) + '</div></div>' +
      '<div class="stat"><div class="lbl">مصدر التقدير</div><div class="val" style="font-size:.8rem">' + (est.source === 'actual' ? 'مصاريفك الفعلية' : 'تقدير مؤقت') + '</div></div>' +
      '</div>' +
      '<div class="t2" style="margin-top:8px">مفيش خزنات في الوضع العادي — كل اللي دفعته متسجّل جنب كل تغيير.</div></div>';
  }

  /* ---------- 1) صيانة دورية ---------- */
  html += '<div class="card list-card"><div class="card-title" style="padding:12px 0 2px">🔁 صيانة دورية' +
    '<span class="spacer"></span><button class="btn btn-sm btn-pos" id="maint-add">＋ صيانة جديدة</button></div>';

  for (const r of routine) {
    const { ck, iv, last, info, before } = r;
    const period = [];
    if (iv.km) period.push('كل <bdi dir="ltr">' + fmtN(iv.km) + '</bdi> كم');
    if (iv.months) period.push('أو <bdi dir="ltr">' + iv.months + '</bdi> شهر');
    const line = [];
    if (info && info.nextDueKm !== null) line.push('📏 التغيير الجاي عند <bdi dir="ltr">' + fmtN(info.nextDueKm) + '</bdi> كم');
    if (info && info.kmLeft !== null) line.push('باقي <bdi dir="ltr">' + fmtN(Math.max(0, info.kmLeft)) + '</bdi> كم');

    let badge = '<span class="badge gray">بدون تذكير</span>';
    if (info) {
      if (info.level === 'missed') badge = '<span class="badge red">🔴 فاتك!</span>';
      else if (info.level === 'soon') badge = '<span class="badge green">🟢 قربت!</span>';
      else badge = '<span class="badge gray">تمام ✓</span>';
    }

    const costLine = last
      ? '💰 اللي دفعته: <b>' + money(last.cost || 0) + '</b>' + (before ? ' • اللي قبله: ' + money(before) : '')
      : 'لسه مفيش تسجيل — أول ما تغيّر سجّلها هنا';

    const actions = [];
    if (iv.km || iv.months) actions.push('<button class="btn btn-sm btn-pos" data-done="' + ck + '">✅ تم التغيير</button>');
    if (last) actions.push('<button class="btn btn-sm" data-editlast="' + ck + '">✏️ تعديل</button>');

    html += '<div class="row-item" style="align-items:flex-start">' +
      '<div class="avatar-dot">' + (info && info.level === 'missed' ? '🚨' : info && info.level === 'soon' ? '🟢' : '🔁') + '</div>' +
      '<div class="grow"><div class="t1">' + badge + ' <b>' + esc(CATS[ck]) + '</b></div>' +
      '<div class="t2" style="line-height:1.9">' +
      (period.length ? '⏱️ ' + period.join(' — ') + '<br>' : '') +
      (line.length ? line.join(' — ') + '<br>' : '') +
      (last ? '📅 آخر مرة: ' + esc(last.date) + (last.odo ? ' عند <bdi dir="ltr">' + fmtN(last.odo) + '</bdi> كم' : '') : '') +
      '<br>' + costLine +
      '</div></div>' +
      '<div class="side" style="display:flex;flex-direction:column;gap:4px;min-width:104px">' + actions.join('') + '</div>' +
      '</div>';
  }
  html += '</div>';

  /* ---------- 2) أعطال وإصلاحات ---------- */
  html += '<div class="card list-card"><div class="card-title" style="padding:12px 0 2px">🩹 أعطال وإصلاحات (' + fmtN(faults.length) + ')' +
    '<span class="spacer"></span><button class="btn btn-sm" id="fault-add">＋ عطل / خبطة</button></div>';
  if (!faults.length) html += '<div class="empty"><div class="d">لا توجد أعطال مسجّلة — لو حصلك عطل أو خبطة سجّلها هنا لوحدها (مش هتتحسب في أسعار الزيت والفلاتر)</div></div>';
  else html += faults.map(m =>
    '<div class="row-item" style="align-items:flex-start"><div class="avatar-dot">🩹</div>' +
    '<div class="grow"><div class="t1"><b>' + esc(CATS[m.category] || m.category) + '</b> <span class="badge gray">' + esc(fullDayLabel(m.date)) + '</span></div>' +
    '<div class="t2" style="line-height:1.8">عداد <bdi dir="ltr">' + fmtN(m.odo) + '</bdi> • 💰 دفعت <b>' + money(m.cost || 0) + '</b>' +
    (m.workshopName ? ' • ' + esc(m.workshopName) : '') + '</div>' +
    (m.faultDesc ? '<div class="t2"><b>العطل:</b> ' + esc(m.faultDesc) + '</div>' : '') +
    (m.repairDesc ? '<div class="t2"><b>الإصلاح:</b> ' + esc(m.repairDesc) + '</div>' : '') +
    '</div><div class="side" style="display:flex;flex-direction:column;gap:4px">' +
    '<button class="btn btn-sm" data-editfault="' + m.id + '">✏️</button>' +
    '<button class="btn btn-sm btn-danger" data-delfault="' + m.id + '">🗑️</button></div></div>').join('');
  html += '</div>';

  html += '<div class="card tight"><div class="t2" style="line-height:1.9">💡 <b>إزاي تستخدمه:</b> لو غيّرت زيت أو فلتر اضغط <b>✅ تم التغيير</b>جنبه — هتلاقي البيانات والسعر القديم ممتليين، عدّل اللي اتغير وبس (من غير ما يتعمل تسجيل مكرر). ولو حصل عطل أو خبطة سجّلها من <b>＋ عطل / خبطة</b> — هتظهر في «تاريخ الأعطال» مع باقي الصيانات عشان PDF يطلع صحيح.</div></div>';

  root.innerHTML = html;

  root.querySelector('#maint-edit-odo').onclick = () => openQuickOdoModal();
  root.querySelector('#maint-add').onclick = () => openMaintForm(null, lastMaintPrefill(maints));
  root.querySelector('#fault-add').onclick = () => openFaultForm(null);
  root.querySelectorAll('[data-done]').forEach(b => b.onclick = () => quickMaintDone(b.dataset.done, { backTo: 'maint' }));
  root.querySelectorAll('[data-editlast]').forEach(b => b.onclick = () => {
    const rec = latestMaint(maints, b.dataset.editlast);
    if (rec) openMaintForm(rec);
  });
  root.querySelectorAll('[data-editfault]').forEach(b => b.onclick = () => {
    const rec = maints.find(m => m.id === b.dataset.editfault);
    if (rec) openFaultForm(rec);
  });
  root.querySelectorAll('[data-delfault]').forEach(b => b.onclick = () => {
    const rec = maints.find(m => m.id === b.dataset.delfault);
    if (rec) confirmDelete('maintenance', rec, CATS[rec.category] + ' — ' + (rec.date || ''));
  });
};

/* بيانات قديمة جاهزة للتعديل بدل ما يبدأ من الصفر */
function lastMaintPrefill(maints) {
  const last = (maints || []).filter(m => maintKind(m) === 'routine')
    .sort((a, b) => (+b.updatedAt || +b.createdAt || 0) - (+a.updatedAt || +a.createdAt || 0))[0];
  if (!last) return null;
  return { workshopName: last.workshopName || '', workshopAddr: last.workshopAddr || '', partBrand: last.partBrand || '', notes: last.notes || '' };
}

/* فورم مستقل للأعطال — مش بتتحسب في أسعار الصيانة الدورية */
function openFaultForm(existing) {
  const isEdit = !!existing;
  DB.all('maintenance').then(maints => {
    const lastFault = maints.filter(m => maintKind(m) === 'fault')
      .sort((a, b) => (+b.updatedAt || +b.createdAt || 0) - (+a.updatedAt || +a.createdAt || 0))[0];
    const d = Object.assign({
      date: todayStr(), odo: +S.odo || '', category: 'fault', cost: '',
      workshopName: '', workshopAddr: '', partBrand: '', faultDesc: '', repairDesc: '', notes: '', receiptPhoto: ''
    }, existing || (lastFault ? {
      workshopName: lastFault.workshopName || '', workshopAddr: lastFault.workshopAddr || '',
      partBrand: lastFault.partBrand || '', notes: lastFault.notes || ''
    } : {}));

    openModal(
      '<div class="modal-title">' + (isEdit ? 'تعديل العطل' : '🩹 تسجيل عطل / خبطة') + '</div>' +
      '<div class="t2" style="margin-bottom:8px">بيُسجّل لوحده — مش داخل في أسعار الزيت والفلاتر، وهيظهر في «تاريخ الأعطال» والـ PDF.</div>' +
      field('التاريخ', dateInput('date', d.date)) +
      '<div class="grid2">' +
      field('عداد المسافة (كم)', numInput('odo', d.odo, '', true)) +
      field('النوع', '<select class="input" data-f="category">' + options(FAULT_CATS.map(k => ({ v: k, l: CATS[k] })), d.category) + '</select>') +
      '</div>' +
      field('اللي دفعته (ج.م — اختياري)', numInput('cost', d.cost, '0')) +
      '<div class="grid2">' +
      field('الورشة / المكان', txtInput('workshopName', d.workshopName, '')) +
      field('العنوان أو لينك الخريطة', txtInput('workshopAddr', d.workshopAddr, '')) +
      '</div>' +
      field('وصف العطل / الخبطة 🩺', '<textarea class="input" data-f="faultDesc" rows="2" placeholder="إيه اللي حصل؟">' + esc(d.faultDesc || '') + '</textarea>') +
      field('الإصلاح اللي اتعمل 🛠️', '<textarea class="input" data-f="repairDesc" rows="2" placeholder="إيه اللي اتظبط؟">' + esc(d.repairDesc || '') + '</textarea>') +
      field('ملاحظات', txtInput('notes', d.notes, '')) +
      '<div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button>' +
      '<button class="btn btn-pri" id="fault-save">💾 حفظ</button></div>',
      { onMount: w => {
        w.querySelector('#fault-save').onclick = async () => {
          const g = f => { const el = w.querySelector('[data-f="' + f + '"]'); return el ? el.value.trim() : ''; };
          const odo = +g('odo') || 0;
          if (!(odo > 0)) { toast('اكتب عداد المسافة'); return; }
          const rec = existing || { id: uid(), createdAt: Date.now(), history: [] };
          rec.date = g('date') || todayStr();
          rec.odo = odo;
          rec.category = g('category') || 'fault';
          rec.kind = 'fault';
          rec.cost = +g('cost') || 0;
          rec.workshopName = g('workshopName'); rec.workshopAddr = g('workshopAddr');
          rec.partBrand = g('partBrand'); rec.faultDesc = g('faultDesc');
          rec.repairDesc = g('repairDesc'); rec.notes = g('notes');
          rec.fromWallet = false; rec.nextDueKm = null; rec.nextDueDate = null;
          rec.updatedAt = Date.now();
          rec.history = (rec.history || []).concat([{ ts: Date.now(), action: isEdit ? 'edit' : 'create' }]);
          await DB.put('maintenance', rec);
          if (odo > (+S.odo || 0)) { S.odo = odo; await saveSettings(); }
          closeModal();
          toast(isEdit ? '✅ تم تعديل العطل' : '✅ تم تسجيل العطل');
          go('maint');
        };
      } }
    );
  });
}
