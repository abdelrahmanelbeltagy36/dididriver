/* ===== views-onboard.js — شاشة أول مرة: اختيار النمط + بيانات العربية + آخر تغييرات + فئة الزيت =====
   بتظهر مرة واحدة فقط (kv: onboarded). كل حاجة اختيارية إلا العداد. */
'use strict';

const OIL_PRESETS = [
  { km: 3000, label: '3,000', hint: 'زيت مينرال' },
  { km: 5000, label: '5,000', hint: 'نص تركيب (الأشهر)' },
  { km: 7000, label: '7,000', hint: 'نص تركيب ممتاز' },
  { km: 10000, label: '10,000', hint: 'زيت تركيب كامل' },
  { km: 15000, label: '15,000', hint: 'تركيب طويل المدى' }
];
/* الأنواع اللي بنسأل عنها في الترحيب (اللي ليها فترات افتراضية) */
const ONB_CATS = ['oil', 'oilFilter', 'airFilter', 'fuelFilter', 'tires', 'brakes', 'battery'];

Views.onboard = async function (root) {
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';

  const ob = { mode: 'driver', vehicleName: '', plate: '', odo: '', fuelType: 'بنزين 90', fuelPrice: 22.25, l100: 8, maintPerKm: 2, oilKm: 5000, cats: {} };

  const catRow = (ck) => {
    return '<div class="grid2" style="align-items:end;margin-bottom:6px">' +
      '<div class="field" style="margin:0"><label style="font-weight:800">' + esc(CATS[ck]) + ' — غيرته إمتى؟</label>' +
      '<input class="input" type="date" data-ob="date-' + ck + '" value=""></div>' +
      '<div class="field" style="margin:0"><label>والعداد كان كام وقتها؟ (اختياري)</label>' +
      '<input class="input" type="number" inputmode="numeric" data-ob="odo-' + ck + '" placeholder="اختياري" dir="ltr"></div>' +
      '</div>' +
      '<div class="field" style="margin:0 0 8px"><label>المبلغ اللي دفعته (اختياري — بيساعد في تقدير المصاريف)</label>' +
      '<input class="input" type="number" step="any" inputmode="decimal" data-ob="cost-' + ck + '" placeholder="مثال: 350" dir="ltr"></div>';
  };

  const presetChips = () => OIL_PRESETS.map(p =>
    '<button class="btn btn-sm' + (p.km === ob.oilKm ? ' btn-pri' : '') + '" data-oil="' + p.km + '" style="min-height:40px">' +
    '<bdi dir="ltr">' + p.label + '</bdi><div class="small" style="font-size:.62rem">' + p.hint + '</div></button>').join('');

  const modeHint = () => ob.mode === 'daily'
    ? '👈 هتسجّل <b>مصاريف بس</b> (بنزين + صيانة + كم) — البرنامج هيقدّر مصاريفك من اللي صرفته فعلًا قبل كده. من غير أرباح وعمولات.'
    : '👈 هتسجّل دخلك من ديدي/أوبر مع العمولات والرحلات، والبرنامج يحسب لك الربح بعد خصم الوقود والصيانة.';

  function render() {
    root.innerHTML =
      '<div class="card" style="border-color:var(--pri)"><div class="card-title">👋 أهلاً بك</div>' +
      '<div class="t2" style="line-height:1.8">دقيقة واحدة وتظبط عربيتك مرة واحدة والأبد — كل الحسابات والمواعيد هتشتغل على بياناتك دي. بياناتك محفوظة على موبايلك فقط.</div>' +
      '<div class="divider"></div>' +
      '<div class="t2" style="font-weight:800;margin-bottom:6px">🧭 ١) إزاي هتستخدم التطبيق؟ (تقدر تغيّرها بعدين)</div>' +
      '<div class="grid2" style="margin-bottom:8px">' +
      '<button class="btn' + (ob.mode === 'driver' ? ' btn-pri' : '') + '" data-obmode="driver" style="min-height:66px;display:flex;flex-direction:column;justify-content:center;gap:2px">' +
      '<span style="font-size:1.3rem">🚕</span><b>شغل ديدي / أوبر</b><span class="small">دخل + عمولة + رحلات</span></button>' +
      '<button class="btn' + (ob.mode === 'daily' ? ' btn-pri' : '') + '" data-obmode="daily" style="min-height:66px;display:flex;flex-direction:column;justify-content:center;gap:2px">' +
      '<span style="font-size:1.3rem">🚗</span><b>قيادة يومية عادية</b><span class="small">مصاريف بس — من غير أرباح</span></button>' +
      '</div>' +
      '<div class="t2" id="ob-mode-hint" style="margin-bottom:8px;line-height:1.7">' + modeHint() + '</div>' +
      '<div class="divider"></div>' +
      '<div class="t2" style="font-weight:800;margin-bottom:6px">🚗 ٢) بيانات عربيتك</div>' +
      '<div class="grid2">' +
      field('اسم العربية', '<input class="input" data-ob="vehicleName" placeholder="مثال: شيران 2019" value="">') +
      field('رقم اللوحة (اختياري)', '<input class="input" data-ob="plate" dir="ltr">') +
      '</div>' +
      field('📍 عداد الكيلومتر الحالي (كم) — أهم خانة', '<input class="input input-lg" type="number" inputmode="numeric" data-ob="odo" placeholder="مثال: 102000" dir="ltr" style="text-align:center;font-weight:800">') +
      '<div class="divider"></div>' +
      '<div class="t2" style="font-weight:800;margin-bottom:6px">⛽ ٣) الوقود (تقدر تعدلها بعدين)</div>' +
      '<div class="grid2">' +
      field('نوع الوقود', '<input class="input" data-ob="fuelType" value="' + esc(ob.fuelType) + '">') +
      field('سعر اللتر (ج.م)', '<input class="input" type="number" step="any" inputmode="decimal" data-ob="fuelPrice" value="' + ob.fuelPrice + '" dir="ltr">') +
      '</div>' +
      field('متوسط الاستهلاك (لتر/100 كم)', '<input class="input" type="number" step="any" inputmode="decimal" data-ob="l100" value="' + ob.l100 + '" dir="ltr">') +
      '<div class="divider"></div>' +
      '<div class="t2" style="font-weight:800;margin-bottom:4px">🛢️ ٤) بتغير الزيت كل كام كم؟</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px" id="ob-oil-chips">' + presetChips() + '</div>' +
      '<div class="grid2">' +
      field('أو اكتب رقم مخصص (كم)', '<input class="input" type="number" inputmode="numeric" data-ob="oilKmCustom" value="' + ob.oilKm + '" dir="ltr">') +
      field('وأقصى مدة (شهور)', '<input class="input" type="number" inputmode="numeric" data-ob="oilMonths" value="6" dir="ltr">') +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="t2" style="font-weight:800;margin-bottom:4px">🔧 ٥) آخر مرة غيرت إيه؟ (كلها اختيارية — اللي مش فاكره سيبها فاضية)</div>' +
      '<div class="t2" style="margin-bottom:8px">لو كتبت التاريخ والعداد، التطبيق يحسبلك فورًا متى التغيير الجاي وينبهك قبلها. مبلغ التغيير اختياري كمان — وبيساعد في تقدير مصاريفك.</div>' +
      ONB_CATS.map(catRow).join('') +
      '<div class="divider"></div>' +
      '<button class="btn btn-pri btn-block" id="ob-finish" style="min-height:50px;font-size:1rem">✅ يلا بينا — ابدأ</button>' +
      '<div class="t2" style="margin-top:8px;text-align:center">تقدر تعدل أي حاجة دي في أي وقت من الإعدادات</div>' +
      '</div>';

    /* mode choice */
    root.querySelectorAll('[data-obmode]').forEach(b => b.onclick = () => {
      ob.mode = b.dataset.obmode;
      root.querySelectorAll('[data-obmode]').forEach(x => x.classList.toggle('btn-pri', x === b));
      root.querySelector('#ob-mode-hint').innerHTML = modeHint();
    });
    /* preset chips */
    root.querySelectorAll('[data-oil]').forEach(b => b.onclick = () => {
      ob.oilKm = +b.dataset.oil;
      root.querySelector('[data-ob="oilKmCustom"]').value = ob.oilKm;
      root.querySelectorAll('[data-oil]').forEach(x => x.classList.toggle('btn-pri', x === b));
    });
    /* convenience: filling oil row autofills oilFilter */
    const oilDate = root.querySelector('[data-ob="date-oil"]');
    const oilOdo = root.querySelector('[data-ob="odo-oil"]');
    oilDate.addEventListener('change', () => {
      const fDate = root.querySelector('[data-ob="date-oilFilter"]');
      if (oilDate.value && !fDate.value) fDate.value = oilDate.value;
    });
    oilOdo.addEventListener('input', () => {
      const fOdo = root.querySelector('[data-ob="odo-oilFilter"]');
      if (oilOdo.value && !fOdo.value) fOdo.value = oilOdo.value;
    });

    root.querySelector('#ob-finish').onclick = finishOnboard;
  }

  async function finishOnboard() {
    const g = k => { const el = root.querySelector('[data-ob="' + k + '"]'); return el ? el.value.trim() : ''; };
    ob.vehicleName = g('vehicleName') || 'عربيتي';
    ob.plate = g('plate');
    ob.odo = +g('odo') || 0;
    ob.fuelType = g('fuelType') || ob.fuelType;
    ob.fuelPrice = +g('fuelPrice') || ob.fuelPrice;
    ob.l100 = +g('l100') || ob.l100;
    const oilCustom = +g('oilKmCustom') || ob.oilKm;
    const oilMonths = +g('oilMonths') || 6;
    if (!(ob.odo > 0)) { toast('اكتب رقم العداد الحالي — من غيره مش هنقدر نحسبلك المواعيد'); root.querySelector('[data-ob="odo"]').focus(); return; }

    /* settings */
    S.mode = ob.mode;
    S.vehicleName = ob.vehicleName;
    S.plate = ob.plate;
    S.odo = ob.odo;
    S.fuelType = ob.fuelType;
    S.fuelPrice = ob.fuelPrice;
    S.l100 = ob.l100;
    S.intervals.oil = { km: oilCustom, months: oilMonths };
    S.intervals.oilFilter = { km: oilCustom, months: oilMonths };
    await saveSettings();

    /* last-change entries (optional) */
    const today = todayStr();
    for (const ck of ONB_CATS) {
      const date = g('date-' + ck);
      const odo = +g('odo-' + ck) || 0;
      const cost = +g('cost-' + ck) || 0;
      if (!date && !odo && !cost) continue;
      const iv = S.intervals[ck] || {};
      const useOdo = odo || ob.odo;
      const useDate = date || today;
      await DB.put('maintenance', {
        id: uid(), createdAt: Date.now(), history: [{ ts: Date.now(), action: 'create' }],
        date: useDate, odo: useOdo, category: ck, cost,
        nextDueKm: iv.km ? useOdo + iv.km : null,
        nextDueDate: iv.months ? addDays(useDate, iv.months * 30) : null,
        faultDesc: '', repairDesc: '', fromWallet: false,
        notes: 'من الترحيب الأول', receiptPhoto: ''
      });
    }
    await kvSet('onboarded', true);
    applyModeLabels();
    toast('🎉 أهلاً! عربيتك اتظبطت — دلوقتي افتح خزنة العربية وشوف مواعيد صيانتك', { duration: 8000 });
    go('home');

    /* اطلب إذن الإشعارات بعد ما خلص (داخل تفاعل المستخدم) */
    if ('Notification' in window && Notification.permission === 'default') {
      const yes = await confirmDlg({
        title: 'تفعيل إشعارات الصيانة؟',
        body: 'هنبعتلك إشعار <b>كل يوم الساعة 4 العصر</b> عشان تسجّل عدادك — ولو حاجة قربت أو فاتت كل حاجة ليها إشعار لوحدها. وترقد تعدّل العداد <b>من جوه الإشعار</b> من غير ما تفتح التطبيق. الإشعارات بتفضل في شريط الموبايل حتى لو قفلت التطبيق.',
        okText: '✅ فعّل الإشعارات'
      });
      await enableNotifications(yes);
    }
  }

  render();
};
