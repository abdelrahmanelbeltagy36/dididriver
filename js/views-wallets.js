/* ===== views-wallets.js — خزنة العربية ===== */
'use strict';

Views.wallets = async function (root) {
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  const sessions = modeSessions(await DB.all('sessions'));
  const purchases = (await DB.all('purchases')).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt - a.createdAt));
  const maints = await DB.all('maintenance');
  const W = walletBalances(sessions, purchases, maints);
  const mk = monthKey(todayStr());
  const monthFuel = purchases.filter(p => monthKey(p.date) === mk).reduce((a, p) => a + (+p.amount || 0), 0);
  const monthMaint = W.maintFromWallet.filter(m => monthKey(m.date) === mk).reduce((a, m) => a + (+m.cost || 0), 0);

  function walletCard(title, icon, bal, inflow, outflow, monthOut, extra, cls, actions) {
    return '<div class="card wallet-card"><div class="stripe ' + cls + '"></div>' +
      '<div class="card-title">' + icon + ' ' + title + '<span class="spacer"></span>' + (actions || '') + '</div>' +
      '<div class="stat big"><div class="lbl">الرصيد الحالي</div>' +
      '<div class="big-val ' + (bal < 0 ? 'neg-t' : 'res-t') + '">' + money(bal) + '</div></div>' +
      '<div class="kv"><span class="k">إجمالي المخصصات من الأيام</span><span class="v res-t">' + money(inflow) + '</span></div>' +
      '<div class="kv"><span class="k">إجمالي المصروف الفعلي</span><span class="v neg-t">' + money(outflow) + '</span></div>' +
      '<div class="kv"><span class="k">مصروف هذا الشهر (' + esc(monthName(mk)) + ')</span><span class="v">' + money(monthOut) + '</span></div>' +
      extra + (bal < 0 ? '<div class="wallet-deficit">⚠️ عجز بالخزنة — تحتاج <bdi dir="ltr">' + fmtN(-bal) + '</bdi> ج.م إضافية. المصاريف الفعلية لا تُخصم من ربحك الشخصي مرة أخرى.</div>' : '') +
      '</div>';
  }

  const fuelExtra =
    '<div class="divider"></div>' +
    '<div class="kv"><span class="k">التكلفة الفعلية للوقود لكل كم</span><span class="v">' +
    (W.kmAll ? money(W.actualFuelPerKm) + ' <span class="small">/كم</span>' : '—') + '</span></div>' +
    '<div class="kv"><span class="k">التكلفة المخططة (تقدير الإعدادات)</span><span class="v">' + money(S.l100 / 100 * S.fuelPrice) + ' <span class="small">/كم</span></span></div>';

  const maintExtra =
    '<div class="divider"></div>' +
    '<div class="kv"><span class="k">آخر مصاريف مدفوعة من الخزنة</span><span class="v">' + fmtN(W.maintFromWallet.length) + ' عملية</span></div>';

  let html = walletCard('خزنة البنزين', '⛽', W.fuelBal, W.fuelIn, W.fuelOut, monthFuel, fuelExtra, 'res-t',
    '<button class="btn btn-sm btn-pri" id="fuel-add">＋ شراء وقود</button>') +
    walletCard('خزنة الصيانة', '🔧', W.maintBal, W.maintIn, W.maintOut, monthMaint, maintExtra, 'res-t',
    '<button class="btn btn-sm btn-pri" id="maint-add">＋ تسجيل صيانة</button>');

  /* الوضع العادي: تقدير المصاريف من المصاريف الفعلية القديمة */
  if (isDaily()) {
    const est = estimatedCostPerKm(sessions, purchases, maints);
    const spent = purchases.reduce((a, p) => a + (+p.amount || 0), 0) + maints.reduce((a, m) => a + (+m.cost || 0), 0);
    const kmAll = sessions.reduce((a, s) => a + (+s.km || 0), 0);
    html += '<div class="card"><div class="card-title">📊 تقدير مصاريفك</div>' +
      '<div class="stat-grid">' +
      '<div class="stat"><div class="lbl">متوسط التكلفة الفعلية</div><div class="val res-t">' + money(est.value) + ' <span class="small">/كم</span></div></div>' +
      '<div class="stat"><div class="lbl">إجمالي مصروف فعلي</div><div class="val neg-t">' + money(spent) + '</div></div>' +
      '<div class="stat"><div class="lbl">كيلومترات مسجّلة</div><div class="val">' + fmtN(kmAll) + '</div></div>' +
      '<div class="stat"><div class="lbl">مصروف هذا الشهر</div><div class="val">' + money(monthFuel + monthMaint) + '</div></div>' +
      '</div>' +
      '<div class="t2" style="margin-top:8px">' + (est.source === 'actual'
        ? 'التقدير جاي من مصاريفك الفعلية القديمة — بدون أي زيادة.'
        : 'لسه مفيش مصاريف كافية — التقدير مؤقت من إعدادات الوقود والصيانة. سجّل مشتريات لتطويره.') + '</div></div>';
  }

  /* explanation card */
  html += '<div class="card tight"><div class="t2" style="font-size:.8rem;line-height:1.8;color:var(--sub)">' +
    'الرصيد = مجموع مخصصات الأيام − المشتريات الفعلية. حذف أي سجل يعكس التأثير تلقائيًا. ' +
    'شراء الوقود وتسجيل الصيانة <b>يخصمان من الخزنة فقط</b> ولا يخصمان من الربح الشخصي مرة أخرى ' +
    fInfo('لماذا؟', [
      'الربح الشخصي اليومي = الدخل − المخصصات − المصاريف المباشرة.',
      'المخصص يذهب إلى الخزنة كاحتياطي. عند الشراء الفعلي، الخزنة هي التي تدفع.',
      'لو خصمنا الشراء من الربح أيضًا فسنحسب التكلفة مرتين — وهذا خطأ محاسبي.'
    ]) + '</div></div>';

  /* purchases history */
  html += '<div class="card list-card"><div class="card-title" style="padding:12px 0 2px">⛽ سجل مشتريات الوقود</div>';
  if (!purchases.length) {
    html += '<div class="empty"><div class="d">لا توجد مشتريات بعد</div></div>';
  } else {
    html += purchases.map(p =>
      '<div class="row-item">' +
      '<div class="avatar-dot">⛽</div>' +
      '<div class="grow"><div class="t1">' + esc(fullDayLabel(p.date)) + '</div>' +
      '<div class="t2">' +
      (p.liters ? fmtN(p.liters) + ' لتر • ' : '') +
      (p.pricePerLiter ? fmtN(p.pricePerLiter) + ' ج.م/لتر • ' : '') +
      (p.odo ? 'عداد ' + fmtN(p.odo) + ' • ' : '') +
      (p.station ? esc(p.station) : '') +
      '</div>' + (p.notes ? '<div class="t2">📝 ' + esc(p.notes) + '</div>' : '') + '</div>' +
      '<div class="side neg-t">' + money(p.amount) + '<div style="margin-top:4px">' +
      vBtn('purchases', p.id) + eBtn('edit-fuel') + dBtn('del-fuel', p.id) +
      '<input type="hidden" data-pid="' + p.id + '"></div></div>' +
      '</div>').join('');
  }
  html += '</div>';

  /* maintenance paid from wallet — recent 5 */
  const mPaid = W.maintFromWallet.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  html += '<div class="card list-card"><div class="card-title" style="padding:12px 0 2px">🔧 صيانة مدفوعة من الخزنة' +
    '<span class="spacer"></span><button class="linklike" onclick="go(\'archive\')">كل السجل ←</button></div>';
  if (!mPaid.length) html += '<div class="empty"><div class="d">لم تُسجل مصاريف صيانة مدفوعة من الخزنة بعد</div></div>';
  else html += mPaid.map(m =>
    '<div class="row-item">' +
    '<div class="avatar-dot">🔧</div>' +
    '<div class="grow"><div class="t1">' + esc(CATS[m.category] || m.category) + '</div>' +
    '<div class="t2">' + esc(fullDayLabel(m.date)) + (m.workshopName ? ' • ' + esc(m.workshopName) : '') + '</div></div>' +
    '<div class="side neg-t">' + money(m.cost) + '</div></div>').join('');
  html += '</div>';

  /* ---------- 🔧 maintenance schedule — quick "تم التغيير" per item ---------- */
  const odoNow = currentOdo(sessions, maints);
  const today = todayStr();
  const dueCats = CAT_LIST.map(ck => ({ ck, info: maintDueInfo(ck, latestMaint(maints, ck), S.intervals[ck], odoNow, today) }))
    .filter(x => x.info);
  const order = { missed: 0, soon: 1, ok: 2 };
  dueCats.sort((a, b) => order[a.info.level] - order[b.info.level]);
  if (dueCats.length) {
    html += '<div class="card list-card"><div class="card-title" style="padding:12px 0 2px">🔧 مواعيد الصيانة' +
      '<span class="spacer"></span><span class="badge gray">عدادك: <bdi dir="ltr">' + fmtN(odoNow) + '</bdi> كم</span></div>';
    for (const { ck, info } of dueCats) {
      const parts = [];
      if (info.kmLeft !== null) {
        if (info.nextDueKm !== null) parts.push('التغيير الجاي عند <bdi dir="ltr">' + fmtN(info.nextDueKm) + '</bdi> كم');
        parts.push('باقي <bdi dir="ltr">' + fmtN(Math.max(0, info.kmLeft)) + '</bdi> كم');
      }
      if (info.daysLeft !== null) parts.push('أو بعد <bdi dir="ltr">' + Math.max(0, Math.ceil(info.daysLeft / 30)) + '</bdi> شهر تقريبًا');
      let badge, line;
      if (info.level === 'missed') {
        badge = '<span class="badge red">🔴 فاتك!</span>';
        line = 'كان لازم يتغير ' + (info.nextDueKm ? 'عند <bdi dir="ltr">' + fmtN(info.nextDueKm) + '</bdi> كم' : '') +
          ' وانت عند <bdi dir="ltr">' + fmtN(odoNow) + '</bdi> — غيّره ضروري 🔧';
      } else if (info.level === 'soon') {
        badge = '<span class="badge green">🟢 قربت!</span>';
        line = parts.join(' — ');
      } else {
        badge = '<span class="badge gray">تمام</span>';
        line = parts.join(' — ');
      }
      html += '<div class="row-item" style="align-items:flex-start">' +
        '<div class="avatar-dot">' + (info.level === 'missed' ? '🚨' : info.level === 'soon' ? '🟢' : '🔧') + '</div>' +
        '<div class="grow"><div class="t1">' + badge + ' ' + esc(CATS[ck]) + '</div>' +
        '<div class="t2" style="line-height:1.8">' + line +
        (info.last ? '<br>آخر مرة: ' + esc(fullDayLabel(info.last.date)) + (info.last.odo ? ' عند عداد <bdi dir="ltr">' + fmtN(info.last.odo) + '</bdi>' : '') : '<br>لسه مفيش تسجيل — أول ما تغير سجلها') +
        '</div></div>' +
        '<div class="side"><button class="btn btn-sm btn-pos" data-done="' + ck + '">✅ تم التغيير</button></div>' +
        '</div>';
    }
    html += '</div>';
  }
  html += '<div id="mt-schedule-anchor"></div>';

  root.innerHTML = html;

  root.querySelector('#fuel-add').onclick = () => openFuelForm(null);
  root.querySelector('#maint-add').onclick = () => openMaintForm(null);

  /* quick "✅ تم التغيير" per category */
  root.querySelectorAll('[data-done]').forEach(b => b.onclick = () => quickMaintDone(b.dataset.done));

  root.querySelectorAll('[data-pid]').forEach(inp => {
    const id = inp.dataset.pid;
    const card = inp.closest('.row-item');
    card.querySelector('[data-act="view-rec"]').onclick = () => showRecHistory('purchases', id);
    card.querySelectorAll('[data-act="edit-fuel"]').forEach(b => b.onclick = () => {
      openFuelForm(purchases.find(p => p.id === id));
    });
    card.querySelectorAll('[data-act="del-fuel"]').forEach(b => b.onclick = () => {
      const p = purchases.find(x => x.id === id);
      confirmDelete('purchases', p, 'شراء وقود بمبلغ ' + fmtN(p.amount) + ' ج.م — ' + fullDayLabel(p.date));
    });
  });
};

