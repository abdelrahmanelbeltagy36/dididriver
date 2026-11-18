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
      return idbReq(r).then(() => obj);
    }
    const a = LS.read(store);
    const i = a.findIndex(x => x.id === obj.id);
    if (i >= 0) a[i] = obj; else a.push(obj);
    LS.write(store, a);
    return obj;
  }

  async function bulkPut(store, arr) {
    if (!arr || !arr.length) return true;
    if (await ready()) {
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readwrite');
        const st = t.objectStore(store);
        arr.forEach(o => st.put(o));
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      });
    }
    const a = LS.read(store);
    arr.forEach(o => {
      const i = a.findIndex(x => x.id === o.id);
      if (i >= 0) a[i] = o; else a.push(o);
    });
    LS.write(store, a);
    return true;
  }

  async function del(store, id) {
    if (await ready()) {
      const r = db.transaction(store, 'readwrite').objectStore(store).delete(id);
      return idbReq(r).then(() => true);
    }
    LS.write(store, LS.read(store).filter(x => x.id !== id));
    return true;
  }

  async function clear(store) {
    if (await ready()) {
      const r = db.transaction(store, 'readwrite').objectStore(store).clear();
      return idbReq(r).then(() => true);
    }
    LS.write(store, []);
    return true;
  }

  return { open, all, get, put, bulkPut, del, clear, STORES };
})();
