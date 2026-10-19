import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { capturar } from '../captura.js';
import { primitivas } from '../dibujo.js';
import { escalaPx } from '../engine.js';
import { editarEscena, escenaEn } from '../docops.js';
import geo from '../geometria-floss.json';

export const ASPECTOS = {
  '16:9': [16, 9],
  '4:5': [4, 5],
  '9:16': [9, 16],
};

const ZOOM_MIN = 10, ZOOM_MAX = 3000;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// La vista pinta lo que devuelve primitivas() y nada más. Además es el control de cámara:
// arrastrar mueve el foco de la escena elegida, pellizcar o la rueda cambian su zoom.
export default function Stage({ doc, linea, clock, aspecto, escenaSel, onSelEscena, cambiar }) {
  const area = useRef(null);
  const [caja, setCaja] = useState({ w: 320, h: 240 });
  const t = useSyncExternalStore(clock.subscribe, clock.getT);

  useEffect(() => {
    const el = area.current;
    const medir = () => setCaja({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [rw, rh] = ASPECTOS[aspecto];
  const aire = 12;
  const f = Math.min((caja.w - aire * 2) / rw, (caja.h - aire * 2) / rh);
  const W = Math.max(60, Math.floor(rw * f)), H = Math.max(60, Math.floor(rh * f));

  const { prims, estado } = useMemo(() => primitivas(geo, doc, linea, t, W, H), [doc, linea, t, W, H]);
  const sceneNow = escenaEn(linea, t);

  // ---- gestos ----
  const ptrs = useRef(new Map());
  const gesto = useRef(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const lineaRef = useRef(linea);
  lineaRef.current = linea;

  // Un gesto de cámara siempre edita el INICIO de una escena: se pausa y se salta ahí,
  // donde la cámara coincide con foco y zoom de la escena (la deriva todavía no empezó).
  const objetivo = () => {
    const id = escenaSel ?? escenaEn(lineaRef.current, clock.getT()).id;
    const e = lineaRef.current.porId[id];
    if (id !== escenaSel) onSelEscena(id);
    clock.setPlaying(false);
    clock.setT(e.inicio);
    return e;
  };

  const empezar = () => {
    const e = objetivo();
    const pts = [...ptrs.current.values()];
    const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length, my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesto.current = { id: e.id, foco0: [...e.foco], zoom0: e.zoom, m0: [mx, my], dist0: dist, n: pts.length };
  };

  const aplicar = () => {
    const g = gesto.current;
    const pts = [...ptrs.current.values()];
    if (!g || !pts.length) return;
    if (pts.length !== g.n) return empezar();
    const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length, my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    const zoom = g.dist0 > 8 && dist > 8 ? clamp(g.zoom0 * (dist / g.dist0), ZOOM_MIN, ZOOM_MAX) : g.zoom0;
    const s0 = escalaPx(g.zoom0, W, H), s1 = escalaPx(zoom, W, H);
    const rect = area.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    // El punto del mundo bajo el centro del gesto al empezar tiene que seguir bajo él.
    const Wx = g.foco0[0] + (g.m0[0] - cx) / s0, Wy = g.foco0[1] + (g.m0[1] - cy) / s0;
    const foco = [Math.round((Wx - (mx - cx) / s1) * 100) / 100, Math.round((Wy - (my - cy) / s1) * 100) / 100];
    cambiar((d) => editarEscena(d, g.id, { foco, zoom: Math.round(zoom * 100) / 100 }), `cam:${g.id}`);
  };

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    capturar(e.currentTarget, e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    empezar();
  };
  const onMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    aplicar();
  };
  const onUp = (e) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size) empezar(); else gesto.current = null;
  };

  // La rueda va con listener propio y no pasivo, para poder frenar el scroll de la página.
  const svgRef = useRef(null);
  useEffect(() => {
    const el = svgRef.current;
    const rueda = (ev) => {
      ev.preventDefault();
      const e = objetivo();
      const rect = area.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const zoom = clamp(e.zoom * Math.exp(-ev.deltaY * 0.0015), ZOOM_MIN, ZOOM_MAX);
      const s0 = escalaPx(e.zoom, W, H), s1 = escalaPx(zoom, W, H);
      const Wx = e.foco[0] + (ev.clientX - cx) / s0, Wy = e.foco[1] + (ev.clientY - cy) / s0;
      cambiar((d) => editarEscena(d, e.id, {
        foco: [Math.round((Wx - (ev.clientX - cx) / s1) * 100) / 100, Math.round((Wy - (ev.clientY - cy) / s1) * 100) / 100],
        zoom: Math.round(zoom * 100) / 100,
      }), `cam:${e.id}`);
    };
    el.addEventListener('wheel', rueda, { passive: false });
    return () => el.removeEventListener('wheel', rueda);
  });

  return (
    <div className="ft-stage" ref={area}>
      <svg
        ref={svgRef}
        className="ft-canvas"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ background: doc.fondo }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {prims.map((p, i) => p.tipo === 'texto' ? (
          <text key={i} x={p.x} y={p.y} fontFamily="Satoshi, system-ui, sans-serif" fontWeight={500} fontSize={p.size}
            letterSpacing={`${p.letterSpacing}em`} fill={p.fill} opacity={p.opacity}>{p.texto}</text>
        ) : (
          <path key={i} d={p.d} fill={p.fill ?? 'none'} fillRule={p.fillRule} stroke={p.stroke ?? undefined}
            strokeWidth={p.stroke ? p.strokeWidth : undefined} strokeDasharray={p.dash ? p.dash.join(' ') : undefined}
            strokeDashoffset={p.dash ? p.dashOffset : undefined} opacity={p.opacity} />
        ))}
      </svg>
      <div className="ft-badge" aria-live="off">
        <b>{(escenaSel ? linea.porId[escenaSel] : sceneNow).nombre}</b>
        <span>zoom {Math.round(estado.cam.zoom)}</span>
      </div>
    </div>
  );
}