/* ---------- quick "تم التغيير" form — التاريخ + العداد + التكلفة وخلاص ---------- */
async function quickMaintDone(catKey, opts) {
  opts = opts || {};
  const iv = S.intervals[catKey] || {};
  const allMaints = await DB.all('maintenance');
  const prev = latestMaint(allMaints, catKey);
  const odoDef = +S.odo || '';
  const costDef = prev && +prev.cost > 0 ? prev.cost : '';
  const nextLine = odo => {
    const lines = [];
    if (iv.km) lines.push('📏 التغيير الجاي عند <bdi dir="ltr">' + fmtN(odo + iv.km) + '</bdi> كم' + (odo ? ' (كل <bdi dir="ltr">' + fmtN(iv.km) + '</bdi> كم)' : ''));
    if (iv.months) lines.push('⏱️ أو بعد <bdi dir="ltr">' + iv.months + '</bdi> شهر تقريبًا');
    return lines.join('<br>') || 'النوع ده بدون فترة محددة';
  };
  openModal(
    '<div class="modal-title">✅ تم تغيير ' + esc(CATS[catKey]) + '</div>' +
    '<div class="t2" style="margin-bottom:8px">سجّل التغيير وسيبدأ العد من جديد تلقائيًا — وعداد عربيتك الرئيسي هيتحدث لوحة</div>' +
    field('التاريخ (غيرته إمتى؟)', dateInput('date', todayStr())) +
    field('عداد المسافة وقت التغيير (كم)', numInput('odo', odoDef, 'رقم العداد دلوقتي', true)) +
    field(isDaily() ? 'اللي دفعته (اختياري — ممتلي بالسعر القديم، عدّله لو اتغير)' : 'التكلفة (ممتلي بالسعر القديم — عدّله لو اتغير)', numInput('cost', costDef, '')) +
    (isDaily() ? '' : '<label class="check-row" style="color:var(--txt);font-weight:700" id="qm-wallet-row">' +
    '<input type="checkbox" data-f="fromWallet" checked> مدفوعة من خزنة الصيانة</label>') +
    '<div class="formula" style="margin-top:10px" id="qm-next"></div>' +
    '<div class="modal-actions">' +
    '<button class="btn" onclick="closeModal()">إلغاء</button>' +
    '<button class="btn btn-pos" id="qm-save">✅ تم التغيير</button></div>',
    { onMount: w => {
      const odoInp = w.querySelector('[data-f="odo"]');
      const nextBox = w.querySelector('#qm-next');
      const upd = () => { nextBox.innerHTML = nextLine(+odoInp.value || 0); };
      odoInp.addEventListener('input', upd);
      odoInp.addEventListener('change', upd);
      const costInp = w.querySelector('[data-f="cost"]');
      const walletRow = w.querySelector('#qm-wallet-row');
      const syncWallet = () => { if (walletRow) walletRow.style.display = (+costInp.value > 0) ? '' : 'none'; };
      costInp.addEventListener('input', syncWallet); syncWallet();
      upd();
      w.querySelector('#qm-save').onclick = async () => {
        const date = w.querySelector('[data-f="date"]').value || todayStr();
        const odo = +w.querySelector('[data-f="odo"]').value || 0;
        const cost = +w.querySelector('[data-f="cost"]').value || 0;
        if (!(odo > 0)) { toast('اكتب رقم العداد وقت التغيير'); return; }
        /* 👉 overwrite: استبدل أحدث تسجيل لنفس النوع — ما يفضلش تسجيل قديم يطلع أحمر */
        const base = {
          date, odo, category: catKey, cost,
          kind: 'routine',
          prevCost: prev ? (+prev.cost || 0) : 0,
          workshopName: '', workshopAddr: '', partBrand: '',
          nextDueKm: iv.km ? odo + iv.km : null,
          nextDueDate: iv.months ? addDays(date, iv.months * 30) : null,
          faultDesc: '', repairDesc: '',
          fromWallet: !isDaily() && cost > 0 && !!(w.querySelector('[data-f="fromWallet"]') || {}).checked,
          notes: 'تسجيل سريع (تم التغيير)', receiptPhoto: '',
          updatedAt: Date.now()
        };
        const rec = prev
          ? Object.assign({}, prev, base, {
              id: prev.id,
              createdAt: prev.createdAt || Date.now(),
              history: (prev.history || []).concat([{ ts: Date.now(), action: 'تغيير مسجّل (استبدال)' }])
            })
          : Object.assign({ id: uid(), createdAt: Date.now(), history: [{ ts: Date.now(), action: 'create' }] }, base);
        await DB.put('maintenance', rec);
        if (odo > (+S.odo || 0)) { S.odo = odo; await saveSettings(); }
        closeModal();
        const nx = rec.nextDueKm ? ' — 📏 التغيير الجاي عند <bdi dir="ltr">' + fmtN(rec.nextDueKm) + '</bdi> كم' : '';
        toast('✅ تم تسجيل التغيير — اتحدّث التسجيل القديم' + nx, { duration: 7000 });
        go(opts.backTo || 'wallets');
        await notifyDueItems(); /* صفّر حالة التنبيه للنوع ده */
      };
    } }
  );
}

