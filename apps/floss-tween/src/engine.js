// Floss Tween: motor puro (sin DOM). Traduce el rig de After "Flos log v7 empujes"
// a funciones de tiempo. Todo lo que dibuja la UI sale de acá; ver SPEC.md.
//
// Unidades de mundo: "unidades de etiqueta" (U), las mismas que muestran los textos
// COORD del After y que usa el punto Foco. Un punto del logo en el espacio del
// NULL CONTROL de la comp base vale U = c + ORIGEN_U.

export const ORIGEN_U = [303.3, 177.9];

// px de pantalla por unidad U con zoom 100, en la comp de referencia (lado corto 1080).
// Sale de 0.65 (escala de la capa base) * 2.42 (escala del NULL CONTROL en base) / 100.
export const K = 0.0065 * 2.42;
export const LADO_REF = 1080;

// Por encima de este zoom los trazos, dashes, marcadores y etiquetas dejan de crecer.
export const ZOOM_TOPE_TRAZO = 221;

// ---------- curvas ----------

// cubic-bezier(x1, y1, x2, y2) igual que CSS. Una key de After con velocidad 0 e
// influencias o (salida) / i (entrada) equivale a [o/100, 0, 1 - i/100, 1].
export function bezier([x1, y1, x2, y2]) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (s) => ((ax * s + bx) * s + cx) * s;
  const Y = (s) => ((ay * s + by) * s + cy) * s;
  const dX = (s) => (3 * ax * s + 2 * bx) * s + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let s = x;
    for (let i = 0; i < 8; i++) {
      const e = X(s) - x;
      if (Math.abs(e) < 1e-7) return Y(s);
      const d = dX(s);
      if (Math.abs(d) < 1e-6) break;
      s -= e / d;
    }
    // Curvas extremas como [1,0,0,1] tienen derivada casi nula en los bordes: bisección.
    let lo = 0, hi = 1;
    s = x;
    for (let i = 0; i < 40; i++) {
      const v = X(s);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = s; else hi = s;
      s = (lo + hi) / 2;
    }
    return Y(s);
  };
}

const cacheCurvas = new Map();
export function curva(c) {
  const k = c.join(',');
  if (!cacheCurvas.has(k)) cacheCurvas.set(k, bezier(c));
  return cacheCurvas.get(k);
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, u) => a + (b - a) * u;
const lerp2 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];

// Zoom en escala logarítmica, como la expresión zs() del After: a mitad de camino
// el zoom es la media geométrica, así el acercamiento se siente parejo.
export function zoomLog(a, b, u) {
  if (a <= 0 || b <= 0 || Math.abs(b - a) < 1e-6) return lerp(a, b, u);
  return a * Math.pow(b / a, u);
}

// ---------- línea de tiempo de escenas ----------

// Arma los tiempos absolutos. Cada escena empieza cuando la cámara llega (inicio de la
// parada), dura `parada` segundos y después viaja `transicion.dur` a la siguiente.
export function armarLinea(doc) {
  let t = 0;
  const escenas = doc.escenas.map((e, i) => {
    const inicio = t;
    const finParada = inicio + e.parada;
    const ultima = i === doc.escenas.length - 1;
    const dur = ultima ? 0 : e.transicion.dur;
    t = finParada + dur;
    return { ...e, i, inicio, finParada, finTransicion: t };
  });
  const porId = Object.fromEntries(escenas.map((e) => [e.id, e]));
  return { escenas, porId, duracion: t };
}

function estadoFinal(e) {
  return e.deriva ? { foco: e.deriva.foco ?? e.foco, zoom: e.deriva.zoom ?? e.zoom } : { foco: e.foco, zoom: e.zoom };
}

// Cámara en el tiempo t: { foco: [Ux, Uy], zoom }
export function camaraEn(linea, t) {
  const E = linea.escenas;
  if (t <= 0) return { foco: E[0].foco, zoom: E[0].zoom };
  for (let i = 0; i < E.length; i++) {
    const e = E[i];
    if (t < e.finParada || i === E.length - 1) {
      if (!e.deriva || e.parada <= 0) return { foco: e.foco, zoom: e.zoom };
      const fin = estadoFinal(e);
      const u = curva(e.deriva.curva)(clamp01((t - e.inicio) / e.parada));
      return { foco: lerp2(e.foco, fin.foco, u), zoom: zoomLog(e.zoom, fin.zoom, u) };
    }
    if (t < e.finTransicion) {
      const a = estadoFinal(e), b = E[i + 1];
      const x = clamp01((t - e.finParada) / e.transicion.dur);
      const u = curva(e.transicion.curva)(x);
      // curvaFoco es opcional: si no está, paneo y zoom van con la misma curva (un solo gesto).
      const uf = e.transicion.curvaFoco ? curva(e.transicion.curvaFoco)(x) : u;
      return { foco: lerp2(a.foco, b.foco, uf), zoom: zoomLog(a.zoom, b.zoom, u) };
    }
  }
}

