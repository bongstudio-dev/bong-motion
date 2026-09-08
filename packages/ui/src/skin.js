/* Skin de la plataforma. Hoy son dos: "dark" (el chasis de siempre) y "glass"
   (el approach claro que está a prueba). Vive en <html data-skin>, no en el
   estado de ninguna app: la elección es de la plataforma y tiene que sobrevivir
   al salto entre tools, que es una recarga completa.

   Se aplica en tiempo de import, antes de que React monte, para que no haya un
   flash del tema anterior. */

const KEY = "bong-motion:skin";
const MODE_KEY = "bong-motion:mode";
const SKINS = ["dark", "glass"];
const MODES = ["system", "light", "dark"];

function read(key, valid, fallback) {
  try {
    const v = localStorage.getItem(key);
    return valid.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* modo privado: la elección dura la sesión y listo */
  }
}

/* ============================================================================
   Claro / oscuro
   ============================================================================
   Dos atributos y no uno. `data-mode` es lo que ELIGIÓ la persona —system,
   light o dark— y es lo que se guarda. `data-theme` es el resultado ya
   resuelto, y es lo único que mira el CSS.

   Separarlos permite escribir los tokens oscuros UNA vez. Si el CSS tuviera que
   resolver "system" por su cuenta habría que duplicar el bloque entero: una
   copia bajo `[data-mode="dark"]` y otra adentro de una media query de
   prefers-color-scheme, porque un selector y una media query no se pueden unir
   en la misma regla. Dos copias del mismo bloque de color es exactamente el
   tipo de cosa que se desincroniza. */

const darkQuery =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export function getMode() {
  return document.documentElement.dataset.mode || "system";
}

export function resolveTheme(mode = getMode()) {
  if (mode === "light" || mode === "dark") return mode;
  return darkQuery?.matches ? "dark" : "light";
}

function applyMode(mode) {
  document.documentElement.dataset.mode = mode;
  document.documentElement.dataset.theme = resolveTheme(mode);
  // Las perillas se guardan por tema: al cambiar hay que traer las del que
  // entra, o quedan puestas las del que salió.
  applyGlass?.();
}

export function setMode(mode) {
  const next = MODES.includes(mode) ? mode : "system";
  applyMode(next);
  write(MODE_KEY, next);
  return next;
}

export function cycleMode() {
  const i = MODES.indexOf(getMode());
  return setMode(MODES[(i + 1) % MODES.length]);
}

// Con el modo en "system", cambiar el tema del sistema tiene que verse sin
// recargar. El listener queda puesto siempre y no hace nada si hay override.
//
// Va con red: el evento `change` de prefers-color-scheme no siempre llega
// —pasa con la emulación de DevTools, y con la pestaña en segundo plano—, así
// que también se re-resuelve al volver a la ventana. Es leer un booleano, no
// cuesta nada, y evita quedarse en el tema viejo hasta la próxima recarga.
function resyncTheme() {
  if (getMode() === "system") applyMode("system");
}

export function getSkin() {
  return document.documentElement.dataset.skin || "dark";
}

export function setSkin(skin) {
  const next = SKINS.includes(skin) ? skin : "dark";
  document.documentElement.dataset.skin = next;
  write(KEY, next);
  next === "glass" ? startLight() : stopLight();
  return next;
}

export function toggleSkin() {
  return setSkin(getSkin() === "glass" ? "dark" : "glass");
}

/* ============================================================================
   Luz del cursor sobre los cristales
   ============================================================================
   La idea no es dibujar una luz sino que los reflejos de cada panel respondan
   al cursor. Se modela como UNA fuente en la sala: a cada superficie se le
   pasa dónde cae esa luz EN SUS PROPIAS COORDENADAS, en porcentaje y sin
   recortar al 0-100. El CSS pinta un degradado enorme centrado en ese punto,
   así que un panel que queda lejos recibe el punto fuera de su caja y sólo le
   toca la cola del degradado — el desvanecimiento por distancia sale gratis y
   es el correcto, sin ningún término de atenuación inventado.

   Variables que se escriben por elemento:
     --lx, --ly  posición de la luz dentro del elemento, en %
     --nx, --ny  dirección normalizada del centro al cursor (-1..1), para el
                 filo especular: se prende el canto que mira a la luz
     --li        cercanía 0..1, sólo para modular la fuerza de ese filo

   Un solo rAF, y adentro primero se leen TODOS los rects y después se escriben
   TODAS las variables. Leer y escribir intercalado en el mismo frame fuerza un
   recálculo de layout por elemento. */