/* ---------- fuel purchase form ---------- */
function openFuelForm(existing) {
  const isEdit = !!existing;
  const d = existing || { date: todayStr(), amount: '', liters: '', pricePerLiter: S.fuelPrice, odo: +S.odo || '', station: '', notes: '' };
  openModal(
    '<div class="modal-title">' + (isEdit ? 'تعديل شراء وقود' : 'شراء وقود جديد') + '</div>' +
    field('التاريخ', dateInput('date', d.date)) +
    field('المبلغ المدفوع (ج.م)', numInput('amount', d.amount, '0', true)) +
    '<div class="grid2">' +
    field('عدد اللترات (اختياري)', numInput('liters', d.liters, '')) +
    field('سعر اللتر', numInput('pricePerLiter', d.pricePerLiter, '')) +
    '</div>' +
    '<div class="grid2">' +
    field('عداد المسافة (اختياري)', numInput('odo', d.odo, '')) +
    field('المحطة (اختياري)', txtInput('station', d.station, '')) +
    '</div>' +
    field('ملاحظات', '<textarea class="input" data-f="notes" rows="2">' + esc(d.notes || '') + '</textarea>') +
    '<div class="modal-actions">' +
    '<button class="btn" onclick="closeModal()">إلغاء</button>' +
    '<button class="btn btn-pri" id="fuel-save">💾 حفظ</button></div>',
    { onMount: w => { w.querySelector('#fuel-save').onclick = () => saveFuel(w, existing); } }
  );
}

