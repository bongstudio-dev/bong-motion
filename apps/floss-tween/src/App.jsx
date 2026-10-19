import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Button, Icon, Segmented } from '@bong/ui';
import Stage, { ASPECTOS } from './components/Stage.jsx';
import Timeline from './components/Timeline.jsx';
import { PanelEfecto, PanelEscena, PanelTransicion } from './components/Panels.jsx';
import { armarLinea } from './engine.js';
import { efectos as calcularEfectos } from './docops.js';
import { createClock } from './clock.js';
import { docOriginal, useDoc } from './state.js';

const fmt = (s) => s.toFixed(2);

const Deshacer = ({ espejo }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" style={espejo ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
    <path d="M5.5 3 2.5 6l3 3M2.5 6H9a4 4 0 0 1 0 8H6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Transporte({ clock, duracion, pxs, setPxs, ajustar }) {
  const t = useSyncExternalStore(clock.subscribe, clock.getT);
  const playing = useSyncExternalStore(clock.subscribe, clock.isPlaying);
  const loop = useSyncExternalStore(clock.subscribe, clock.isLoop);
  return (
    <div className="ft-transporte">
      <button className="play" onClick={() => clock.toggle()} aria-label={playing ? 'Pausa' : 'Play'}>
        {playing ? <Icon.Pause /> : <Icon.Play />}
      </button>
      <div className="ft-tiempo"><b>{fmt(t)}</b><span> / {fmt(duracion)} s</span></div>
      <button className={`ft-boton ${loop ? 'on' : ''}`} onClick={() => clock.setLoop(!loop)} aria-pressed={loop}>Loop</button>
      <span className="ft-espacio" />
      <button className="ft-boton" onClick={() => setPxs((p) => Math.max(14, p / 1.4))} aria-label="Alejar timeline"><Icon.Minus /></button>
      <button className="ft-boton" onClick={() => setPxs((p) => Math.min(400, p * 1.4))} aria-label="Acercar timeline"><Icon.Plus /></button>
      <button className="ft-boton" onClick={ajustar}>Fit</button>
    </div>
  );
}

