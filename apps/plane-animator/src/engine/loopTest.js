// Contrato del loop. BRIEF §7.
//
// En el palette-animator alcanzaba con getFrame(0) ≈ getFrame(0.9999). Con
// assets rotando hay un caso nuevo: un carousel que avanza un slot por ciclo
// tiene movimiento continuo, pero el frame final NO es igual al inicial —
// cada slot quedó con la imagen del siguiente.
//
//   El loop cierra si y sólo si el avance total de slots durante la grabación
//   es múltiplo de la cantidad de assets visibles:
//   (cycles × slotsPerCycle) % assetCount === 0
//
// Este test compara getScene(0) contra getScene(0.9999) INCLUYENDO assetIndex,
// ponderando por opacidad: un plano fuera de cuadro (o con opacidad ~0) puede
// teletransportarse sin romper nada, porque no se ve.

import { getScene, resolveTemplate, resolveParams, visibleAssets } from "./getScene.js";
import { stageOf, visibleAt } from "./camera.js";
import { gcd, lcm, mod } from "../utils/math.js";

const TAU = Math.PI * 2;

// Distancia angular mínima entre dos ángulos: 0 y 2π son el mismo estado.
const angleDist = (a, b) => {
  const d = Math.abs(mod(a - b, TAU));
  return d > Math.PI ? TAU - d : d;
};

// Un plano fuera del frustum no se ve aunque tenga opacidad 1. Se mide contra
// el área visible a SU profundidad, no a z = 0.
//
// Además se pondera por escorzo: un plano de canto a cámara proyecta área cero.
// No es un detalle — es el escondite que usa `orbit` para cambiar de asset, y
// sin esto el test marcaría como roto un cambio que nadie puede ver.
function visibility(plane, stage, camera) {
  if (plane.opacity <= 0.001) return 0;

  const view = visibleAt(plane.pos[2], stage, camera);
  const reach = Math.max(plane.size[0], plane.size[1]) / 2;
  if (Math.abs(plane.pos[0]) - reach > view.w / 2) return 0;
  if (Math.abs(plane.pos[1]) - reach > view.h / 2) return 0;

  // Normal del plano: (0,0,1) rotada por el Euler XYZ que usa three.
  const [rx, ry] = plane.rot;
  const n = [
    Math.sin(ry),
    -Math.cos(ry) * Math.sin(rx),
    Math.cos(ry) * Math.cos(rx),
  ];
  // Dirección de vista, de cámara al plano.
  const v = [
    plane.pos[0] - camera.position[0],
    plane.pos[1] - camera.position[1],
    plane.pos[2] - camera.position[2],
  ];
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  const facing = Math.abs((n[0] * v[0] + n[1] * v[1] + n[2] * v[2]) / len);

  return plane.opacity * facing;
}

