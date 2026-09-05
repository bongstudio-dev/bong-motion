// Test del engine sin browser: pureza, contrato de loop y sanidad geométrica.
import { getScene } from "../src/engine/getScene.js";
import { loopClosure, minCyclesFor } from "../src/engine/loopTest.js";
import { defaultState } from "../src/state/defaults.js";
import { TEMPLATE_LIST } from "../src/engine/templates.js";
import { VARIANTS_BY_TEMPLATE } from "../src/engine/library.js";

let fails = 0;
const ok = (cond, msg) => {
  if (!cond) { fails++; console.log("  ✗", msg); } else console.log("  ✓", msg);
};

const withAssets = (n, aspects) => {
  const s = defaultState();
  s.assets = Array.from({ length: n }, (_, i) => ({
    id: `a${i}`,
    name: `img${i}.jpg`,
    w: Math.round(1080 * (aspects?.[i % aspects.length] ?? 0.8)),
    h: 1080,
    visible: true,
    focal: [0, 0],
    fit: "auto",
  }));
  return s;
};

console.log("\n== 1. Pureza: mismo input → mismo output ==");
{
  const s = withAssets(5);
  const a = JSON.stringify(getScene(0.37, s));
  const b = JSON.stringify(getScene(0.37, s));
  ok(a === b, "getScene(0.37) es determinístico");
  ok(!/NaN|null,null/.test(a), "sin NaN en la escena");
}

console.log("\n== 2. Todos los templates producen geometría válida ==");
for (const tpl of TEMPLATE_LIST) {
  const s = withAssets(5);
  s.template.id = tpl.id;
  let bad = 0;
  for (let k = 0; k < 40; k++) {
    const sc = getScene(k / 40, s);
    for (const p of sc.planes) {
      const nums = [...p.pos, ...p.rot, ...p.size, p.opacity, p.radius, ...p.crop];
      if (nums.some((n) => !Number.isFinite(n))) bad++;
      if (p.size[0] <= 0 || p.size[1] <= 0) bad++;
      if (p.opacity < 0 || p.opacity > 1) bad++;
    }
  }
  ok(bad === 0, `${tpl.id}: 40 frames sin valores inválidos`);
}

console.log("\n== 3. Orden de dibujo: más lejos primero ==");
{
  const s = withAssets(5);
  s.template.id = "deck";
  const sc = getScene(0.3, s);
  const sorted = sc.planes.every((p, i, arr) => i === 0 || arr[i - 1].renderOrder <= p.renderOrder);
  ok(sorted, "planes ordenados por renderOrder ascendente");
  const zs = sc.planes.map((p) => p.pos[2]);
  ok(zs[0] <= zs[zs.length - 1], `el primero está más lejos (z ${zs[0].toFixed(0)} → ${zs[zs.length-1].toFixed(0)})`);
}

console.log("\n== 4. Contrato del loop §7 — carousel ==");
{
  // 6 assets, avance 1 slot/ciclo → cierra recién a los 6 ciclos.
  const s = withAssets(6);
  s.template.id = "carousel";
  s.timing.cycles = 1;
  const c1 = loopClosure(s);
  ok(c1.status === "cycles", `1 ciclo con 6 assets → status '${c1.status}' (esperado 'cycles')`);
  ok(c1.suggested === 6, `sugiere 6 ciclos (dio ${c1.suggested})`);

  s.timing.cycles = 6;
  const c6 = loopClosure(s);
  ok(c6.status === "ok", `6 ciclos → cierra (status '${c6.status}')`);

  // 3 assets, avance 2 slots/ciclo → gcd(3,2)=1 → 3 ciclos.
  const s2 = withAssets(3);
  s2.template.id = "carousel";
  s2.template.params = { carousel: { slotsPerCycle: 2 } };
  ok(minCyclesFor(s2) === 3, `3 assets × 2 slots/ciclo → minCycles 3 (dio ${minCyclesFor(s2)})`);

  // count múltiplo de assets: 4 assets, 1 slot → 4 ciclos.
  const s3 = withAssets(4);
  s3.template.id = "carousel";
  ok(minCyclesFor(s3) === 4, `4 assets → minCycles 4 (dio ${minCyclesFor(s3)})`);

  // Sin assets, los N placeholders numerados cuentan como N assets: el número
  // rota entre posiciones igual que rotaría una imagen.
  const s4 = defaultState();
  ok(minCyclesFor(s4) === 6, `sin assets → los 6 placeholders piden 6 ciclos (dio ${minCyclesFor(s4)})`);
  const c4 = loopClosure(s4);
  ok(c4.status === "cycles" && c4.suggested === 6, `y el badge ofrece 6 en vez de "no cierra" (status '${c4.status}')`);
  s4.timing.cycles = 6;
  ok(loopClosure(s4).status === "ok", "con 6 ciclos el estado inicial de la app cierra");
}

