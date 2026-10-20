// Persistencia de los assets en IndexedDB.
//
// localStorage no sirve para imágenes (tope de ~5 MB) y por eso los assets eran
// "de la sesión": cada vez que se recargaba la tool había que cargarlos de
// cero. IndexedDB guarda archivos enteros sin ese tope, del lado del navegador
// y sin servidor: las fotos de un cliente no salen de la máquina.
//
// Dos stores: `meta` (nombre, orden, recorte, visibilidad) y `files` (el File
// original). Se separan para poder actualizar el orden o el recorte sin
// reescribir megas de imagen.
//
// Todo está en try/catch: modo privado o almacenamiento bloqueado simplemente
// dejan la tool como antes (assets de sesión), sin romper nada.

const DB_NAME = "plane-animator";
const VERSION = 1;

let dbPromise = null;
function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("sin IndexedDB"));
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("meta", { keyPath: "id" });
      req.result.createObjectStore("files");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

const wrap = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

// ids cuyo archivo ya está guardado: el orden y el recorte cambian seguido,
// el archivo no.
const persisted = new Set();
export const markPersisted = (ids) => ids.forEach((id) => persisted.add(id));

// Devuelve [{ ...meta, file }] en el orden guardado.
export async function loadSavedAssets() {
  try {
    const db = await open();
    const tx = db.transaction(["meta", "files"], "readonly");
    const metas = await wrap(tx.objectStore("meta").getAll());
    const out = [];
    for (const m of metas.sort((a, b) => a.order - b.order)) {
      const file = await wrap(tx.objectStore("files").get(m.id));
      if (file) out.push({ ...m, file });
    }
    return out;
  } catch {
    return [];
  }
}

// Deja la base igual a la lista de assets del state.
export async function syncAssets(assets, getFile) {
  try {
    const db = await open();
    const tx = db.transaction(["meta", "files"], "readwrite");
    const meta = tx.objectStore("meta");
    const files = tx.objectStore("files");

    const want = new Set(assets.map((a) => a.id));
    for (const id of await wrap(meta.getAllKeys())) {
      if (!want.has(id)) {
        meta.delete(id);
        files.delete(id);
        persisted.delete(id);
      }
    }
    assets.forEach((a, order) => {
      meta.put({
        id: a.id, order, name: a.name, w: a.w, h: a.h, srcW: a.srcW, srcH: a.srcH,
        visible: a.visible, focal: a.focal, fit: a.fit,
      });
      if (!persisted.has(a.id)) {
        const f = getFile(a.id);
        if (f) {
          files.put(f, a.id);
          persisted.add(a.id);
        }
      }
    });
    await done(tx);
  } catch {
    /* sin almacenamiento: seguimos con assets de sesión */
  }
}
