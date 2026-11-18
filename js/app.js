/* ===== app.js — boot, theme, router ===== */
'use strict';

const Nav = { current: null, params: {} };

const TITLES = {
  home: 'إدارة دخل السائق',
  add: 'إضافة يوم',
  wallets: 'خزنة العربية',
  analytics: 'التحليلات',
  archive: 'الأرشيف والصيانة',
  settings: 'الإعدادات',
  feedback: 'اقتراحات ومشاكل',
  onboard: 'أهلاً بك — نظّم عربيتك'
};

async function go(page, params) {
  Nav.current = page;
  Nav.params = params || {};
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('on', b.dataset.page === page));
  document.getElementById('topbar-title').textContent = TITLES[page] || 'إدارة دخل السائق';
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

/* ---------- boot ---------- */
window.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await initPro();
  applyTheme();
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

  /* first-run onboarding — إلا لو جهاز قديم عنده بيانات أصلاً */
  const obDone = await kvGet('onboarded', false);
  const hasData = ((await DB.all('sessions')).length + (await DB.all('maintenance')).length) > 0;
  if (!obDone && !hasData) {
    go('onboard');
  } else {
    if (!obDone) await kvSet('onboarded', true); /* أجهزة موجودة قبل التحديث */
    go('home');
    /* 🔔 weekly maintenance nudge — once every 7 days on app open */
    setTimeout(() => { weeklyNudge().catch(() => {}); }, 1500);
  }

  /* service worker for offline + installability */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try { navigator.serviceWorker.register('sw.js'); } catch (e) { /* ignore */ }
  }
});

/* ---------- weekly nudge: عدّل العداد + راجع المواعيد ---------- */
async function weeklyNudge() {
  const last = +(await kvGet('lastNudgeTs', 0)) || 0;
  if (Date.now() - last < 7 * 86400000) return;
  await kvSet('lastNudgeTs', Date.now());
  if (Nav.current && Nav.current !== 'home') return; /* don't interrupt user mid-task */
  const sessions = await DB.all('sessions');
  const maints = await DB.all('maintenance');
  if (!sessions.length && !maints.length) return; /* empty app — nothing to review yet */
  const odo = currentOdo(sessions, maints);
  const today = todayStr();
  const missed = [], soon = [];
  for (const ck of CAT_LIST) {
    const info = maintDueInfo(ck, maints.filter(m => m.category === ck).sort((a, b) => b.date.localeCompare(a.date))[0], S.intervals[ck], odo, today);
    if (!info) continue;
    if (info.level === 'missed') missed.push(CATS[ck]);
    else if (info.level === 'soon') soon.push(CATS[ck]);
  }
  if (missed.length) {
    toast('🔴 فاتك تغيير: ' + missed.join('، ') + ' — افتح خزنة العربية وسجّلها', { duration: 9000, actionLabel: 'فتح 🔧', onAction: () => go('wallets') });
  } else if (soon.length) {
    toast('🟢 قرب موعدها: ' + soon.join('، ') + ' — فاضل 500 كم أو أقل', { duration: 9000, actionLabel: 'فتح 🔧', onAction: () => go('wallets') });
  } else {
    toast('🔔 المراجعة الأسبوعية: مشيت كيلومترات؟ حدّث رقم العداد من "إضافة يوم" أو "تم التغيير"', { duration: 8000 });
  }
}