// Comparación de los dos extremos del loop.
//
// NO se comparan los planos por id. En un carousel cada plano avanza un slot
// por ciclo: el plano p2 termina donde estaba p1 y por id parecería que se
// movió medio stage, cuando el FRAME es idéntico. Lo que tiene que cerrar es la
// imagen renderizada, así que se emparejan los planos visibles por posición y
// recién ahí se comparan atributos (incluido assetIndex — BRIEF §7).
function compare(state, eps) {
  const stage = stageOf(state);
  const minSide = Math.min(stage.w, stage.h);
  const a = getScene(0, state);
  const b = getScene(1 - eps, state);

  const seen = (scene) =>
    scene.planes
      .map((pl) => ({ pl, vis: visibility(pl, stage, scene.camera) }))
      .filter((e) => e.vis > 0.005);

  const A = seen(a);
  const B = seen(b);
  const taken = new Set();

  let maxDelta = 0;
  let maxOpacity = 0;
  let assetShift = 0;

  for (const ea of A) {
    // Vecino más cercano todavía libre. Con ≤ 24 planos el O(n²) es gratis y
    // evita los empates raros de un sort lexicográfico.
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < B.length; i++) {
      if (taken.has(i)) continue;
      const p = B[i].pl.pos;
      const d =
        Math.abs(ea.pl.pos[0] - p[0]) +
        Math.abs(ea.pl.pos[1] - p[1]) +
        Math.abs(ea.pl.pos[2] - p[2]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }

    // Un plano visible que no tiene par del otro lado es un pop entero.
    if (best < 0) {
      maxOpacity = Math.max(maxOpacity, ea.vis);
      continue;
    }
    taken.add(best);

    const pa = ea.pl;
    const pb = B[best].pl;
    const vis = Math.max(ea.vis, B[best].vis);

    const dPos = bestD / minSide;
    const dSize =
      (Math.abs(pa.size[0] - pb.size[0]) + Math.abs(pa.size[1] - pb.size[1])) /
      minSide;
    const dRot =
      (angleDist(pa.rot[0], pb.rot[0]) +
        angleDist(pa.rot[1], pb.rot[1]) +
        angleDist(pa.rot[2], pb.rot[2])) /
      Math.PI;

    // Ponderado por visibilidad: un teletransporte invisible no cuenta.
    maxDelta = Math.max(maxDelta, (dPos + dSize + dRot) * vis);
    maxOpacity = Math.max(maxOpacity, Math.abs(ea.vis - B[best].vis));
    // Sin assets cargados el índice es -1 en todos: ahí lo que distingue a un
    // plano de otro es el número del placeholder. Sin esto, componer antes de
    // tener las imágenes daría un "cierra ✓" que después no se cumple.
    if (pa.assetIndex !== pb.assetIndex || pa.placeholder !== pb.placeholder) {
      assetShift = Math.max(assetShift, vis);
    }
  }

  for (let i = 0; i < B.length; i++) {
    if (!taken.has(i)) maxOpacity = Math.max(maxOpacity, B[i].vis);
  }

  return {
    closes: maxDelta < 0.01 && maxOpacity < 0.02 && assetShift < 0.02,
    maxDelta,
    maxOpacity,
    assetShift,
  };
}

// Ciclos mínimos que cierran, por la regla algebraica del §7.
export function minCyclesFor(state) {
  const tpl = resolveTemplate(state);
  const p = resolveParams(state, tpl);
  const N = Math.max(1, Math.round(tpl.count(p)));
  const M = visibleAssets(state).length;

  const slots = Math.abs(Math.round(tpl.slotsPerCycle?.(p, N) ?? 0));
  // Algunos templates necesitan además cerrar su propia geometría: flip vuelve
  // al frente sólo con un número par de medias vueltas.
  const unit = Math.max(1, Math.round(tpl.cycleUnit?.(p, N) ?? 1));

  // Sin assets cargados se dibujan N placeholders numerados, y el número rota
  // entre posiciones igual que rotaría un asset. Para el contrato del loop
  // cuentan como N assets: si no, el badge diría "no cierra" sin ofrecer los
  // ciclos que sí cierran, que es justo cuando más se está componiendo a ciegas.
  const effective = M > 0 ? M : N;
  const byAssets = slots === 0 ? 1 : effective / gcd(effective, slots);
  return Math.max(1, lcm(byAssets, unit) || 1);
}

// Tres estados para el badge del stage:
//   'ok'      → loop ✓ cierra
//   'cycles'  → loop ✓ (× N ciclos), con el N mínimo que cierra
//   'broken'  → loop ✗
export function loopClosure(state, eps = 1e-4) {
  const now = compare(state, eps);
  const min = minCyclesFor(state);

  if (now.closes) return { ...now, status: "ok", minCycles: min, suggested: null };

  // Si el problema es sólo cuántos ciclos se graban, lo verificamos de verdad
  // en vez de confiar en la fórmula: se re-corre el test con el múltiplo de
  // `min` más cercano por encima de los ciclos actuales.
  const current = Math.max(1, Math.round(state.timing.cycles));
  const suggested = Math.max(min, Math.ceil(current / min) * min);
  if (suggested !== current) {
    const probe = compare(
      { ...state, timing: { ...state.timing, cycles: suggested } },
      eps,
    );
    if (probe.closes) return { ...now, status: "cycles", minCycles: min, suggested };
  }

  return { ...now, status: "broken", minCycles: min, suggested: null };
}
