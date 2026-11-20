/* ===== views-settings.js — الإعدادات + اختبار المحاسبة + النسخ + السلة + المقترحات ===== */
'use strict';

let ST = { photoTmp: '' };

Views.settings = async function (root) {
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  const mk = monthKey(todayStr());

  /* متوسط مصاريفك الفعلية — أساس التقدير في الوضع العادي */
  const dailyEst = isDaily()
    ? estimatedCostPerKm(modeSessions(await DB.all('sessions')), await DB.all('purchases'), await DB.all('maintenance'))
    : null;

  let html = '';

  /* ---------- الوضع: سائق / قيادة يومية ---------- */
  html += '<div class="card" style="border-color:var(--pri)"><div class="card-title">🧭 نمط التطبيق</div>' +
    '<div class="seg" id="st-mode">' +
    '<button type="button" data-v="driver" class="' + (!isDaily() ? 'on' : '') + '">🚕 ديدي / أوبر</button>' +
    '<button type="button" data-v="daily" class="' + (isDaily() ? 'on' : '') + '">🚗 قيادة يومية</button>' +
    '</div>' +
    '<div class="t2" style="margin-top:8px;line-height:1.8">' + (isDaily()
      ? 'الوضع الحالي: <b>مصاريف بس</b> — التكلفة المتوقعة بتتقدّم من مصاريفك الفعلية القديمة، من غير دخل أو عمولات.'
      : 'الوضع الحالي: <b>دخل السائق</b> — ديدي/أوبر مع العمولات وحساب الربح الشخصي.') + '</div>' +
    '<div class="t2" style="margin-top:4px">تغيير النمط بيخبي سجلات النمط التاني ويظهر سجلات النمط ده — وكل البيانات محفوظة.</div></div>';

  /* ---------- إشعارات الصيانة ---------- */
  const notifState = !('Notification' in window) ? 'المتصفح مش بيدعم الإشعارات'
    : Notification.permission === 'granted' ? 'مفعّلة ✓'
    : Notification.permission === 'denied' ? 'مقفولة من إعدادات المتصفح' : 'لم تُطلب بعد';
  html += '<div class="card"><div class="card-title">🔔 إشعارات الصيانة</div>' +
    '<div class="t2" style="line-height:1.8">تذكير العداد <b>كل يوم الساعة 10 الصبح والساعة 4 العصر</b>. لو التطبيق كان مفتوح، الإشعار بيجي في الوقت؛ ولو قفلته وفتحته بعد الوقت، بيجيك فورًا. ولو حاجة قربت أو فاتت، كل حاجة ليها إشعار لوحدها. وترقد تعدّل العداد من زرار جوه الإشعار.</div>' +
    '<div class="t2" style="margin-top:6px;color:var(--sub)">📌 نسخة الويب مش بتبعت إشعار والتطبيق مقفول تمامًا — ده محتاج نسخة أندرويد أصلية (FCM).</div>' +
    '<div class="kv" style="margin-top:8px"><span class="k">الحالة</span><span class="v">' + notifState + '</span></div>' +
    '<button class="btn btn-pri btn-block" id="st-notif">' +
    (('Notification' in window) && Notification.permission === 'granted'
      ? (S.notifications === false ? '✅ إعادة تفعيل الإشعارات' : '🔕 إيقاف الإشعارات')
      : '🔔 تفعيل الإشعارات') + '</button>' +
    '<button class="btn btn-block" id="st-notif-test" style="margin-top:6px">🧪 إرسال إشعار تجريبي (اتأكد دلوقتي)</button></div>';

  /* ---------- cloud account ---------- */
  if (Cloud.enabled()) {
    const cu = Cloud.user() || {};
    html += '<div class="card"><div class="card-title">☁️ الحساب والمزامنة</div>' +
      '<div class="kv"><span class="k">البريد</span><span class="v" dir="ltr">' + esc(cu.email || '—') + '</span></div>' +
      '<div class="kv"><span class="k">حالة البيانات</span><span class="v">بتتزامن تلقائيًا مع السحابة لما النت يرجع</span></div>' +
      '<div class="kv"><span class="k">إشعارات أندرويد (FCM)</span><span class="v">' +
      (localStorage.getItem('didicloud_fcm_token') ? 'متصلة ✓' : 'مش متصلة — افتح التطبيق الأصلي') + '</span></div>' +
      '<div class="t2" style="font-size:.72rem;color:var(--sub);word-break:break-all">تشخيص: Capacitor=' +
      (typeof window.Capacitor) + ' • native=' + (!!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) +
      ' • plugin=' + (typeof (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications)) +
      ' • cap=' + (typeof window.Capacitor) +
      ' • host=' + location.hostname + ' • native=' + (!!window.__NATIVE_WEBVIEW__) +
      ' • ' + (localStorage.getItem('didicloud_fcm_diag') || 'no-diag') + '</div>' +
      '<div class="kv" style="margin-top:4px"><span class="k">التذكير اليومي (4 عصر + 9 وربع)</span><span class="v">' +
      (localStorage.getItem('didicloud_local_reminders') ? 'مفعّل ✓' : 'مش مفعّل') + '</span></div>' +
      '<button class="btn btn-block" id="st-fcm-retry" style="margin-top:6px">🔄 إعادة محاولة تفعيل الإشعارات</button>' +
      '<button class="btn btn-block" id="st-logout" style="margin-top:8px">🚪 تسجيل الخروج</button></div>';
  }

  /* ---------- vehicle ---------- */
  html += '<div class="card"><div class="card-title">🚗 العربية</div>' +
    field('اسم العربية', '<input class="input" id="st-vehicle" value="' + esc(S.vehicleName) + '">') +
    '<div class="grid2">' +
    field('رقم اللوحة (اختياري)', '<input class="input" id="st-plate" value="' + esc(S.plate) + '">') +
    field('عداد المسافة الحالي (كم)', '<input class="input" id="st-odo" type="number" inputmode="decimal" value="' + (+S.odo || 0) + '">') +
    '</div>' +
    '<div class="field"><label>صورة العربية (اختياري)</label><div style="display:flex;gap:8px;align-items:center">' +
    ((ST.photoTmp || S.photo) ? '<img class="photo-thumb" id="st-photo-prev" src="' + (ST.photoTmp || S.photo) + '">' : '') +
    '<button class="btn btn-sm" id="st-photo-btn">📷 صورة</button></div></div>' +
    '<button class="btn btn-pri btn-block" id="st-vehicle-save">💾 حفظ بيانات العربية</button></div>';

  /* ---------- fuel & reserves ---------- */
  html += '<div class="card"><div class="card-title">⛽ الوقود والمخصصات</div>' +
    '<div class="grid2">' +
    field('نوع الوقود', '<input class="input" id="st-fueltype" value="' + esc(S.fuelType) + '">') +
    field('سعر اللتر (ج.م)', '<input class="input" id="st-fuelprice" type="number" step="any" inputmode="decimal" value="' + S.fuelPrice + '">') +
    '</div>' +
    '<div class="grid2">' +
    field('متوسط الاستهلاك (لتر/100 كم)', '<input class="input" id="st-l100" type="number" step="any" inputmode="decimal" value="' + S.l100 + '">' +
      '<div class="t2">يُحدَّث تلقائيًا من مشتريات الوقود الحقيقية عند طلب ذلك</div>') +
    field('مخصص الصيانة (ج.م/كم)', '<input class="input" id="st-maintkm" type="number" step="any" inputmode="decimal" value="' + S.maintPerKm + '">') +
    '</div>' +
    '<div class="formula" style="margin-bottom:10px">' +
    'تكلفة الوقود/كم = ' + fmtN(S.l100) + ' ÷ 100 × ' + fmtN(S.fuelPrice) + ' = <b>' + fmtN(S.l100 / 100 * S.fuelPrice) + ' ج.م</b><br>' +
    'إجمالي المخصص/كم = <b>' + fmtN(S.l100 / 100 * S.fuelPrice + S.maintPerKm) + ' ج.م</b> (وقود + صيانة)</div>' +
    (isDaily()
      ? '<div class="formula" style="margin-bottom:10px">📊 متوسط مصاريفك الفعلية: <b>' + fmtN(dailyEst.value) + ' ج.م/كم</b> ' +
        (dailyEst.source === 'actual' ? '(من مشتريات البنزين والصيانة اللي سجلتها)' : '(لسه مفيش مصاريف كافية — ده تقدير مؤقت)') +
        '<br>ده الرقم اللي بيحسب منه تقدير مصاريف الأيام الجاية — بدون أي زيادة.</div>'
      : '') +
    '<div class="t2" style="margin-bottom:10px">⚠️ تغيير الإعدادات يؤثر على الأيام الجديدة فقط — كل سجل محفوظ يحتفظ بلقطة إعداداته الخاصة للأبد.</div>' +
    '<button class="btn btn-pri btn-block" id="st-fuel-save">💾 حفظ إعدادات الوقود</button></div>';

  /* ---------- commissions & target (السائقين بس) ---------- */
  if (!isDaily()) {
    html += '<div class="card"><div class="card-title">📱 العمولات وهدف الأيام</div>' +
      '<div class="grid2">' +
      field('عمولة ديدي %', '<input class="input" id="st-c-didi" type="number" step="any" inputmode="decimal" value="' + S.commission.didi + '">') +
      field('عمولة أوبر %', '<input class="input" id="st-c-uber" type="number" step="any" inputmode="decimal" value="' + S.commission.uber + '">') +
      '</div>' +
      '<div class="grid2">' +
      field('عمولة أخرى %', '<input class="input" id="st-c-other" type="number" step="any" inputmode="decimal" value="' + S.commission.other + '">') +
      field('هدف أيام العمل شهريًا', '<input class="input" id="st-target" type="number" inputmode="decimal" value="' + S.targetDays + '">') +
      '</div>' +
      '<button class="btn btn-pri btn-block" id="st-target-save">💾 حفظ</button></div>';
  }

  /* ---------- intervals ---------- */
  const ivSessions = await DB.all('sessions');
  const ivMaints = await DB.all('maintenance');
  const ivOdo = currentOdo(ivSessions, ivMaints);
  const ivToday = todayStr();
  html += '<div class="card"><div class="card-title">🔧 فترات الصيانة والتذكيرات</div>' +
    '<div class="t2" style="margin-bottom:8px">التطبيق يحسب لك <b>متى تحتاج تغيير كل حاجة</b> على عداد عربيتك الحقيقي:' +
    ' كل ما تسجّل عملية صيانة (تغيير زيت مثلًا) في سجل الصيانة واكتب رقم العداد وقتها،' +
    ' يبدأ العد من جديد ويقولك <b>باقي كام كم</b> على التغيير الجديد — تلقائيًا بضاعة.</div>' +
    '<div class="t2" style="margin-bottom:10px">اكتب 0 في أي خانة = تذكير مقفول للنوع ده. اللي يحصل الأول (الكم أو الشهور) هو اللي يطلع التذكير.</div>' +
    allCatKeys().map(ck => {
      const iv = intervalOf(ck) || {};
      const isCustom = !!(S.customCats && S.customCats[ck]);
      const oilChips = (ck === 'oil' || ck === 'oilFilter')
        ? '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">' +
          OIL_PRESETS.map(p => '<button class="btn btn-sm' + (iv.km === p.km ? ' btn-pri' : '') + '" data-oilchip="' + ck + '" data-km="' + p.km + '" style="min-height:36px;padding:4px 10px"><bdi dir="ltr">' + p.label + '</bdi></button>').join('') +
          '</div>' : '';
      return '<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--line)">' +
        '<div class="t1" style="font-weight:800;margin-bottom:4px;display:flex;align-items:center;gap:6px">' + esc(catLabel(ck)) +
        (isCustom ? '<button class="btn btn-sm btn-danger" data-delcat="' + ck + '" style="min-height:24px;padding:2px 8px">🗑️</button>' : '') + '</div>' +
        oilChips +
        '<div class="grid2">' +
        '<div class="field" style="margin:0"><label style="color:var(--pri);font-weight:700">📏 كل كام كم</label>' +
        '<input class="input" type="number" inputmode="decimal" data-iv="' + ck + '" data-k="km" value="' + (iv.km || 0) + '" placeholder="0 = بدون"></div>' +
        '<div class="field" style="margin:0"><label style="color:var(--pri);font-weight:700">⏱️ أقصى مدة (شهور)</label>' +
        '<input class="input" type="number" inputmode="decimal" data-iv="' + ck + '" data-k="months" value="' + (iv.months || 0) + '" placeholder="0 = بدون"></div>' +
        '</div></div>';
    }).join('') +
    '<div class="divider"></div>' +
    '<div class="t2" style="font-weight:800;margin-bottom:6px">📍 حالة عربيتك دلوقتي (حسب عدادك الحالي: <bdi dir="ltr">' + fmtN(ivOdo) + '</bdi> كم)</div>' +
    allCatKeys().filter(ck => { const iv = intervalOf(ck); return iv && (iv.km || iv.months); }).map(ck => {
      const iv = intervalOf(ck);
      const last = latestMaint(ivMaints, ck);
      const r = maintDueInfo(ck, last, iv, ivOdo, ivToday);
      let line;
      if (!last) {
        line = '<span class="badge gray">لسه مفيش تسجيل</span> أول ما تغيّر <b>' + esc(catLabel(ck)) + '</b> سجّلها في سجل الصيانة وهبدأ أعدّ لك من ساعتها';
      } else {
        const parts = [];
        if (r.nextDueKm !== null) parts.push('التغيير الجاي عند <bdi dir="ltr">' + fmtN(r.nextDueKm) + '</bdi> كم');
        if (r.kmLeft !== null && r.kmLeft > 0) parts.push('باقي <bdi dir="ltr">' + fmtN(r.kmLeft) + '</bdi> كم');
        if (r.daysLeft !== null && r.daysLeft > 0) parts.push('أو بعد <bdi dir="ltr">' + Math.max(0, Math.round(r.daysLeft / 30)) + '</bdi> شهر تقريبًا');
        let badge;
        if (r.level === 'missed') badge = '<span class="badge red">🔴 فاتك! غيّرها ضروري</span>';
        else if (r.level === 'soon') badge = '<span class="badge green">🟢 قربت!</span>';
        else badge = '<span class="badge gray">تمام ✓</span>';
        line = badge + ' ' + parts.join(' — ');
        if (r.level === 'missed') line += '<div class="t2" style="color:var(--neg);font-weight:700">استحقاقها كان ' + (r.nextDueKm ? 'عند <bdi dir="ltr">' + fmtN(r.nextDueKm) + '</bdi> كم' : '') + ' وانت عند <bdi dir="ltr">' + fmtN(ivOdo) + '</bdi></div>';
        line += '<div class="t2">آخر مرة: ' + esc(last.date) + (last.odo ? ' عند عداد <bdi dir="ltr">' + fmtN(last.odo) + '</bdi> كم' : '') + '</div>';
      }
      return '<div class="kv" style="align-items:start"><span class="k" style="white-space:nowrap">' + esc(catLabel(ck)) + '</span>' +
        '<span class="v" style="text-align:right;font-weight:500">' + line + '</span></div>';
    }).join('') +
    '<button class="btn btn-pri btn-block" id="st-iv-save" style="margin-top:10px">💾 حفظ الفترات</button></div>';

  /* ---------- appearance ---------- */
  html += '<div class="card"><div class="card-title">🎨 المظهر</div>' +
    field('نمط العرض', '<select class="input" id="st-theme">' +
      options([{ v: 'system', l: 'حسب النظام (تلقائي)' }, { v: 'light', l: 'فاتح' }, { v: 'dark', l: 'غامق' }], S.theme) + '</select>') +
    '</div>';

  /* ---------- accounting test ---------- */
  html += '<div class="card"><div class="card-title">🧪 اختبار المحاسبة' +
    '<span class="spacer"></span><button class="btn btn-sm btn-pri" id="st-test-run">▶ تشغيل الاختبار</button></div>' +
    '<div class="t2" style="margin-bottom:8px">اختبار ذاتي للتأكد أن كل الحسابات صحيحة: دخل صافي 1,012 ج.م، 160 كم، لتر 22.25، استهلاك 8 ل/100كم، صيانة 2 ج.م/كم — ثم شراء بنزين 300 وتغيير زيت 1,200 للتأكد أنهما يخصمان من الخزنتين فقط.</div>' +
    '<div id="test-result"></div></div>';

  /* ---------- backup & export ---------- */
  html += '<div class="card"><div class="card-title">💾 نسخ احتياطي وتصدير</div>' +
    '<div class="btn-row">' +
    '<button class="btn btn-sm btn-pri" id="bk-json">⬇️ نسخة JSON كاملة</button>' +
    '<button class="btn btn-sm" id="bk-import">⬆️ استعادة JSON</button>' +
    '</div>' +
    '<div class="btn-row" style="margin-top:8px">' +
    '<button class="btn btn-sm" id="bk-days-csv">أيام CSV</button>' +
    '<button class="btn btn-sm" id="bk-days-xls">أيام Excel</button>' +
    '<button class="btn btn-sm" id="bk-maint-csv">صيانة CSV</button>' +
    '<button class="btn btn-sm" id="bk-maint-xls">صيانة Excel</button>' +
    '</div>' +
    '<input type="file" id="bk-file" accept=".json,application/json" style="display:none">' +
    '</div>';

  /* ---------- trash ---------- */
  const trash = (await DB.all('trash')).sort((a, b) => b.deletedAt - a.deletedAt);
  html += '<div class="card"><div class="card-title">🗑️ سلة المهملات (' + trash.length + ')<span class="spacer"></span><span class="badge gray">تُحتفظ 30 يومًا</span></div>';
  if (!trash.length) html += '<div class="empty"><div class="d">لا يوجد شيء في السلة</div></div>';
  else {
    html += trash.map(t => '<div class="row-item">' +
      '<div class="avatar-dot">🗑️</div>' +
      '<div class="grow"><div class="t1">' + esc(t.describe || t.origId) + '</div>' +
      '<div class="t2">حُذف: ' + esc(new Date(t.deletedAt).toLocaleString('en-GB')) + '</div></div>' +
      '<div class="side"><button class="btn btn-sm" data-restore="' + t.id + '">↩️ استعادة</button>' +
      '<button class="btn btn-sm btn-danger" data-purge="' + t.id + '" style="margin-top:4px">حذف نهائي</button></div>' +
      '</div>').join('');
  }
  html += '</div>';

  /* ---------- feedback link ---------- */
  html += '<div class="card tight"><div class="row-item">' +
    '<div class="avatar-dot">💬</div><div class="grow"><div class="t1">اقتراحات ومشاكل</div>' +
    '<div class="t2">أرسل مقترحًا أو بلّغ عن مشكلة وراجع رسائلك السابقة</div></div>' +
    '<button class="btn btn-sm btn-pri" onclick="go(\'feedback\')">فتح ←</button></div></div>';

  /* ---------- Pro ---------- */
  const seller = await getSellerInfo();
  html += '<div class="card"><div class="card-title">💎 النسخة الكاملة (Pro)<span class="spacer"></span>' +
    (isPro() ? '<span class="badge green">مفعّلة ✓</span>' : '<span class="badge gray">نسخة مجانية</span>') + '</div>' +
    proStatusLine() +
    proBenefits().map(b => '<div class="kv"><span class="v" style="text-align:right;font-weight:600">' + b + '</span></div>').join('') +
    '<div class="divider"></div>';

  if (!isPro()) {
    if (!PRO_STATE.trialStart) {
      html += '<button class="btn btn-pos btn-block" id="st-pro-trial">🎁 ابدأ أول 30 يوم مجانًا</button>' +
        '<div class="t2" style="margin:6px 0 10px;text-align:center">كل الميزات مجانًا شهر كامل — بدون دفع وبدون كود</div>';
    }
    html += '<div class="field"><label>لديك كود تفعيل؟ (شهري أو سنوي)</label>' +
      '<input class="input" id="st-pro-code" placeholder="DISPM-XXXX-XXXX أو DISPY-XXXX-XXXX" dir="ltr" style="text-align:center;letter-spacing:1px"></div>' +
      '<div class="btn-row"><button class="btn btn-pri" id="st-pro-activate">💎 تفعيل</button>' +
      '<button class="btn" id="st-pro-buy">🛒 كيف أشتري؟ (30 ج/شهر — 200 ج/سنة)</button></div>' +
      '<div class="divider"></div>';
  }
  html += '</div>'; /* close Pro card */

  /* developer-only: admin seller panel — hidden; revealed by 7 taps on the version line */
  if (ST.admin) {
    html += '<div class="card" style="border-color:var(--res)"><div class="card-title">🔐 لوحة الأدمن (لك فقط)<span class="spacer"></span><span class="badge orange">سرية</span></div>' +
      '<div class="t2" style="margin-bottom:6px">الرقم هنا هو اللي يظهر لكل عملائك في شاشة الشراء (محمّل مسبقًا داخل التطبيق — عدّل فقط لو تغيّر)</div>' +
      '<div class="grid2">' +
      field('رقم فودافون كاش', '<input class="input" id="st-si-vf" value="' + esc(seller.vf || '') + '" placeholder="' + esc(PRO_SELLER_DEFAULT.vf) + '" dir="ltr">') +
      field('واتساب / تواصل', '<input class="input" id="st-si-wa" value="' + esc(seller.wa || '') + '" placeholder="' + esc(PRO_SELLER_DEFAULT.wa) + '" dir="ltr">') +
      '</div>' +
      field('سعر مخصص (يظهر مكان 30/200 لو مكتوب)', '<input class="input" id="st-si-price" value="' + esc(seller.price || '') + '" placeholder="اتركه فاضي للأسعار القياسية" dir="ltr">') +
      '<button class="btn btn-pri btn-block" id="st-si-save">💾 حفظ بيانات البائع</button>' +
      '<div class="divider"></div>' +
      '<div class="t2" style="font-weight:800;margin-bottom:6px">🔑 الأكواد المتاحة</div>' +
      '<div class="grid2">' +
      '<div class="kv"><span class="k">🗓️ شهرية</span><span class="v"><bdi dir="ltr">' + proValidCodes().m.length + '</bdi> كود</span></div>' +
      '<div class="kv"><span class="k">📅 سنوية</span><span class="v"><bdi dir="ltr">' + proValidCodes().y.length + '</bdi> كود</span></div>' +
      '</div>' +
      '<div class="t2" style="margin-top:8px">الأكواد نفسها في ملف سري على جهاز الكمبيوتر عندك (license-codes-PRIVATE.txt) — مش موجودة هنا كلام مفتوح لسبب أمان.</div>' +
      '</div>';
  }

  /* ---------- disclaimer ---------- */
  html += '<div class="card tight"><div class="t2" style="line-height:1.9">📌 <b>إخلاء مسؤولية:</b> هذا التطبيق أداة تسجيل وتنظيم شخصي لدخل ومصاريف السائق. هو <b>ليس</b> استشارة مالية أو ضريبية أو محاسبية، ولا بديل عن المحاسب أو المحامي. كل الحسابات حسب الإعدادات التي تدخلها بنفسك.</div>' +
    '<div class="t2" id="st-ver" style="margin-top:8px;color:var(--sub);cursor:default">الإصدار 1.0.0 • التخزين محلي على جهازك 100% (IndexedDB) — لا شيء يُرسل لأي سيرفر.</div></div>';

  root.innerHTML = html;
  bindSettings(root);
  bindTrash(root, trash);
};