async function saveFuel(wrap, existing) {
  const isEdit = !!existing;
  const g = f => { const el = wrap.querySelector('[data-f="' + f + '"]'); return el ? el.value : ''; };
  const amount = +g('amount');
  if (!(amount > 0)) { toast('أدخل مبلغًا أكبر من صفر'); return; }
  const rec = existing || { id: uid(), createdAt: Date.now(), history: [] };
  rec.date = g('date') || todayStr();
  rec.amount = amount;
  rec.liters = +g('liters') || null;
  rec.pricePerLiter = +g('pricePerLiter') || null;
  rec.odo = +g('odo') || null;
  rec.station = g('station');
  rec.notes = g('notes');
  rec.updatedAt = Date.now();
  rec.history = (rec.history || []).concat([{ ts: Date.now(), action: existing ? 'edit' : 'create' }]);

  await DB.put('purchases', rec);
  if (rec.odo && rec.odo > (+S.odo || 0)) { S.odo = rec.odo; await saveSettings(); }

  /* consumption suggestion from real observation */
  if (rec.liters && rec.odo) {
    const all = (await DB.all('purchases')).filter(p => p.odo && p.id !== rec.id && p.odo < rec.odo).sort((a, b) => b.odo - a.odo);
    const prev = all[0];
    if (prev) {
      const kmDelta = rec.odo - prev.odo;
      if (kmDelta > 50) {
        const obs = (rec.liters / kmDelta) * 100;
        if (Math.abs(obs - S.l100) / S.l100 > 0.12) {
          toast('💡 من تعبئتك الفعلية: الاستهلاك ≈ <bdi dir="ltr">' + fmtN(obs) + '</bdi> لتر/100كم (الإعداد حاليًا ' + fmtN(S.l100) + ')', { duration: 9000, actionLabel: 'تحديث', onAction: () => { S.l100 = Math.round(obs * 10) / 10; saveSettings().then(() => toast('✅ تم تحديث متوسط الاستهلاك')); } });
        }
      }
    }
  }

  closeModal();
  toast(isEdit ? '✅ تم تعديل الشراء' : '✅ تم تسجيل الشراء — خصم من خزنة البنزين');
  go('wallets');
}

