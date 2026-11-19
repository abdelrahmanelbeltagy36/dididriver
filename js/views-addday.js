/* ===== views-addday.js — إضافة يوم (entry with live preview) ===== */
'use strict';

const AddDay = { drafts: [], date: todayStr() };

function blankDraft() {
  return {
    platform: 'didi', mode: 'net', amount: '',
    commissionPct: S.commission.didi || 0,
    tips: '', tipsIncluded: true,
    km: '', hours: '', trips: '', directExpenses: '',
    odoStart: '', odoEnd: '', notes: ''
  };
}

function draftCalc(d) {
  const tmp = {
    mode: d.mode, amount: +d.amount || 0, commissionPct: +d.commissionPct || 0,
    tips: +d.tips || 0, tipsIncluded: d.tipsIncluded,
    km: +d.km || 0, hours: +d.hours || 0, trips: +d.trips || 0,
    directExpenses: +d.directExpenses || 0,
    snap: { fuelPrice: S.fuelPrice, l100: S.l100, maintKm: S.maintPerKm }
  };
  return calcSession(tmp);
}

Views.add = async function (root) {
  if (!AddDay.drafts.length) {
    AddDay.drafts = [blankDraft()];
    AddDay.date = Nav.params.date || todayStr();
  } else if (Nav.params.date) {
    AddDay.date = Nav.params.date;
  }
  Nav.params = {};

  /* تقدير المصاريف بيجي من المصاريف الفعلية القديمة (أو من الإعدادات أول مرة) */
  AddDay.est = estimatedCostPerKm(
    modeSessions(await DB.all('sessions')),
    await DB.all('purchases'),
    await DB.all('maintenance')
  );

  root.innerHTML =
    '<div class="card">' +
    field(isDaily() ? 'تاريخ اليوم' : 'تاريخ اليوم', '<input class="input" type="date" id="ad-date" value="' + AddDay.date + '">') +
    '<div class="t2 muted" style="font-size:.78rem">' +
    (isDaily()
      ? 'وضع القيادة اليومية: بتسجّل مصاريف بس — والبرنامج يقدّر تكلفة اليوم من مصاريفك الفعلية السابقة.'
      : 'يمكن تسجيل عدة جلسات/تطبيقات في نفس اليوم — تُجمع في تقرير واحد مع بقاء تفصيل كل تطبيق.') +
    '</div>' +
    '</div>' +
    '<div id="ad-cards"></div>' +
    (isDaily() ? '' : '<button class="btn btn-block" id="ad-add-session" style="margin-bottom:12px">＋ إضافة جلسة / تطبيق آخر</button>') +
    '<div class="card" id="ad-preview"></div>' +
    '<div class="save-bar"><button class="btn btn-pos btn-block" id="ad-save">💾 حفظ اليوم</button></div>';

  renderAddCards();
  bindAddEvents(root);
  updatePreview();
};

function renderAddCards() {
  const box = document.getElementById('ad-cards');
  if (!box) return;
  box.innerHTML = AddDay.drafts.map((d, i) => addCardHTML(d, i)).join('');
}

