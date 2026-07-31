// Ventana flotante con los atributos de UNA capa de texto.
//
// Se desacopla del sidebar por tamaño: son once controles y el sidebar mide
// 360px con seis secciones más. Flotando, además, se puede dejar abierta contra
// el stage mientras se ajusta — que es cómo se compone un texto: mirando la
// pieza, no la lista.
//
// Se arrastra del encabezado y recuerda dónde la dejaron mientras dure la
// sesión (módulo, no state: sobrevive a cerrar y volver a abrir).

import { useEffect, useRef, useState } from "react";
import { Field, Icon, IconButton, Segmented, Select, Button } from "../controls.jsx";
import { ScrubField } from "../ScrubField.jsx";
import {
  TEXT_ALIGNS,
  TEXT_ANCHORS,
  TEXT_CASES,
  TEXT_FONTS,
  TEXT_SLOT_OPTIONS,
  TEXT_WEIGHTS,
  textLabel,
} from "./model.js";
import { customFonts, loadCustomFont, queryInstalledFonts, subscribeFonts } from "./fonts.js";

const WIDTH = 292;
let lastPos = null; // recordado por sesión

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

// Cuatro líneas de largo desparejo: el borde que queda parejo es el que muestra
// hacia dónde alinea.
const ALIGN_ICON_ROWS = [12, 8, 12, 7];

const AlignIcon = ({ mode }) => (
  <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true">
    {ALIGN_ICON_ROWS.map((w, i) => {
      const x = mode === "left" ? 1 : mode === "right" ? 13 - w : (14 - w) / 2;
      return (
        <rect key={i} x={x} y={1 + i * 2.8} width={w} height="1.4" fill="currentColor" />
      );
    })}
  </svg>
);

// Envoltorio sin hooks: la ventana se monta recién cuando hay una capa abierta.
// Así la posición inicial se calcula contra el viewport de ESE momento y no
// contra el que hubiera al arrancar la app.
export function TextWindow({ text, ...rest }) {
  if (!text) return null;
  return <TextWindowInner text={text} {...rest} />;
}

