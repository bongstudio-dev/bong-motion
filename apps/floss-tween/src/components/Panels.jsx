import { Button, Field, Group, Select, Toggle, ScrubField } from '@bong/ui';
import CurveEditor from './CurveEditor.jsx';
import {
  borrarEscena, cambiarDurTramos, desplazarTramos, duplicarEscena, editarEscena, editarTransicion,
  fijarTramos, getTramo, moverEscena, reatarEvento,
} from '../docops.js';

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const LN_MIN = Math.log(10), LN_MAX = Math.log(3000);

// Zoom con perilla logarítmica: recorrer el ancho completo no es lineal en el zoom, así
// que de 72 a 600 se siente parejo.
function ZoomField({ label, value, onChange }) {
  return (
    <ScrubField label={label} value={Math.log(value)} min={LN_MIN} max={LN_MAX} step={0.005}
      format={() => String(Math.round(value))} onChange={(v) => onChange(r2(Math.exp(v)))} />
  );
}

function Acciones({ children }) {
  return <div className="ft-acciones">{children}</div>;
}

// ---------- escena ----------

export function PanelEscena({ doc, linea, id, cambiar, onSel, clock }) {
  const e = doc.escenas.find((x) => x.id === id);
  if (!e) return null;
  const i = doc.escenas.indexOf(e);
  const ed = (patch, clave) => cambiar((d) => editarEscena(d, id, patch), clave ?? `esc:${id}`);
  const der = e.deriva;
  return (
    <div className="ft-panel-cuerpo">
      <input className="text-input ft-nombre" value={e.nombre} aria-label="Nombre de la escena"
        onChange={(ev) => ed({ nombre: ev.target.value }, `nom:${id}`)} />
      <Group title="Cámara al llegar">
        <ZoomField label="Zoom" value={e.zoom} onChange={(v) => ed({ zoom: v })} />
        <ScrubField label="Foco X" value={e.foco[0]} min={-100} max={800} step={0.1} onChange={(v) => ed({ foco: [r2(v), e.foco[1]] })} />
        <ScrubField label="Foco Y" value={e.foco[1]} min={-100} max={450} step={0.1} onChange={(v) => ed({ foco: [e.foco[0], r2(v)] })} />
        <p className="hint">También se mueve arrastrando y pellizcando sobre la vista.</p>
      </Group>
      <Group title="Parada">
        <ScrubField label="Duración" value={e.parada} min={0} max={8} step={0.01} unit=" s" onChange={(v) => ed({ parada: v })} />
        <Toggle label="Deriva lenta" value={!!der} hint="Un acercamiento suave mientras la cámara espera."
          onChange={(on) => ed({ deriva: on ? { foco: [...e.foco], zoom: r2(e.zoom * 1.12), curva: [0.25, 0.1, 0.25, 1] } : null })} />
        {der && (
          <>
            <ZoomField label="Zoom final" value={der.zoom} onChange={(v) => ed({ deriva: { ...der, zoom: v } })} />
            <ScrubField label="Foco X final" value={(der.foco ?? e.foco)[0]} min={-100} max={800} step={0.1}
              onChange={(v) => ed({ deriva: { ...der, foco: [r2(v), (der.foco ?? e.foco)[1]] } })} />
            <ScrubField label="Foco Y final" value={(der.foco ?? e.foco)[1]} min={-100} max={450} step={0.1}
              onChange={(v) => ed({ deriva: { ...der, foco: [(der.foco ?? e.foco)[0], r2(v)] } })} />
            <CurveEditor titulo="Curva de la deriva" curva={der.curva} onChange={(c) => ed({ deriva: { ...der, curva: c } }, `der:${id}`)} />
          </>
        )}
      </Group>
      <Acciones>
        <Button onClick={() => { clock.setPlaying(false); clock.setT(linea.porId[id].inicio); }}>Ver escena</Button>
        <Button onClick={() => { const r = duplicarEscena(doc, id); cambiar(() => r.doc); if (r.id) onSel({ k: 'escena', id: r.id }); }}>Duplicar</Button>
        <Button disabled={i === 0} onClick={() => cambiar((d) => moverEscena(d, id, -1))}>←</Button>
        <Button disabled={i === doc.escenas.length - 1} onClick={() => cambiar((d) => moverEscena(d, id, +1))}>→</Button>
        <Button variant="ghost" disabled={doc.escenas.length <= 1}
          onClick={() => { const sig = doc.escenas[i > 0 ? i - 1 : 1].id; cambiar((d) => borrarEscena(d, id)); onSel({ k: 'escena', id: sig }); }}>Borrar</Button>
      </Acciones>
    </div>
  );
}