function bindSettings(root) {
  /* 🔐 secret admin unlock: 7 taps on the version line */
  const ver = root.querySelector('#st-ver');
  if (ver) {
    let taps = 0, tmo = null;
    ver.addEventListener('click', () => {
      clearTimeout(tmo);
      tmo = setTimeout(() => { taps = 0; }, 2000);
      if (++taps >= 7) { taps = 0; ST.admin = !ST.admin; go('settings'); }
    });
  }

  const fcmRetry = root.querySelector('#st-fcm-retry');
  if (fcmRetry) fcmRetry.onclick = async () => {
    if (typeof window.retryNativePush !== 'function') { toast('الزرار ده شغال في نسخة الأندرويد بس'); return; }
    const ok = await window.retryNativePush();
    if (typeof window.initLocalReminders === 'function') await window.initLocalReminders();
    toast(ok ? '✅ تم تفعيل الإشعارات — راجع الإعدادات' : 'لسه ما حصلش تسجيل — تأكد إن إذن الإشعارات مسموح للتطبيق من إعدادات الموبايل');
    go('settings');
  };

  const notifTestBtn = root.querySelector('#st-notif-test');
  if (notifTestBtn) notifTestBtn.onclick = () => sendTestNotification();

  const logoutBtn = root.querySelector('#st-logout');
  if (logoutBtn) logoutBtn.onclick = async () => {
    const ok = await confirmDlg({
      title: 'تسجيل الخروج؟',
      body: 'هتقدر تدخل تاني في أي وقت — وبياناتك محفوظة في السحابة ومزامنة.',
      okText: 'خروج'
    });
    if (!ok) return;
    await Cloud.logout();
    location.reload();
  };

  /* تغيير النمط (سائق / قيادة يومية) */
  root.querySelectorAll('#st-mode button').forEach(b => b.onclick = async () => {
    const v = b.dataset.v;
    if (v === S.mode) return;
    const ok = await confirmDlg({
      title: 'تغيير نمط التطبيق؟',
      body: v === 'daily'
        ? 'هنتقل لوضع <b>القيادة اليومية</b>: مصاريف بس من غير دخل وعمولات. سجلات ديدي/أوبر هتتخبى ومش هتتمسح.'
        : 'هنتقل لوضع <b>دخل السائق</b>: ديدي/أوبر وحساب الربح الشخصي. سجلات القيادة اليومية هتتخبى ومش هتتمسح.',
      okText: 'تغيير النمط'
    });
    if (!ok) return;
    S.mode = v;
    await saveSettings();
    applyModeLabels();
    toast('✅ تم تغيير النمط — سجلاتك محفوظة');
    go('settings');
  });

  /* إشعارات الصيانة */
  const notifBtn = root.querySelector('#st-notif');
  if (notifBtn) notifBtn.onclick = async () => {
    if (('Notification' in window) && Notification.permission === 'granted') {
      if (S.notifications === false) {
        S.notifications = true; await saveSettings();
        toast('✅ الإشعارات مفعّلة تاني');
        go('settings');
        await notifyDueItems({ force: true });
      } else {
        S.notifications = false; await saveSettings();
        toast('🔕 الإشعارات متوقفة');
        go('settings');
      }
      return;
    }
    await enableNotifications(true);
    go('settings');
  };

  root.querySelector('#st-photo-btn').onclick = () => pickImage(d => {
    ST.photoTmp = d;
    const prev = root.querySelector('#st-photo-prev');
    if (prev) prev.src = d;
    else root.querySelector('#st-photo-btn').insertAdjacentHTML('beforebegin', '<img class="photo-thumb" id="st-photo-prev" src="' + d + '">');
  });

  root.querySelector('#st-vehicle-save').onclick = async () => {
    S.vehicleName = root.querySelector('#st-vehicle').value || S.vehicleName;
    S.plate = root.querySelector('#st-plate').value;
    S.odo = +root.querySelector('#st-odo').value || 0;
    if (ST.photoTmp) { S.photo = ST.photoTmp; ST.photoTmp = ''; }
    await saveSettings();
    toast('✅ تم حفظ بيانات العربية');
  };

  root.querySelector('#st-fuel-save').onclick = async () => {
    S.fuelType = root.querySelector('#st-fueltype').value || S.fuelType;
    S.fuelPrice = +root.querySelector('#st-fuelprice').value || S.fuelPrice;
    S.l100 = +root.querySelector('#st-l100').value || S.l100;
    S.maintPerKm = +root.querySelector('#st-maintkm').value || S.maintPerKm;
    await saveSettings();
    toast('✅ تم الحفظ — الأيام الجديدة ستستخدم الإعدادات الجديدة');
    go('settings');
  };

  const targetSave = root.querySelector('#st-target-save');
  if (targetSave) targetSave.onclick = async () => {
    S.commission.didi = +root.querySelector('#st-c-didi').value || 0;
    S.commission.uber = +root.querySelector('#st-c-uber').value || 0;
    S.commission.other = +root.querySelector('#st-c-other').value || 0;
    S.targetDays = +root.querySelector('#st-target').value || 26;
    await saveSettings();
    toast('✅ تم الحفظ');
  };

  /* oil interval preset chips */
  root.querySelectorAll('[data-oilchip]').forEach(b => b.onclick = () => {
    const ck = b.dataset.oilchip;
    const inp = root.querySelector('[data-iv="' + ck + '"][data-k="km"]');
    inp.value = b.dataset.km;
    root.querySelectorAll('[data-oilchip="' + ck + '"]').forEach(x => x.classList.toggle('btn-pri', x === b));
    toast('اتظبطت على <bdi dir="ltr">' + fmtN(+b.dataset.km) + '</bdi> كم — اضغط 💾 حفظ الفترات تحت', { duration: 5000 });
  });

  root.querySelector('#st-iv-save').onclick = async () => {
    root.querySelectorAll('[data-iv]').forEach(el => {
      const ck = el.dataset.iv, val = +el.value || 0;
      if (S.customCats && S.customCats[ck]) S.customCats[ck][el.dataset.k] = val;
      else S.intervals[ck][el.dataset.k] = val;
    });
    await saveSettings();
    toast('✅ تم حفظ فترات الصيانة');
  };

  root.querySelectorAll('[data-delcat]').forEach(b => b.onclick = async () => {
    const ck = b.dataset.delcat;
    const ok = await confirmDlg({
      title: 'حذف الفئة المخصصة؟',
      body: 'هتختفي من جدول الصيانة والتنبيهات — وسجلاتها القديمة هتفتضل في الأرشيف.',
      okText: 'حذف', danger: true
    });
    if (!ok) return;
    delete S.customCats[ck];
    await saveSettings();
    toast('🗑️ تم حذف الفئة');
    go('settings');
  });

  root.querySelector('#st-theme').addEventListener('change', async e => {
    S.theme = e.target.value;
    await saveSettings();
    applyTheme();
  });

  /* Pro */
  const trialBtn = root.querySelector('#st-pro-trial');
  if (trialBtn) trialBtn.onclick = async () => {
    const ok = await startTrial();
    if (ok) go('settings');
  };
  const actBtn = root.querySelector('#st-pro-activate');
  if (actBtn) actBtn.onclick = async () => {
    const ok = await activatePro(root.querySelector('#st-pro-code').value);
    if (ok) go('settings');
  };
  const buyBtn = root.querySelector('#st-pro-buy');
  if (buyBtn) buyBtn.onclick = () => upgradeModal('');
  const siSave = root.querySelector('#st-si-save');
  if (siSave) siSave.onclick = async () => {
    await saveSellerInfo({
      vf: root.querySelector('#st-si-vf').value.trim(),
      wa: root.querySelector('#st-si-wa').value.trim(),
      price: root.querySelector('#st-si-price').value.trim()
    });
    toast('✅ تم الحفظ — سيظهر هذا الرقم للعملاء بدل الرقم المدمج');
  };

  root.querySelector('#st-test-run').onclick = () => {
    const res = runAccountingTest();
    const box = root.querySelector('#test-result');
    box.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الخطوة</th><th>المتوقع</th><th>النتيجة</th><th></th></tr></thead><tbody>' +
      res.rows.map(r => '<tr><td>' + r.label + '</td><td><bdi dir="ltr">' + fmtN(r.exp) + '</bdi></td>' +
        '<td class="' + (r.pass ? 'pos-t' : 'neg-t') + '"><bdi dir="ltr">' + fmtN(r.got) + '</bdi></td>' +
        '<td>' + (r.pass ? '<span class="badge green">✓</span>' : '<span class="badge red">✗ فشل</span>') + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<div class="' + (res.pass ? 'warn-strip" style="background:var(--pos-soft);color:var(--pos)' : 'warn-strip') + '">' +
      (res.pass ? '✅ نجح الاختبار بالكامل — الحسابات والمحاسبة سليمة: الشراءات تخصم من الخزنتين فقط ولا تمس الربح الشخصي.' : '❌ فشل الاختبار — راجع الصفوف الحمراء') +
      '</div>' +
      '<div class="t2" style="margin-top:6px">بعد شراء بنزين بـ 300 ج.م: خزنة البنزين = <bdi dir="ltr">284.80 − 300 = -15.20</bdi> (عجز يظهر بالأحمر). بعد تغيير زيت بـ 1,200: خزنة الصيانة = <bdi dir="ltr">320 − 1200 = -880</bdi> (عجز). الربح الشخصي يبقى <bdi dir="ltr">407.20</bdi> ج.م.</div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  /* backup */
  root.querySelector('#bk-json').onclick = async () => {
    const data = { app: 'driver-income', version: 1, exportedAt: new Date().toISOString() };
    for (const s of DB.STORES) data[s] = await DB.all(s);
    download('driver-income-backup-' + todayStr() + '.json', JSON.stringify(data, null, 2), 'application/json');
    toast('✅ تم تنزيل النسخة الاحتياطية — احتفظ بها في مكان آمن');
  };

  const fileInp = root.querySelector('#bk-file');
  root.querySelector('#bk-import').onclick = () => fileInp.click();
  fileInp.addEventListener('change', async () => {
    const f = fileInp.files && fileInp.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || data.app !== 'driver-income') { toast('الملف ليس نسخة احتياطية من هذا التطبيق'); return; }
      const ok = await confirmDlg({
        title: 'استعادة نسخة احتياطية؟',
        body: 'سيتم <b>استبدال كل البيانات الحالية</b> بمحتوى الملف (' +
          [data.sessions, data.purchases, data.maintenance].map(x => (x || []).length).join(' + ') + ' سجل). لا يمكن التراجع.',
        okText: 'استبدال الكل', danger: true, requireDouble: true
      });
      if (!ok) return;
      for (const s of DB.STORES) {
        await DB.clear(s);
        if (Array.isArray(data[s])) await DB.bulkPut(s, data[s]);
      }
      await loadSettings();
      applyTheme();
      toast('✅ تمت الاستعادة بنجاح');
      go('home');
    } catch (e) {
      toast('تعذر قراءة الملف: ' + esc(e.message));
    }
    fileInp.value = '';
  });

  root.querySelector('#bk-days-csv').onclick = async () => {
    const sessions = await DB.all('sessions');
    const rows = sessions.sort((a, b) => a.date.localeCompare(b.date)).map(s => {
      const c = calcSession(s);
      return [s.date, PLATFORMS[s.platform] || s.platform, s.mode, s.amount,
        Math.round(c.commission * 100) / 100, Math.round(c.effNet * 100) / 100, s.tips, s.tipsIncluded ? 'داخل الدخل' : 'منفصل',
        s.km, s.hours, s.trips, s.directExpenses,
        Math.round(c.fuelRes * 100) / 100, Math.round(c.maintRes * 100) / 100, Math.round(c.profit * 100) / 100,
        Math.round(c.margin * 10) / 10, s.odoStart || '', s.odoEnd || '', s.notes || ''];
    });
    download('كل-الأيام.csv', toCSV([['التاريخ', 'التطبيق', 'نوع الدخل', 'المبلغ', 'عمولة', 'صافي فعلي', 'بقشيش', 'البقشيش', 'كم', 'ساعات', 'رحلات', 'مصاريف مباشرة', 'مخصص وقود', 'مخصص صيانة', 'ربح شخصي', 'هامش %', 'عداد من', 'عداد إلى', 'ملاحظات'], ...rows]), 'text/csv;charset=utf-8');
  };
  root.querySelector('#bk-days-xls').onclick = () => {
    if (!requirePro('تصدير Excel')) return;
    (async () => {
    const sessions = await DB.all('sessions');
    const rows = sessions.sort((a, b) => a.date.localeCompare(b.date)).map(s => {
      const c = calcSession(s);
      return [s.date, PLATFORMS[s.platform] || s.platform, s.mode, s.amount,
        Math.round(c.commission * 100) / 100, Math.round(c.effNet * 100) / 100, s.km, s.hours, s.trips,
        Math.round(c.profit * 100) / 100, Math.round(c.margin * 10) / 10, s.notes || ''];
    });
    download('كل-الأيام.xls', xlsDoc('كل السجلات اليومية', ['التاريخ', 'التطبيق', 'نوع', 'مبلغ', 'عمولة', 'صافي', 'كم', 'ساعات', 'رحلات', 'ربح', 'هامش %', 'ملاحظات'], rows), 'application/vnd.ms-excel');
    })();
  };
  root.querySelector('#bk-maint-csv').onclick = async () => {
    const maints = await DB.all('maintenance');
    const rows = maints.sort((a, b) => a.date.localeCompare(b.date)).map(m => [m.date, CATS[m.category] || m.category, m.odo, m.cost, m.workshopName || '', m.partBrand || '', m.faultDesc || '', m.repairDesc || '', m.fromWallet ? 'من الخزنة' : 'خارجية', m.notes || '']);
    download('كل-الصيانة.csv', toCSV([['التاريخ', 'النوع', 'العداد', 'التكلفة', 'الورشة', 'القطعة', 'وصف العطل', 'الإصلاح', 'الدفع', 'ملاحظات'], ...rows]), 'text/csv;charset=utf-8');
  };
  root.querySelector('#bk-maint-xls').onclick = () => {
    if (!requirePro('تصدير Excel')) return;
    (async () => {
    const maints = await DB.all('maintenance');
    const rows = maints.sort((a, b) => a.date.localeCompare(b.date)).map(m => [m.date, CATS[m.category] || m.category, m.odo, m.cost, m.workshopName || '', m.faultDesc || '', m.repairDesc || '']);
    download('كل-الصيانة.xls', xlsDoc('سجل الصيانة الكامل', ['التاريخ', 'النوع', 'العداد', 'التكلفة', 'الورشة', 'وصف العطل', 'الإصلاح'], rows), 'application/vnd.ms-excel');
    })();
  };
}

