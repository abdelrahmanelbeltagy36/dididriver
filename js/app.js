/* ===== app.js — boot, theme, router, notifications, modes ===== */
'use strict';

const Nav = { current: null, params: {} };

const TITLES = {
  home: 'إدارة دخل السائق',
  add: 'إضافة يوم',
  wallets: 'خزنة العربية',
  analytics: 'التحليلات',
  archive: 'الأرشيف',
  maint: 'جدول الصيانة',
  settings: 'الإعدادات',
  feedback: 'اقتراحات ومشاكل',
  onboard: 'أهلاً بك — نظّم عربيتك',
  login: 'تسجيل الدخول'
};
/* أسماء الوضع العادي (قيادة يومية — مصاريف بس) */
const DAILY_TITLES = {
  home: 'مصاريف عربيتي',
  add: 'تسجيل يوم',
  wallets: 'مصاريف العربية',
  analytics: 'تحليل المصاريف',
  archive: 'الأرشيف',
  maint: 'جدول الصيانة',
  settings: 'الإعدادات',
  feedback: 'اقتراحات ومشاكل',
  onboard: 'أهلاً بك — نظّم عربيتك',
  login: 'تسجيل الدخول'
};
function appTitle(page) {
  return (isDaily() ? DAILY_TITLES : TITLES)[page] || (isDaily() ? DAILY_TITLES.home : TITLES.home);
}

async function go(page, params) {
  /* الوضع العادي مش فيه خزنات — كل حاجة في جدول الصيانة */
  if (isDaily() && (page === 'wallets' || page === 'purchases')) page = 'maint';
  Nav.current = page;
  Nav.params = params || {};
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('on', b.dataset.page === page));
  document.getElementById('topbar-title').textContent = appTitle(page);
  const root = document.getElementById('view');
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  try {
    const fn = Views[page] || Views.home;
    await fn(root);
  } catch (e) {
    console.error(e);
    root.innerHTML = '<div class="card"><div class="warn-strip">حدث خطأ غير متوقع: ' + esc(e.message) + '</div></div>';
  }
  window.scrollTo(0, 0);
}

/* Pro promo chip in topbar when not activated */
function proBadgeHTML() {
  return isPro() ? '' : '<button class="icon-btn" id="pro-chip" title="النسخة الكاملة" style="color:var(--res);font-weight:800">💎</button>';
}