/* ---------- shared delete with undo ---------- */
async function confirmDelete(store, rec, desc) {
  const ok = await confirmDlg({
    title: 'حذف السجل؟',
    body: '<b>' + esc(desc) + '</b><br><br>سيُنقل السجل إلى سلة المهملات لمدة 30 يومًا مع إمكانية الاستعادة، وسيظهر زر تراجع فورًا.',
    okText: '🗑️ حذف', danger: true
  });
  if (!ok) return;
  await moveToTrash(store, rec, desc);
  toast('🗑️ تم النقل إلى سلة المهملات: ' + esc(desc), { actionLabel: 'تراجع', onAction: async () => {
    const items = await DB.all('trash');
    const t = items.find(x => x.origId === rec.id && x.store === store);
    if (t) { await restoreFromTrash(t); toast('↩️ تم التراجع عن الحذف'); go(Nav.current); }
  } });
  go(Nav.current);
}

/* record edit history viewer */
async function showRecHistory(store, id) {
  const rec = await DB.get(store, id);
  if (!rec) { toast('السجل موجود في سلة المهملات'); return; }
  const h = rec.history || [];
  showFormula('🕘 سجل التعديلات', h.length ? h.map(x =>
    esc(new Date(x.ts).toLocaleString('en-GB')) + ' — ' + esc(x.action === 'create' ? 'إنشاء' : x.action === 'edit' ? 'تعديل' : (x.by || x.action))
  ) : ['لا توجد تعديلات مسجلة']);
}
