/* ===== native-push.js — إشعارات أندرويد محلية مجدولة =====
   التذكير اليومي بيتعمل على مستوى النظام (4 عصر + 9 وربع) — من غير إنترنت
   ولا Firebase. نسخة الويب العادية الملف ده no-op.
*/
'use strict';

(function () {
  let started = false;
  const cap = window.Capacitor;
  const ln = (cap && cap.Plugins && cap.Plugins.LocalNotifications) || null;
  const native = !!ln || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  function diag(msg) {
    try {
      const old = localStorage.getItem('didicloud_fcm_diag') || '';
      localStorage.setItem('didicloud_fcm_diag', (old ? old + ' | ' : '') + msg);
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
    if (!ln) { diag('local=no-plugin'); return false; }
    try {
      /* إذن واحد بس لكل حاجة */
      const perm = await ln.requestPermissions();
      if (!perm || perm.display !== 'granted') { diag('local-perm=' + JSON.stringify(perm)); return false; }

      /* شيل المواعيد القديمة من النسخ اللي فاتت */
      try { await ln.cancel({ ids: [101, 102, 103] }); } catch (e) {}

      await ln.schedule({ notifications: [
        { id: 102, title: '📍 وقت تسجيل الكيلومتر — العصر',
          body: 'الساعة 4 العصر — الوقت المثالي إنك تسجّل عدادك.',
          schedule: { at: nextAt(16, 0), repeats: true, every: 'day', allowWhileIdle: true } },
        { id: 103, title: '📍 وقت تسجيل الكيلومتر — بالليل',
          body: 'الساعة 9 وربع — آخر فرصة النهاردة تسجّل عدادك.',
          schedule: { at: nextAt(21, 15), repeats: true, every: 'day', allowWhileIdle: true } }
      ]});
      localStorage.setItem('didicloud_local_reminders', 'ok');
      diag('local=ok');
      return true;
    } catch (e) {
      diag('local-error=' + ((e && e.message) || 'unknown'));
      return false;
    }
  }

  async function initNativePush() {
    if (started || !native) return;
    started = true;
    try {
      /* ضغطة على الإشعار → افتح خانة العداد */
      if (cap && typeof cap.addListener === 'function') {
        cap.addListener('LocalNotifications', 'localNotificationActionPerformed', () => {
          setTimeout(() => { if (typeof openQuickOdoModal === 'function') openQuickOdoModal(); }, 500);
        });
      }
    } catch (e) { diag('listener-error=' + (e && e.message)); }

    /* نأخر شوية عشان الشاشة الأولية تفتح قبل أي حوار إذن */
    setTimeout(() => { initLocalReminders().catch(() => {}); }, 1200);
  }

  window.initNativePush = initNativePush;
  window.initLocalReminders = initLocalReminders;
  window.retryNativePush = async function () {
    const ok = await initLocalReminders();
    return ok;
  };
  /* توافق مع كود الدخول القديم */
  window.trySaveFcmToken = async function () { return true; };
})();
