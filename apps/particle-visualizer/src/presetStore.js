// Almacenamiento de presets + preset marcado como default (localStorage).

// Claves de config que NO se guardan en un preset (estado de runtime).
// Los dos interruptores que ENCIENDEN la cámara van acá. El store es blacklist
// y `getInitialConfig` aplica el preset marcado con ★ AL MONTAR la app: si se
// persistieran, abrir la tool dispararía el prompt de permiso de cámara sin que
// nadie lo pidiera. Prender la cámara tiene que ser siempre un acto explícito.
// Lo estético (espejo, opacidad, suavizado) sí se guarda: no toca el hardware.
// `texts` entra por otro motivo: no es un ajuste del look sino contenido que
// escribió el usuario. Un preset que arrastra el titular de otra pieza pisa el
// trabajo de quien lo aplica.
export const RUNTIME_KEYS = [
  "isPlaying",
  "clearSignal",
  "handTracking",
  "cameraBackdrop",
  "texts",
];

const PRESETS_KEY = "amt-presets";
const DEFAULT_KEY = "amt-default-preset";

export function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePresets(list) {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
  } catch {
    // storage no disponible: no rompemos la app.
  }
}

export function loadDefaultId() {
  try {
    return localStorage.getItem(DEFAULT_KEY) || null;
  } catch {
    return null;
  }
}

export function saveDefaultId(id) {
  try {
    if (id) {
      localStorage.setItem(DEFAULT_KEY, id);
    } else {
      localStorage.removeItem(DEFAULT_KEY);
    }
  } catch {
    // ignorar
  }
}

export function snapshotConfig(config) {
  const values = { ...config };
  RUNTIME_KEYS.forEach((key) => delete values[key]);
  return values;
}

// Config inicial de la tool: si hay un preset marcado como default, lo usamos
// como base (conservando el estado de runtime del config base).
export function getInitialConfig(baseConfig) {
  const id = loadDefaultId();
  if (!id) return baseConfig;

  const preset = loadPresets().find((item) => item.id === id);
  if (!preset) return baseConfig;

  const next = { ...baseConfig, ...preset.values };
  RUNTIME_KEYS.forEach((key) => {
    next[key] = baseConfig[key];
  });
  return next;
}