// ---------- transición ----------

export function PanelTransicion({ doc, id, cambiar }) {
  const i = doc.escenas.findIndex((x) => x.id === id);
  const e = doc.escenas[i], sig = doc.escenas[i + 1];
  if (!e || !sig) return null;
  const tr = e.transicion;
  const ed = (patch, clave) => cambiar((d) => editarTransicion(d, id, patch), clave ?? `tr:${id}`);
  return (
    <div className="ft-panel-cuerpo">
      <div className="ft-sub">{e.nombre} → {sig.nombre}</div>
      <ScrubField label="Duración" value={tr.dur} min={0.02} max={4} step={0.01} unit=" s" onChange={(v) => ed({ dur: v })} />
      <CurveEditor titulo="Curva del viaje" curva={tr.curva} onChange={(c) => ed({ curva: c }, `trc:${id}`)} />
      <Toggle label="Curva del paneo aparte" value={!!tr.curvaFoco}
        hint="Zoom y paneo normalmente van con la misma curva (un solo gesto). Separarlas puede hacer que el logo se condense."
        onChange={(on) => ed({ curvaFoco: on ? [...tr.curva] : null })} />
      {tr.curvaFoco && <CurveEditor titulo="Curva del paneo" curva={tr.curvaFoco} onChange={(c) => ed({ curvaFoco: c }, `trf:${id}`)} />}
    </div>
  );
}

// ---------- evento y líneas ----------

export function PanelEfecto({ doc, linea, item, cambiar }) {
  if (!item) return null;
  const caminos = item.caminos;
  const primero = getTramo(doc, caminos[0]);
  const inicio = item.t0, dur = primero.dur;
  const esEvento = item.tipo === 'evento';
  const ev = esEvento ? doc.eventos[item.idx] : null;
  const clave = `fx:${item.key}`;
  return (
    <div className="ft-panel-cuerpo">
      <div className="ft-sub">{item.label}</div>
      <ScrubField label="Inicio" value={Math.max(0, inicio)} min={0} max={Math.max(14, linea.duracion + 2)} step={0.01} unit=" s"
        onChange={(v) => cambiar((d) => desplazarTramos(d, caminos, r3(v - inicio)), clave)} />
      <ScrubField label={caminos.length > 1 ? 'Duración (cada una)' : 'Duración'} value={dur} min={0.02} max={4} step={0.01} unit=" s"
        onChange={(v) => cambiar((d) => cambiarDurTramos(d, caminos, r3(v - dur)), `${clave}:d`)} />
      <CurveEditor titulo={caminos.length > 1 ? 'Curva (todas)' : 'Curva'} curva={primero.curva}
        onChange={(c) => cambiar((d) => fijarTramos(d, caminos, { curva: c }), `${clave}:c`)} />
      {esEvento && (
        <Field label="Atado a la escena" value={null}>
          <Select value={ev.escena} options={doc.escenas.map((e) => ({ value: e.id, label: e.nombre }))}
            onChange={(v) => cambiar((d) => reatarEvento(d, item.idx, v))} />
          <p className="hint">Si cambia la duración de esa escena, el efecto se corre con ella.</p>
        </Field>
      )}
      {!esEvento && <p className="hint">Mueve todas las líneas del grupo juntas; cada una mantiene su desfasaje.</p>}
    </div>
  );
}
