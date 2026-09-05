// Capa de cámara. Transversal: no es un template, se aplica ENCIMA de
// cualquiera de las ocho familias.
//
// Regla que manda sobre todo lo demás: el movimiento tiene que cerrar el loop
// por su cuenta. Por eso todos los recorridos son de ida y vuelta sobre una
// onda triangular —vale 0 en los dos extremos del ciclo de cámara— y el ease
// sólo moldea el camino, nunca los extremos. Con cualquier curva, el frame de
// la cámara al empezar y al terminar es exactamente el mismo.
//
// El cierre real de la pieza es el mínimo común múltiplo entre lo que pide el
// template y lo que pide la cámara. Eso lo calcula loopTest.js.

import { clamp, frac, triangle } from "../utils/math.js";
import { makeEase } from "./ease.js";

const DEG = Math.PI / 180;

// Topes con amplitud 1. Están acá y no en el schema porque son la escala del
// movimiento, no un gusto: la amplitud del panel es una fracción de esto.
const MAX_DOLLY = 0.5; // fracción de la distancia base de cámara
const MAX_ORBIT = 180; // grados de barrido
const MAX_TILT = 55; // grados de elevación

export const CAMERA_MOVES = [
  { value: "fixed", label: "Fija" },
  { value: "dolly", label: "Dolly" },
  { value: "orbit", label: "Orbit" },
  { value: "tilt", label: "Tilt" },
];

export const defaultCamera = () => ({
  move: "fixed", // 'fixed' | 'dolly' | 'orbit' | 'tilt'
  amplitude: 0.5, // con signo: hacia dónde arranca el recorrido
  phase: 0, // 0..1 del ciclo de cámara
  period: 1, // ciclos de template que tarda la cámara en volver
  ease: [0.65, 0, 0.35, 1],
});

// Cuántos ciclos de template tarda la cámara en completar su recorrido.
//
// El param es "cada cuántos ciclos vuelve" y no "cuántas vueltas da por ciclo":
// es lo que permite cámara lenta sobre template rápido, que es para lo que
// está. Al revés —cámara más rápida que el template— el mínimo común múltiplo
// sería siempre el del template y el control no cambiaría nunca el cierre.
export const cameraPeriod = (cam) =>
  !cam || cam.move === "fixed" ? 1 : Math.max(1, Math.round(cam.period ?? 1));

export const cameraActive = (cam) =>
  !!cam && cam.move !== "fixed" && Math.abs(cam.amplitude ?? 0) > 0.001;

// φ ∈ [0,1): dónde está la cámara dentro de SU recorrido. `tc` viene en ciclos
// de template, igual que el `t` que reciben los templates.
export const cameraPhase = (cam, tc) =>
  frac(tc / cameraPeriod(cam) + (cam?.phase ?? 0));

// Devuelve una cámara nueva; nunca muta la base. Con 'fixed' —o amplitud 0—
// devuelve la MISMA referencia, así el camino sin cámara es idéntico al de
// antes de que esta capa existiera.
export function applyCameraMove(base, cam, tc) {
  if (!cameraActive(cam)) return base;

  const amp = clamp(cam.amplitude, -1, 1);
  const ease = makeEase(cam.ease);
  // 0 → 1 → 0 sobre el ciclo de cámara. Los extremos son el mismo estado.
  const k = ease(triangle(cameraPhase(cam, tc)));
  const z = base.position[2];

  if (cam.move === "dolly") {
    // Amplitud negativa acerca, positiva aleja.
    return { ...base, position: [0, 0, z * (1 + MAX_DOLLY * amp * k)] };
  }
  if (cam.move === "orbit") {
    // Barrido pendular alrededor del centro de la escena: sale del frente,
    // llega hasta amp × 180° y vuelve. Una revolución continua sólo cerraría
    // con un barrido de exactamente 360°, y ahí la amplitud dejaría de servir
    // para todo lo que no sea ese único valor.
    const a = amp * MAX_ORBIT * DEG * k;
    return { ...base, position: [Math.sin(a) * z, 0, Math.cos(a) * z] };
  }
  // tilt: arranca mirando desde abajo (k = 0 en el extremo del ciclo) y se
  // endereza en el medio. Con amplitud negativa arranca desde arriba.
  const e = amp * MAX_TILT * DEG * (1 - k);
  return { ...base, position: [0, -Math.sin(e) * z, Math.cos(e) * z] };
}