console.log("\n== 5. Parallax cierra en 1 ciclo (cada capa vuelve a su lugar) ==");
{
  const s = withAssets(5);
  s.template.id = "parallax";
  s.timing.ease = [0, 0, 1, 1];
  const c = loopClosure(s);
  ok(c.status === "ok", `parallax: cierra en 1 ciclo (Δ ${(c.maxDelta*100).toFixed(2)}%)`);
}

console.log("\n== 5b. Orbit avanza una imagen por ciclo y cierra a la vuelta ==");
{
  const s = withAssets(6);
  s.template.id = "orbit";
  s.template.params = { orbit: { count: 6 } };
  s.timing.ease = [0, 0, 1, 1];

  const c1 = loopClosure(s);
  ok(c1.status === "cycles", `1 ciclo no cierra: el anillo giró un puesto (status '${c1.status}')`);
  ok(c1.suggested === 6, `sugiere 6 ciclos = una vuelta entera (dio ${c1.suggested})`);

  s.timing.cycles = c1.suggested;
  ok(loopClosure(s).status === "ok", "6 ciclos → cierra");

  // Lo que pedía el usuario: al frente aparece la imagen SIGUIENTE, no la inicial.
  const frente = [];
  for (let k = 0; k < 6; k++) {
    const sc = getScene(k / 6 + 1e-6, s);
    frente.push(sc.planes.reduce((a, b) => (b.pos[2] > a.pos[2] ? b : a)).assetIndex);
  }
  ok(frente.join(",") === "0,1,2,3,4,5", `el frente avanza una imagen por ciclo (${frente.join(",")})`);

  // Con stepsPerCycle = count vuelve el giro continuo de una vuelta por ciclo.
  const spin = withAssets(6);
  spin.template.id = "orbit";
  spin.template.params = { orbit: { count: 6, stepsPerCycle: 6 } };
  spin.timing.ease = [0, 0, 1, 1];
  ok(loopClosure(spin).status === "ok", "stepsPerCycle = count → vuelta completa por ciclo, cierra en 1");
}

console.log("\n== 6. Flip: la rotación sólo cierra con medias vueltas pares ==");
{
  const s = withAssets(4);
  s.template.id = "flip";
  s.timing.cycles = 1;
  const c1 = loopClosure(s);
  ok(c1.status !== "ok", `1 media vuelta no cierra (status '${c1.status}')`);
  ok(c1.suggested % 2 === 0, `sugiere un número par de ciclos (${c1.suggested})`);

  s.timing.cycles = c1.suggested;
  ok(loopClosure(s).status === "ok", `${c1.suggested} ciclos → cierra`);

  // La cara oculta es la que cambia de textura.
  const sc = getScene(0, s);
  const p = sc.planes[0];
  ok(p.backAssetId && p.backAssetId !== p.assetId, "front y back tienen assets distintos");
  ok(p.doubleSided === true, "flip marca doubleSided");
}