/* ---------- theme ---------- */
function resolveTheme() {
  if (S.theme === 'dark') return 'dark';
  if (S.theme === 'light') return 'light';
  return (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}
function applyTheme() {
  const t = resolveTheme();
  document.documentElement.dataset.theme = t;
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#0d1220' : '#2563eb');
}

/* ---------- labels change with the chosen mode ---------- */
function applyModeLabels() {
  const add = document.querySelector('.nav-item[data-page="add"] span:last-child');
  if (add) add.textContent = isDaily() ? 'تسجيل يوم' : 'إضافة يوم';
  const home = document.querySelector('.nav-item[data-page="home"] span:last-child');
  if (home) home.textContent = isDaily() ? 'عربيتي' : 'الرئيسية';
  const walNav = document.querySelector('.nav-item[data-page="wallets"]');
  if (walNav) {
    walNav.style.display = isDaily() ? 'none' : '';
    const wal = walNav.querySelector('span:last-child');
    if (wal) wal.textContent = 'خزنة العربية';
  }
  document.title = appTitle(Nav.current || 'home');
}

/* ---------- boot ---------- */
window.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await initPro();
  applyTheme();
  applyModeLabels();
  purgeExpiredTrash();

  document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => go(b.dataset.page));
  document.getElementById('settings-btn').onclick = () => go('settings');
  document.getElementById('theme-toggle').onclick = async () => {
    S.theme = resolveTheme() === 'dark' ? 'light' : 'dark';
    await saveSettings();
    applyTheme();
    go(Nav.current || 'home');
  };
  /* 💎 chip → upgrade screen */
  const slot = document.getElementById('pro-slot');
  function renderProChip() {
    if (isPro()) { slot.innerHTML = ''; return; }
    slot.innerHTML = '<button class="icon-btn" id="pro-chip" title="النسخة الكاملة Pro" style="color:var(--res);font-weight:800;font-size:.85rem">💎</button>';
    slot.querySelector('#pro-chip').onclick = () => upgradeModal('');
  }
  renderProChip();
  window._renderProChip = renderProChip;

  if (window.matchMedia) {
    try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.theme === 'system') applyTheme(); }); } catch (e) {}
  }

  /* الإشعار بيضغط على "تحديث العداد" → نفتح التطبيق على خانة العداد مباشرة */
  if ('serviceWorker' in navigator) {
    try { navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'open-quick-odo') openQuickOdoModal();
    }); } catch (e) {}
  }
  const quickOdo = new URLSearchParams(location.search).get('quick') === 'odo';

  /* ☁️ Supabase: لو فيه إعداد سحابة لازم تسجيل دخول أول */
  let cloudReady = true;
  if (Cloud.enabled()) {
    if (!Cloud.signedIn()) {
      go('login');
      cloudReady = false;
    } else {
      try {
        await Cloud.flush();
        await Cloud.pull();
        await loadSettings();
        applyTheme();
        applyModeLabels();
        renderProChip();
      } catch (e) { console.warn('cloud sync skipped:', e && e.message); }
    }
  }

  if (cloudReady) {
    /* first-run onboarding — إلا لو جهاز قديم عنده بيانات أصلاً */
    const obDone = await kvGet('onboarded', false);
    const hasData = ((await DB.all('sessions')).length + (await DB.all('maintenance')).length) > 0;
    if (!obDone && !hasData) {
      go('onboard');
    } else {
      if (!obDone) await kvSet('onboarded', true); /* أجهزة موجودة قبل التحديث */
      go('home');
      /* ⏰ تذكير العداد 10 الصبح + 4 العصر — وفور ما ترجع للتطبيق */
      setTimeout(() => { dailyNudge().catch(() => {}); }, 800);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) dailyNudge().catch(() => {});
      });
      window.addEventListener('focus', () => { dailyNudge().catch(() => {}); });
    }
    if (quickOdo) setTimeout(() => {
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      openQuickOdoModal();
    }, 500);
  }

  /* 📱 FCM: إشعارات حقيقية حتى والتطبيق مقفول (نسخة أندرويد بس) */
  if (typeof initNativePush === 'function') initNativePush();

  /* الـ WebView الأصلي بيحقن capacitor.js بنفسه — الـ Service Worker بيخلي الكاش يتقدمه
     فبنوقفه في الأندرويد عشان الـ bridge والـ FCM يشتغلوا */
  const NATIVE_WEBVIEW = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  window.__NATIVE_WEBVIEW__ = NATIVE_WEBVIEW;
  if (NATIVE_WEBVIEW) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {});
    }
  } else if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try { navigator.serviceWorker.register('sw.js'); } catch (e) { /* ignore */ }
  }
});

/* =================🔔 إشعارات الصيانة ================= */

/* كل الحاجات المستحقة/القريبة + العداد الحالي */
async function dueItems() {
  const sessions = modeSessions(await DB.all('sessions'));
  const maints = await DB.all('maintenance');
  const odo = currentOdo(sessions, maints);
  const today = todayStr();
  const all = [];
  for (const ck of allCatKeys()) {
    const last = latestMaint(maints, ck);
    const info = maintDueInfo(ck, last, intervalOf(ck), odo, today);
    all.push({ ck, info });
  }
  return { items: all.filter(x => x.info && x.info.level !== 'ok'), all, odo };
}

/* إشعار حقيقي في شريط الموبايل + زرار "تحديث العداد" جوه الإشعار */
async function showMaintNotification(title, body, tag) {
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg || !reg.showNotification) return false;
    await reg.showNotification(title, {
      body: body,
      tag: tag,
      icon: 'icons/icon-512.png',
      badge: 'icons/icon-512.png',
      vibrate: [120, 60, 120],
      actions: [{ action: 'quick-odo', title: '✅ تحديث العداد' }],
      data: { url: './index.html?quick=odo' }
    });
    return true;
  } catch (e) {
    console.warn('SW showNotification failed, trying direct:', e && e.message);
    /* fallback: متصفحات مش بتدعم إشعارات الـ service worker */
    try {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: body, tag: tag, icon: 'icons/icon-512.png' });
        return true;
      }
    } catch (e2) {}
    return false;
  }
}

