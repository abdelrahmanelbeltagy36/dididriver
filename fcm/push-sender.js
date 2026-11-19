/* ============================================================
   fcm/push-sender.js — باعت تذكير العداد عبر Firebase Cloud Messaging
   بيشتغل من GitHub Actions مرة كل ساعة: لو الساعة في القاهرة 10 أو 4
   يبعت لكل التوكنات المسجلة. وإلا بيسكت.
   المتغيرات من GitHub Secrets (SUPABASE_URL / SUPABASE_SERVICE_KEY / FCM_SERVICE_ACCOUNT_JSON)
   ============================================================
*/
'use strict';
const crypto = require('crypto');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SA_JSON = process.env.FCM_SERVICE_ACCOUNT_JSON || '';

function cairoHour() {
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo', hour: '2-digit', hour12: false
  }).format(new Date());
  return parseInt(s, 10);
}
function b64url(x) {
  return Buffer.from(x).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function makeJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const input = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(input);
  return input + '.' + b64url(signer.sign(sa.private_key));
}
async function getAccessToken(sa) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: makeJwt(sa)
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('OAuth: ' + JSON.stringify(data));
  return data.access_token;
}
async function fetchTokens() {
  const res = await fetch(SUPABASE_URL + '/rest/v1/fcm_tokens?select=user_id,token', {
    headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY }
  });
  const rows = await res.json();
  if (!res.ok) throw new Error('Supabase: ' + JSON.stringify(rows));
  return rows || [];
}
async function deleteToken(token) {
  await fetch(SUPABASE_URL + '/rest/v1/fcm_tokens?token=eq.' + encodeURIComponent(token), {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY }
  });
}
async function sendFcm(accessToken, projectId, token, slot) {
  const titles = { 10: '📍 وقت تسجيل الكيلومتر — الصبح', 16: '📍 وقت تسجيل الكيلومتر — العصر' };
  const bodies = {
    10: 'الساعة 10 الصبح — اكتب عدادك من الإشعار في ثانية.',
    16: 'الساعة 4 العصر — الوقت المثالي إنك تسجّل عدادك.'
  };
  const res = await fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: token,
        notification: { title: titles[slot], body: bodies[slot] },
        data: { type: 'odo', slot: String(slot) },
        android: { priority: 'high', notification: { channelId: 'odo-reminders', sound: 'default' } }
      }
    })
  });
  return { ok: res.ok, data: await res.json() };
}

(async () => {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY || !SA_JSON) {
      console.log('Secrets not configured yet — skip (add them in GitHub repo settings)');
      return;
    }
    const hour = cairoHour();
    const force = String(process.env.FORCE_SEND || '').toLowerCase() === 'true';
    console.log('Cairo hour =', hour, force ? '(force test)' : '');
    if (!force && hour !== 10 && hour !== 16) { console.log('Not a reminder hour — skip'); return; }
    const slot = (hour === 10 || hour === 16) ? hour : 16;

    const sa = JSON.parse(SA_JSON);
    const [accessToken, tokens] = await Promise.all([getAccessToken(sa), fetchTokens()]);
    let sent = 0, failed = 0;
    for (const row of tokens) {
      if (!row.token) continue;
      const r = await sendFcm(accessToken, sa.project_id, row.token, slot);
      if (r.ok) { sent++; console.log('✅ sent to', row.user_id); }
      else {
        failed++;
        const msg = (r.data && r.data.error && r.data.error.message) || '';
        console.warn('❌ failed', row.user_id, msg);
        if (/unregistered|invalid|not found/i.test(msg)) await deleteToken(row.token);
      }
    }
    console.log('Done:', sent, 'sent /', failed, 'failed');
  } catch (e) {
    console.error('push sender failed:', e.message);
    process.exitCode = 1;
  }
})();
