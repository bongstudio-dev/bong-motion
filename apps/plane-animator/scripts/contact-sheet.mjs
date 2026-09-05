// Genera las hojas de contacto de docs/preview/.
//
// No corre en CI ni forma parte del build: son PNG commiteados que se
// regeneran a mano cuando cambia un template. Por eso no agrega ninguna
// dependencia — usa el Chrome que ya está instalado en la máquina, en modo
// headless con SwiftShader, contra el servidor de desarrollo de Vite.
//
//   node apps/plane-animator/scripts/contact-sheet.mjs
//
// Chrome dibuja la MISMA página que se puede abrir a mano en
// /contact-sheet.html, que a su vez usa el renderer real. No hay un segundo
// camino de dibujo: si la hoja miente, el preview miente igual.

import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(app, "../..");
const salida = resolve(repo, "docs/preview");

const PUERTO = 5199;
const FAMILIAS = ["tunnel", "wall", "hero"];
const RATIOS = ["4:5", "9:16"];

// Mismo tamaño que declara el <body> del harness.
const VENTANA = "1200,968";

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const existe = async (p) => {
  try {
    await (await import("node:fs/promises")).access(p);
    return true;
  } catch {
    return false;
  }
};

async function buscarChrome() {
  for (const c of CHROME) if (await existe(c)) return c;
  throw new Error(
    "No encontré Chrome ni Chromium. Instalá uno, o abrí a mano\n" +
      `  http://localhost:5175/contact-sheet.html?tpl=tunnel&ratio=4:5`,
  );
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarServidor(url, intentos = 60) {
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await esperar(500);
  }
  return false;
}

const correr = (cmd, args) =>
  new Promise((ok, fail) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) =>
      code === 0 ? ok() : fail(new Error(`${cmd} salió con ${code}\n${err.slice(-800)}`)),
    );
  });

const chrome = await buscarChrome();

console.log(`Levantando vite en :${PUERTO}…`);
const vite = spawn("npx", ["vite", "--port", String(PUERTO), "--strictPort"], {
  cwd: app,
  stdio: ["ignore", "ignore", "pipe"],
});
let viteErr = "";
vite.stderr.on("data", (d) => (viteErr += d));

try {
  if (!(await esperarServidor(`http://localhost:${PUERTO}/contact-sheet.html`))) {
    throw new Error(`El dev server no levantó.\n${viteErr.slice(-800)}`);
  }

  await rm(salida, { recursive: true, force: true });
  await mkdir(salida, { recursive: true });

  for (const tpl of FAMILIAS) {
    for (const ratio of RATIOS) {
      const nombre = `${tpl}-${ratio.replace(":", "x")}.png`;
      const destino = resolve(salida, nombre);
      const url = `http://localhost:${PUERTO}/contact-sheet.html?tpl=${tpl}&ratio=${encodeURIComponent(ratio)}`;

      await correr(chrome, [
        "--headless",
        "--disable-gpu",
        // SwiftShader: no hay GPU en headless, y sin esto el canvas sale negro.
        "--enable-unsafe-swiftshader",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        `--window-size=${VENTANA}`,
        // Le da tiempo al módulo a importar, compilar los shaders y dibujar.
        "--virtual-time-budget=8000",
        `--screenshot=${destino}`,
        url,
      ]);
      console.log(`  ✓ docs/preview/${nombre}`);
    }
  }
  console.log(`\n${FAMILIAS.length * RATIOS.length} hojas en docs/preview/\n`);
} finally {
  vite.kill("SIGTERM");
}
