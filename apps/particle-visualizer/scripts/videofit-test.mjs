// Test del mapeo cámara → stage, sin browser.
// El bug que busca: que `drawVideoCover` y `videoPointToStage` dejen de coincidir
// y la partícula no nazca en la punta del dedo. A ojo eso no se ve, sólo se
// siente raro, así que se verifica acá.

import { coverRect, videoPointToStage } from "../src/engine/videoFit.js";
import { ParticleSystem } from "../src/engine/ParticleSystem.js";

let fails = 0;
const ok = (cond, msg) => {
  if (!cond) {
    fails++;
    console.log("  ✗", msg);
  } else console.log("  ✓", msg);
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// Cámaras reales × los cinco ratios del stage.
const CAMS = [
  [1280, 720, "16:9"],
  [1280, 960, "4:3"],
  [640, 480, "VGA 4:3"],
];
const STAGES = [
  [1080, 1080, "1:1"],
  [1080, 1440, "3:4"],
  [1080, 1350, "4:5"],
  [1920, 1080, "16:9"],
  [1080, 1920, "9:16"],
];

console.log("\n== 1. El recorte nunca deforma ==");
{
  let bad = 0;
  for (const [vw, vh] of CAMS) {
    for (const [w, h] of STAGES) {
      const { sw, sh } = coverRect(vw, vh, w, h);
      if (!near(sw / sh, w / h, 1e-9)) bad++;
    }
  }
  ok(bad === 0, `aspect del recorte == aspect del stage en las ${CAMS.length * STAGES.length} combinaciones`);
}

console.log("\n== 2. El recorte queda centrado y dentro del frame ==");
{
  let bad = 0;
  for (const [vw, vh] of CAMS) {
    for (const [w, h] of STAGES) {
      const { sx, sy, sw, sh } = coverRect(vw, vh, w, h);
      if (sx < -1e-9 || sy < -1e-9) bad++;
      if (sx + sw > vw + 1e-9 || sy + sh > vh + 1e-9) bad++;
      // centrado: lo que sobra se reparte igual de los dos lados
      if (!near(sx, (vw - sw) / 2, 1e-9) || !near(sy, (vh - sh) / 2, 1e-9)) bad++;
    }
  }
  ok(bad === 0, "el rect no se sale del frame y está centrado");
}

console.log("\n== 3. El centro es invariante al espejo ==");
{
  // El mejor canario: si el mapeo se rompe, el centro casi siempre se corre.
  let bad = 0;
  for (const [vw, vh] of CAMS) {
    for (const [w, h] of STAGES) {
      for (const mirror of [true, false]) {
        const p = videoPointToStage(0.5, 0.5, vw, vh, w, h, mirror);
        if (!near(p.x, 0.5, 1e-9) || !near(p.y, 0.5, 1e-9)) bad++;
      }
    }
  }
  ok(bad === 0, "el centro del frame cae en el centro del stage, con y sin espejo");
}

console.log("\n== 4. El espejo es simétrico ==");
{
  const [vw, vh] = [1280, 960];
  const [w, h] = [1080, 1350];
  let bad = 0;
  for (const lx of [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]) {
    const a = videoPointToStage(lx, 0.5, vw, vh, w, h, true).x;
    const b = videoPointToStage(1 - lx, 0.5, vw, vh, w, h, true).x;
    if (!near(a + b, 1, 1e-9)) bad++;
  }
  ok(bad === 0, "x(lx) + x(1−lx) === 1 en todo el rango");

  const sinEspejo = videoPointToStage(0.3, 0.5, vw, vh, w, h, false).x;
  const conEspejo = videoPointToStage(0.3, 0.5, vw, vh, w, h, true).x;
  ok(near(sinEspejo + conEspejo, 1, 1e-9), `espejar refleja el punto (${sinEspejo.toFixed(3)} ↔ ${conEspejo.toFixed(3)})`);
}

console.log("\n== 5. Los bordes del recorte dan 0 y 1 exactos ==");
{
  const [vw, vh] = [1280, 720];
  const [w, h] = [1080, 1350];
  const { sx, sy, sw, sh } = coverRect(vw, vh, w, h);
  const izq = videoPointToStage(sx / vw, 0.5, vw, vh, w, h, false);
  const der = videoPointToStage((sx + sw) / vw, 0.5, vw, vh, w, h, false);
  const arr = videoPointToStage(0.5, sy / vh, vw, vh, w, h, false);
  const aba = videoPointToStage(0.5, (sy + sh) / vh, vw, vh, w, h, false);
  ok(near(izq.x, 0, 1e-9) && near(der.x, 1, 1e-9), `borde izq → 0 y der → 1 (${izq.x}, ${der.x})`);
  ok(near(arr.y, 0, 1e-9) && near(aba.y, 1, 1e-9), `borde sup → 0 e inf → 1 (${arr.y}, ${aba.y})`);
}

console.log("\n== 6. Fuera del recorte se clampea, sin NaN ==");
{
  const [vw, vh] = [1280, 720];
  const [w, h] = [1080, 1920]; // 9:16: recorta mucho a los costados
  let bad = 0;
  for (const lx of [-0.5, 0, 0.02, 0.98, 1, 1.5]) {
    for (const ly of [-0.5, 0, 1, 1.5]) {
      const p = videoPointToStage(lx, ly, vw, vh, w, h, true);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) bad++;
      if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) bad++;
    }
  }
  ok(bad === 0, "puntos fuera del encuadre quedan en 0..1 y nunca dan NaN");
}

