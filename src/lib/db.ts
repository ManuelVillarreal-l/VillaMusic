/** Guarda en IndexedDB los archivos de audio que sube el usuario (localStorage no alcanza para MP3). */
const DB_NAME = 'villamusic';
const STORE = 'audio';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function saveBlob(id: string, blob: Blob): Promise<void> {
  await run('readwrite', (s) => s.put(blob, id));
}

export async function loadBlob(id: string): Promise<Blob | undefined> {
  return run<Blob | undefined>('readonly', (s) => s.get(id));
}

export async function deleteBlob(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}
