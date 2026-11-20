/* ===== views-login.js — تسجيل الدخول / حساب جديد (Supabase Auth) ===== */
'use strict';

Views.login = async function (root) {
  let mode = 'login'; /* 'login' | 'signup' */

  function render(msg) {
    root.innerHTML =
      '<div class="card" style="border-color:var(--pri);max-width:520px;margin:24px auto">' +
      '<div style="text-align:center;margin-bottom:6px;font-size:2rem">🚗</div>' +
      '<div class="card-title" style="justify-content:center">إدارة دخل السائق</div>' +
      '<div class="t2" style="text-align:center;margin-bottom:14px;line-height:1.8">سجّل دخولك عشان بياناتك تتفظل محفوظة ومزامنة على كل أجهزتك — والتطبيق يشتغل حتى من غير نت.</div>' +
      '<div class="seg" id="lg-seg">' +
      '<button type="button" data-v="login" class="' + (mode === 'login' ? 'on' : '') + '">🔑 تسجيل دخول</button>' +
      '<button type="button" data-v="signup" class="' + (mode === 'signup' ? 'on' : '') + '">✨ حساب جديد</button>' +
      '</div>' +
      '<div style="height:12px"></div>' +
      field('البريد الإلكتروني', '<input class="input" id="lg-email" type="email" inputmode="email" dir="ltr" placeholder="name@example.com" autocomplete="email">') +
      field('كلمة المرور', '<input class="input" id="lg-pass" type="password" dir="ltr" placeholder="••••••••" autocomplete="' + (mode === 'signup' ? 'new-password' : 'current-password') + '">') +
      (mode === 'signup' ? '<div class="t2" style="margin:-4px 0 10px">كلمة المرور 6 حروف على الأقل.</div>' : '') +
      '<div id="lg-msg">' + (msg || '') + '</div>' +
      '<button class="btn btn-pri btn-block" id="lg-go" style="min-height:48px">' + (mode === 'login' ? 'دخول ←' : 'إنشاء الحساب ←') + '</button>' +
      '<div class="divider"></div>' +
      '<div class="t2" style="text-align:center;line-height:1.8">🔒 بياناتك مشتركة بس معاك — كل مستخدم يشوف بياناته هو. التطبيق بيشتغل offline-first: لو النت قطع تقدر تفتح وتسجّل، وهتتزامن تلقائيًا لما ترجع.</div>' +
      '</div>';

    root.querySelectorAll('#lg-seg button').forEach(b => b.onclick = () => {
      mode = b.dataset.v;
      render('');
    });
    root.querySelector('#lg-go').onclick = doAuth;
    const pass = root.querySelector('#lg-pass');
    pass.addEventListener('keydown', e => { if (e.key === 'Enter') doAuth(); });
  }

  async function doAuth() {
    const email = (root.querySelector('#lg-email').value || '').trim();
    const password = root.querySelector('#lg-pass').value || '';
    const msgBox = root.querySelector('#lg-msg');
    if (!email || !password) { msgBox.innerHTML = '<div class="warn-strip">اكتب الإيميل وكلمة المرور</div>'; return; }
    if (mode === 'signup' && password.length < 6) { msgBox.innerHTML = '<div class="warn-strip">كلمة المرور 6 حروف على الأقل</div>'; return; }
    const btn = root.querySelector('#lg-go');
    btn.disabled = true; btn.textContent = '...جارٍ الاتصال';
    msgBox.innerHTML = '';
    try {
      const r = mode === 'signup' ? await Cloud.signup(email, password) : await Cloud.login(email, password);
      if (r.needConfirm) {
        msgBox.innerHTML = '<div class="warn-strip" style="background:var(--pos-soft);color:var(--pos)">✅ تم إنشاء الحساب — افتح إيميلك وفعّله، وبعدين سجّل دخول.</div>';
        btn.disabled = false; btn.textContent = 'دخول ←';
        mode = 'login';
        return;
      }
      toast('✅ أهلاً بك — بياناتك هتتزامن دلوقتي');
      location.reload();
    } catch (e) {
      const text = (e && e.message) || 'حصل خطأ';
      msgBox.innerHTML = '<div class="warn-strip">' + (text.toLowerCase().includes('invalid')
        ? (mode === 'login' ? 'الإيميل أو كلمة المرور غلط' : 'الإيميل مستخدم قبل كده أو بياناته غلط')
        : esc(text)) + '</div>';
      btn.disabled = false;
      btn.textContent = mode === 'login' ? 'دخول ←' : 'إنشاء الحساب ←';
    }
  }

  render('');
};
