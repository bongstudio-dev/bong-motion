// Floss Tween: operaciones puras sobre el documento (escenas-floss.json).
// Cada una recibe un doc y devuelve uno nuevo; la UI las compone con el historial.
// Un "tramo" es { escena, offset, dur, curva }: lo que tienen los eventos y las líneas.
import { armarLinea } from './engine.js';

export const TRANSICION_DEF = { dur: 0.8, curva: [1, 0, 0, 1] };
const clon = (o) => JSON.parse(JSON.stringify(o));
const r3 = (v) => Math.round(v * 1000) / 1000;

// ---------- carga ----------

export function validar(doc) {
  if (!doc || doc.version !== 1) return 'El archivo no es una animación de Floss Tween (versión 1).';
  if (!Array.isArray(doc.escenas) || !doc.escenas.length) return 'No tiene escenas.';
  const ids = new Set();
  for (const e of doc.escenas) {
    if (!e.id || ids.has(e.id)) return `Escena sin id o repetida: ${e.id}`;
    ids.add(e.id);
    if (!Array.isArray(e.foco) || e.foco.length !== 2 || !(e.zoom > 0) || !(e.parada >= 0)) return `Escena "${e.id}" incompleta.`;
  }
  const tramos = [...(doc.eventos ?? [])];
  for (const l of Object.values(doc.lineas ?? {})) { if (l.entra) tramos.push(l.entra); if (l.sale) tramos.push(l.sale); }
  for (const t of tramos) if (!ids.has(t.escena)) return `Un evento apunta a una escena que no existe: ${t.escena}`;
  return null;
}

// Todas las escenas llevan transición, también la última (el motor la ignora): así
// agregar o reordenar escenas nunca deja a una sin curva.
export function normalizar(doc) {
  const d = clon(doc);
  d.eventos ??= [];
  d.lineas ??= {};
  for (const e of d.escenas) {
    e.transicion ??= clon(TRANSICION_DEF);
    e.deriva ??= null;
  }
  return d;
}

// ---------- tramos ----------

// Un camino identifica un tramo dentro del doc: ['eventos', 2] o ['lineas', 'ly232', 'entra'].
export function getTramo(doc, camino) {
  return camino.reduce((o, k) => o[k], doc);
}

function todosLosTramos(doc) {
  const out = doc.eventos.map((_, i) => ['eventos', i]);
  for (const [id, l] of Object.entries(doc.lineas)) {
    if (l.entra) out.push(['lineas', id, 'entra']);
    if (l.sale) out.push(['lineas', id, 'sale']);
  }
  return out;
}

// Re-ata un tramo a otra escena sin moverlo en el tiempo (con la línea de tiempo `lin`).
function reatar(tramo, escenaId, lin) {
  const t0 = lin.porId[tramo.escena].inicio + tramo.offset;
  tramo.escena = escenaId;
  tramo.offset = r3(t0 - lin.porId[escenaId].inicio);
}

// ---------- escenas ----------

export function editarEscena(doc, id, patch) {
  const d = clon(doc);
  const e = d.escenas.find((x) => x.id === id);
  if (!e) return doc;
  Object.assign(e, clon(patch));
  if (e.parada < 0) e.parada = 0;
  return d;
}

export function editarTransicion(doc, id, patch) {
  const d = clon(doc);
  const e = d.escenas.find((x) => x.id === id);
  if (!e) return doc;
  Object.assign(e.transicion, clon(patch));
  if (e.transicion.dur < 0.02) e.transicion.dur = 0.02;
  if (e.transicion.curvaFoco === null) delete e.transicion.curvaFoco;
  return d;
}

function idLibre(doc, base) {
  const usados = new Set(doc.escenas.map((e) => e.id));
  let n = 2, id = `${base}-${n}`;
  while (usados.has(id)) id = `${base}-${++n}`;
  return id;
}

// La copia entra justo después de la original, con parada de 1 s y sin deriva.
export function duplicarEscena(doc, id) {
  const d = clon(doc);
  const i = d.escenas.findIndex((x) => x.id === id);
  if (i < 0) return { doc, id: null };
  const copia = clon(d.escenas[i]);
  copia.id = idLibre(d, d.escenas[i].id);
  copia.nombre = `${d.escenas[i].nombre} copia`;
  copia.parada = 1;
  copia.deriva = null;
  d.escenas.splice(i + 1, 0, copia);
  return { doc: d, id: copia.id };
}