/* إشعار مستقل لكل حاجة قربت/فاتت — والساكت لما مفيش حاجة */
async function notifyDueItems(opts) {
  opts = opts || {};
  if (S.notifications === false) return 0;
  if (!('Notification' in window) || Notification.permission !== 'granted') return 0;
  if (!('serviceWorker' in navigator)) return 0;
  const { items, all, odo } = await dueItems();

  /* لو حاجة رجعت تمام، نصفّر حالتها عشان ننبه تاني لو قربت بعدين */
  for (const { ck, info } of all) {
    if (!info || info.level === 'ok') await kvSet('notifLevel-' + ck, info ? 'ok' : '');
  }
  if (!items.length) return 0; /* مفيش حاجة → مفيش أي إشعار خالص */

  let sent = 0;
  for (const { ck, info } of items) {
    const key = 'notifLevel-' + ck;
    const prev = await kvGet(key, '');
    if (!opts.force && prev === info.level) continue; /* ما نكررش نفس التنبيه */
    const missed = info.level === 'missed';
    const name = catLabel(ck);
    const title = (missed ? '🔴 ' : '🟢 ') + 'تغيير ' + name + (missed ? ' فات' : ' قرب');
    const where = info.nextDueKm !== null ? ' (الموعد عند <bdi dir="ltr">' + fmtN(info.nextDueKm) + '</bdi> كم)' : '';
    const body = missed
      ? 'عدادك عدّى موعد ' + name + where + ' — وانت عند ' + fmtN(odo) + ' كم. غيّرها وسجّلها من خزنة العربية.'
      : 'فاضل ' + (info.kmLeft !== null ? fmtN(Math.max(0, info.kmLeft)) + ' كم' : 'أيام قليلة') + ' على موعد ' + name + where + '. جهّز نفسك.';
    const plain = body.replace(/<[^>]+>/g, '');
    const tag = 'maint-' + ck + (opts.force ? '-' + todayStr() : '-now');
    /* الحالة تتسجل بس لو الإشعار اتبعت فعلًا — عشان ما نكتش أبدًا لو فشل */
    if (await showMaintNotification(title, plain, tag)) {
      await kvSet(key, info.level);
      sent++;
    }
  }
  return sent;
}

/* =================⏰ تذكير العداد — الساعة 10 والساعة 4 كل يوم ================= */
const ODO_SLOTS = [
  { h: 10, key: 'lastOdoNudge10', tagPart: '10', label: 'الصبح',
    body: 'الساعة 10 الصبح — لو مشيت شوية اكتب عدادك دلوقتي. اضغط «تحديث العداد».' },
  { h: 16, key: 'lastOdoNudge16', tagPart: '16', label: 'العصر',
    body: 'الساعة 4 العصر — الوقت المثالي إنك تسجّل عدادك. اضغط «تحديث العداد».' }
];
const odoTimers = {};

function scheduleSlot(slot) {
  if (odoTimers[slot.h]) return;
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slot.h, 0, 0);
  if (target <= now) return;
  const ms = target - now;
  if (ms > 2147483647) return; /* حد setTimeout */
  odoTimers[slot.h] = setTimeout(() => {
    delete odoTimers[slot.h];
    dailyNudge();
  }, ms);
}

async function sendOdoSlot(slot) {
  if (S.notifications === false) return false;
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  return await showMaintNotification('📍 وقت تسجيل الكيلومتر — ' + slot.label, slot.body, 'odo-' + slot.tagPart + '-' + todayStr());
}

/* بنفحص كل موعد: لو وقته فات ومتبعتش → نبعت فورًا. ولو لسه ما جاش → تايمر */
async function dailyNudge() {
  const today = todayStr();
  let sentAny = false;
  for (const slot of ODO_SLOTS) {
    if ((await kvGet(slot.key, '')) === today) continue;
    if (new Date().getHours() < slot.h) { scheduleSlot(slot); continue; }
    await kvSet(slot.key, today);
    if (await sendOdoSlot(slot)) sentAny = true;
  }
  /* إشعار منفصل لكل حاجة قربت أو فاتت — والساكت لو مفيش */
  await notifyDueItems();

  if (!sentAny && Nav.current === 'home') {
    toast('📍 سجّل عدادك النهاردة — الصبح والساعة 4', {
      duration: 8000, actionLabel: 'تحديث العداد', onAction: () => openQuickOdoModal()
    });
  }
}

/* اسم قديم للـ boot / التوثيق */
const weeklyNudge = dailyNudge;

