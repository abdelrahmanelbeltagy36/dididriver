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
  const wal = document.querySelector('.nav-item[data-page="wallets"] span:last-child');
  if (wal) wal.textContent = isDaily() ? 'المصاريف' : 'خزنة العربية';
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
      /* 🔔 مراجعة الصيانة كل 3 أيام أول ما تفتح التطبيق */
      setTimeout(() => { weeklyNudge().catch(() => {}); }, 1500);
    }
    if (quickOdo) setTimeout(() => {
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      openQuickOdoModal();
    }, 500);
  }

  /* service worker for offline + installability */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
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
  for (const ck of CAT_LIST) {
    const last = latestMaint(maints, ck);
    const info = maintDueInfo(ck, last, S.intervals[ck], odo, today);
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
    console.warn('showNotification failed:', e && e.message);
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
    const name = CATS[ck];
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

/* المراجعة الدورية — كل 3 أيام بالظبط */
async function weeklyNudge() {
  const last = +(await kvGet('lastNudgeTs', 0)) || 0;
  if (Date.now() - last < 3 * 86400000) return;
  await kvSet('lastNudgeTs', Date.now());
  const { items } = await dueItems();
  /* بناديها دايمًا — حتى لو مفيش حاجة — عشان نصفّر حالات اللي رجعت تمام */
  const sent = await notifyDueItems({ force: true });
  if (!items.length) return; /* الساكت لما مفيش حاجة */
  if (sent || Nav.current !== 'home') return;

  /* fallback: إشعار داخل التطبيق لو صلاحية الإشعارات مش مفعّلة */
  const missed = items.filter(x => x.info.level === 'missed').map(x => CATS[x.ck]);
  const soon = items.filter(x => x.info.level === 'soon').map(x => CATS[x.ck]);
  const parts = [];
  if (missed.length) parts.push('🔴 فاتك: ' + missed.join('، '));
  if (soon.length) parts.push('🟢 قربت: ' + soon.join('، '));
  toast(parts.join(' — ') + ' — اضغط فتح للتسجيل', { duration: 9000, actionLabel: 'فتح 🔧', onAction: () => go('wallets') });
}

/* تفعيل إشعارات الصيانة (بيُطلب من الإعدادات أو بعد الترحيب) */
async function enableNotifications(ask) {
  if (!('Notification' in window)) { toast('المتصفح ده مش بيدعم الإشعارات'); return false; }
  if (Notification.permission === 'granted') {
    S.notifications = true; await saveSettings();
    toast('✅ الإشعارات مفعّلة — كل 3 أيام هنبعتلك تنبيه بكل حاجة قربت أو فاتت');
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
