// Copia el runtime WASM de MediaPipe desde node_modules a public/.
//
// Se sirve local en vez de por CDN para que el hand-tracking funcione sin
// internet — es una tool que se muestra en reuniones. Pero el WASM son 34MB y
// no tiene sentido commitearlo: sale del paquete npm, que ya está pineado a una
// versión exacta. El modelo .task sí está en git porque no viene en npm.
//
// Corre en `predev` y `prebuild`, así que basta con `npm install`.

import { cp, mkdir, access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, "..");
const root = resolve(app, "../..");

const from = resolve(root, "node_modules/@mediapipe/tasks-vision/wasm");
const to = resolve(app, "public/mediapipe/wasm");

const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

if (!(await exists(from))) {
  console.error("✗ falta node_modules/@mediapipe/tasks-vision — corré `npm install`");
  process.exit(1);
}

// El WASM y el JS que lo carga tienen que ser de la MISMA versión: si no, el
// error que tira es críptico. Si ya está copiado de una versión distinta, se
// pisa.
const pkg = JSON.parse(
  await readFile(resolve(root, "node_modules/@mediapipe/tasks-vision/package.json"), "utf8"),
);

await mkdir(dirname(to), { recursive: true });
await cp(from, to, { recursive: true });
console.log(`mediapipe wasm ${pkg.version} → public/mediapipe/wasm/`);

if (!(await exists(resolve(app, "public/mediapipe/hand_landmarker.task")))) {
  console.warn("⚠ falta public/mediapipe/hand_landmarker.task (está en git, revisá el checkout)");
}
