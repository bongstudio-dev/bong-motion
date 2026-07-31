// Fuentes: las instaladas en la máquina y las que sube el usuario.
//
// Las subidas viven en memoria por sesión, con el mismo criterio que los assets
// del plane-animator: en localStorage no entra un binario, y una entrada que
// apunta a un archivo que ya no está es una referencia rota disfrazada de
// preset. Lo que SÍ se persiste es el nombre de la familia en la capa de texto,
// así que volver a subir el archivo alcanza para recuperar la pieza.

const custom = new Map(); // family -> { family, fileName }
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn());

export function subscribeFonts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const customFonts = () => [...custom.values()];

// Nombre de familia a partir del archivo: "PPNeueMontreal-Bold.otf" →
// "PPNeueMontreal-Bold". Es lo que se guarda en la capa, así que tiene que ser
// estable y reconocible cuando el usuario vuelva a subir el mismo archivo.
const familyFromFile = (name) => name.replace(/\.[^.]+$/, "").trim() || "Custom";

export async function loadCustomFont(file) {
  const family = familyFromFile(file.name);
  const buffer = await file.arrayBuffer();
  const face = new FontFace(family, buffer);
  await face.load();
  document.fonts.add(face);
  custom.set(family, { family, fileName: file.name });
  notify();
  return family;
}

// Fuentes instaladas en la máquina (Local Font Access API — Chrome/Edge con
// permiso). Si no está disponible se sigue con la lista fija: el campo de
// familia custom permite tipear cualquiera igual.
export async function queryInstalledFonts() {
  if (typeof window.queryLocalFonts !== "function") {
    throw new Error("unsupported");
  }
  const data = await window.queryLocalFonts();
  return [...new Set(data.map((f) => f.family))].sort((a, b) =>
    a.localeCompare(b),
  );
}

// Antes de rasterizar hay que esperar a que las fuentes estén listas: si no, el
// primer frame del export sale con la fallback y el archivo miente.
export async function ensureFontsReady() {
  try {
    await document.fonts?.ready;
  } catch {
    /* sin Font Loading API seguimos: peor tipografía, no un export roto */
  }
}
