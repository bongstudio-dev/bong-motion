import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { capturar } from '../captura.js';
import { cambiarDurTramos, desplazarTramos, editarEscena, editarTransicion } from '../docops.js';

const ALTO_REGLA = 24, ALTO_CAM = 46, ALTO_CARRIL = 30, MARGEN = 14;
const redond = (v) => Math.round(v * 100) / 100;

// Arrastre genérico: guarda el doc de partida y en cada movimiento aplica `fn(docInicial, dt)`,
// así los cambios no se acumulan y soltar siempre deja el valor exacto del gesto.
function useArrastre({ pxs, cambiar, docRef }) {
  return (clave, fn) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    capturar(el, e.pointerId);
    const x0 = e.clientX, inicial = docRef.current;
    const mover = (ev) => {
      const dt = (ev.clientX - x0) / pxs;
      cambiar(() => fn(inicial, dt), clave);
    };
    const soltar = () => {
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerup', soltar);
      el.removeEventListener('pointercancel', soltar);
    };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  };
}

function Cabezal({ clock, pxs, scroller }) {
  const t = useSyncExternalStore(clock.subscribe, clock.getT);
  const playing = useSyncExternalStore(clock.subscribe, clock.isPlaying);
  const x = MARGEN + t * pxs;
  useEffect(() => {
    const s = scroller.current;
    if (!playing || !s) return;
    if (x > s.scrollLeft + s.clientWidth - 30 || x < s.scrollLeft) s.scrollLeft = Math.max(0, x - 60);
  }, [x, playing, scroller]);
  return <div className="ft-cabezal" style={{ transform: `translateX(${x}px)` }} />;
}

export default function Timeline({ doc, linea, efectos, sel, onSel, cambiar, clock, pxs, duracion, scroller }) {
  const docRef = useRef(doc);
  docRef.current = doc;
  const arrastre = useArrastre({ pxs, cambiar, docRef });
  const carriles = Math.max(1, ...efectos.map((f) => f.carril + 1));
  const ancho = MARGEN * 2 + duracion * pxs;
  const alto = ALTO_REGLA + ALTO_CAM + carriles * ALTO_CARRIL + 10;
  const X = (t) => MARGEN + t * pxs;

  const paso = pxs >= 90 ? 0.5 : pxs >= 44 ? 1 : pxs >= 22 ? 2 : 5;
  const marcas = useMemo(() => {
    const m = [];
    for (let s = 0; s <= duracion + 1e-6; s += paso) m.push(s);
    return m;
  }, [duracion, paso]);

  const buscar = (ev) => {
    const r = scroller.current.getBoundingClientRect();
    return Math.max(0, Math.min(duracion, (ev.clientX - r.left + scroller.current.scrollLeft - MARGEN) / pxs));
  };
  const alRegla = (e) => {
    capturar(e.currentTarget, e.pointerId);
    clock.setT(buscar(e));
    const el = e.currentTarget;
    const mover = (ev) => clock.setT(buscar(ev));
    const soltar = () => { el.removeEventListener('pointermove', mover); el.removeEventListener('pointerup', soltar); el.removeEventListener('pointercancel', soltar); };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  };

  return (
    <div className="ft-tl" ref={scroller}>
      <div className="ft-tl-in" style={{ width: ancho, height: alto }}>
        <div className="ft-regla" style={{ height: ALTO_REGLA }} onPointerDown={alRegla}>
          {marcas.map((s) => (
            <span key={s} className="ft-marca" style={{ left: X(s) }}>{Number.isInteger(s) ? `${s}s` : ''}</span>
          ))}
        </div>

        <div className="ft-fila" style={{ top: ALTO_REGLA, height: ALTO_CAM }}>
          {linea.escenas.map((e, i) => {
            const ancho1 = Math.max(0, e.parada * pxs);
            const ultima = i === linea.escenas.length - 1;
            const selE = sel?.k === 'escena' && sel.id === e.id;
            const selT = sel?.k === 'trans' && sel.id === e.id;
            return (
              <div key={e.id}>
                {e.parada > 0 ? (
                  <div className={`ft-bloque ${selE ? 'sel' : ''}`} style={{ left: X(e.inicio), width: ancho1 }}
                    onPointerDown={() => onSel({ k: 'escena', id: e.id })}>
                    <span>{e.nombre}</span>
                    <i className="ft-borde" onPointerDown={(ev) => { onSel({ k: 'escena', id: e.id }); arrastre(`par:${e.id}`, (d, dt) => editarEscena(d, e.id, { parada: Math.max(0, redond(e.parada + dt)) }))(ev); }} />
                  </div>
                ) : (
                  <button className={`ft-punto ${selE ? 'sel' : ''}`} style={{ left: X(e.inicio) }} title={e.nombre}
                    onPointerDown={(ev) => { ev.stopPropagation(); onSel({ k: 'escena', id: e.id }); }}>
                    <span>{e.nombre}</span>
                    <i className="ft-borde" onPointerDown={(ev) => { onSel({ k: 'escena', id: e.id }); arrastre(`par:${e.id}`, (d, dt) => editarEscena(d, e.id, { parada: Math.max(0, redond(dt)) }))(ev); }} />
                  </button>
                )}
                {!ultima && (
                  <div className={`ft-bloque trans ${selT ? 'sel' : ''}`} style={{ left: X(e.finParada), width: Math.max(10, e.transicion.dur * pxs) }}
                    onPointerDown={() => onSel({ k: 'trans', id: e.id })}>
                    <span>{e.transicion.dur.toFixed(2)}s</span>
                    <i className="ft-borde" onPointerDown={(ev) => { onSel({ k: 'trans', id: e.id }); arrastre(`tr:${e.id}`, (d, dt) => editarTransicion(d, e.id, { dur: redond(e.transicion.dur + dt) }))(ev); }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="ft-fila fx" style={{ top: ALTO_REGLA + ALTO_CAM, height: carriles * ALTO_CARRIL }}>
          {efectos.map((f) => {
            const activo = sel && (sel.k === f.tipo) && sel.key === f.key;
            const dur0 = f.t1 - f.t0;
            return (
              <div key={f.key} className={`ft-pastilla ${f.tipo} ${activo ? 'sel' : ''}`}
                style={{ left: X(f.t0), width: Math.max(26, dur0 * pxs), top: f.carril * ALTO_CARRIL + 2, height: ALTO_CARRIL - 4 }}
                onPointerDown={(ev) => {
                  onSel({ k: f.tipo, key: f.key });
                  arrastre(`fx:${f.key}`, (d, dt) => desplazarTramos(d, f.caminos, redond(dt)))(ev);
                }}>
                <span>{f.label}</span>
                <i className="ft-borde" onPointerDown={(ev) => {
                  onSel({ k: f.tipo, key: f.key });
                  arrastre(`fxd:${f.key}`, (d, dt) => cambiarDurTramos(d, f.caminos, redond(dt)))(ev);
                }} />
              </div>
            );
          })}
        </div>

        <Cabezal clock={clock} pxs={pxs} scroller={scroller} />
      </div>
    </div>
  );
}
