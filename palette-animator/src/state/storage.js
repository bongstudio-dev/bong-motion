// Persistencia: localStorage + import/export JSON + paletas guardadas.

import { mergeState, defaultState } from "./defaults.js";

const STATE_KEY = "palette-animator:state";
const PALETTES_KEY = "palette-animator:palettes";

export function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return defaultState();
    return mergeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* almacenamiento lleno o bloqueado: seguimos sin persistir */
  }
}

export function loadSavedPalettes() {
  try {
    const raw = localStorage.getItem(PALETTES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveSavedPalettes(list) {
  try {
    localStorage.setItem(PALETTES_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

// Exporta el estado completo como archivo .json descargable.
export function exportStateFile(state, filename = "palette-animator.json") {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, filename);
}

// Lee un File y devuelve un estado saneado (promesa).
export function importStateFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(mergeState(JSON.parse(String(reader.result))));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Damos margen a que arranque la descarga antes de revocar.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