/* ============================================================================
   Perillas del cristal
   ============================================================================
   El material no se ajusta a ojo recompilando: se ajusta con las perillas de
   abajo, en vivo y sobre la interfaz de verdad. Cada una vive en un solo lado
   —o la lee el CSS o la lee el motor de luz— y `where` dice cuál.

   Los defaults NO están acá. Los de CSS salen del propio skin-glass.css (uno
   por tema) y se leen del computed style; los de JS están en `js`. Guardar sólo
   lo que se movió es lo que permite que "reset" sea borrar y listo, y que
   cambiar un default en el CSS se note sin tener que limpiar el localStorage.

   Los valores se guardan por tema: el mismo reflejo que sobre crema es sutil,
   sobre verde profundo es una mancha. */

export const GLASS_PARAMS = [
  { group: "Luz", key: "light", label: "Intensidad", min: 0, max: 1, step: 0.005, where: "css",
    hint: "El pico del reflejo. Es la perilla del contraste del glossy." },
  { group: "Luz", key: "contrast", label: "Contraste", min: 0, max: 0.4, step: 0.005, where: "css",
    hint: "Cuánto se hunde el lado opuesto. Es lo que le da dirección al reflejo." },
  { group: "Luz", key: "spread", label: "Difusión", min: 0.3, max: 2.5, step: 0.02, where: "css",
    hint: "Qué tan abierto es el degradado. Bajo se ve la mancha; alto es un lado más claro que el otro." },
  { group: "Luz", key: "edge", label: "Filo", min: 0, max: 1.6, step: 0.02, where: "css",
    hint: "Brillo del canto que mira a la luz." },

  { group: "Reactividad", key: "follow", label: "Seguimiento", min: 0, max: 2.5, step: 0.02, where: "js",
    hint: "Cuánto se corre la luz con el cursor. En 0 queda fija; arriba de 1 exagera." },
  { group: "Reactividad", key: "inertia", label: "Inercia", min: 0, max: 0.96, step: 0.01, where: "js",
    hint: "El retardo. La luz persigue al cursor en vez de saltar con él." },
  { group: "Reactividad", key: "warp", label: "Deformación", min: 0, max: 1.5, step: 0.02, where: "js",
    hint: "El reflejo se estira en la dirección del movimiento y vuelve al parar." },
  { group: "Reactividad", key: "reach", label: "Alcance", min: 120, max: 2000, step: 20, where: "js", unit: "px",
    hint: "A qué distancia un panel deja de responder al cursor." },

  { group: "Material", key: "blur", label: "Desenfoque", min: 0, max: 60, step: 1, where: "css", unit: "px" },
  { group: "Material", key: "sat", label: "Saturación", min: 0.4, max: 2.4, step: 0.02, where: "css" },
  { group: "Material", key: "opacity", label: "Opacidad", min: 0, max: 1, step: 0.005, where: "css" },

  { group: "Profundidad", key: "shadow", label: "Sombra", min: 0, max: 2.5, step: 0.02, where: "css" },
  { group: "Profundidad", key: "lift", label: "Elevación", min: 0, max: 3, step: 0.02, where: "css" },
  { group: "Profundidad", key: "parallax", label: "Paralaje", min: 0, max: 14, step: 0.5, where: "css", unit: "px" },

  { group: "Movimiento", key: "speed", label: "Velocidad", min: 0.2, max: 3, step: 0.05, where: "css",
    hint: "Multiplica la duración de todas las transiciones del skin." },
];

const BY_KEY = Object.fromEntries(GLASS_PARAMS.map((p) => [p.key, p]));
const CSS_UNIT = { blur: "px", parallax: "px" };

