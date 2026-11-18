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
  feedback: 'اقتراحات ومشاكل'
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

  go('home');

  /* service worker for offline + installability */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try { navigator.serviceWorker.register('sw.js'); } catch (e) { /* ignore */ }
  }
});