export function borrarEscena(doc, id) {
  if (doc.escenas.length <= 1) return doc;
  const lin = armarLinea(doc);
  const d = clon(doc);
  const i = d.escenas.findIndex((x) => x.id === id);
  if (i < 0) return doc;
  const destino = d.escenas[i > 0 ? i - 1 : i + 1];
  for (const camino of todosLosTramos(d)) {
    const t = getTramo(d, camino);
    if (t.escena === id) reatar(t, destino.id, lin);
  }
  d.escenas.splice(i, 1);
  return d;
}

export function moverEscena(doc, id, dir) {
  const d = clon(doc);
  const i = d.escenas.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= d.escenas.length) return doc;
  [d.escenas[i], d.escenas[j]] = [d.escenas[j], d.escenas[i]];
  return d;
}

// Escena que está en pantalla en el tiempo t (la parada o el viaje que sale de ella).
export function escenaEn(linea, t) {
  const E = linea.escenas;
  for (const e of E) if (t < e.finTransicion || e === E[E.length - 1]) return e;
  return E[E.length - 1];
}

// ---------- tramos: edición ----------

// Mueve el inicio de un conjunto de tramos a `delta` segundos de donde estaban.
export function desplazarTramos(doc, caminos, delta) {
  const d = clon(doc);
  for (const c of caminos) { const t = getTramo(d, c); t.offset = r3(t.offset + delta); }
  return d;
}

export function cambiarDurTramos(doc, caminos, delta) {
  const d = clon(doc);
  for (const c of caminos) { const t = getTramo(d, c); t.dur = Math.max(0.02, r3(t.dur + delta)); }
  return d;
}

export function fijarTramos(doc, caminos, patch) {
  const d = clon(doc);
  for (const c of caminos) Object.assign(getTramo(d, c), clon(patch));
  return d;
}

// Re-ata un evento a otra escena sin cambiarle el momento.
export function reatarEvento(doc, idx, escenaId) {
  const lin = armarLinea(doc);
  const d = clon(doc);
  reatar(d.eventos[idx], escenaId, lin);
  return d;
}

// ---------- vista de efectos para la timeline ----------

const SEPARACION_GRUPO = 1.2; // segundos entre arranques para que dos líneas sean grupos distintos

// Eventos y grupos de líneas con su tiempo absoluto y un carril para que no se pisen.
export function efectos(doc, linea) {
  const abs = (t) => {
    const e = linea.porId[t.escena];
    const t0 = e.inicio + t.offset;
    return [t0, t0 + t.dur];
  };
  const items = [];
  doc.eventos.forEach((ev, i) => {
    const [t0, t1] = abs(ev);
    const label = ev.tipo === 'ajuste' ? `Ajuste ${ev.letra}` : ev.tipo === 'salidaOriginales' ? 'Salen originales' : ev.tipo;
    items.push({ key: `ev${i}`, tipo: 'evento', idx: i, label, caminos: [['eventos', i]], t0, t1 });
  });
  for (const lado of ['entra', 'sale']) {
    const filas = Object.entries(doc.lineas)
      .filter(([, l]) => l[lado])
      .map(([id, l]) => ({ id, camino: ['lineas', id, lado], t0: abs(l[lado])[0], t1: abs(l[lado])[1] }))
      .sort((a, b) => a.t0 - b.t0 || (a.id < b.id ? -1 : 1));
    let grupo = null;
    const grupos = [];
    for (const f of filas) {
      if (grupo && f.t0 - grupo.ult <= SEPARACION_GRUPO) { grupo.filas.push(f); grupo.ult = f.t0; }
      else { grupo = { filas: [f], ult: f.t0 }; grupos.push(grupo); }
    }
    for (const g of grupos) {
      const ids = g.filas.map((f) => f.id).sort();
      items.push({
        key: `${lado}:${ids[0]}`, tipo: 'lineas', lado, label: `Líneas ${lado === 'entra' ? 'entran' : 'salen'} (${g.filas.length})`,
        caminos: g.filas.map((f) => f.camino), t0: Math.min(...g.filas.map((f) => f.t0)), t1: Math.max(...g.filas.map((f) => f.t1)),
      });
    }
  }
  items.sort((a, b) => a.t0 - b.t0);
  const finCarril = [];
  for (const it of items) {
    let c = finCarril.findIndex((fin) => fin <= it.t0 + 1e-6);
    if (c < 0) c = finCarril.length;
    finCarril[c] = it.t1;
    it.carril = c;
  }
  return items;
}
