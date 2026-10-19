// Compara el motor contra el muestreo cuadro a cuadro del After (fixtures/after-samples.txt,
// generado con scripts/sample.jsx). Si el rig o el JSON de escenas se tocan, esto avisa.
import { readFileSync } from 'node:fs';
import { armarLinea, camaraEn, proyectar, estadoEn } from '../src/engine.js';

const aqui = new URL('..', import.meta.url);
const doc = JSON.parse(readFileSync(new URL('src/escenas-floss.json', aqui), 'utf8'));
const txt = readFileSync(new URL('fixtures/after-samples.txt', aqui), 'utf8').split('\n');
const ini = txt.findIndex((l) => l.startsWith('SAMPLES'));
const filas = txt.slice(ini + 1).filter(Boolean).map((l) => l.split(',').map(Number));

const linea = armarLinea(doc);
function distSegmento(px, py, [x1, y1], [x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  const u = l2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2)) : 0;
  return Math.hypot(px - (x1 + u * dx), py - (y1 + u * dy));
}
const ORIGEN = [303.3, 177.9];
const puntos = [[0, 0], [100, 0], [0, 100]];

let peor = { err: 0 }, sumaErr = 0, n = 0, peorZoom = 0, peorAjuste = 0;
for (const f of filas) {
  const [t, , , , aF, aS1, aS2, sAE] = f;
  const cam = camaraEn(linea, t);
  peorZoom = Math.max(peorZoom, Math.abs(cam.zoom - sAE) / sAE);
  puntos.forEach((c, j) => {
    // Tolerancia de un cuadro: la curva [1,0,0,1] tiene tangente vertical en el medio
    // (la cámara salta cientos de px entre dos cuadros), y el modelo de escenas unifica
    // keys de Zoom y Foco que en el After estaban corridas ~0.01 s. Se mide la
    // trayectoria, no ese corrimiento.
    // Distancia del punto del After al tramo de trayectoria del motor (polilínea), no al
    // punto más cercano: en el salto un muestreo por puntos nunca alcanza.
    let err = Infinity, prev = null;
    const ax = f[8 + j * 2], ay = f[9 + j * 2];
    for (let d = -0.034; d <= 0.0341; d += 0.001) {
      const q = proyectar([c[0] + ORIGEN[0], c[1] + ORIGEN[1]], camaraEn(linea, t + d), 1920, 1080);
      if (prev) err = Math.min(err, distSegmento(ax, ay, prev, q));
      prev = q;
    }
    sumaErr += err; n++;
    if (err > peor.err) peor = { err, t, punto: c };
  });
  const est = estadoEn(doc, linea, t);
  peorAjuste = Math.max(peorAjuste,
    Math.abs(est.ajustes.F.p * 100 - aF), Math.abs(est.ajustes.S1.p * 100 - aS1), Math.abs(est.ajustes.S2.p * 100 - aS2));
}

const fmt = (v, d = 2) => v.toFixed(d);
console.log(`floss-tween: ${filas.length} cuadros, duración ${fmt(linea.duracion)} s`);
console.log(`  posición en pantalla: error medio ${fmt(sumaErr / n)} px, peor ${fmt(peor.err)} px en t=${fmt(peor.t, 3)}`);
console.log(`  zoom: peor desvío ${fmt(peorZoom * 100)} %`);
console.log(`  ajustes F/S1/S2: peor desvío ${fmt(peorAjuste)} puntos de 100`);

// Umbrales: error medio < 1 px; peor < 15 px. El peor cae en el traslado F -> S1, donde
// en el After las keys de Foco arrancan 0.013 s antes que las de Zoom y con otra
// duración; el modelo las unifica (son ~1.4 unidades de mundo con zoom 540).
const ok = sumaErr / n < 1 && peor.err < 15 && peorAjuste < 1;
if (!ok) { console.error('floss-tween: el motor se aleja del After'); process.exit(1); }

// La geometría exportada se dibuja entera, cuadro a cuadro, sin errores ni NaN.
import { primitivas } from '../src/dibujo.js';
const geo = JSON.parse(readFileSync(new URL('src/geometria-floss.json', aqui), 'utf8'));
let prims = 0;
for (let t = 0; t <= linea.duracion; t += 1 / doc.fps) {
  for (const p of primitivas(geo, doc, linea, t, 1080, 1350).prims) {
    prims++;
    if (/NaN|undefined/.test(p.d ?? '') || Number.isNaN(p.opacity)) { console.error(`floss-tween: primitiva rota en t=${t.toFixed(3)}`); process.exit(1); }
  }
}
console.log(`  dibujo: ${prims} primitivas en vertical 1080x1350, sin errores`);
