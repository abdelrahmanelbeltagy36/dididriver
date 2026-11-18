/* ===== views-home.js — الرئيسية ===== */
'use strict';

const METRICS = [
  { k: 'net', l: 'الدخل الصافي', f: v => money(v) },
  { k: 'profit', l: 'الربح الشخصي', f: v => money(v) },
  { k: 'margin', l: 'هامش الربح', f: v => fmtPct(v) },
  { k: 'km', l: 'الكيلومترات', f: v => fmtN(v) + ' كم' },
  { k: 'hours', l: 'ساعات العمل', f: v => fmtN(v) + ' س' },
  { k: 'profitPerKm', l: 'ربح / كم', f: v => money(v) },
  { k: 'profitPerHour', l: 'ربح / ساعة', f: v => money(v) }
];

function currentOdo(sessions, maints) {
  let o = +S.odo || 0;
  for (const s of sessions) {
    if (+s.odoEnd > o) o = +s.odoEnd;
    if (+s.odoStart > o) o = +s.odoStart;
  }
  for (const m of (maints || [])) if (+m.odo > o) o = +m.odo;
  return o;
}

function comparisonList(cur, prev) {
  return METRICS.map(m => {
    const c = cur[m.k] || 0;
    const p = prev ? (prev[m.k] || 0) : 0;
    const ch = prev ? pctChange(c, p) : null;
    const diff = prev ? c - p : null;
    return '<div class="chg-row">' +
      '<span class="name">' + m.l + '</span>' +
      '<span class="pair">' +
      '<span class="small">' + m.f(c) + '</span>' +
      changeBadge(ch) +
      '</span></div>';
  }).join('');
}