function TextWindowInner({ text, onChange, onClose }) {
  const [pos, setPos] = useState(() => {
    if (lastPos) return lastPos;
    // A la izquierda del sidebar, contra el stage: es lo que se está mirando
    // mientras se compone el texto.
    const x = Math.max(8, window.innerWidth - 360 - WIDTH - 24);
    return { x, y: 84 };
  });
  const drag = useRef(null);
  const [uploaded, setUploaded] = useState(customFonts);
  const [installed, setInstalled] = useState([]);
  const [fontNote, setFontNote] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    const off = subscribeFonts(() => setUploaded(customFonts()));
    return () => off();
  }, []);

  // Si la ventana quedó fuera de cuadro al achicar el browser, se trae adentro.
  useEffect(() => {
    const onResize = () =>
      setPos((p) => ({
        x: clamp(p.x, 8, Math.max(8, window.innerWidth - WIDTH - 8)),
        y: clamp(p.y, 8, Math.max(8, window.innerHeight - 120)),
      }));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    lastPos = pos;
  }, [pos]);

  const set = (patch) => onChange({ ...text, ...patch });

  const onPointerDown = (e) => {
    if (e.target.closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };

  const onPointerMove = (e) => {
    if (!drag.current) return;
    setPos({
      x: clamp(e.clientX - drag.current.dx, 8, window.innerWidth - WIDTH - 8),
      y: clamp(e.clientY - drag.current.dy, 8, window.innerHeight - 80),
    });
  };

  const endDrag = () => (drag.current = null);

  const uploadFont = async (file) => {
    if (!file) return;
    try {
      const family = await loadCustomFont(file);
      set({ fontFamily: family });
      setFontNote(`${family} cargada ✓`);
    } catch {
      setFontNote("No se pudo leer ese archivo (probá .otf, .ttf o .woff2).");
    }
  };

  const readSystemFonts = async () => {
    try {
      const fams = await queryInstalledFonts();
      setInstalled(fams);
      setFontNote(`${fams.length} fuentes del sistema detectadas ✓`);
    } catch (err) {
      setFontNote(
        err.message === "unsupported"
          ? "Tu browser no permite leer las fuentes instaladas (probá Chrome o Edge). Podés subir el archivo."
          : `No se pudo leer las fuentes (${err.name}).`,
      );
    }
  };

  // Orden: las subidas primero (son las que el usuario acaba de traer), después
  // las del sistema si se detectaron, si no la lista fija.
  const base = installed.length
    ? installed.map((f) => ({ value: f, label: f }))
    : TEXT_FONTS;
  const options = [
    ...uploaded.map((f) => ({ value: f.family, label: `${f.family} ↑` })),
    ...base,
  ];
  const known = options.some((f) => f.value === text.fontFamily);
  const fontOptions = known
    ? options
    : [{ value: text.fontFamily, label: `Actual: ${text.fontFamily}` }, ...options];

  return (
    <div className="float-panel" style={{ left: pos.x, top: pos.y, width: WIDTH }}>
      <div
        className="float-panel-head"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="float-panel-grip" />
        <span className="float-panel-title">{textLabel(text)}</span>
        <IconButton onClick={onClose} title="Cerrar" aria-label="Cerrar">
          <Icon.Close />
        </IconButton>
      </div>

      <div className="float-panel-body">
        <Field label="Texto">
          <textarea
            className="text-input"
            rows={2}
            value={text.content}
            spellCheck={false}
            placeholder="Escribí acá — Enter para saltar de línea"
            onChange={(e) => set({ content: e.target.value })}
          />
        </Field>

        <Field label="Fuente">
          <Select
            value={text.fontFamily}
            options={fontOptions}
            onChange={(v) => set({ fontFamily: v })}
          />
        </Field>
        <div className="btn-row">
          <Button block onClick={() => fileRef.current?.click()}>
            Subir fuente
          </Button>
          <Button block onClick={readSystemFonts}>
            Leer del sistema
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".otf,.ttf,.woff,.woff2,font/*"
          hidden
          onChange={(e) => {
            uploadFont(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {fontNote && <p className="hint">{fontNote}</p>}

        <div className="row-2">
          <Field label="Peso">
            <Select
              value={String(text.fontWeight)}
              options={TEXT_WEIGHTS.map((w) => ({ value: String(w.value), label: w.label }))}
              onChange={(v) => set({ fontWeight: Number(v) })}
            />
          </Field>
          <Field label="Caja">
            <Select
              value={text.textCase}
              options={TEXT_CASES}
              onChange={(v) => set({ textCase: v })}
            />
          </Field>
        </div>

        <ScrubField
          label="Tamaño"
          value={text.size}
          min={8}
          max={400}
          step={1}
          onChange={(v) => set({ size: Math.round(v) })}
          format={(v) => `${Math.round(v)} px`}
        />
        <ScrubField
          label="Interlineado"
          value={text.lineHeight}
          min={50}
          max={250}
          step={1}
          onChange={(v) => set({ lineHeight: Math.round(v) })}
          format={(v) => `${Math.round(v)} %`}
        />
        <ScrubField
          label="Tracking"
          value={text.tracking}
          min={-15}
          max={60}
          step={0.5}
          onChange={(v) => set({ tracking: v })}
          format={(v) => `${v.toFixed(1)} %`}
        />

        <Field label="Color">
          <div className="color-input">
            <label className="swatch" style={{ background: text.color }}>
              <input
                type="color"
                value={text.color}
                onChange={(e) => set({ color: e.target.value.toUpperCase() })}
              />
            </label>
            <input
              className="text-input hex"
              value={text.color}
              spellCheck={false}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                if (/^#[0-9A-F]{0,6}$/.test(v)) set({ color: v });
              }}
            />
          </div>
        </Field>
        <ScrubField
          label="Opacidad"
          value={text.opacity}
          min={0}
          max={100}
          step={1}
          onChange={(v) => set({ opacity: Math.round(v) })}
          format={(v) => `${Math.round(v)} %`}
        />

        <Field label="Alineación">
          <Segmented
            value={text.align}
            options={TEXT_ALIGNS.map((mode) => ({
              value: mode,
              label: <AlignIcon mode={mode} />,
            }))}
            onChange={(v) => set({ align: v })}
          />
        </Field>

        <Field label="Posición">
          <div className="pos-grid">
            {TEXT_ANCHORS.flat().map((a) => (
              <button
                key={a}
                className={`pos-cell ${text.anchor === a ? "active" : ""}`.trim()}
                onClick={() => set({ anchor: a })}
                aria-label={`Anclar en ${a}`}
              >
                <i />
              </button>
            ))}
          </div>
        </Field>
        <div className="row-2">
          <ScrubField
            label="X"
            value={text.offsetX}
            min={-50}
            max={50}
            step={0.5}
            onChange={(v) => set({ offsetX: v })}
            format={(v) => `${v.toFixed(1)} %`}
          />
          <ScrubField
            label="Y"
            value={text.offsetY}
            min={-50}
            max={50}
            step={0.5}
            onChange={(v) => set({ offsetY: v })}
            format={(v) => `${v.toFixed(1)} %`}
          />
        </div>

        <Field label="Capa">
          <Segmented
            value={text.slot}
            options={TEXT_SLOT_OPTIONS}
            onChange={(v) => set({ slot: v })}
          />
        </Field>
      </div>
    </div>
  );
}

export default TextWindow;