// Defaults del motor de luz. Los del CSS se leen del stylesheet.
const JS_DEFAULTS = { follow: 1, inertia: 0.16, warp: 0.35, reach: 720 };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const GLASS_KEY = "bong-motion:glass";
let overrides = { light: {}, dark: {} };

function loadGlass() {
  try {
    const raw = JSON.parse(localStorage.getItem(GLASS_KEY) || "{}");
    for (const theme of ["light", "dark"]) {
      const src = raw?.[theme];
      if (!src || typeof src !== "object") continue;
      for (const [k, v] of Object.entries(src)) {
        if (BY_KEY[k] && Number.isFinite(v)) overrides[theme][k] = v;
      }
    }
  } catch {
    /* sin perillas guardadas, o storage bloqueado */
  }
}

function saveGlass() {
  try {
    localStorage.setItem(GLASS_KEY, JSON.stringify(overrides));
  } catch {
    /* las perillas duran la sesión */
  }
}

/* El default de una perilla de CSS es lo que dice el stylesheet para el tema
   activo. Se lee quitando el override en línea y preguntando el computed: así
   el CSS sigue siendo la fuente de verdad y nadie tiene que mantener los
   mismos números en dos lugares. */
const cssDefaults = { light: {}, dark: {} };

function readCssDefault(key) {
  const theme = resolveTheme();
  const cache = cssDefaults[theme];
  if (key in cache) return cache[key];
  const root = document.documentElement;
  const inline = root.style.getPropertyValue("--g-" + key);
  if (inline) root.style.removeProperty("--g-" + key);
  const raw = getComputedStyle(root).getPropertyValue("--g-" + key).trim();
  if (inline) root.style.setProperty("--g-" + key, inline);
  cache[key] = parseFloat(raw) || 0;
  return cache[key];
}

export function glassDefault(key) {
  return BY_KEY[key]?.where === "js" ? JS_DEFAULTS[key] : readCssDefault(key);
}

export function getGlass(key) {
  const theme = resolveTheme();
  const v = overrides[theme][key];
  return Number.isFinite(v) ? v : glassDefault(key);
}

export function isGlassTweaked(key) {
  return Number.isFinite(overrides[resolveTheme()][key]);
}

export function anyGlassTweaked() {
  return Object.keys(overrides[resolveTheme()]).length > 0;
}

export function setGlass(key, value) {
  const spec = BY_KEY[key];
  if (!spec) return;
  overrides[resolveTheme()][key] = clamp(value, spec.min, spec.max);
  applyGlass();
  saveGlass();
}

export function resetGlass() {
  overrides[resolveTheme()] = {};
  applyGlass();
  saveGlass();
}

/* Escribe en línea sobre <html> sólo las perillas movidas. Las que están en el
   default no se escriben: así el CSS manda y el reset es borrar. */
function applyGlass() {
  const root = document.documentElement;
  const theme = resolveTheme();
  for (const spec of GLASS_PARAMS) {
    if (spec.where !== "css") continue;
    const v = overrides[theme][spec.key];
    if (Number.isFinite(v)) {
      root.style.setProperty("--g-" + spec.key, v + (CSS_UNIT[spec.key] ?? ""));
    } else {
      root.style.removeProperty("--g-" + spec.key);
    }
  }
}

/* Las perillas movidas, en CSS, para poder pegarlas en el stylesheet cuando el
   ajuste ya está bueno. Una maqueta que no se puede volcar a código obliga a
   copiar números a mano de una captura. */
export function glassAsCss() {
  const theme = resolveTheme();
  const moved = GLASS_PARAMS.filter((p) => Number.isFinite(overrides[theme][p.key]));
  if (!moved.length) return "/* nada movido en el tema " + theme + " */";
  const sel =
    theme === "dark"
      ? ':root[data-skin="glass"][data-theme="dark"] {'
      : ':root[data-skin="glass"] {';
  const css = moved
    .filter((p) => p.where === "css")
    .map((p) => `  --g-${p.key}: ${overrides[theme][p.key]}${CSS_UNIT[p.key] ?? ""};`);
  const js = moved
    .filter((p) => p.where === "js")
    .map((p) => `  ${p.key}: ${overrides[theme][p.key]},`);
  let out = css.length ? [sel, ...css, "}"].join("\n") : "";
  if (js.length) out += (out ? "\n\n" : "") + "// JS_DEFAULTS en skin.js\n" + js.join("\n");
  return out;
}

