/* ===== capacitor-push.js =====
   بيحوّل plugin الإشعارات الأصلي للـ Capacitor.
   في نسخة الويب العادية الـ capacitorExports مش موجود → الملف ده no-op تمامًا.
*/
'use strict';
(function () {
  var core = (typeof capacitorExports !== 'undefined') ? capacitorExports :
    (window.Capacitor && window.Capacitor.Plugins) ? null : null;
  if (core && typeof core.registerPlugin === 'function') {
    window.CapacitorPushNotifications = core.registerPlugin('PushNotifications', {});
  }
})();