function addCardHTML(d, i) {
  /* الوضع العادي: مصاريف بس — من غير دخل/عمولة/بقشيش/رحلات */
  if (isDaily()) {
    return '<div class="session-card" data-idx="' + i + '">' +
      '<div class="sc-head"><span class="sc-title">🚗 يوم قيادة</span></div>' +
      '<div class="grid2">' +
      field('إجمالي الكيلومترات 🛣️', numInput('km', d.km, 'مثال: 45')) +
      field('ساعات القيادة (اختياري) ⏱️', numInput('hours', d.hours, 'مثال: 3')) +
      '</div>' +
      field('المصروف الفعلي اليوم (اختياري) 💸', numInput('directExpenses', d.directExpenses, 'وقوف، غسيل، مواصلات…')) +
      '<div class="t2 muted" style="font-size:.78rem;margin:-4px 0 8px">اللي بتكتبه هنا بيتضاف لتقدير البنزين والصيانة — وبيغذّي التقدير للأيام الجاية.</div>' +
      '<div class="grid2">' +
      field('عداد البداية (اختياري)', numInput('odoStart', d.odoStart, '')) +
      field('عداد النهاية (اختياري)', numInput('odoEnd', d.odoEnd, '')) +
      '</div>' +
      field('ملاحظات 📝', '<textarea class="input" data-f="notes" rows="2" placeholder="ملاحظات اليوم…">' + esc(d.notes || '') + '</textarea>') +
      '</div>';
  }
  const gross = d.mode === 'gross';
  return '<div class="session-card" data-idx="' + i + '">' +
    '<div class="sc-head"><span class="sc-title">جلسة ' + (i + 1) + '</span>' +
    (AddDay.drafts.length > 1 ? '<button class="btn btn-sm" data-act="rm" data-idx="' + i + '">✕ حذف</button>' : '') +
    '</div>' +
    '<div class="grid2">' +
    field('التطبيق', '<select class="input" data-f="platform">' + options([
      { v: 'didi', l: 'ديدي' }, { v: 'uber', l: 'أوبر' }, { v: 'other', l: 'أخرى' }
    ], d.platform) + '</select>') +
    '<div class="field"><label>نوع الدخل</label><div class="seg" data-seg="mode">' +
    '<button type="button" class="' + (!gross ? 'on' : '') + '" data-v="net">صافي</button>' +
    '<button type="button" class="' + (gross ? 'on' : '') + '" data-v="gross">إجمالي</button></div></div>' +
    '</div>' +
    field(gross ? 'الدخل الإجمالي (قبل العمولة)' : 'الدخل الصافي (بعد العمولة)', numInput('amount', d.amount, '0'), '') +
    (gross ? field('نسبة العمولة %', numInput('commissionPct', d.commissionPct, '')) : '') +
    '<div class="grid2">' +
    field('بقشيش وحوافز', numInput('tips', d.tips, '0')) +
    '<div class="field" style="align-self:end"><label class="check-row" style="color:var(--txt)">' +
    '<input type="checkbox" data-f="tipsIncluded" ' + (d.tipsIncluded ? 'checked' : '') + '> البقشيش محسوب داخل الدخل ' +
    fInfo('البقشيش', [
      'لو البقشيش <b>مضاف بالفعل</b> داخل الدخل الصافي: اتركه مفعّلًا حتى لا يحسب مرتين.',
      'لو البقشيش <b>منفصل</b> عن الدخل: أزل العلامة وسيُضاف إلى الدخل الصافي مرة واحدة.'
    ]) + '</label></div>' +
    '</div>' +
    '<div class="grid2">' +
    field('إجمالي كم العمل 🛣️', numInput('km', d.km, 'مثال: 160')) +
    field('ساعات العمل ⏱️', numInput('hours', d.hours, 'مثال: 9')) +
    '</div>' +
    '<div class="grid2">' +
    field('عدد الرحلات', numInput('trips', d.trips, '0')) +
    field('مصاريف مباشرة 💸', numInput('directExpenses', d.directExpenses, 'وقوف، ترول، غسيل…')) +
    '</div>' +
    '<div class="grid2">' +
    field('عداد البداية (اختياري)', numInput('odoStart', d.odoStart, '')) +
    field('عداد النهاية (اختياري)', numInput('odoEnd', d.odoEnd, '')) +
    '</div>' +
    field('ملاحظات 📝', '<textarea class="input" data-f="notes" rows="2" placeholder="ملاحظات اليوم…">' + esc(d.notes || '') + '</textarea>') +
    '</div>';
}

function bindAddEvents(root) {
  const dateEl = root.querySelector('#ad-date');
  dateEl.addEventListener('change', () => { AddDay.date = dateEl.value || todayStr(); });

  root.addEventListener('input', e => {
    const el = e.target;
    if (!el.dataset || !el.dataset.f) {
      if (el.id === 'ad-date') AddDay.date = el.value;
      return;
    }
    const card = el.closest('[data-idx]');
    if (!card) return;
    const i = +card.dataset.idx;
    if (el.type === 'checkbox') AddDay.drafts[i][el.dataset.f] = el.checked;
    else AddDay.drafts[i][el.dataset.f] = el.value;
    updatePreview();
  });

  root.addEventListener('click', e => {
    const segBtn = e.target.closest('[data-seg="mode"] button');
    if (segBtn) {
      const card = segBtn.closest('[data-idx]');
      const i = +card.dataset.idx;
      const v = segBtn.dataset.v;
      AddDay.drafts[i].mode = v;
      if (v === 'gross') AddDay.drafts[i].commissionPct = AddDay.drafts[i].commissionPct || S.commission[AddDay.drafts[i].platform] || 0;
      renderAddCards();
      updatePreview();
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const idx = act.dataset.idx;
    if (act.dataset.act === 'rm') {
      AddDay.drafts.splice(+idx, 1);
      renderAddCards();
      updatePreview();
    }
  });

  /* platform change resets commission default */
  root.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset && el.dataset.f === 'platform') {
      const card = el.closest('[data-idx]');
      const i = +card.dataset.idx;
      AddDay.drafts[i].platform = el.value;
      if (AddDay.drafts[i].mode === 'gross') {
        AddDay.drafts[i].commissionPct = S.commission[el.value] || 0;
        renderAddCards();
      }
      updatePreview();
    }
  });

  const addSessionBtn = root.querySelector('#ad-add-session');
  if (addSessionBtn) addSessionBtn.onclick = () => {
    const last = AddDay.drafts[AddDay.drafts.length - 1];
    const nd = blankDraft();
    nd.odoStart = last && last.odoEnd ? last.odoEnd : '';
    AddDay.drafts.push(nd);
    renderAddCards();
    updatePreview();
    const cards = root.querySelectorAll('.session-card');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  root.querySelector('#ad-save').onclick = saveDay;
}

