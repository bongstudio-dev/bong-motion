// Renderiza el motor a PNG (Chrome headless) en varios tiempos, le pide a After los mismos
// cuadros y arma una comparación lado a lado en fixtures/frames/. Necesita After abierto.
//   node scripts/verificar.mjs 0 0.3 3.3
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { armarLinea } from '../src/engine.js';
import { primitivas, aSVG } from '../src/dibujo.js';

const raiz = new URL('..', import.meta.url);
const ruta = (p) => fileURLToPath(new URL(p, raiz));
const geo = JSON.parse(readFileSync(ruta('src/geometria-floss.json'), 'utf8'));
const doc = JSON.parse(readFileSync(ruta('src/escenas-floss.json'), 'utf8'));
const linea = armarLinea(doc);
const W = 1920, H = 1080;
// After solo muestrea en cuadros: redondear al cuadro más cercano.
const cuadro = (t) => Math.round(t * doc.fps) / doc.fps;
const tiempos = (process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [0, 0.3, 2.2, 3.3, 5.6, 7.6, 9.95, 11.0]).map(cuadro);
const dir = ruta('fixtures/frames/');
mkdirSync(dir, { recursive: true });

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
for (const t of tiempos) {
  const svg = aSVG(primitivas(geo, doc, linea, t, W, H).prims, W, H, doc.fondo);
  const f = `${dir}motor-${t.toFixed(3)}.svg`;
  writeFileSync(f, svg);
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${W},${H}`, `--screenshot=${dir}motor-${t.toFixed(3)}.png`, 'file://' + f], { stdio: 'ignore' });
}

rmSync(`${dir}err.txt`, { force: true });
const jsx = ruta('scripts/frames-after.jsx');
const pre = `var TIEMPOS=[${tiempos.join(',')}]; $.evalFile(File('${jsx}'));`;
execFileSync('osascript', ['-e', `tell application "Adobe After Effects 2026" to DoScript "${pre}"`]);
if (existsSync(`${dir}err.txt`)) throw new Error(readFileSync(`${dir}err.txt`, 'utf8'));
console.log(dir, tiempos.map((t) => t.toFixed(3)).join(' '));