const SEL =
  ".tool-rail, .sidebar-head, .section, .library, .transport, .float-panel, .modal";

/* Controles que reciben el hover localizado. El realce no se pinta parejo sobre
   toda la superficie sino como una luz chica bajo el cursor, así que además de
   saber cuál está apuntado hay que saber en qué punto de él. */
const HOVER_SEL = [
  ".section-head",
  ".btn",
  ".pick",
  ".tool-rail-item",
  ".browser-row",
  ".browser-head",
  ".asset-row",
  ".color-row",
  ".text-row",
  ".saved-row",
  ".preset-thumb",
  ".ease-cell",
  ".pos-cell",
  ".icon-btn",
  ".library-tabs button",
].join(",");
// Afuera quedan a propósito los verdes (.ratio-switch, .transport .btn,
// .btn.primary) y el segmentado: van con hover plano y no leen --hx/--hy, así
// que trackearlos sería escribir variables que nadie usa.

let running = false;
let frame = 0;
let mx = -9999; // el cursor, crudo
let my = -9999;
let lightX = -9999; // la luz, que lo persigue con inercia
let lightY = -9999;
let warpX = 1; // estiramiento del reflejo por velocidad
let warpY = 1;
let target = null; // el control apuntado ahora mismo
let hovered = null; // el que tiene escritas las coordenadas

function onMove(e) {
  mx = e.clientX;
  my = e.clientY;
  // El closest se resuelve acá y no en el rAF: para cuando corra el frame el
  // evento ya no existe y e.target puede haberse desmontado.
  target = e.target?.closest?.(HOVER_SEL) ?? null;
  if (!frame) frame = requestAnimationFrame(paint);
}

/* Sólo se le escriben coordenadas al control apuntado. Recorrer todos los
   controles de la interfaz en cada movimiento no haría falta: los demás no
   tienen hover y su gradiente está en intensidad cero. */
function paintHover() {
  if (target !== hovered) {
    if (hovered) {
      hovered.style.removeProperty("--hx");
      hovered.style.removeProperty("--hy");
    }
    hovered = target;
  }
  if (!hovered) return;
  const r = hovered.getBoundingClientRect();
  hovered.style.setProperty("--hx", (mx - r.left).toFixed(1) + "px");
  hovered.style.setProperty("--hy", (my - r.top).toFixed(1) + "px");
}

/* Un frame. La luz no está donde está el cursor: lo persigue.
   - Inercia: la posición se acerca a la del cursor una fracción por frame.
     Es un solo lerp y es lo que hace que el reflejo se sienta pesado en vez de
     pegado al mouse. Mientras no llegó, el rAF se vuelve a pedir solo — si sólo
     corriera con el evento, al soltar el mouse la luz quedaría a mitad de
     camino congelada.
   - Deformación: la velocidad estira el degradado en el eje en que se mueve, y
     vuelve sola al frenar. Es lo que hace que el reflejo se lea como algo que
     tiene cuerpo y no como una imagen que se reposiciona. */