// ---------- proyección ----------

// Escala en px por unidad U para un viewport dado. Se toma el lado corto como
// referencia: 1920x1080 da exactamente lo mismo que After; en vertical se ve igual de
// grande que en la comp 1080x1350.
export function escalaPx(zoom, ancho, alto) {
  return K * zoom * (Math.min(ancho, alto) / LADO_REF);
}

// Mundo (U) a pantalla (px). El foco cae siempre en el centro del viewport.
export function proyectar([ux, uy], cam, ancho, alto) {
  const s = escalaPx(cam.zoom, ancho, alto);
  return [ancho / 2 + s * (ux - cam.foco[0]), alto / 2 + s * (uy - cam.foco[1])];
}

// Factor de "no escalar más": multiplica en unidades de mundo los trazos, dashes,
// marcadores y etiquetas. Con zoom > 221 se mantienen del mismo tamaño en pantalla.
export function factorTrazo(zoom) {
  return Math.min(1, ZOOM_TOPE_TRAZO / zoom);
}

// ---------- eventos ----------

function tiempoEvento(linea, ev) {
  const e = linea.porId[ev.escena];
  if (!e) throw new Error(`Evento apunta a escena inexistente: ${ev.escena}`);
  const t0 = e.inicio + (ev.offset ?? 0);
  return [t0, t0 + ev.dur];
}

// Progreso 0..1 de un tramo { escena, offset, dur, curva }.
export function progreso(linea, tramo, t) {
  const [t0, t1] = tiempoEvento(linea, tramo);
  if (t1 <= t0) return t >= t0 ? 1 : 0;
  return curva(tramo.curva)(clamp01((t - t0) / (t1 - t0)));
}

const linealVentana = (t, a, b, va, vb) => (b <= a ? (t >= b ? vb : va) : lerp(va, vb, clamp01((t - a) / (b - a))));
// ease() de After: smoothstep sobre el tramo.
const easeAE = (t, a, b, va, vb) => {
  const u = clamp01((t - a) / (b - a));
  return lerp(va, vb, u * u * (3 - 2 * u));
};

// Estado de un ajuste de letra (F, S1, S2) en t.
//   p        0..1, cuánto avanzó la letra hacia su forma ajustada
//   ventana  0..1, visibilidad de la etiqueta COORD y el agrandado de marcadores
//   original 0..0.85, opacidad del contorno ORIGINAL punteado
export function ajusteEn(linea, ev, t, salidaOriginal) {
  const [t0, t1] = tiempoEvento(linea, ev);
  const p = progreso(linea, ev, t);
  const ventana = linealVentana(t, t0 - 0.25, t0, 0, 1) * linealVentana(t, t1 + 0.2, t1 + 0.35, 1, 0);
  let original = 0.85 * easeAE(t, t0 - 0.25, t0 - 0.05, 0, 1);
  if (salidaOriginal) original *= 1 - progreso(linea, salidaOriginal, t);
  return { p, ventana, original };
}

// Trim de una línea: cuánto está dibujada (0..1). En After es Trim Start 100 -> 0 al
// entrar y 0 -> 100 al salir, o sea que se dibuja desde el final hacia el principio.
// `lin` = { entra: tramo, sale: tramo | null }, cada tramo atado a su escena.
export function lineaEn(linea, lin, t) {
  const entra = lin.entra ? progreso(linea, lin.entra, t) : 1;
  const sale = lin.sale ? progreso(linea, lin.sale, t) : 0;
  return entra * (1 - sale);
}

// Todo el estado animable en t, listo para que la UI lo dibuje.
export function estadoEn(doc, linea, t) {
  const cam = camaraEn(linea, t);
  const salida = doc.eventos.find((e) => e.tipo === 'salidaOriginales');
  const ajustes = {};
  for (const ev of doc.eventos) if (ev.tipo === 'ajuste') ajustes[ev.letra] = ajusteEn(linea, ev, t, salida);
  const lineas = {};
  for (const [id, lin] of Object.entries(doc.lineas ?? {})) lineas[id] = lineaEn(linea, lin, t);
  return { t, cam, trazo: factorTrazo(cam.zoom), ajustes, lineas };
}