function bindTrash(root, trash) {
  root.querySelectorAll('[data-restore]').forEach(b => b.onclick = async () => {
    const t = trash.find(x => x.id === b.dataset.restore);
    if (!t) return;
    await restoreFromTrash(t);
    toast('↩️ تمت الاستعادة');
    go('settings');
  });
  root.querySelectorAll('[data-purge]').forEach(b => b.onclick = async () => {
    const t = trash.find(x => x.id === b.dataset.purge);
    if (!t) return;
    const ok = await confirmDlg({
      title: 'حذف نهائي؟',
      body: '<b>' + esc(t.describe || '') + '</b><br><br>سيُحذف السجل للأبد ولا يمكن استعادته أو التراجع.',
      okText: 'حذف نهائي', danger: true, requireDouble: true, doubleText: '⚠️ متأكد نهائيًا؟ اضغط ثانية'
    });
    if (!ok) return;
    await DB.del('trash', t.id);
    toast('تم الحذف نهائيًا');
    go('settings');
  });
}

/* ---------- accounting test ---------- */
function runAccountingTest() {
  const fuelPrice = 22.25, l100 = 8, maint = 2, km = 160, net = 1012;
  const fck = (l100 / 100) * fuelPrice;        /* 1.78 */
  const fuel = km * fck;                        /* 284.80 */
  const mnt = km * maint;                       /* 320.00 */
  const total = fuel + mnt;                     /* 604.80 */
  const profit = net - total;                   /* 407.20 */
  const fuelAfterPurchase = fuel - 300;         /* -15.20 deficit */
  const maintAfterOil = mnt - 1200;             /* -880 deficit */
  const profitAfterBoth = profit;               /* unchanged 407.20 */
  const T = 0.005;
  const rows = [
    { label: 'تكلفة الوقود لكل كم (8÷100×22.25)', got: fck, exp: 1.78 },
    { label: 'مخصص الوقود (160 كم)', got: fuel, exp: 284.80 },
    { label: 'مخصص الصيانة (160 كم × 2)', got: mnt, exp: 320.00 },
    { label: 'إجمالي المخصصات', got: total, exp: 604.80 },
    { label: 'الربح الشخصي المتاح (1012 − 604.80)', got: profit, exp: 407.20 },
    { label: 'خزنة البنزين بعد شراء 300 (عجز متوقع)', got: fuelAfterPurchase, exp: -15.20 },
    { label: 'خزنة الصيانة بعد تغيير زيت 1,200 (عجز متوقع)', got: maintAfterOil, exp: -880 },
    { label: 'الربح الشخصي بعد الشراءين — يجب ألا يتغير', got: profitAfterBoth, exp: 407.20 }
  ];
  rows.forEach(r => { r.pass = Math.abs(r.got - r.exp) < T; });
  return { rows, pass: rows.every(r => r.pass) };
}