function paint() {
  frame = 0;

  const inertia = getGlass("inertia");
  const follow = getGlass("follow");
  const warp = getGlass("warp");
  const reach = getGlass("reach");

  // Primer frame: la luz aparece donde está el cursor, sin viaje desde el
  // rincón en el que arrancó.
  if (lightX < -9000) {
    lightX = mx;
    lightY = my;
  }

  const k = 1 - inertia;
  const prevX = lightX;
  const prevY = lightY;
  lightX += (mx - lightX) * k;
  lightY += (my - lightY) * k;

  // Velocidad de la luz, no la del cursor: así la deformación también hereda
  // el retardo y no aparece un frame antes que el movimiento.
  const vx = Math.abs(lightX - prevX);
  const vy = Math.abs(lightY - prevY);
  const norm = (v) => v / (v + 90); // satura suave, sin tope duro
  warpX += (1 + warp * norm(vx) - warpX) * 0.25;
  warpY += (1 + warp * norm(vy) - warpY) * 0.25;

  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--lwx", warpX.toFixed(3));
  rootStyle.setProperty("--lwy", warpY.toFixed(3));

  const els = document.querySelectorAll(SEL);
  const n = els.length;

  // Fase de lectura.
  const box = new Array(n);
  for (let i = 0; i < n; i++) box[i] = els[i].getBoundingClientRect();

  // Fase de escritura.
  for (let i = 0; i < n; i++) {
    const r = box[i];
    if (!r.width || !r.height) continue;

    // `follow` escala el corrimiento respecto del centro del panel, no la
    // posición absoluta: en 0 la luz queda clavada en el medio de cada panel y
    // en 2 se va al doble de lejos que el cursor.
    const rawX = ((lightX - r.left) / r.width) * 100;
    const rawY = ((lightY - r.top) / r.height) * 100;
    const lx = clamp(50 + (rawX - 50) * follow, -320, 420);
    const ly = clamp(50 + (rawY - 50) * follow, -320, 420);

    const dx = lightX - (r.left + r.width / 2);
    const dy = lightY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy) || 1;

    // Distancia al borde más cercano, 0 si la luz está encima.
    const ox = Math.max(r.left - lightX, 0, lightX - r.right);
    const oy = Math.max(r.top - lightY, 0, lightY - r.bottom);
    const t = clamp(1 - Math.hypot(ox, oy) / reach, 0, 1);

    const s = els[i].style;
    s.setProperty("--lx", lx.toFixed(1) + "%");
    s.setProperty("--ly", ly.toFixed(1) + "%");
    s.setProperty("--nx", (dx / len).toFixed(3));
    s.setProperty("--ny", (dy / len).toFixed(3));
    s.setProperty("--li", (t * t * (3 - 2 * t)).toFixed(3)); // smoothstep
  }

  paintHover();

  // Seguir mientras la luz no llegó o el estiramiento no volvió a uno.
  const quieta =
    Math.abs(mx - lightX) < 0.4 &&
    Math.abs(my - lightY) < 0.4 &&
    Math.abs(warpX - 1) < 0.002 &&
    Math.abs(warpY - 1) < 0.002;
  if (!quieta && !frame) frame = requestAnimationFrame(paint);
}

function startLight() {
  if (running) return;
  // Con reduced-motion el cristal se queda con la luz cenital del CSS.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  running = true;
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("scroll", onMove, { passive: true, capture: true });
  window.addEventListener("resize", onMove, { passive: true });
}

function stopLight() {
  if (!running) return;
  running = false;
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("scroll", onMove, { capture: true });
  window.removeEventListener("resize", onMove);
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  // Devolver las variables al default del CSS: si se apaga el skin con el
  // cursor en un rincón, los paneles no quedan congelados con esa luz.
  if (hovered) {
    hovered.style.removeProperty("--hx");
    hovered.style.removeProperty("--hy");
    hovered = null;
  }
  target = null;
  lightX = -9999;
  lightY = -9999;
  warpX = 1;
  warpY = 1;
  document.documentElement.style.removeProperty("--lwx");
  document.documentElement.style.removeProperty("--lwy");
  document.querySelectorAll(SEL).forEach((el) => {
    el.style.removeProperty("--lx");
    el.style.removeProperty("--ly");
    el.style.removeProperty("--nx");
    el.style.removeProperty("--ny");
    el.style.removeProperty("--li");
  });
}

if (typeof document !== "undefined") {
  document.documentElement.dataset.skin = read(KEY, SKINS, "dark");
  applyMode(read(MODE_KEY, MODES, "system"));
  loadGlass();
  applyGlass();
  darkQuery?.addEventListener?.("change", resyncTheme);
  window.addEventListener("focus", resyncTheme);
  document.addEventListener("visibilitychange", resyncTheme);
  if (getSkin() === "glass") {
    // El listener puede engancharse ya; el primer paint espera al DOM.
    startLight();
  }
}
