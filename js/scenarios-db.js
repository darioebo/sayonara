import { makeId } from './scenarios-core.js';

const DB_NAME = 'sayonara';
const STORE = 'scenarios';
let dbPromise = null;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function initDB() {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const out = fn(store);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function listScenarios() {
  const db = await initDB();
  const all = await tx(db, 'readonly', (store) => {
    return new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  });
  return all.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function getScenario(id) {
  const db = await initDB();
  return tx(db, 'readonly', (store) => {
    return new Promise((res, rej) => {
      const req = store.get(id);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
  });
}

export async function saveScenario(s) {
  const db = await initDB();
  return tx(db, 'readwrite', (store) => {
    return new Promise((res, rej) => {
      const req = store.put(s);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  });
}

export async function deleteScenario(id) {
  const db = await initDB();
  return tx(db, 'readwrite', (store) => {
    return new Promise((res, rej) => {
      const req = store.delete(id);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  });
}

export async function duplicateScenario(s) {
  const now = new Date().toISOString();
  const copy = {
    ...s,
    id: makeId(),
    name: `${s.name} (cópia)`,
    createdAt: now,
    updatedAt: now
  };
  await saveScenario(copy);
  return copy;
}