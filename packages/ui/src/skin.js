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

const REACH = 720; // px: a esta distancia del panel el filo ya no responde
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

let running = false;
let frame = 0;
let mx = -9999;
let my = -9999;
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

function paint() {
  frame = 0;
  const els = document.querySelectorAll(SEL);
  const n = els.length;
  if (!n) {
    paintHover();
    return;
  }

  // Fase de lectura.
  const box = new Array(n);
  for (let i = 0; i < n; i++) box[i] = els[i].getBoundingClientRect();

  // Fase de escritura.
  for (let i = 0; i < n; i++) {
    const r = box[i];
    if (!r.width || !r.height) continue;

    const lx = clamp(((mx - r.left) / r.width) * 100, -320, 420);
    const ly = clamp(((my - r.top) / r.height) * 100, -320, 420);

    const dx = mx - (r.left + r.width / 2);
    const dy = my - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy) || 1;

    // Distancia al borde más cercano, 0 si el cursor está encima.
    const ox = Math.max(r.left - mx, 0, mx - r.right);
    const oy = Math.max(r.top - my, 0, my - r.bottom);
    const t = clamp(1 - Math.hypot(ox, oy) / REACH, 0, 1);

    const s = els[i].style;
    s.setProperty("--lx", lx.toFixed(1) + "%");
    s.setProperty("--ly", ly.toFixed(1) + "%");
    s.setProperty("--nx", (dx / len).toFixed(3));
    s.setProperty("--ny", (dy / len).toFixed(3));
    s.setProperty("--li", (t * t * (3 - 2 * t)).toFixed(3)); // smoothstep
  }

  paintHover();
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
  darkQuery?.addEventListener?.("change", resyncTheme);
  window.addEventListener("focus", resyncTheme);
  document.addEventListener("visibilitychange", resyncTheme);
  if (getSkin() === "glass") {
    // El listener puede engancharse ya; el primer paint espera al DOM.
    startLight();
  }
}
