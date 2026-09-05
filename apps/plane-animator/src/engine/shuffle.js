// Shuffle de los params formales del template activo.
//
// Aleatoriza SÓLO lo que declara el schema del template: no toca los assets
// cargados, ni el ratio del canvas, ni la duración del ciclo. El reset sigue
// siendo el que devuelve a los defaults; esto es lo contrario, y por eso
// conviven.
//
// La parte que no es obvia es que un sorteo uniforme sobre los rangos crudos
// tira composiciones vacías muy seguido: un orbit de radio máximo con fov
// chico deja todo afuera de cuadro, y un carousel de tamaño máximo con la
// cantidad máxima tapa el frame entero. Así que se sortea, se MIDE lo que
// salió, y si no se ve nada se vuelve a sortear. Es la misma verificación que
// hace library-test sobre los presets de fábrica, corrida en el momento.

import { getScene, resolveTemplate } from "./getScene.js";
import { stageOf, visibleAt } from "./camera.js";

const INTENTOS = 40;
const FRAMES = 10;

// Un plano tan cerca que su alto proyectado pasa este múltiplo del cuadro ya
// no es parte de una composición: es una pared. Se ve, pero no se ve NADA.
const PARED = 2;

// Mismo criterio que el test de loop y que library-test —fuera del frustum no
// se ve, por más opacidad que tenga— más el descarte de las paredes.
function useful(plane, stage, camera) {
  if (plane.opacity <= 0.02) return false;
  const view = visibleAt(plane.pos[2], stage, camera);
  const reach = Math.max(plane.size[0], plane.size[1]) / 2;
  if (Math.abs(plane.pos[0]) - reach > view.w / 2) return false;
  if (Math.abs(plane.pos[1]) - reach > view.h / 2) return false;
  // view.h es Infinity para lo que quedó detrás de cámara: eso ya es una pared.
  if (!(view.h > 0) || plane.size[1] > view.h * PARED) return false;
  return true;
}

// Sorteo con sesgo al centro del rango: el promedio de dos uniformes. Sigue
// llegando a los dos extremos, pero no aterriza en los dos a la vez seguido,
// que es de donde salen las composiciones imposibles.
const centrado = (rnd, min, max, step) => {
  const u = (rnd() + rnd()) / 2;
  const v = min + u * (max - min);
  const snapped = Math.round(v / step) * step;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(6))));
};

function sortear(tpl, actuales, rnd) {
  const out = {};
  for (const item of tpl.schema) {
    // Los params que el schema esconde en esta configuración no se sortean:
    // moverlos a ciegas cambia cosas que no están en pantalla.
    if (item.when && !item.when({ ...actuales, ...out })) continue;
    if (item.type === "toggle") out[item.key] = rnd() < 0.5;
    else if (item.type === "select") {
      out[item.key] = item.options[Math.floor(rnd() * item.options.length)].value;
    } else {
      out[item.key] = centrado(rnd, item.min, item.max, item.step ?? 0.01);
    }
  }
  return { ...actuales, ...out };
}

// Cuántos planos se ven, en el peor frame y en promedio. Es el puntaje que
// decide si un sorteo sirve.
export function framingScore(state) {
  const stage = stageOf(state);
  let peor = Infinity;
  let suma = 0;
  for (let k = 0; k < FRAMES; k++) {
    const scene = getScene(k / FRAMES, state);
    let vistos = 0;
    for (const p of scene.planes) {
      const nums = [...p.pos, ...p.rot, ...p.size, p.opacity, p.radius];
      if (nums.some((n) => !Number.isFinite(n))) return { peor: 0, medio: 0, roto: true };
      if (p.size[0] <= 0 || p.size[1] <= 0) return { peor: 0, medio: 0, roto: true };
      if (useful(p, stage, scene.camera)) vistos++;
    }
    peor = Math.min(peor, vistos);
    suma += vistos;
  }
  return { peor, medio: suma / FRAMES, roto: false };
}

// Devuelve los params nuevos del template activo. `rnd` se inyecta para poder
// testearlo con una secuencia repetible.
export function shuffleParams(state, rnd = Math.random) {
  const tpl = resolveTemplate(state);
  const actuales = { ...tpl.params, ...(state.template.params?.[tpl.id] ?? {}) };

  // Un frame vacío no sirve. Uno con un solo plano tampoco cuando la familia
  // tiene varios: ahí lo que pasó es que uno se comió el cuadro y tapó al
  // resto. Y en promedio, menos de un cuarto de los planos en cuadro es una
  // composición que perdió su propia idea.
  const N = Math.max(1, Math.round(tpl.count(actuales)));
  const piso = Math.min(2, N);
  const meta = Math.max(piso, Math.floor(N * 0.25));

  let mejor = null;
  let mejorPuntaje = -1;
  for (let i = 0; i < INTENTOS; i++) {
    const params = sortear(tpl, actuales, rnd);
    const probe = {
      ...state,
      template: { ...state.template, params: { ...state.template.params, [tpl.id]: params } },
    };
    const s = framingScore(probe);
    if (s.roto) continue;
    if (s.peor >= piso && s.medio >= meta) return params;
    const puntaje = s.peor * 100 + s.medio;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = params;
    }
  }
  // Si en 40 intentos ninguno llegó a la meta, va el mejor que salió. Nunca se
  // devuelve algo roto: en el peor caso, los params que ya estaban.
  return mejor ?? actuales;
}
