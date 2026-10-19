// Floss Tween: de estado del motor a primitivas de dibujo en px de pantalla.
// La UI (React/SVG) y el exportador de video solo tienen que pintar lo que sale de acá;
// las reglas finas del After (factor de trazo, punteado sobre el trim, etiquetas que leen
// un vértice del logo) viven en este archivo y en engine.js, en ningún otro lado.
import { estadoEn, escalaPx, curva } from './engine.js';

const lerp = (a, b, u) => a + (b - a) * u;
const lerpForma = (a, b, u) =>
  !b || u <= 0 ? a : u >= 1 ? b : {
    v: a.v.map((p, i) => [lerp(p[0], b.v[i][0], u), lerp(p[1], b.v[i][1], u)]),
    in: a.in.map((p, i) => [lerp(p[0], b.in[i][0], u), lerp(p[1], b.in[i][1], u)]),
    out: a.out.map((p, i) => [lerp(p[0], b.out[i][0], u), lerp(p[1], b.out[i][1], u)]),
    cerrado: a.cerrado,
  };

const n2 = (v) => Math.round(v * 100) / 100;

// Forma en U -> atributo d en px.
function pathD(f, P) {
  const pts = f.v.map(P);
  const abs = (i, t) => P([f.v[i][0] + t[0], f.v[i][1] + t[1]]);
  let d = `M${n2(pts[0][0])} ${n2(pts[0][1])}`;
  const tramo = (i, j) => {
    const c1 = abs(i, f.out[i]), c2 = abs(j, f.in[j]);
    d += `C${n2(c1[0])} ${n2(c1[1])} ${n2(c2[0])} ${n2(c2[1])} ${n2(pts[j][0])} ${n2(pts[j][1])}`;
  };
  for (let i = 0; i + 1 < pts.length; i++) tramo(i, i + 1);
  if (f.cerrado) { tramo(pts.length - 1, 0); d += 'Z'; }
  return d;
}

// Forma del grupo del logo en el estado actual (con el ajuste de su letra aplicado).
function formasGrupo(g, est) {
  const p = g.letra ? est.ajustes[g.letra]?.p ?? 0 : 0;
  const u = g.curvaMorph ? curva(g.curvaMorph)(p) : p;
  return g.formas.map((f) => lerpForma(f.a, f.b, u));
}

