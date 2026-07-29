// Persistencia: localStorage + import/export JSON + presets guardados.
// Copiado del palette-animator; sólo cambian las claves y "paletas" → "presets".

import { mergeState, defaultState } from "./defaults.js";

const STATE_KEY = "plane-animator:state";
const PRESETS_KEY = "plane-animator:presets";

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
    // Los assets se descartan explícitamente: no entran en localStorage.
    const { assets, ...rest } = state;
    localStorage.setItem(STATE_KEY, JSON.stringify(rest));
  } catch {
    /* almacenamiento lleno o bloqueado: seguimos sin persistir */
  }
}

export function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function savePresets(list) {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

// Exporta el estado completo como archivo .json descargable.
export function exportStateFile(state, filename = "plane-animator.json") {
  const { assets, ...rest } = state;
  const blob = new Blob([JSON.stringify(rest, null, 2)], {
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