function updatePreview() {
  const box = document.getElementById('ad-preview');
  if (!box) return;

  /* معاينة الوضع العادي: التكلفة المتوقعة من مصاريفك القديمة */
  if (isDaily()) {
    const est = AddDay.est || estimatedCostPerKm([], [], []);
    const d = AddDay.drafts[0] || blankDraft();
    const km = +d.km || 0, hours = +d.hours || 0, direct = +d.directExpenses || 0;
    const fuelMaint = km * est.value;
    const total = fuelMaint + direct;
    const src = est.source === 'actual'
      ? 'من <b>مصاريفك الفعلية القديمة</b> — بدون أي زيادة'
      : 'لسه مفيش مصاريف كافية — تقدير مؤقت من إعدادات الوقود والصيانة';
    box.innerHTML =
      '<div class="card-title">👁️ تكلفة اليوم المتوقعة</div>' +
      '<div class="formula" style="margin-bottom:10px">📊 مصدر التقدير: ' + src + '<br>' +
      'تكلفة الكيلومتر = <b>' + fmtN(est.value) + ' ج.م/كم</b></div>' +
      '<div class="preview-num"><span class="pl">🛣️ الكيلومترات</span><span class="pv">' + fmtN(km) + ' كم</span></div>' +
      '<div class="preview-num"><span class="pl">⛽+🔧 وقود وصيانة متوقعة (' + fmtN(km) + ' × ' + fmtN(est.value) + ')</span><span class="pv res-t">' + money(fuelMaint) + '</span></div>' +
      '<div class="preview-num"><span class="pl">💸 مصروف فعلي كتبته</span><span class="pv neg-t">' + money(direct) + '</span></div>' +
      '<div class="preview-num preview-total"><span class="pl" style="font-weight:800;color:var(--txt)">إجمالي تكلفة اليوم</span><span class="pv res-t">' + money(total) + '</span></div>' +
      '<div class="stat-grid" style="margin-top:10px">' +
      '<div class="stat"><div class="lbl">تكلفة/كم</div><div class="val">' + money(km ? total / km : 0) + '</div></div>' +
      '<div class="stat"><div class="lbl">تكلفة/ساعة</div><div class="val">' + money(hours ? total / hours : 0) + '</div></div>' +
      '</div>';
    return;
  }

  const cals = AddDay.drafts.map(draftCalc);
  let net = 0, commission = 0, fuel = 0, maint = 0, direct = 0, km = 0, hours = 0, trips = 0;
  cals.forEach(c => { net += c.effNet; commission += c.commission; fuel += c.fuelRes; maint += c.maintRes; direct += c.direct; km += c.km; hours += c.hours; });
  AddDay.drafts.forEach(d => trips += +d.trips || 0);
  const profit = net - fuel - maint - direct;
  const margin = net ? (profit / net) * 100 : 0;

  box.innerHTML =
    '<div class="card-title">👁️ معاينة مباشرة قبل الحفظ</div>' +
    '<div class="preview-num"><span class="pl">الدخل الصافي ' + fInfo('الدخل الصافي', [
      'صافي = الإجمالي × (1 − العمولة%) + البقشيش غير المحسوب',
      'العمولة تُحسب تلقائيًا في وضع «إجمالي»'
    ]) + '</span><span class="pv">' + money(net) + '</span></div>' +
    (commission ? '<div class="preview-num"><span class="pl">عمولة التطبيقات</span><span class="pv neg-t">' + money(commission) + '</span></div>' : '') +
    '<div class="preview-num"><span class="pl">⛽ مخصص الوقود ' + fInfo('مخصص الوقود', [
      'تكلفة الوقود/كم = الاستهلاك ÷ 100 × سعر اللتر = <span class="fnum">' + fmtN(S.l100) + ' ÷ 100 × ' + fmtN(S.fuelPrice) + ' = ' + fmtN(S.l100 / 100 * S.fuelPrice) + '</span> ج.م/كم',
      'مخصص الوقود = ' + fmtN(km) + ' كم × ' + fmtN(S.l100 / 100 * S.fuelPrice) + ' = <span class="fnum">' + fmtN(fuel) + '</span> ج.م'
    ]) + '</span><span class="pv res-t">' + money(fuel) + '</span></div>' +
    '<div class="preview-num"><span class="pl">🔧 مخصص الصيانة ' + fInfo('مخصص الصيانة', [
      'مخصص الصيانة = الكيلومترات × ' + fmtN(S.maintPerKm) + ' ج.م/كم',
      '= ' + fmtN(km) + ' × ' + fmtN(S.maintPerKm) + ' = <span class="fnum">' + fmtN(maint) + '</span> ج.م'
    ]) + '</span><span class="pv res-t">' + money(maint) + '</span></div>' +
    (direct ? '<div class="preview-num"><span class="pl">مصاريف مباشرة</span><span class="pv neg-t">' + money(direct) + '</span></div>' : '') +
    '<div class="preview-num preview-total"><span class="pl" style="font-weight:800;color:var(--txt)">الربح الشخصي المتاح ' +
    fInfo('الربح الشخصي', [
      'الربح = صافي − مخصص وقود − مخصص صيانة − مصاريف مباشرة',
      '= ' + fmtN(net) + ' − ' + fmtN(fuel) + ' − ' + fmtN(maint) + (direct ? ' − ' + fmtN(direct) : '') + ' = <span class="fnum">' + fmtN(profit) + '</span> ج.م',
      'ملاحظة: مشتريات الوقود والصيانة الفعلية تُخصم من الخزنتين فقط، و<b>لا تُخصم من الربح مرة أخرى</b>.'
    ]) +
    '</span><span class="pv ' + (profit >= 0 ? 'pos-t' : 'neg-t') + '">' + money(profit) + '</span></div>' +
    '<div class="stat-grid cols3" style="margin-top:10px">' +
    '<div class="stat"><div class="lbl">هامش الربح</div><div class="val ' + (margin >= 0 ? 'pos-t' : 'neg-t') + '">' + fmtPct(margin) + '</div></div>' +
    '<div class="stat"><div class="lbl">ربح/كم</div><div class="val">' + money(km ? profit / km : 0) + '</div></div>' +
    '<div class="stat"><div class="lbl">ربح/ساعة</div><div class="val">' + money(hours ? profit / hours : 0) + '</div></div>' +
    '</div>';
}