Views.home = async function (root) {
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  const sessions = await DB.all('sessions');
  const purchases = await DB.all('purchases');
  const maints = await DB.all('maintenance');
  const W = walletBalances(sessions, purchases, maints);
  const { latest, prev, days } = latestAndPrevDays(sessions);
  const today = todayStr();

  let html = '';

  /* ---------- 📍 عداد سريع — في الواجهة مباشرة ---------- */
  const odoNow = currentOdo(sessions, maints);
  const odoMissed = [], odoSoon = [];
  for (const ck of CAT_LIST) {
    const info = maintDueInfo(ck, maints.filter(m => m.category === ck).sort((a, b) => b.date.localeCompare(a.date))[0], S.intervals[ck], odoNow, today);
    if (!info) continue;
    if (info.level === 'missed') odoMissed.push(CATS[ck]);
    else if (info.level === 'soon') odoSoon.push(CATS[ck]);
  }
  html += '<div class="card" style="border-color:var(--res)"><div class="card-title">📍 عداد العربية<span class="spacer"></span>' +
    (odoMissed.length ? '<span class="badge red">🔴 فاتك: ' + odoMissed.length + '</span>' : '') +
    (odoSoon.length ? '<span class="badge green">🟢 قربت: ' + odoSoon.length + '</span>' : '') + '</div>' +
    '<div style="display:flex;gap:8px;align-items:end">' +
    '<div class="field" style="margin:0;flex:1"><label>مشيت كيلومترات جديدة؟ اكتب الرقم دلوقتي (كم)</label>' +
    '<input class="input input-lg" type="number" inputmode="numeric" id="hm-odo" value="' + (+odoNow || '') + '" placeholder="مثال: 107200" dir="ltr" style="text-align:center;font-weight:800"></div>' +
    '<button class="btn btn-pri" id="hm-odo-save" style="min-height:44px">تحديث ✓</button></div>' +
    (odoMissed.length ? '<div class="t2" style="margin-top:8px;color:var(--neg);font-weight:700">🔴 فاتك تغيير: ' + odoMissed.map(n => esc(n)).join('، ') + ' — من خزنة العربية سجّلها</div>' : '') +
    (odoSoon.length ? '<div class="t2" style="margin-top:6px;color:var(--pos);font-weight:700">🟢 قربت: ' + odoSoon.map(n => esc(n)).join('، ') + ' — فاضل 500 كم أو أقل</div>' : '') +
    (odoNow ? '<div class="t2" style="margin-top:6px">بعد ما تحدث الرقم، كل المواعيد بتُحسب عليه فورًا — والتفاصيل في خزنة العربية.</div>' : '') +
    '</div>';

  /* ---------- latest working day hero ---------- */
  if (latest) {
    const cur = dayStats(sessions, latest);
    const prevS = prev ? dayStats(sessions, prev) : null;
    const chProfit = prevS ? pctChange(cur.profit, prevS.profit) : null;
    const profitCls = cur.profit >= 0 ? 'pos-t' : 'neg-t';
    html += '<div class="card hero">' +
      '<div class="card-title">آخر يوم عمل — ' + esc(fullDayLabel(latest)) + '</div>' +
      '<div class="stat-grid cols3">' +
      '<div class="stat big"><div class="lbl muted">الربح الشخصي ' + fInfo('الربح الشخصي', [
        'الربح = الدخل الصافي − مخصص الوقود − مخصص الصيانة − المصاريف المباشرة',
        'مخصص الوقود = ' + fmtN(cur.km) + ' كم × تكلفة الوقود/كم',
        'مخصص الصيانة = ' + fmtN(cur.km) + ' كم × ' + fmtN(S.maintPerKm) + ' ج.م/كم'
      ]) + '</div><div class="big-val ' + profitCls + '">' + money(cur.profit) + '</div></div>' +
      '<div class="stat big"><div class="lbl muted">الدخل الصافي</div><div class="big-val">' + money(cur.net) + '</div></div>' +
      '<div class="stat big"><div class="lbl muted">هامش الربح</div><div class="big-val">' + fmtPct(cur.margin) + '</div></div>' +
      '</div>' +
      '<div class="divider" style="background:rgba(255,255,255,.25)"></div>' +
      '<div class="stat-grid cols3">' +
      '<div class="stat big"><div class="lbl muted">كم</div><div class="val">' + fmtN(cur.km) + ' كم</div></div>' +
      '<div class="stat big"><div class="lbl muted">ساعات</div><div class="val">' + fmtN(cur.hours) + '</div></div>' +
      '<div class="stat big"><div class="lbl muted">رحلات</div><div class="val">' + fmtN(cur.trips) + '</div></div>' +
      '</div>';

    if (prevS) {
      const dProfit = cur.profit - prevS.profit;
      const chRevKm = pctChange(cur.revPerKm, prevS.revPerKm);
      const chProfHr = pctChange(cur.profitPerHour, prevS.profitPerHour);
      html += '<div class="divider" style="background:rgba(255,255,255,.25)"></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:.84rem">' +
        '<span>مقارنة باليوم السابق (' + esc(dayLabel(prev)) + '):</span>' +
        changeBadge(chProfit) +
        '<span class="small">الفرق: ' + money(dProfit) + '</span>' +
        '<span class="small">إيراد/كم:</span>' + changeBadge(chRevKm) +
        '<span class="small">ربح/ساعة:</span>' + changeBadge(chProfHr) +
        '</div>';
    }
    html += '</div>';
  } else {
    html += '<div class="card"><div class="empty"><div class="ic">🚗</div>' +
      '<div class="t">أهلاً بك في إدارة دخل السائق</div>' +
      '<div class="d">ابدأ بتسجيل أول يوم عمل لتظهر كل الحسابات والمقارنات تلقائيًا.</div>' +
      '<button class="btn btn-pri" onclick="go(\'add\')">＋ تسجيل أول يوم</button></div></div>';
  }

  /* ---------- warnings ---------- */
  const warns = [];
  if (W.fuelBal < 0) warns.push('<div class="warn-strip">⛽ خزنة البنزين بالعجز — تحتاج <bdi dir="ltr">' + fmtN(-W.fuelBal) + '</bdi> ج.م لتغطية المشتريات</div>');
  if (W.maintBal < 0) warns.push('<div class="warn-strip">🔧 خزنة الصيانة بالعجز — تحتاج <bdi dir="ltr">' + fmtN(-W.maintBal) + '</bdi> ج.م لتغطية المصاريف</div>');
  const odo = currentOdo(sessions, maints);
  const missedNames = [], soonNames = [];
  for (const ck of CAT_LIST) {
    const info = maintDueInfo(ck, maints.filter(m => m.category === ck).sort((a, b) => b.date.localeCompare(a.date))[0], S.intervals[ck], odo, today);
    if (!info) continue;
    if (info.level === 'missed') missedNames.push(CATS[ck]);
    else if (info.level === 'soon') soonNames.push(CATS[ck]);
  }
  for (const n of missedNames) warns.push('<div class="warn-strip" style="background:var(--neg-soft);color:var(--neg)">🔴 <b>' + esc(n) + '</b> — فاتك تغييرها! عدادك عدّى موعدها. غيّرها وسجّلها من خزنة العربية</div>');
  for (const n of soonNames) warns.push('<div class="warn-strip" style="background:var(--pos-soft);color:var(--pos)">🟢 <b>' + esc(n) + '</b> — قرب موعدها (فاضل 500 كم أو أقل) جهّز نفسك</div>');
  html += warns.length ? '<div>' + warns.join('') + '</div>' : '';

  /* ---------- weekly & monthly comparisons ---------- */
  const wk = weekStartSat(today);
  const wkPrev = addDays(wk, -7);
  const wCur = weekStats(sessions, wk);
  const wPrev = weekStats(sessions, wkPrev);
  const mk = monthKey(today);
  const mCur = monthStats(sessions, mk);
  const mPrev = monthStats(sessions, prevMonthKey(mk));

  html += '<div class="card"><div class="card-title">📅 هذا الأسبوع مقابل الأسبوع الماضي' +
    '<span class="spacer"></span><span class="badge blue">من ' + dayLabel(wk) + '</span></div>' +
    (wPrev.count || wCur.count ? comparisonList(wCur, wPrev) : '<div class="empty"><div class="d">لا توجد بيانات كافية بعد</div></div>') +
    '</div>';

  html += '<div class="card"><div class="card-title">🗓️ هذا الشهر مقابل الشهر الماضي' +
    '<span class="spacer"></span><span class="badge blue">' + esc(monthName(mk)) + '</span></div>' +
    (mPrev.count || mCur.count ? comparisonList(mCur, mPrev) : '<div class="empty"><div class="d">لا توجد بيانات كافية بعد</div></div>') +
    '</div>';

  /* ---------- monthly target ---------- */
  const worked = workedDaysInMonth(sessions, mk);
  const target = +S.targetDays || 26;
  const pctDone = Math.min(100, (worked / target) * 100);
  html += '<div class="card tight"><div class="kv"><span class="k">🎯 هدف أيام العمل (' + esc(monthName(mk)) + ')</span>' +
    '<span class="v"><bdi dir="ltr">' + worked + ' / ' + target + '</bdi> يوم</span></div>' +
    '<div class="progress"><i style="width:' + pctDone + '%"></i></div></div>';

  /* ---------- wallets ---------- */
  html += '<div class="card"><div class="card-title">خزنة العربية<span class="spacer"></span>' +
    '<button class="linklike" onclick="go(\'wallets\')">تفاصيل ←</button></div>' +
    '<div class="stat-grid cols3">' +
    '<div class="stat"><div class="lbl">⛽ خزنة البنزين</div><div class="val ' + (W.fuelBal < 0 ? 'neg-t' : 'res-t') + '">' + money(W.fuelBal) + '</div></div>' +
    '<div class="stat"><div class="lbl">🔧 خزنة الصيانة</div><div class="val ' + (W.maintBal < 0 ? 'neg-t' : 'res-t') + '">' + money(W.maintBal) + '</div></div>' +
    '<div class="stat"><div class="lbl">إجمالي المخصصات</div><div class="val res-t">' + money(W.fuelIn + W.maintIn) + '</div></div>' +
    '</div></div>';

  /* ---------- recent days ---------- */
  if (days.length) {
    const recent = days.slice(-5).reverse();
    html += '<div class="card list-card"><div class="card-title" style="padding:12px 0 2px">آخر الأيام<span class="spacer"></span>' +
      '<button class="linklike" onclick="go(\'archive\')">الأرشيف ←</button></div>' +
      recent.map(d => {
        const st = dayStats(sessions, d);
        return '<div class="row-item" style="cursor:pointer" onclick="openDayDetail(\'' + d + '\')">' +
          '<div class="avatar-dot">📅</div>' +
          '<div class="grow"><div class="t1">' + esc(fullDayLabel(d)) + '</div>' +
          '<div class="t2">' + fmtN(st.km) + ' كم • ' + fmtN(st.hours) + ' ساعة • ' + fmtN(st.count) + ' جلسة</div></div>' +
          '<div class="side ' + (st.profit >= 0 ? 'pos-t' : 'neg-t') + '">' + money(st.profit) + '</div>' +
          '</div>';
      }).join('') +
      '</div>';
  }

  root.innerHTML = html;

  /* quick odometer update */
  const odoSave = root.querySelector('#hm-odo-save');
  if (odoSave) odoSave.onclick = async () => {
    const v = +root.querySelector('#hm-odo').value || 0;
    if (!(v > 0)) { toast('اكتب رقم العداد'); return; }
    if (v < (+S.odo || 0)) {
      const ok = await confirmDlg({ title: 'الرقم أقل من المفوت؟', body: 'العداد المحفوظ <bdi dir="ltr">' + fmtN(S.odo) + '</bdi> وأنت كتبت <bdi dir="ltr">' + fmtN(v) + '</bdi>. هنعملها تحديث للرقم ده على أي حال.', okText: 'تحديث' });
      if (!ok) return;
    }
    S.odo = v;
    await saveSettings();
    toast('✅ تم تحديث العداد — كل المواعيد اتحدثت');
    go('home');
  };

  /* Pro promo card */
  const promo = await proPromoCard();
  if (promo) {
    root.querySelector('.card').insertAdjacentHTML('afterend', promo);
    root.querySelector('#promo-x').onclick = async () => { await kvSet('proSeen', true); root.querySelector('.card').nextElementSibling.remove(); };
    root.querySelector('#promo-open').onclick = () => { kvSet('proSeen', true); upgradeModal('كل ميزات Pro'); };
  }
};

