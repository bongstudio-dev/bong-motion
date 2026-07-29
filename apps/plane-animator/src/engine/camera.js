// Cámara y sistema de coordenadas. BRIEF §3.
//
// Unidad de mundo = 1 px lógico del stage. La cámara se posiciona para que la
// altura visible en z = 0 sea exactamente stage.h, así un `planeSize` de 600
// significa 600px sobre un stage de 1080 y los números del panel son legibles.
//
// Reemplaza a `layout.js` del palette-animator: ahí el modelo era
// `weights → rects`; acá los templates ubican en el espacio y lo único que
// hace falta derivar es la cámara.

// Invariante en los cuatro ratios: el lado menor siempre es 1080. Todos los
// params de tamaño y distancia se miden contra esto, nunca contra stage.h.
export const SHORT = 1080;

export const RATIOS = [
  { value: "1:1", label: "1:1", w: 1080, h: 1080 },
  { value: "4:5", label: "4:5", w: 1080, h: 1350 },
  { value: "9:16", label: "9:16", w: 1080, h: 1920 },
  { value: "16:9", label: "16:9", w: 1920, h: 1080 },
];

export const RATIO_IDS = [...RATIOS.map((r) => r.value), "custom"];

// Dims del stage en px lógicos. En custom se normaliza el lado menor a 1080
// para que la convención de tamaños siga valiendo.
export function stageDims(ratio, custom) {
  const preset = RATIOS.find((r) => r.value === ratio);
  if (preset) return { w: preset.w, h: preset.h };

  const rw = Math.max(1, Number(custom?.w) || 1080);
  const rh = Math.max(1, Number(custom?.h) || 1350);
  const k = SHORT / Math.min(rw, rh);
  // Redondeo a par: H.264 no acepta lados impares y el export a MP4 fallaría
  // sólo en los ratios custom, que es el peor momento para enterarse.
  const even = (v) => Math.max(2, Math.round(v / 2) * 2);
  return { w: even(rw * k), h: even(rh * k) };
}

export const stageOf = (state) =>
  stageDims(state.stage.ratio, { w: state.stage.customW, h: state.stage.customH });

// Cámara derivada del ratio + fov. Es lo único que cambia entre ratios: los
// templates componen en px y el encuadre se abre o se cierra alrededor.
export function makeCamera(stage, fov = 45) {
  const z = stage.h / 2 / Math.tan((fov * Math.PI) / 360);
  return {
    fov,
    aspect: stage.w / stage.h,
    position: [0, 0, z],
    lookAt: [0, 0, 0],
    near: 10,
    far: z * 6,
  };
}

// Tamaño del área visible a una profundidad z dada. Sirve para el fade de
// parallax, para el wrap fuera de cuadro y para el test de loop (un plano que
// no entra en el frustum no rompe el loop aunque tenga opacidad 1).
export function visibleAt(z, stage, cam) {
  const dist = cam.position[2] - z;
  if (dist <= 0) return { w: Infinity, h: Infinity };
  const h = 2 * dist * Math.tan((cam.fov * Math.PI) / 360);
  return { w: h * cam.aspect, h };
}