async function saveDay() {
  if (!AddDay.date) { toast('اختر تاريخ اليوم'); return; }
  const daily = isDaily();
  const valid = daily
    ? AddDay.drafts.filter(d => (+d.km > 0 || +d.directExpenses > 0))
    : AddDay.drafts.filter(d => +d.amount > 0);
  if (!valid.length) {
    toast(daily ? 'اكتب الكيلومترات أو مصروف فعلي واحد على الأقل' : 'أدخل دخلًا أكبر من صفر في جلسة واحدة على الأقل');
    return;
  }

  const records = valid.map(d => ({
    id: uid(),
    kind: S.mode,
    date: AddDay.date,
    platform: daily ? 'other' : d.platform,
    mode: daily ? 'net' : d.mode,
    amount: daily ? 0 : +d.amount,
    commissionPct: (!daily && d.mode === 'gross') ? (+d.commissionPct || 0) : 0,
    tips: daily ? 0 : (+d.tips || 0),
    tipsIncluded: daily ? true : !!d.tipsIncluded,
    km: +d.km || 0,
    hours: +d.hours || 0,
    trips: daily ? 0 : (+d.trips || 0),
    directExpenses: +d.directExpenses || 0,
    odoStart: +d.odoStart || null,
    odoEnd: +d.odoEnd || null,
    notes: d.notes || '',
    snap: { fuelPrice: S.fuelPrice, l100: S.l100, maintKm: S.maintPerKm },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    history: [{ ts: Date.now(), action: 'create', by: daily ? 'تسجيل يوم' : 'إضافة يوم' }]
  }));

  await DB.bulkPut('sessions', records);

  /* keep odometer current (settings-level, never touches saved records) */
  let maxOdo = 0;
  records.forEach(r => { if (r.odoEnd && r.odoEnd > maxOdo) maxOdo = r.odoEnd; });
  if (maxOdo > (+S.odo || 0)) {
    S.odo = maxOdo;
    await saveSettings();
  }

  toast((daily ? '✅ تم تسجيل يوم قيادة — ' : '✅ تم حفظ ' + records.length + ' جلسة ليوم ') + fullDayLabel(AddDay.date), { duration: 4500 });
  AddDay.drafts = [blankDraft()];
  Nav.params = { date: AddDay.date };
  go('add');
}