console.log("\n== 7. fitToAsset: espaciado por acumulación ==");
{
  // Set mixto: 4:5 vertical y 16:9 horizontal alternados.
  const s = withAssets(4, [0.8, 16 / 9]);
  s.template.id = "carousel";
  s.fit.mode = "fitToAsset";
  s.timing.ease = [0, 0, 1, 1];

  const sc = getScene(0, s);
  const widths = new Set(sc.planes.map((p) => Math.round(p.size[0])));
  ok(widths.size > 1, `los planos toman distintos anchos (${[...widths].join(", ")})`);

  // Sin recorte: crop debe ser identidad.
  const idents = sc.planes.every(
    (p) => Math.abs(p.crop[0] - 1) < 1e-6 && Math.abs(p.crop[1] - 1) < 1e-6,
  );
  ok(idents, "fitToAsset no recorta (crop = 1,1,0,0)");

  // Los planos no se pisan: gap real entre bordes consecutivos.
  const along = [...sc.planes].sort((a, b) => a.pos[0] - b.pos[0]);
  let overlaps = 0;
  for (let i = 1; i < along.length; i++) {
    const gapReal =
      along[i].pos[0] - along[i].size[0] / 2 -
      (along[i - 1].pos[0] + along[i - 1].size[0] / 2);
    if (gapReal < -1) overlaps++;
  }
  ok(overlaps === 0, "ningún par de planos se superpone");

  // El área se conserva entre aspects distintos. Se mide con scaleCenter en 0:
  // el realce del plano central es un efecto aparte y sí cambia el área.
  const flat = { ...s, template: { ...s.template, params: { carousel: { scaleCenter: 0, fade: 0 } } } };
  const areas = getScene(0, flat).planes.map((p) => p.size[0] * p.size[1]);
  ok(
    Math.max(...areas) / Math.min(...areas) < 1.02,
    `vertical y horizontal ocupan la misma área (${Math.round(Math.min(...areas))} vs ${Math.round(Math.max(...areas))})`,
  );
}

console.log("\n== 8. Crop cover/contain ==");
{
  const s = withAssets(2, [16 / 9]); // imagen apaisada en plano 4:5
  s.template.id = "carousel";
  s.fit.mode = "cover";
  // Los planos vienen ordenados por profundidad, no por asset: hay que buscar
  // el que efectivamente muestra el asset que estamos tocando.
  const planeOf = (st, idx) => getScene(0, st).planes.find((p) => p.assetIndex === idx);
  const cover = planeOf(s, 0).crop;
  ok(cover[0] < 1 && Math.abs(cover[1] - 1) < 1e-6, `cover recorta en X (sx ${cover[0].toFixed(3)})`);

  s.fit.mode = "contain";
  const contain = planeOf(s, 0).crop;
  ok(contain[1] > 1 && Math.abs(contain[0] - 1) < 1e-6, `contain deja fondo en Y (sy ${contain[1].toFixed(3)})`);

  // Focal desplaza dentro del margen disponible, sin salirse del asset.
  s.fit.mode = "cover";
  s.assets[0].focal = [0.5, 0];
  const shifted = planeOf(s, 0).crop;
  ok(
    Math.abs(shifted[2] + shifted[0] - 1) < 1e-6,
    `focal +0.5 llega al borde exacto (ox ${shifted[2].toFixed(3)} + sx ${shifted[0].toFixed(3)} = 1)`,
  );
}

console.log("\n== 9. La composición no depende del ratio ==");
{
  const s = withAssets(5);
  const ratios = ["1:1", "4:5", "9:16", "16:9"];
  const sizes = ratios.map((r) => {
    const st = { ...s, stage: { ...s.stage, ratio: r } };
    return getScene(0.25, st).planes[0].size[0];
  });
  ok(
    new Set(sizes.map((v) => Math.round(v))).size === 1,
    `mismo tamaño de plano en los 4 ratios (${Math.round(sizes[0])}px)`,
  );
}

console.log("\n== 10. Placeholders sin assets ==");
{
  const s = defaultState();
  const sc = getScene(0, s);
  ok(sc.planes.length === 6, `dibuja ${sc.planes.length} placeholders`);
  ok(sc.planes.every((p) => p.assetIndex === -1 && p.placeholder >= 1), "todos marcados como placeholder numerado");
}

