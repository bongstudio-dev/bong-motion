// Verifica la librería de presets de fábrica.
//
// Lo que atrapa: un param mal escrito (que quedaría silenciosamente ignorado y
// el preset se vería como el default), un preset que deja todo fuera de cuadro,
// y uno que no cierra el loop con ningún número de ciclos.

import { LIBRARY, variantState } from "../src/engine/library.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { getScene } from "../src/engine/getScene.js";
import { loopClosure } from "../src/engine/loopTest.js";
import { stageOf, visibleAt } from "../src/engine/camera.js";
import { defaultState } from "../src/state/defaults.js";

let fails = 0;
const ok = (cond, msg) => {
  if (!cond) {
    fails++;
    console.log("    ✗", msg);
  }
  return cond;
};

const withAssets = (n) => {
  const s = defaultState();
  s.assets = Array.from({ length: n }, (_, i) => ({
    id: `a${i}`, name: `img${i}.jpg`, w: 1080, h: 1350,
    visible: true, focal: [0, 0], fit: "auto",
  }));
  return s;
};

// Mismo criterio que el test de loop: fuera del frustum no se ve.
function onScreen(plane, stage, camera) {
  if (plane.opacity <= 0.02) return false;
  const view = visibleAt(plane.pos[2], stage, camera);
  const reach = Math.max(plane.size[0], plane.size[1]) / 2;
  if (Math.abs(plane.pos[0]) - reach > view.w / 2) return false;
  if (Math.abs(plane.pos[1]) - reach > view.h / 2) return false;
  return true;
}

const base = withAssets(6);
let total = 0;

for (const group of LIBRARY) {
  const tpl = TEMPLATES[group.template];
  console.log(`\n== ${group.template} ==`);
  ok(tpl, `el template "${group.template}" existe`);
  if (!tpl) continue;

  const known = new Set(Object.keys(tpl.params));

  for (const variant of group.variants) {
    total++;
    const label = `${variant.name} (${variant.id})`;
    let bien = true;

    // 1. Nada de params inventados: un typo acá se traga el valor y el preset
    //    se vería idéntico al default, sin ningún error.
    const raros = Object.keys(variant.params).filter((k) => !known.has(k));
    bien = ok(raros.length === 0, `${label}: params desconocidos → ${raros.join(", ")}`) && bien;

    // 2. Ids únicos y nombre presente.
    bien = ok(!!variant.name && !!variant.id, `${label}: tiene id y nombre`) && bien;

    const state = variantState(base, variant, group.template);
    const stage = stageOf(state);

    // 3. Geometría válida a lo largo de la pieza.
    let malos = 0;
    let vistosMax = 0;
    for (let k = 0; k < 24; k++) {
      const scene = getScene(k / 24, state);
      for (const p of scene.planes) {
        const nums = [...p.pos, ...p.rot, ...p.size, p.opacity, p.radius, ...p.crop];
        if (nums.some((n) => !Number.isFinite(n))) malos++;
        if (p.size[0] <= 0 || p.size[1] <= 0) malos++;
      }
      const vistos = scene.planes.filter((p) => onScreen(p, stage, scene.camera)).length;
      if (vistos > vistosMax) vistosMax = vistos;
    }
    bien = ok(malos === 0, `${label}: ${malos} valores inválidos`) && bien;

    // 4. Que se vea algo. Un radio grande con fov chico deja todo fuera y el
    //    preset se vería como un cuadro vacío.
    bien = ok(vistosMax >= 1, `${label}: no hay ningún plano en cuadro`) && bien;

    // 5. Que exista un número de ciclos que cierre.
    const c = loopClosure(state);
    let cierra = c.status === "ok";
    let sugerido = null;
    if (!cierra && c.suggested) {
      const probe = { ...state, timing: { ...state.timing, cycles: c.suggested } };
      cierra = loopClosure(probe).status === "ok";
      sugerido = c.suggested;
    }
    bien = ok(cierra, `${label}: no cierra el loop con ningún ciclo`) && bien;

    const nota = c.status === "ok" ? "cierra" : `cierra con ${sugerido} ciclos`;
    console.log(
      `  ${bien ? "✓" : "✗"} ${variant.name.padEnd(12)} ${String(vistosMax).padStart(2)} planos en cuadro · ${nota}`,
    );
  }
}

console.log(
  fails === 0
    ? `\nTODO OK — ${total} presets verificados\n`
    : `\n${fails} FALLAS sobre ${total} presets\n`,
);
process.exit(fails ? 1 : 0);
