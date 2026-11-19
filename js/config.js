/* ===== config.js — إعدادات السحابة =====
   هون بتحط رابط Supabase والمفتاح العام (anon key) بعد ما تعمل المشروع.
   المفتاح ده "عام" بالتصميم — الأمان كله في Row Level Security في schema.sql.
   لو سيبتهم فاضيين: التطبيق يشتغل offline زي ما كان تمامًا، من غير login.
*/
window.APP_CONFIG = window.APP_CONFIG || {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
