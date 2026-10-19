// Convierte fixtures/export-base.json (volcado crudo de After, lo escribe export.jsx) en
// src/geometria-floss.json y completa "lineas" en src/escenas-floss.json.
//   node scripts/export.mjs            (solo convierte)
//   node scripts/export.mjs --after    (corre antes export.jsx en After 2026 abierto)
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ORIGEN_U, armarLinea } from '../src/engine.js';

const raiz = new URL('..', import.meta.url);
const ruta = (p) => fileURLToPath(new URL(p, raiz));

if (process.argv.includes('--after')) {
  rmSync(ruta('fixtures/export-err.txt'), { force: true });
  const jsx = ruta('scripts/export.jsx');
  execFileSync('osascript', ['-e', `tell application "Adobe After Effects 2026" to DoScript "$.evalFile(File('${jsx}'))"`]);
  if (existsSync(ruta('fixtures/export-err.txt'))) throw new Error('export.jsx: ' + readFileSync(ruta('fixtures/export-err.txt'), 'utf8'));
}

const crudo = JSON.parse(readFileSync(ruta('fixtures/export-base.json'), 'utf8'));
const doc = JSON.parse(readFileSync(ruta('src/escenas-floss.json'), 'utf8'));
const avisos = [];
const avisar = (m) => avisos.push(m);

// ---------- transformaciones ----------