console.log("\n== 11. Stagger y dirección ==");
{
  const s = withAssets(5);
  s.timing.stagger = 0.08;
  const sc = getScene(0.2, s);
  ok(new Set(sc.planes.map((p) => Math.round(p.pos[0]))).size > 1, "el stagger desfasa los planos");

  for (const dir of ["forward", "reverse", "pingpong"]) {
    const st = { ...s, timing: { ...s.timing, stagger: 0, direction: dir } };
    const frames = Array.from({ length: 12 }, (_, k) => getScene(k / 12, st));
    const bad = frames.some((f) => f.planes.some((p) => !Number.isFinite(p.pos[0])));
    ok(!bad, `dirección '${dir}' produce frames válidos`);
  }
}

// Las tres familias nuevas comparten los mismos cinco checks, así que se
// corren desde una sola tabla en vez de copiarlos tres veces.
const NUEVAS = ["tunnel", "wall"];

console.log("\n== 12. Familias nuevas: los cinco checks ==");
for (const id of NUEVAS) {
  const tpl = TEMPLATE_LIST.find((t) => t.id === id);
  console.log(`  -- ${id} --`);
  ok(!!tpl, `${id}: la familia existe`);
  if (!tpl) continue;

  // 2. El selector lista LIBRARY, no TEMPLATE_LIST: sin variantes de fábrica
  //    la familia existiría en el engine y sería invisible en la interfaz.
  ok((VARIANTS_BY_TEMPLATE[id] ?? []).length > 0, `${id}: aparece en el selector`);

  // 3. Con cero assets, placeholders numerados como el resto.
  const vacio = defaultState();
  vacio.template.id = id;
  const sc0 = getScene(0, vacio);
  const N = sc0.planes.length;
  ok(
    N > 0 && sc0.planes.every((p) => p.assetIndex === -1 && p.placeholder >= 1),
    `${id}: ${N} placeholders numerados sin assets`,
  );
  const nums = new Set(sc0.planes.map((p) => p.placeholder));
  ok(nums.size === N, `${id}: los ${N} placeholders tienen números distintos`);

  // 4. Cambiar el ratio no cambia la composición, sólo el marco. Es el mismo
  //    criterio del test 9: el lado menor siempre es 1080 y los planos se miden
  //    contra eso, así que su tamaño no puede depender del ratio.
  const conAssets = withAssets(6);
  conAssets.template.id = id;
  const firmas = ["1:1", "4:5", "9:16", "16:9"].map((r) => {
    const st = { ...conAssets, stage: { ...conAssets.stage, ratio: r } };
    const sc = getScene(0.25, st);
    return sc.planes
      .map((p) => `${Math.round(p.size[0])}x${Math.round(p.size[1])}`)
      .sort()
      .join("|");
  });
  ok(new Set(firmas).size === 1, `${id}: misma composición en los 4 ratios`);

  // 4b. Un param relativo que nadie convierte a px pasa todos los demás checks
  //     —un plano de 0.62px sigue estando "en cuadro"— y sólo se nota mirando.
  const anchos = getScene(0, conAssets).planes.map((p) => p.size[0]);
  ok(
    Math.min(...anchos) > 40 && Math.max(...anchos) < 4000,
    `${id}: los planos miden px de verdad (${Math.round(Math.min(...anchos))}–${Math.round(Math.max(...anchos))}px)`,
  );

  // 5. El indicador reporta un cierre alcanzable.
  const c = loopClosure(conAssets);
  ok(c.status !== "broken", `${id}: el indicador reporta cierre (status '${c.status}')`);
  if (c.suggested) {
    conAssets.timing.cycles = c.suggested;
    ok(
      loopClosure(conAssets).status === "ok",
      `${id}: con ${c.suggested} ciclos cierra de verdad`,
    );
  }
}

