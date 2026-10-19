// Las operaciones de edición no tienen que romper el documento ni mover lo que no tocan.
import { readFileSync } from 'node:fs';
import { armarLinea, estadoEn } from '../src/engine.js';
import * as O from '../src/docops.js';

const aqui = new URL('..', import.meta.url);
const base = O.normalizar(JSON.parse(readFileSync(new URL('src/escenas-floss.json', aqui), 'utf8')));
let fallos = 0;
const ok = (cond, msg) => { if (!cond) { fallos++; console.error('  FALLA: ' + msg); } };
const cerca = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol;

ok(O.validar(base) === null, 'el doc de Floss valida: ' + O.validar(base));
ok(O.validar({ version: 2 }) !== null, 'rechaza otra versión');

const L0 = armarLinea(base);
const fx0 = O.efectos(base, L0);
ok(fx0.length === 3 + 1 + 4 || fx0.length >= 7, `efectos: ${fx0.length} items`);
ok(fx0.every((f) => f.t1 > f.t0 && Number.isInteger(f.carril)), 'efectos con tiempos y carril');
const nl = fx0.filter((f) => f.tipo === 'lineas').reduce((n, f) => n + f.caminos.length, 0);
ok(nl === 30, `los 15 pares de líneas están en grupos (${nl}/30)`);

// Alargar una parada corre todo lo que sigue, y lo atado a escenas anteriores se queda.
{
  const d = O.editarEscena(base, 'f', { parada: base.escenas[1].parada + 1 });
  const L = armarLinea(d);
  ok(cerca(L.duracion, L0.duracion + 1), 'la duración crece 1 s');
  ok(cerca(L.porId.s1.inicio, L0.porId.s1.inicio + 1), 'S1 arranca 1 s después');
  ok(cerca(L.porId.general.inicio, L0.porId.general.inicio), 'General no se mueve');
  const ajF0 = estadoEn(base, L0, L0.porId.f.inicio + 0.5).ajustes.F.p;
  const ajF = estadoEn(d, L, L.porId.f.inicio + 0.5).ajustes.F.p;
  ok(cerca(ajF, ajF0), 'el ajuste de F sigue atado a su escena');
}

// Duplicar, mover y borrar mantienen válido el doc y los tiempos absolutos de lo atado.
{
  const { doc: d, id } = O.duplicarEscena(base, 'f');
  ok(O.validar(d) === null && d.escenas.length === base.escenas.length + 1 && id === 'f-2', 'duplicar');
  const m = O.moverEscena(d, id, +1);
  ok(m.escenas[2].id === 's1' && m.escenas[3].id === id, 'mover hacia adelante');
  ok(O.validar(m) === null, 'mover deja el doc válido');
  const b = O.borrarEscena(d, id);
  ok(JSON.stringify(b.escenas.map((e) => e.id)) === JSON.stringify(base.escenas.map((e) => e.id)), 'borrar la copia vuelve al original');
}
{
  // Borrar una escena con eventos atados: los eventos conservan su momento en la línea vieja.
  const Lb = armarLinea(base);
  const abs0 = Lb.porId.s1.inicio + base.eventos[1].offset;
  const d = O.borrarEscena(base, 's1');
  ok(O.validar(d) === null, 'borrar s1 deja el doc válido');
  const ev = d.eventos[1];
  const Ld = armarLinea(d);
  ok(ev.escena !== 's1' && cerca(Ld.porId[ev.escena].inicio + ev.offset, abs0, 0.01), 'el ajuste de S1 se re-ató sin moverse');
  ok(O.borrarEscena({ ...base, escenas: [base.escenas[0]] }, 'general').escenas.length === 1, 'no deja el doc sin escenas');
}

// Transición y tramos
{
  const d = O.editarTransicion(base, 'f', { dur: 0.001 });
  ok(d.escenas[1].transicion.dur >= 0.02, 'duración mínima de transición');
  const e = O.editarTransicion(O.editarTransicion(base, 'f', { curvaFoco: [0, 0, 1, 1] }), 'f', { curvaFoco: null });
  ok(!('curvaFoco' in e.escenas[1].transicion), 'curvaFoco null la quita');
  const fx = O.efectos(base, L0).find((f) => f.tipo === 'lineas' && f.lado === 'entra');
  const d2 = O.desplazarTramos(base, fx.caminos, 0.5);
  const fx2 = O.efectos(d2, armarLinea(d2)).find((f) => f.key === fx.key);
  ok(fx2 && cerca(fx2.t0, fx.t0 + 0.5) && cerca(fx2.t1, fx.t1 + 0.5), 'desplazar un grupo de líneas lo corre entero');
  const d3 = O.cambiarDurTramos(base, fx.caminos, -10);
  ok(O.getTramo(d3, fx.caminos[0]).dur === 0.02, 'duración mínima de tramo');
  const d4 = O.reatarEvento(base, 1, 's2');
  const L4 = armarLinea(d4);
  ok(cerca(L4.porId.s2.inicio + d4.eventos[1].offset, L0.porId.s1.inicio + base.eventos[1].offset, 0.01), 'reatar un evento no lo mueve');
}

// Todo lo anterior no muta el original.
ok(JSON.stringify(base) === JSON.stringify(O.normalizar(JSON.parse(readFileSync(new URL('src/escenas-floss.json', aqui), 'utf8')))), 'las operaciones no mutan el doc de entrada');

console.log(fallos ? `docops: ${fallos} fallas` : 'docops: OK');
if (fallos) process.exit(1);
