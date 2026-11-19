/* ===== cloud.js — طبقة Supabase (Auth + مزامنة offline-first) =====
   لو APP_CONFIG فاضي: كل الدوال no-op والتطبيق يشتغل محلي 100%.
   الفكرة: IndexedDB هو المصدر الأساسي (مرة JWT)، والسحابة mirror بالـ last-write-wins.
*/
'use strict';

const Cloud = (function () {
  const SESSION_KEY = 'didicloud_session';
  const QUEUE_KEY = 'cloud_queue';
  let applying = false;
  let flushing = false;
  let session = null;

  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { session = null; }

  function enabled() {
    const c = window.APP_CONFIG || {};
    return !!(c.supabaseUrl && c.supabaseAnonKey);
  }
  function base() { return (window.APP_CONFIG.supabaseUrl || '').replace(/\/+$/, ''); }
  function headers(extra) {
    const c = window.APP_CONFIG || {};
    const h = { apikey: c.supabaseAnonKey || '', 'Content-Type': 'application/json' };
    if (session && session.access_token) h.Authorization = 'Bearer ' + session.access_token;
    return Object.assign(h, extra || {});
  }

  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch(base() + '/' + path.replace(/^\//, ''), {
      method: opts.method || 'GET',
      headers: headers(opts.headers),
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && (data.msg || data.message || data.error_description || data.error)) || ('HTTP ' + res.status);
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return data;
  }

  /* ---------- Auth ---------- */
  async function signup(email, password) {
    const data = await api('auth/v1/signup', {
      method: 'POST',
      body: { email: email, password: password }
    });
    if (data && data.access_token) {
      session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      await pushAll();
      await pull();
      return { ok: true, session: session };
    }
    return { ok: true, needConfirm: true, email: email };
  }

  async function login(email, password) {
    const data = await api('auth/v1/token?grant_type=password', {
      method: 'POST',
      body: { email: email, password: password }
    });
    session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    await pushAll();
    await pull();
    return { ok: true, session: session };
  }

  async function logout() {
    try { if (session) await api('auth/v1/logout', { method: 'POST' }); } catch (e) {}
    session = null;
    localStorage.removeItem(SESSION_KEY);
  }

  function user() { return session ? (session.user || null) : null; }
  function signedIn() { return !!(session && session.access_token); }

  /* ---------- queue / mirror ---------- */
  async function enqueue(item) {
    if (!enabled() || !signedIn() || applying) return;
    const q = await kvGet(QUEUE_KEY, []);
    q.push(item);
    await kvSet(QUEUE_KEY, q);
    /* fire and forget — Combine batches naturally */
    flush().catch(() => {});
  }

  function onMutation(op, store, id, data) {
    if (!enabled() || !signedIn() || applying) return;
    if (op === 'clear') enqueue({ op: 'clear', store: store });
    else if (op === 'del') enqueue({ op: 'del', store: store, id: id });
    else enqueue({ op: 'upsert', store: store, id: id, data: data });
  }

  async function pushAll() {
    if (!enabled() || !signedIn()) return;
    const q = await kvGet(QUEUE_KEY, []);
    for (const store of DB.STORES) {
      const rows = await DB.all(store);
      for (const row of rows) {
        if (!row || !row.id) continue;
        q.push({ op: 'upsert', store: store, id: row.id, data: row });
      }
    }
    await kvSet(QUEUE_KEY, q);
    await flush();
  }

  async function flush() {
    if (!enabled() || !signedIn() || applying || flushing) return;
    const q = await kvGet(QUEUE_KEY, []);
    if (!q.length) return;
    flushing = true;
    try {
      const uid = user().id;
      for (const item of q) {
        if (item.op === 'clear') {
          await api('rest/v1/user_rows?user_id=eq.' + uid + '&store=eq.' + encodeURIComponent(item.store), {
            method: 'PATCH', body: { deleted: true, updated_at: new Date().toISOString() },
            headers: { Prefer: 'return=minimal' }
          });
        } else if (item.op === 'del') {
          await api('rest/v1/user_rows?id=eq.' + encodeURIComponent(item.id) + '&user_id=eq.' + uid, {
            method: 'PATCH', body: { deleted: true, updated_at: new Date().toISOString() },
            headers: { Prefer: 'return=minimal' }
          });
        } else {
          await api('rest/v1/user_rows?on_conflict=id', {
            method: 'POST',
            body: {
              id: item.id, user_id: uid, store: item.store, data: item.data,
              deleted: false, updated_at: new Date().toISOString()
            },
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
          });
        }
      }
      /* Remove only processed items — anything added meanwhile stays queued */
      const current = await kvGet(QUEUE_KEY, []);
      await kvSet(QUEUE_KEY, current.slice(q.length));
    } catch (e) {
      console.warn('cloud flush failed (will retry):', e.message);
    } finally {
      flushing = false;
    }
  }

  async function pull() {
    if (!enabled() || !signedIn()) return;
    const rows = await api('rest/v1/user_rows?select=*', { method: 'GET' });
    applying = true;
    try {
      for (const r of (rows || [])) {
        if (!r.store || !r.id) continue;
        if (r.deleted) await DB.del(r.store, r.id);
        else await DB.put(r.store, r.data);
      }
    } finally {
      applying = false;
    }
    await flush(); /* push anything created while offline */
  }

  /* ---------- subscription codes (server-side!) ---------- */
  async function redeem(code) {
    if (!enabled() || !signedIn()) throw new Error('لازم تسجل دخول الأول');
    return await api('rest/v1/rpc/redeem_code', { method: 'POST', body: { p_code: code } });
  }

  return {
    enabled, user, signedIn, session: () => session,
    signup, login, logout, pushAll, pull, flush, onMutation, redeem,
    isApplying: () => applying
  };
})();