// El túnel se ancla en la cámara: la distancia a cámara de cada card —lo único
// que define su tamaño en pantalla— no puede depender del ratio.
console.log("\n== 12b. Tunnel: la profundidad no depende del ratio ==");
{
  const s = withAssets(6);
  s.template.id = "tunnel";
  const dists = ["1:1", "4:5", "9:16", "16:9"].map((r) => {
    const st = { ...s, stage: { ...s.stage, ratio: r } };
    const sc = getScene(0.3, st);
    return sc.planes
      .map((p) => Math.round(sc.camera.position[2] - p.pos[2]))
      .sort((a, b) => a - b)
      .join(",");
  });
  ok(new Set(dists).size === 1, `misma distancia a cámara en los 4 ratios`);

  // El wrap ocurre en el punto más cercano a cámara, donde la card tapa el
  // cuadro entero. Ahí la opacidad tiene que ser 0 o el salto se ve. Se mide con
  // el fade de aparición apagado, que es el caso peor.
  const st = { ...s, template: { ...s.template, params: { tunnel: { fadeIn: 0 } } } };
  let minDist = Infinity;
  let opAlWrap = 0;
  for (let k = 0; k < 480; k++) {
    const sc = getScene(k / 480, st);
    for (const pl of sc.planes) {
      const d = sc.camera.position[2] - pl.pos[2];
      if (d < minDist) {
        minDist = d;
        opAlWrap = pl.opacity;
      }
    }
  }
  ok(minDist > 100, `ninguna card cruza el near plane (mínimo ${Math.round(minDist)}px)`);
  ok(opAlWrap < 0.02, `en el punto de wrap la opacidad ya es 0 (${opAlWrap.toFixed(4)})`);
}

console.log("\n== 12c. Wall: la deriva recorre tiles enteros ==");
{
  const s = withAssets(6);
  s.template.id = "wall";
  s.timing.ease = [0, 0, 1, 1];

  // La deriva es un número entero de tiles, así que la geometría vuelve a su
  // lugar cada ciclo. Lo que tarda más es la asignación de imágenes: cada
  // columna hereda la de su vecina, y todo vuelve al arranque recién cuando
  // cada card volvió a su columna. El cierre declarado es ése, no el
  // geométrico, porque el badge no puede prometer un frame que no se repite.
  //
  // cols / gcd(cols, deriva) por columnas, y no depende de cuántos assets haya.
  for (const [cols, drift, esperado] of [
    [4, 1, 4],
    [4, 2, 2],
    [6, 1, 6],
    [5, 2, 5],
    [6, 3, 2],
  ]) {
    const st = { ...s, template: { ...s.template, params: { wall: { cols, drift } } } };
    const min = minCyclesFor(st);
    ok(min === esperado, `${cols} columnas × ${drift} tiles → ${esperado} ciclos (dio ${min})`);
    st.timing = { ...st.timing, cycles: min };
    ok(loopClosure(st).status === "ok", `  y con ${min} ciclos cierra de verdad`);
  }

  // Con 3 y 8 assets el número no cambia: las cards no rotan de imagen.
  for (const m of [3, 8]) {
    const st = withAssets(m);
    st.template.id = "wall";
    st.timing.ease = [0, 0, 1, 1];
    ok(minCyclesFor(st) === 4, `con ${m} assets sigue cerrando a los 4 ciclos`);
  }

  // Filas alternas: las impares se mueven al revés que las pares.
  const dx = (dir) => {
    const st = {
      ...s,
      template: { ...s.template, params: { wall: { rowDir: dir, tiltX: 0, tiltY: 0 } } },
    };
    const a = getScene(0, st).planes;
    const b = getScene(0.02, st).planes;
    const fila = (r) => {
      const i = r * 4;
      return b[i].pos[0] - a[i].pos[0];
    };
    return [fila(0), fila(1)];
  };
  const alt = dx("alternate");
  ok(alt[0] * alt[1] < 0, `alterno: fila 0 y fila 1 van en sentidos opuestos (${alt[0].toFixed(1)} vs ${alt[1].toFixed(1)})`);
  const uni = dx("uniform");
  ok(uni[0] * uni[1] > 0, `uniforme: las dos filas van para el mismo lado (${uni[0].toFixed(1)} vs ${uni[1].toFixed(1)})`);
}

console.log(fails === 0 ? "\nTODO OK\n" : `\n${fails} FALLAS\n`);
process.exit(fails ? 1 : 0);
