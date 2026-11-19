/* ===== db.js — storage layer: IndexedDB with localStorage fallback ===== */
'use strict';

const DB = (function () {
  const STORES = ['settings', 'sessions', 'purchases', 'maintenance', 'feedback', 'trash', 'kv'];
  const NAME = 'driver_income_db';
  const VERSION = 1;
  let db = null;
  let mode = 'idb';
  let opening = null;

  function open() {
    if (opening) return opening;
    if (!('indexedDB' in window)) { mode = 'ls'; opening = Promise.resolve(); return opening; }
    opening = new Promise((resolve) => {
      let rq;
      try { rq = indexedDB.open(NAME, VERSION); }
      catch (e) { mode = 'ls'; return resolve(); }
      rq.onupgradeneeded = (e) => {
        const d = e.target.result;
        STORES.forEach(s => {
          if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
        });
      };
      rq.onsuccess = () => { db = rq.result; mode = 'idb'; resolve(); };
      rq.onerror = () => { mode = 'ls'; resolve(); };
      rq.onblocked = () => { mode = 'ls'; resolve(); };
    });
    return opening;
  }

  function ready() {
    return open().then(() => mode === 'idb' && !!db);
  }

  function idbReq(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /* mirror to Supabase — no-op when cloud is off (offline mode) */
  function cloudHook(op, store, id, data) {
    try {
      if (store === 'kv' && id === 'cloud_queue') return; /* avoid queue recursion */
      /* Cloud هو const على مستوى السكربتات — مش window.Cloud */
      if (typeof Cloud !== 'undefined' && typeof Cloud.onMutation === 'function') Cloud.onMutation(op, store, id, data);
    } catch (e) { /* offline-first: never let cloud break local writes */ }
  }

  /* ---- localStorage fallback ---- */
  const LS = {
    key: s => 'dididb__' + s,
    read(s) { try { return JSON.parse(localStorage.getItem(LS.key(s))) || []; } catch (e) { return []; } },
    write(s, arr) { try { localStorage.setItem(LS.key(s), JSON.stringify(arr)); } catch (e) { /* quota */ } }
  };

  async function all(store) {
    if (await ready()) {
      const r = db.transaction(store, 'readonly').objectStore(store).getAll();
      return idbReq(r).then(x => x || []);
    }
    return LS.read(store);
  }

  async function get(store, id) {
    if (await ready()) {
      const r = db.transaction(store, 'readonly').objectStore(store).get(id);
      return idbReq(r).then(x => x || null);
    }
    return LS.read(store).find(x => x.id === id) || null;
  }

  async function put(store, obj) {
    if (await ready()) {
      const r = db.transaction(store, 'readwrite').objectStore(store).put(obj);
      return idbReq(r).then(() => { cloudHook('upsert', store, obj.id, obj); return obj; });
    }
    const a = LS.read(store);
    const i = a.findIndex(x => x.id === obj.id);
    if (i >= 0) a[i] = obj; else a.push(obj);
    LS.write(store, a);
    cloudHook('upsert', store, obj.id, obj);
    return obj;
  }

  async function bulkPut(store, arr) {
    if (!arr || !arr.length) return true;
    if (await ready()) {
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readwrite');
        const st = t.objectStore(store);
        arr.forEach(o => st.put(o));
        t.oncomplete = () => { arr.forEach(o => cloudHook('upsert', store, o.id, o)); resolve(true); };
        t.onerror = () => reject(t.error);
      });
    }
    const a = LS.read(store);
    arr.forEach(o => {
      const i = a.findIndex(x => x.id === o.id);
      if (i >= 0) a[i] = o; else a.push(o);
    });
    LS.write(store, a);
    arr.forEach(o => cloudHook('upsert', store, o.id, o));
    return true;
  }

  async function del(store, id) {
    if (await ready()) {
      const r = db.transaction(store, 'readwrite').objectStore(store).delete(id);
      return idbReq(r).then(() => { cloudHook('del', store, id); return true; });
    }
    LS.write(store, LS.read(store).filter(x => x.id !== id));
    cloudHook('del', store, id);
    return true;
  }

  async function clear(store) {
    if (await ready()) {
      const r = db.transaction(store, 'readwrite').objectStore(store).clear();
      return idbReq(r).then(() => { cloudHook('clear', store); return true; });
    }
    LS.write(store, []);
    cloudHook('clear', store);
    return true;
  }

  return { open, all, get, put, bulkPut, del, clear, STORES };
})();