const r5 = (v) => Math.round(v * 1e4) / 1e4;
// Matriz afín [a, b, c, d, e, f]: x' = a x + c y + e ; y' = b x + d y + f
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
// Transform de After: traslada a pos, rota, escala, resta el anchor.
function matriz(pos, rotDeg, esc, anchor) {
  const r = (rotDeg * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
  const sx = esc[0] / 100, sy = esc[1] / 100;
  const lin = [co * sx, si * sx, -si * sy, co * sy, 0, 0];
  const t = mul(lin, [1, 0, 0, 1, -anchor[0], -anchor[1]]);
  t[4] += pos[0]; t[5] += pos[1];
  return t;
}
const aplicar = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const aplicarLin = (m, [x, y]) => [m[0] * x + m[2] * y, m[1] * x + m[3] * y];
// Del espacio del NULL CONTROL de base a unidades de mundo.
const aU = (p) => [r5(p[0] + ORIGEN_U[0]), r5(p[1] + ORIGEN_U[1])];

// Posición: si tiene expresión manda la expresión (evaluada en t=0, con los ajustes en 0).
// Ej.: los marcadores de las letras guardan una X vieja pero se dibujan donde dice la expresión.
const posV = (p) => (p.e && p.eOn && p.ve !== undefined ? p.ve : p.v);
function matrizCapa(L) {
  const x = L.xf;
  const pos = x.pos ? posV(x.pos) : [posV(x.x), posV(x.y)];
  return matriz(pos, x.rot.v, x.scale.v, x.anchor.v);
}
function matrizGrupo(g) {
  if (!g.xf) return [1, 0, 0, 1, 0, 0];
  return matriz(g.xf.pos.v, g.xf.rot.v, g.xf.scale.v, g.xf.anchor.v);
}
function formaU(s, m) {
  return {
    v: s.v.map((p) => aU(aplicar(m, p))),
    in: s.i.map((p) => aplicarLin(m, p).map(r5)),
    out: s.o.map((p) => aplicarLin(m, p).map(r5)),
    cerrado: s.c,
  };
}

// ---------- utilidades sobre el volcado ----------

const letraDe = (expr) => (expr && /Ajuste (F|S1|S2)/.exec(expr)?.[1]) || null;
const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const curvaDeKeys = (k1, k2) => {
  if (Math.abs(k1.oS) > 1e-3 || Math.abs(k2.iS) > 1e-3) avisar(`curva con velocidad distinta de 0 (t=${k1.t.toFixed(3)}): se aproxima con velocidad 0`);
  return [r5(k1.oI / 100), 0, r5(1 - k2.iI / 100), 1];
};
function buscar(items, mn) {
  for (const it of items ?? []) if (it.mn === mn) return it;
  return null;
}
function todos(items, mn, out = []) {
  for (const it of items ?? []) {
    if (it.mn === mn) out.push(it);
    if (it.items) todos(it.items, mn, out);
  }
  return out;
}
// Multiplicador de un control de CTRL_DASHES en una expresión: thisComp...effect("DASH")(1)*0.5
function multiplicador(p, control) {
  if (!p?.e || !p.e.includes(`effect("${control}")`)) return null;
  const m = new RegExp(`effect\\("${control}"\\)\\(1\\)\\s*\\*\\s*([\\d.]+)`).exec(p.e);
  return m ? Number(m[1]) : 1;
}
// Trazo: ancho y punteado expresados como múltiplos de los controles globales.
function trazoDe(stroke) {
  const anchoMult = multiplicador(stroke.width, 'WIDTH');
  const t = { color: hex(stroke.color.v), ancho: anchoMult ?? null, anchoFijo: anchoMult == null ? stroke.width.v : null };
  if (stroke.dashes && stroke.enabled !== false) {
    const dash = stroke.dashes.find((d) => d.mn === 'ADBE Vector Stroke Dash 1');
    const gap = stroke.dashes.find((d) => d.mn === 'ADBE Vector Stroke Gap 1');
    const off = stroke.dashes.find((d) => d.mn === 'ADBE Vector Stroke Offset');
    if (dash) t.punteado = { dash: multiplicador(dash.p, 'DASH') ?? 1, gap: multiplicador(gap?.p, 'GAP') ?? 1, offset: multiplicador(off?.p, 'OFFSET') ?? 0 };
  }
  return t;
}

// ---------- tiempos de escenas ----------

const linea = armarLinea(doc);
const fps = crudo.comp.fps;
// Un tramo se ata a la escena que está quieta cuando arranca; si arranca durante un
// traslado, a la escena de destino con offset negativo (como el ajuste de la F). Así,
// estirar la parada de la escena anterior no lo deja colgado a mitad de viaje.
function tramo(k1, k2) {
  const E = linea.escenas;
  let e = E[0];
  for (let i = 0; i < E.length; i++) {
    if (k1.t + 1e-6 >= E[i].inicio) e = E[i];
    if (k1.t + 1e-6 >= E[i].finParada && i + 1 < E.length && k1.t < E[i + 1].inicio) e = E[i + 1];
  }
  return { escena: e.id, offset: r5(k1.t - e.inicio), dur: r5(k2.t - k1.t), curva: curvaDeKeys(k1, k2) };
}

// ---------- recorrido ----------

const ctrl = crudo.layers.find((l) => l.name === 'CTRL_DASHES');
const fx = Object.fromEntries(ctrl.fx.map((f) => [f.name, f.p.v]));
const nc = crudo.layers.find((l) => l.name.trim() === 'NULL CONTROL' && l.kind === 'null');

const geo = {
  version: 1,
  fuente: 'Flos log v7 empujes.aep, comp base (id 1). Generado por scripts/export.mjs; no editar a mano.',
  controles: { ancho: fx.WIDTH, dash: fx.DASH, gap: fx.GAP, offset: fx.OFFSET },
  logo: null,
  originales: {},
  lineas: [],
  marcadores: [],
  etiquetas: [],
};
const lineasDoc = {};

for (const L of crudo.layers) {
  if (L.kind === 'null') continue;
  if (L.parent !== nc.index) { avisar(`${L.name}: no cuelga del NULL CONTROL, se ignora`); continue; }
  if (Math.abs(L.xf.rot.v) > 1e-6 && L.kind === 'shape' && !todos(L.items, 'ADBE Vector Filter - Trim').length)
    avisar(`${L.name}: rotada ${L.xf.rot.v}°`);
  const esOriginal = /^ORIGINAL (F|S1|S2)$/.exec(L.name);
  if (!L.enabled && !esOriginal) continue;
  const M = matrizCapa(L);
  const orden = L.index;

  if (L.kind === 'text') {
    const t = L.text.v;
    const expr = L.xf.pos.e ?? '';
    const g = /content\("(Group \d+)"\)/.exec(expr)?.[1];
    const vi = Number(/points\(\)\[(\d+)\]/.exec(expr)?.[1]);
    const off = /q\[0\]\+([\d.]+)\*k\s*,\s*q\[1\]-([\d.]+)\*k/.exec(expr);
    geo.etiquetas.push({
      id: `ly${L.id}`, nombre: L.name, orden, letra: letraDe(L.xf.opacity.e), grupo: g, vertice: vi,
      desvio: off ? [Number(off[1]), -Number(off[2])] : [0, 0],
      fuente: t.font, tamano: t.fontSize, tracking: t.tracking, color: hex(t.fillColor),
    });
    continue;
  }
  if (L.kind !== 'shape') continue;

  // Logo
  if (L.name === 'Floss logo') {
    geo.logo = { id: `ly${L.id}`, orden, opacidad: L.xf.opacity.v / 100, grupos: [] };
    for (const g of L.items.filter((i) => i.mn === 'ADBE Vector Group' && i.enabled)) {
      const MG = mul(M, matrizGrupo(g));
      const fill = buscar(g.items, 'ADBE Vector Graphic - Fill');
      const paths = todos(g.items, 'ADBE Vector Shape - Group').filter((p) => p.enabled);
      let letra = null, curvaMorph = null;
      const formas = paths.map((p) => {
        const pr = p.path;
        if (pr.k?.length >= 2) {
          letra = letra ?? letraDe(pr.e);
          if (pr.k.length > 2) avisar(`logo ${g.name}: ${pr.k.length} keys de forma, se usan la primera y la última`);
          const k1 = pr.k[0], k2 = pr.k[pr.k.length - 1];
          // Medido en After: la forma avanza lineal con el ajuste (las keys de path tienen
          // velocidad 1 e influencia 16.7, que es una key lineal). Sin curva propia.
          curvaMorph = null;
          if (k1.v.v.length !== k2.v.v.length) avisar(`logo ${g.name}: las dos formas tienen distinta cantidad de vértices`);
          return { a: formaU(k1.v, MG), b: formaU(k2.v, MG) };
        }
        return { a: formaU(pr.v, MG), b: null };
      });
      geo.logo.grupos.push({
        id: g.name, letra, curvaMorph,
        relleno: fill ? hex(fill.color.v) : null,
        // Merge Paths de After sobre varios paths: se resuelve con evenodd (agujeros).
        regla: buscar(g.items, 'ADBE Vector Filter - Merge') ? 'evenodd' : 'nonzero',
        formas,
      });
    }
    continue;
  }

  // Marcadores: rectángulos rellenos
  const rect = todos(L.items, 'ADBE Vector Shape - Rect')[0];
  if (rect) {
    const g = L.items.find((i) => i.mn === 'ADBE Vector Group');
    const MG = mul(M, matrizGrupo(g));
    const centro = aU(aplicar(MG, rect.pos.v));
    const escX = L.xf.scale.v[0] / 100;
    if (Math.abs(rect.size.v[0] - rect.size.v[1]) > 1e-3) avisar(`${L.name}: marcador no cuadrado`);
    const xExpr = L.xf.x?.e ?? '';
    const dx = /\+\s*\(?\s*(-?[\d.]+)\s*\)?\s*\*\s*p\s*;?\s*$/.exec(xExpr.trim());
    const fill = todos(L.items, 'ADBE Vector Graphic - Fill')[0];
    geo.marcadores.push({
      id: `ly${L.id}`, nombre: L.name, orden, centro, lado: r5(rect.size.v[0] * escX),
      letra: letraDe(xExpr) ?? letraDe(L.xf.scale.e), dx: dx ? r5(Number(dx[1])) : 0,
      relleno: fill ? hex(fill.color.v) : '#FFFFFF',
    });
    continue;
  }

  // Trazos: líneas de construcción y contornos ORIGINAL
  const paths = todos(L.items, 'ADBE Vector Shape - Group').filter((p) => p.enabled);
  const stroke = todos(L.items, 'ADBE Vector Graphic - Stroke').find((s) => s.enabled);
  if (!paths.length || !stroke) {
    if (todos(L.items, 'ADBE Vector Filter - Trim').some((t) => t.start.k)) avisar(`${L.name}: tiene Trim animado pero no dibuja nada (sin path), se ignora`);
    continue;
  }
  const g = L.items.find((i) => i.mn === 'ADBE Vector Group');
  const MG = mul(M, matrizGrupo(g));
  const forma = formaU(paths[0].path.v, MG);
  if (paths.length > 1) avisar(`${L.name}: ${paths.length} paths, se usa el primero`);
  if (forma.v.length < 2) { avisar(`${L.name}: path de ${forma.v.length} vértice, no dibuja nada, se ignora`); continue; }
  const trazo = trazoDe(stroke);

  if (esOriginal) {
    geo.originales[esOriginal[1]] = { id: `ly${L.id}`, orden, visible: L.enabled, forma, trazo };
    if (!L.enabled) avisar(`${L.name}: deshabilitada en After, se exporta con visible=false`);
    continue;
  }

  // Trim animado a nivel capa (Start 100 -> 0 entra, 0 -> 100 sale)
  const trims = L.items.filter((i) => i.mn === 'ADBE Vector Filter - Trim');
  const trim = trims.find((t) => t.start.k) ?? null;
  const id = `ly${L.id}`;
  const lin = { id, nombre: L.name, orden, forma, trazo, animada: !!trim };
  geo.lineas.push(lin);
  if (trim) {
    const k = trim.start.k;
    const ent = k.length >= 2 ? tramo(k[0], k[1]) : null;
    const sal = k.length >= 4 ? tramo(k[2], k[3]) : null;
    if (k.length !== 4) avisar(`${L.name}: ${k.length} keys de Trim Start (se esperaban 4)`);
    lineasDoc[id] = { nombre: L.name, entra: ent, sale: sal };
    const t1 = k[0].t;
    if (L.inPoint > t1 + 0.5 / fps)
      avisar(`${L.name}: la capa aparece en ${L.inPoint.toFixed(3)} s pero el trazo arranca en ${t1.toFixed(3)} s (en After se ve aparecer ya empezado)`);
  }
}

// Las etiquetas leen un vértice del logo: verificar que exista.
for (const e of geo.etiquetas) {
  const g = geo.logo.grupos.find((x) => x.id === e.grupo);
  if (!g || !g.formas[0].a.v[e.vertice]) avisar(`etiqueta ${e.nombre}: no encuentro ${e.grupo} vértice ${e.vertice}`);
}

writeFileSync(ruta('src/geometria-floss.json'), JSON.stringify(geo, null, 1) + '\n');
doc.lineas = lineasDoc;
writeFileSync(ruta('src/escenas-floss.json'), JSON.stringify(doc, null, 2) + '\n');

console.log(`geometria-floss.json: logo ${geo.logo.grupos.length} grupos, ${geo.lineas.length} líneas (${Object.keys(lineasDoc).length} animadas), ${geo.marcadores.length} marcadores, ${geo.etiquetas.length} etiquetas, originales ${Object.keys(geo.originales).join(' ')}`);
if (avisos.length) console.log('Avisos:\n  ' + avisos.join('\n  '));
