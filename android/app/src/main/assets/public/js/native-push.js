/* ===== native-push.js — إشعارات محلية مجدولة (بدون FCM / بدون إنترنت) =====
   الأندرويد نفسه بيطلق التذكير الساعة 4 عصر و9 وربع مساءً كل يوم،
   والتطبيق مقفول. نسخة الويب العادية الملف ده no-op بالكامل.
*/
'use strict';

(function () {
  const KEY_STATE = 'didicloud_local_reminders';
  const KEY_DIAG = 'didicloud_notif_diag';
  const cap = window.Capacitor;
  const ln = (cap && cap.Plugins && cap.Plugins.LocalNotifications) || null;
  const native = !!ln || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  function diag(msg) {
    try {
      const old = localStorage.getItem(KEY_DIAG) || '';
      localStorage.setItem(KEY_DIAG, (old ? old + ' | ' : '') + msg);
    } catch (e) {}
  }
  function nextAt(h, m) {
    const dt = new Date();
    dt.setHours(h, m || 0, 0, 0);
    if (dt.getTime() <= Date.now()) dt.setDate(dt.getDate() + 1);
    return dt;
  }

  async function initLocalReminders() {
    if (!native) return false;
    if (!ln) { diag('no-plugin'); return false; }
    try {
      const perm = await ln.requestPermissions();
      if (!perm || perm.display !== 'granted') { diag('perm=' + JSON.stringify(perm)); return false; }
      try { await ln.cancel({ ids: [101, 102, 103] }); } catch (e) {}
      await ln.schedule({ notifications: [
        { id: 102, title: '📍 وقت تسجيل الكيلومتر — العصر',
          body: 'الساعة 4 العصر — الوقت المثالي إنك تسجّل عدادك.',
          schedule: { at: nextAt(16, 0), repeats: true, every: 'day' } },
        { id: 103, title: '📍 وقت تسجيل الكيلومتر — بالليل',
          body: 'الساعة 9 وربع — آخر فرصة النهاردة تسجّل عدادك.',
          schedule: { at: nextAt(21, 15), repeats: true, every: 'day' } }
      ]});
      localStorage.setItem(KEY_STATE, 'ok');
      diag('scheduled');
      return true;
    } catch (e) {
      diag('error=' + ((e && e.message) || 'unknown'));
      return false;
    }
  }

  window.initLocalReminders = initLocalReminders;
  window.retryNativePush = initLocalReminders;
  window.initNativePush = initLocalReminders; /* توافق مع أي استدعاء قديم */
})();