// Primitivas ordenadas de atrás hacia adelante:
//   { tipo: 'path', d, fill, fillRule, stroke, strokeWidth, dash: [d, g] | null, dashOffset, opacity }
//   { tipo: 'texto', x, y, size, texto, fill, fuente, letterSpacing, opacity }
export function primitivas(geo, doc, linea, t, ancho, alto) {
  const est = estadoEn(doc, linea, t);
  const { cam, trazo: k } = est;
  const s = escalaPx(cam.zoom, ancho, alto);
  const P = ([ux, uy]) => [ancho / 2 + s * (ux - cam.foco[0]), alto / 2 + s * (uy - cam.foco[1])];
  const C = geo.controles;
  const capas = [];

  const trazoPx = (tr) => {
    const w = (tr.ancho != null ? tr.ancho * C.ancho * k : tr.anchoFijo) * s;
    const pd = tr.punteado;
    return {
      stroke: tr.color, strokeWidth: n2(w),
      dash: pd ? [n2(pd.dash * C.dash * k * s), n2(pd.gap * C.gap * k * s)] : null,
      dashOffset: pd ? n2(-pd.offset * C.offset * k * s) : 0,
    };
  };

  // Logo
  if (geo.logo) {
    const formasPorGrupo = {};
    for (const g of geo.logo.grupos) {
      const fs = formasGrupo(g, est);
      formasPorGrupo[g.id] = fs;
      capas.push({ orden: geo.logo.orden, prim: {
        tipo: 'path', d: fs.map((f) => pathD(f, P)).join(''), fill: g.relleno, fillRule: g.regla,
        stroke: null, opacity: geo.logo.opacidad } });
    }
    // Etiquetas COORD: leen un vértice del grupo ya ajustado; el texto es su X en U.
    for (const e of geo.etiquetas) {
      const aj = est.ajustes[e.letra];
      if (!aj || aj.ventana <= 0) continue;
      const v = formasPorGrupo[e.grupo][0].v[e.vertice];
      const [x, y] = P([v[0] + e.desvio[0] * k, v[1] + e.desvio[1] * k]);
      capas.push({ orden: e.orden, prim: {
        tipo: 'texto', x: n2(x), y: n2(y), size: n2(e.tamano * k * s), texto: v[0].toFixed(3),
        fill: e.color, fuente: e.fuente, letterSpacing: e.tracking / 1000, opacity: aj.ventana } });
    }
  }

  // Contornos ORIGINAL punteados
  for (const [letra, o] of Object.entries(geo.originales)) {
    const op = est.ajustes[letra]?.original ?? 0;
    if (!o.visible || op <= 0) continue;
    capas.push({ orden: o.orden, prim: { tipo: 'path', d: pathD(o.forma, P), fill: null, opacity: op, ...trazoPx(o.trazo) } });
  }

  // Líneas de construcción. El trim deja visible [1 - f, 1] del segmento y el punteado
  // arranca en el inicio recortado (como en After: el trim modifica el path antes del trazo).
  for (const l of geo.lineas) {
    const f = l.animada ? est.lineas[l.id] ?? 0 : 1;
    if (f <= 0) continue;
    const [a, b] = l.forma.v;
    const u0 = 1 - f;
    const ini = [lerp(a[0], b[0], u0), lerp(a[1], b[1], u0)];
    const p0 = P(ini), p1 = P(b);
    capas.push({ orden: l.orden, prim: {
      tipo: 'path', d: `M${n2(p0[0])} ${n2(p0[1])}L${n2(p1[0])} ${n2(p1[1])}`, fill: null, opacity: 1, ...trazoPx(l.trazo) } });
  }

  // Marcadores
  for (const m of geo.marcadores) {
    const aj = m.letra ? est.ajustes[m.letra] : null;
    const lado = m.lado * k * (aj ? 1 + 0.35 * aj.ventana : 1);
    const cx = m.centro[0] + (aj ? m.dx * aj.p : 0), cy = m.centro[1];
    const h = lado / 2;
    const q = [P([cx - h, cy - h]), P([cx + h, cy - h]), P([cx + h, cy + h]), P([cx - h, cy + h])];
    capas.push({ orden: m.orden, prim: {
      tipo: 'path', d: 'M' + q.map((p) => `${n2(p[0])} ${n2(p[1])}`).join('L') + 'Z', fill: m.relleno, stroke: null, opacity: 1 } });
  }

  // En After el índice 1 queda arriba: se pinta del índice mayor al menor.
  capas.sort((x, y) => y.orden - x.orden);
  return { estado: est, prims: capas.map((c) => c.prim) };
}

// SVG completo como string (para verificar contra After y para exportar cuadros).
export function aSVG(prims, ancho, alto, fondo) {
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const el = prims.map((p) => {
    const op = p.opacity < 1 ? ` opacity="${n2(p.opacity)}"` : '';
    if (p.tipo === 'texto')
      return `<text x="${p.x}" y="${p.y}" font-family="Satoshi" font-weight="500" font-size="${p.size}" letter-spacing="${p.letterSpacing}em" fill="${p.fill}"${op}>${esc(p.texto)}</text>`;
    const fill = p.fill ? ` fill="${p.fill}"${p.fillRule === 'evenodd' ? ' fill-rule="evenodd"' : ''}` : ' fill="none"';
    const st = p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.strokeWidth}"${p.dash ? ` stroke-dasharray="${p.dash.join(' ')}" stroke-dashoffset="${p.dashOffset}"` : ''}` : '';
    return `<path d="${p.d}"${fill}${st}${op}/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}"><rect width="100%" height="100%" fill="${fondo}"/>${el.join('')}</svg>`;
}