console.log("\n== 7. Video sin dimensiones no rompe ==");
{
  const vacio = coverRect(0, 0, 1080, 1350);
  ok(vacio.sw === 0 && vacio.sh === 0, "coverRect(0,0,…) devuelve un rect vacío en vez de dividir por cero");
  const p = videoPointToStage(0.5, 0.5, 0, 0, 1080, 1350, true);
  ok(Number.isFinite(p.x) && Number.isFinite(p.y), "videoPointToStage con video sin dimensiones cae al centro");

  let tiró = false;
  try {
    coverRect(NaN, 720, 1080, 1350);
  } catch {
    tiró = true;
  }
  ok(!tiró, "NaN en las dimensiones no tira una excepción");
}

console.log("\n== 8. El emisor de la mano no lo pisa la config ==");
{
  // El bug que este test existe para atrapar: React mergea el config entero en
  // `updateConfig` cada vez que se toca CUALQUIER control. Si la posición de la
  // mano viviera en config, mover el slider de gravedad la pisaría con el
  // emitterX viejo y el emisor pegaría un salto intermitente.
  const base = {
    emitterX: 0.1, emitterY: 0.1, direction: 0, spread: 0, speed: 1,
    scale: 0.2, scaleVariation: 0, rotationSpeed: 0, lifespan: 5,
    fadeIn: 0, fadeOut: 0, gravity: 0, turbulence: 0, turbulenceFrequency: 0.01,
    drag: 0, spawnRate: 1000, maxParticles: 50, backgroundColor: "#000",
  };
  const system = new ParticleSystem({ ...base });
  system.setAssets([{ image: { naturalWidth: 10, naturalHeight: 10 } }]);

  const nacimiento = () => {
    system.particles = [];
    system.spawnParticle(1000, 1000);
    return { x: system.particles[0].x, y: system.particles[0].y };
  };

  ok(nacimiento().x === 100, "sin override nace en el emisor de config (0.1 → 100)");

  system.setEmitterOverride({ x: 0.8, y: 0.6 });
  const conMano = nacimiento();
  ok(conMano.x === 800 && conMano.y === 600, `con override nace en la mano (${conMano.x}, ${conMano.y})`);

  // Acá se reproduce el bug: el usuario mueve un slider.
  system.updateConfig({ ...base, gravity: 1.5 });
  const trasSlider = nacimiento();
  ok(
    trasSlider.x === 800 && trasSlider.y === 600,
    `tocar un slider NO mueve el emisor (${trasSlider.x}, ${trasSlider.y})`,
  );
  ok(system.config.gravity === 1.5, "y el cambio de config sí se aplicó");

  system.setEmitterOverride(null);
  ok(nacimiento().x === 100, "al soltar el override vuelve al emisor de config");
}

console.log("\n== 9. render() delega el fondo cuando le pasan backdrop ==");
{
  const system = new ParticleSystem({ backgroundColor: "#ff0000" });
  const llamadas = [];
  const ctx = {
    clearRect: () => llamadas.push("clear"),
    fillRect: () => llamadas.push("fill"),
    set fillStyle(v) { llamadas.push(`fillStyle:${v}`); },
    save() {}, restore() {}, translate() {}, rotate() {}, drawImage() {},
  };

  system.render(ctx, 100, 100);
  ok(llamadas.includes("fillStyle:#ff0000"), "sin backdrop pinta el color de config");

  llamadas.length = 0;
  let backdropLlamado = false;
  system.render(ctx, 100, 100, () => { backdropLlamado = true; });
  ok(backdropLlamado, "con backdrop delega el fondo");
  ok(!llamadas.includes("fillStyle:#ff0000"), "y ya no pinta el color sólido encima");
  ok(llamadas[0] === "clear", "el clearRect sigue ocurriendo primero");
}

console.log("\n== 10. Cuánto encuadre sobrevive (informativo) ==");
for (const [vw, vh, camName] of CAMS) {
  const fila = STAGES.map(([w, h, name]) => {
    const { sw } = coverRect(vw, vh, w, h);
    return `${name} ${Math.round((sw / vw) * 100)}%`;
  });
  console.log(`   cámara ${camName.padEnd(8)} → ${fila.join("  ")}`);
}

console.log(fails === 0 ? "\nTODO OK\n" : `\n${fails} FALLAS\n`);
process.exit(fails ? 1 : 0);
