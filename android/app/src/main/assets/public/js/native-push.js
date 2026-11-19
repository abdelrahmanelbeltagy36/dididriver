/* ===== native-push.js — FCM في نسخة أندرويد الأصلية (Capacitor) =====
   في نسخة الويب العادية الملف ده no-op بالكامل.
   في الأندرويد: بيطلب إذن الإشعارات، يسجّل التوكن في Supabase،
   ويفتح التطبيق على خانة العداد لما المستخدم يضغط الإشعار. */
'use strict';

(function () {
  let started = false;

  async function initNativePush() {
    if (started) return;
    const cap = window.Capacitor;
    /* Capacitor بيحقن Plugins直接在 الـ WebView — مفيش isNativePlatform/capacitorExports */
    const plugin = (cap && cap.Plugins && cap.Plugins.PushNotifications) ||
      window.CapacitorPushNotifications;
    const isNative = !!plugin || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (!isNative || !plugin) return; /* ويب عادي — نشوف الإشعارات بتاعة app.js */
    started = true;

    try {
      /* أندرويد 13+ محتاج إذن صريح */
      if (typeof plugin.requestPermissions === 'function') {
        const perm = await plugin.requestPermissions();
        if (perm && perm.receive && perm.receive !== 'granted') return;
      }
    } catch (e) { /* أكمل محاولة التسجيل */ }

    async function trySaveToken() {
      const token = localStorage.getItem('didicloud_fcm_token') || '';
      if (!token) return false;
      if (window.Cloud && typeof Cloud.enabled === 'function' && Cloud.enabled() &&
          typeof Cloud.signedIn === 'function' && Cloud.signedIn()) {
        try { await Cloud.saveFcmToken(token); return true; }
        catch (e) { console.warn('save FCM token failed', e); }
      }
      return false;
    }
    window.trySaveFcmToken = trySaveToken;

    try {
      plugin.addListener('registration', async (info) => {
        if (!info || !info.token) return;
        localStorage.setItem('didicloud_fcm_token', info.token);
        await trySaveToken();
      });

      plugin.addListener('registrationError', (err) => {
        console.warn('FCM registration error', err);
      });

      /* الإشعار والتطبيق مفتوح */
      plugin.addListener('pushNotificationReceived', (n) => {
        if (!n) return;
        if (n.title) toast(n.title + (n.body ? ' — ' + n.body : ''), { duration: 8000 });
        if (n.data && n.data.type === 'odo' && typeof openQuickOdoModal === 'function') {
          /* سيبه في شريط الإشعارات — المستخدم يضغطه لو حابب */
        }
      });

      /* المستخدم ضغط الإشعار والتطبيق مقفول → افتح خانة العداد */
      plugin.addListener('pushNotificationActionPerformed', (n) => {
        const data = n && n.notification && n.notification.data;
        if (data && (data.type === 'odo' || data.type === 'quick-odo')) {
          setTimeout(() => { if (typeof openQuickOdoModal === 'function') openQuickOdoModal(); }, 600);
        }
      });

      await plugin.register();
    } catch (e) {
      console.warn('push init failed', e);
    }
  }

  window.initNativePush = initNativePush;
  window.retryNativePush = async function () {
    started = false;
    await initNativePush();
    if (typeof window.trySaveFcmToken === 'function') await window.trySaveFcmToken();
    return !!(localStorage.getItem('didicloud_fcm_token'));
  };
})();