export default function App() {
  const { doc, cambiar, deshacer, rehacer, reemplazar, puedeDeshacer, puedeRehacer } = useDoc();
  const [aspecto, setAspecto] = useState('16:9');
  const [sel, setSel] = useState({ k: 'escena', id: doc.escenas[0].id });
  // Panel en el celu: normal, amplio (editar curvas con espacio) o cerrado (más vista).
  const [panelModo, setPanelModo] = useState('normal');
  const panelAbierto = panelModo !== 'cerrado';
  const [pxs, setPxs] = useState(60);
  const scroller = useRef(null);

  const clockRef = useRef(null);
  if (!clockRef.current) clockRef.current = createClock();
  const clock = clockRef.current;

  const linea = useMemo(() => armarLinea(doc), [doc]);
  const efectos = useMemo(() => calcularEfectos(doc, linea), [doc, linea]);
  const duracion = Math.max(linea.duracion, ...efectos.map((f) => f.t1)) + 0.15;

  useEffect(() => { clock.setDuration(duracion); }, [clock, duracion]);
  useEffect(() => { clock.start(); return () => clock.stop(); }, [clock]);

  const ajustar = () => {
    const w = scroller.current?.clientWidth ?? 320;
    setPxs(Math.max(14, Math.min(400, (w - 28) / duracion)));
  };
  const primera = useRef(true);
  useEffect(() => { if (primera.current) { primera.current = false; ajustar(); } });

  // Si lo seleccionado ya no existe (se borró una escena, cambió un grupo de líneas), volver a una escena.
  const selValida = useMemo(() => {
    if (sel?.k === 'escena' && linea.porId[sel.id]) return sel;
    if (sel?.k === 'trans' && linea.porId[sel.id] && linea.escenas.at(-1).id !== sel.id) return sel;
    if ((sel?.k === 'evento' || sel?.k === 'lineas') && efectos.some((f) => f.key === sel.key)) return sel;
    return { k: 'escena', id: doc.escenas[0].id };
  }, [sel, linea, efectos, doc]);
  const item = selValida.k === 'evento' || selValida.k === 'lineas' ? efectos.find((f) => f.key === selValida.key) : null;
  const escenaSel = selValida.k === 'escena' || selValida.k === 'trans' ? selValida.id : null;

  useEffect(() => {
    const tecla = (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (e.code === 'Space') { e.preventDefault(); clock.toggle(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? rehacer() : deshacer(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [clock, deshacer, rehacer]);

  // Elegir una escena en la barra de escenas la muestra: pausa y lleva el cabezal a su inicio.
  const verEscena = (id) => {
    setSel({ k: 'escena', id });
    clock.setPlaying(false);
    clock.setT(linea.porId[id].inicio);
  };
  const esUltima = escenaSel && linea.escenas.at(-1).id === escenaSel;
  const alVolver = () => {
    if (window.confirm('¿Volver a la animación original de After? Se puede deshacer.')) reemplazar(docOriginal());
  };

  return (
    <div className="ft">
      <header className="ft-top">
        <div className="ft-marca-app">Floss Tween <span>· Bong Studio</span></div>
        <Segmented value={aspecto} options={Object.keys(ASPECTOS)} onChange={setAspecto} />
        <span className="ft-espacio" />
        <button className="ft-boton" disabled={!puedeDeshacer} onClick={deshacer} aria-label="Deshacer"><Deshacer /></button>
        <button className="ft-boton" disabled={!puedeRehacer} onClick={rehacer} aria-label="Rehacer"><Deshacer espejo /></button>
        <button className="ft-boton ft-solo-pc" onClick={alVolver}>Original</button>
      </header>

      <Stage doc={doc} linea={linea} clock={clock} aspecto={aspecto} escenaSel={escenaSel}
        onSelEscena={(id) => setSel({ k: 'escena', id })} cambiar={cambiar} />

      <div className="ft-dock">
        <Transporte clock={clock} duracion={duracion} pxs={pxs} setPxs={setPxs} ajustar={ajustar} />
        <Timeline doc={doc} linea={linea} efectos={efectos} sel={selValida} onSel={setSel} cambiar={cambiar}
          clock={clock} pxs={pxs} duracion={duracion} scroller={scroller} />
      </div>

      <aside className={`ft-panel ${panelModo}`}>
        <div className="ft-panel-cab">
          <div className="ft-chips" role="tablist" aria-label="Escenas">
            {doc.escenas.map((e) => (
              <button key={e.id} role="tab" aria-selected={escenaSel === e.id}
                className={`ft-chip ${escenaSel === e.id ? 'on' : ''}`} onClick={() => verEscena(e.id)}>
                {e.nombre}
              </button>
            ))}
          </div>
          <button className="ft-boton ft-solo-cel" onClick={() => setPanelModo((m) => (m === 'amplio' ? 'normal' : 'amplio'))}
            aria-label={panelModo === 'amplio' ? 'Achicar panel' : 'Agrandar panel'} aria-pressed={panelModo === 'amplio'}>
            <Icon.Chevron style={{ transform: panelModo === 'amplio' ? 'rotate(90deg)' : 'rotate(-90deg)' }} />
          </button>
          <button className="ft-boton ft-solo-cel" onClick={() => setPanelModo((m) => (m === 'cerrado' ? 'normal' : 'cerrado'))}
            aria-label={panelAbierto ? 'Esconder panel' : 'Mostrar panel'} aria-expanded={panelAbierto}>
            <Icon.Chevron style={{ transform: panelAbierto ? 'rotate(90deg)' : 'rotate(-90deg)' }} />
          </button>
        </div>
        {panelAbierto && (
          <div className="ft-panel-scroll">
            {escenaSel && !esUltima && (
              <Segmented value={selValida.k} options={[{ value: 'escena', label: 'Escena' }, { value: 'trans', label: 'Viaje a la siguiente' }]}
                onChange={(k) => setSel({ k, id: escenaSel })} />
            )}
            {selValida.k === 'escena' && <PanelEscena doc={doc} linea={linea} id={selValida.id} cambiar={cambiar} onSel={setSel} clock={clock} />}
            {selValida.k === 'trans' && <PanelTransicion doc={doc} id={selValida.id} cambiar={cambiar} />}
            {item && <PanelEfecto doc={doc} linea={linea} item={item} cambiar={cambiar} />}
            <div className="ft-pie"><Button variant="ghost" onClick={alVolver}>Volver al original de After</Button></div>
          </div>
        )}
      </aside>
    </div>
  );
}