/* زرار تجريبي عشان تتأكد إن الإشعارات شغالة على جهازك */
async function sendTestNotification() {
  if (!('Notification' in window)) { toast('المتصفح ده مش بيدعم الإشعارات'); return false; }
  if (Notification.permission === 'denied') {
    toast('الإشعارات مقفولة — افتحها من إعدادات الموقع للصفحة دي');
    return false;
  }
  if (Notification.permission !== 'granted') {
    let p = 'default';
    try { p = await Notification.requestPermission(); } catch (e) {}
    if (p !== 'granted') { toast('مش هتشوف إشعارات — فعّلها من إعدادات الموقع'); return false; }
  }
  const ok = await showMaintNotification('🔔 إشعار تجريبي', 'الإشعارات شغالة ✅ — هتجيك تذكيرات العداد الساعة 10 والساعة 4 كل يوم.', 'test-' + Date.now());
  toast(ok ? '✅ بعتلك إشعار تجريبي — شوف شريط الإشعارات' : '⚠️ المتصفح رفض الإشعار — جرّبه من الوضع المثبت (Add to Home Screen)');
  return ok;
}

/* تفعيل إشعارات الصيانة (بيُطلب من الإعدادات أو بعد الترحيب) */
async function enableNotifications(ask) {
  if (!('Notification' in window)) { toast('المتصفح ده مش بيدعم الإشعارات'); return false; }
  if (Notification.permission === 'granted') {
    S.notifications = true; await saveSettings();
    toast('✅ الإشعارات مفعّلة — كل يوم الساعة 4 العصر هنبعتلك تنبيه تسجيل العداد');
    return true;
  }
  if (Notification.permission === 'denied') {
    toast('الإشعارات مقفولة في المتصفح — افتحها من إعدادات الموقع ثم ارجع هنا');
    return false;
  }
  if (ask) {
    let p = 'default';
    try { p = await Notification.requestPermission(); } catch (e) {}
    if (p === 'granted') {
      S.notifications = true; await saveSettings();
      toast('✅ الإشعارات مفعّلة — هنبعتلك إشعار منفصل لكل حاجة قربت أو فاتت');
      return true;
    }
    toast('تمام — من غير إشعارات. تقدر تفعّلها وقت ما تحب من الإعدادات');
    return false;
  }
  return false;
}

/* نافذة صغيرة لتعديل العداد بسرعة — بتتفتح من الإشعار نفسه */
async function openQuickOdoModal() {
  const sessions = modeSessions(await DB.all('sessions'));
  const maints = await DB.all('maintenance');
  const cur = currentOdo(sessions, maints);
  openModal(
    '<div class="modal-title">📍 تحديث عداد العربية</div>' +
    '<div class="t2" style="margin-bottom:10px">اكتب رقم العداد الجديد وهنفحص لك كل المواعيد فورًا — ولو حاجة قربت أو فاتت هتبعتلك إشعار بيها.</div>' +
    field('عداد الكيلومتر الحالي (كم)',
      '<input class="input input-lg" id="qo-odo" type="number" inputmode="numeric" value="' + (+cur || '') + '" placeholder="مثال: 107200" dir="ltr" style="text-align:center;font-weight:800">') +
    '<div class="modal-actions">' +
    '<button class="btn" onclick="closeModal()">إلغاء</button>' +
    '<button class="btn btn-pri" id="qo-save">✅ تحديث العداد</button></div>',
    { onMount: w => {
      const inp = w.querySelector('#qo-odo');
      try { inp.focus(); inp.select(); } catch (e) {}
      w.querySelector('#qo-save').onclick = async () => {
        const v = +inp.value || 0;
        if (!(v > 0)) { toast('اكتب رقم العداد'); return; }
        if (v < (+S.odo || 0)) {
          const ok = await confirmDlg({ title: 'الرقم أقل من المحفوظ؟', body: 'العداد المحفوظ <bdi dir="ltr">' + fmtN(S.odo) + '</bdi> وأنت كتبت <bdi dir="ltr">' + fmtN(v) + '</bdi>. هنحدّثه على أي حال.', okText: 'تحديث' });
          if (!ok) return;
        }
        S.odo = v;
        await saveSettings();
        closeModal();
        toast('✅ تم تحديث العداد — بنفحص المواعيد...');
        go('home');
        await notifyDueItems();
      };
    } }
  );
}