/* day detail modal — shared with archive */
async function openDayDetail(date) {
  const sessions = (await DB.all('sessions')).filter(s => s.date === date);
  if (!sessions.length) return;
  const st = dayStats(sessions, date);
  const rows = sessions.map(s => {
    const c = calcSession(s);
    return '<div class="session-card">' +
      '<div class="sc-head"><span class="sc-title">' + esc(PLATFORMS[s.platform] || s.platform) + '</span>' +
      '<span>' + vBtn('sessions', s.id) + eBtn('edit-session') + dBtn('del-session', s.id) + '</span></div>' +
      '<input type="hidden" data-rid="' + s.id + '">' +
      '<div class="kv"><span class="k">الدخل (' + (s.mode === 'gross' ? 'إجمالي' : 'صافي') + ')</span><span class="v">' + money(s.amount) + '</span></div>' +
      (s.mode === 'gross' ? '<div class="kv"><span class="k">العمولة (' + fmtN(s.commissionPct) + '%)</span><span class="v neg-t">' + money(c.commission) + '</span></div>' : '') +
      (s.tips ? '<div class="kv"><span class="k">بقشيش/حوافز</span><span class="v">' + money(s.tips) + '</span></div>' : '') +
      '<div class="kv"><span class="k">كم • ساعات • رحلات</span><span class="v">' + fmtN(s.km) + ' • ' + fmtN(s.hours) + ' • ' + fmtN(s.trips) + '</span></div>' +
      (s.directExpenses ? '<div class="kv"><span class="k">مصاريف مباشرة</span><span class="v neg-t">' + money(s.directExpenses) + '</span></div>' : '') +
      '<div class="kv"><span class="k">مخصص وقود + صيانة</span><span class="v res-t">' + money(c.fuelRes + c.maintRes) + '</span></div>' +
      '<div class="kv"><span class="k">الربح الشخصي للجلسة</span><span class="v ' + (c.profit >= 0 ? 'pos-t' : 'neg-t') + '">' + money(c.profit) + '</span></div>' +
      (s.notes ? '<div class="t2">📝 ' + esc(s.notes) + '</div>' : '') +
      '</div>';
  }).join('');

  openModal(
    '<div class="modal-title">يوم ' + esc(fullDayLabel(date)) + '</div>' +
    '<div class="stat-grid cols3" style="margin-bottom:12px">' +
    '<div class="stat"><div class="lbl">صافي الدخل</div><div class="val">' + money(st.net) + '</div></div>' +
    '<div class="stat"><div class="lbl">الربح الشخصي</div><div class="val ' + (st.profit >= 0 ? 'pos-t' : 'neg-t') + '">' + money(st.profit) + '</div></div>' +
    '<div class="stat"><div class="lbl">هامش</div><div class="val">' + fmtPct(st.margin) + '</div></div>' +
    '</div>' + rows +
    '<div class="modal-actions">' +
    '<button class="btn" onclick="closeModal()">إغلاق</button>' +
    '<button class="btn btn-pri" onclick="closeModal();go(\'add\',{date:\'' + date + '\'})">＋ إضافة جلسة لهذا اليوم</button>' +
    '</div>',
    { onMount: w => {
      w.querySelectorAll('[data-rid]').forEach(inp => {
        const id = inp.dataset.rid;
        const card = inp.closest('.session-card');
        const rec = sessions.find(x => x.id === id);
        card.querySelector('[data-act="view-rec"]').onclick = () => showRecHistory('sessions', id);
        card.querySelector('[data-act="edit-session"]').onclick = () => openSessionEdit(rec);
        card.querySelector('[data-act="del-session"]').onclick = async () => {
          await confirmDelete('sessions', rec,
            'جلسة ' + PLATFORMS[rec.platform] + ' بدخل ' + fmtN(rec.amount) + ' ج.م — ' + fullDayLabel(rec.date));
          closeModal();
          go(Nav.current);
        };
      });
    } }
  );
}