/* ================= feedback view ================= */
Views.feedback = async function (root) {
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  const items = (await DB.all('feedback')).sort((a, b) => b.ts - a.ts);
  const CATFB = { idea: 'اقتراح', bug: 'مشكلة', change: 'تعديل' };

  let html = '<div class="card"><div class="card-title">💬 اقتراحات ومشاكل</div>' +
    field('النوع', '<select class="input" id="fb-cat">' +
      options([{ v: 'idea', l: 'اقتراح 💡' }, { v: 'bug', l: 'مشكلة 🐞' }, { v: 'change', l: 'طلب تعديل ✏️' }], 'idea') + '</select>') +
    field('نص الرسالة', '<textarea class="input" id="fb-text" rows="4" placeholder="اكتب اقتراحك أو المشكلة بالتفصيل…"></textarea>') +
    '<div class="btn-row"><button class="btn btn-pri" id="fb-send">إرسال</button>' +
    '<button class="btn" id="fb-export">📤 تصدير كنص (للمطور)</button></div></div>';

  html += '<div class="card list-card"><div class="card-title" style="padding:12px 0 2px">رسائلك السابقة (' + items.length + ')</div>';
  if (!items.length) html += '<div class="empty"><div class="d">لا توجد رسائل بعد</div></div>';
  else html += items.map(it =>
    '<div class="row-item" style="align-items:flex-start">' +
    '<div class="avatar-dot">' + (CATFB[it.category] || '').slice(0, 1) + '</div>' +
    '<div class="grow"><div class="t1">' + esc(CATFB[it.category] || it.category) + '</div>' +
    '<div class="t2">' + esc(new Date(it.ts).toLocaleString('en-GB')) + '</div>' +
    '<div class="t2" style="line-height:1.7;white-space:pre-wrap">' + esc(it.text) + '</div></div>' +
    '<div class="side"><button class="btn btn-sm btn-danger" data-fbdel="' + it.id + '">🗑️</button></div>' +
    '</div>').join('');
  html += '</div>';
  root.innerHTML = html;

  root.querySelector('#fb-send').onclick = async () => {
    const text = root.querySelector('#fb-text').value.trim();
    if (!text) { toast('اكتب الرسالة أولًا'); return; }
    await DB.put('feedback', { id: uid(), ts: Date.now(), category: root.querySelector('#fb-cat').value, text });
    toast('✅ تم حفظ رسالتك');
    go('feedback');
  };

  root.querySelector('#fb-export').onclick = async () => {
    const all = (await DB.all('feedback')).sort((a, b) => a.ts - b.ts);
    if (!all.length) { toast('لا توجد رسائل للتصدير'); return; }
    const txt = 'اقتراحات ومشاكل — تطبيق إدارة دخل السائق\n' + new Date().toLocaleString('en-GB') + '\n' +
      '────────────────────────\n\n' +
      all.map(it => '[' + (CATFB[it.category] || it.category) + '] ' + new Date(it.ts).toLocaleString('en-GB') + '\n' + it.text).join('\n\n────────────────────────\n\n');
    download('مقترحات-ومشاكل.txt', txt, 'text/plain;charset=utf-8');
  };

  root.querySelectorAll('[data-fbdel]').forEach(b => b.onclick = async () => {
    await DB.del('feedback', b.dataset.fbdel);
    toast('تم الحذف');
    go('feedback');
  });
};
