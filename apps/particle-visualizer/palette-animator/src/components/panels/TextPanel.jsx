import { useState } from "react";
import { Section, Field, Slider, Segmented, Select, Button } from "../ui/controls.jsx";

// Fuentes del sistema comunes + Satoshi. El campo custom permite tipear
// cualquier familia instalada en la máquina (el canvas la usa si existe).
const FONTS = [
  { value: "Satoshi", label: "Satoshi" },
  { value: "system-ui", label: "System UI" },
  { value: "Helvetica Neue", label: "Helvetica Neue" },
  { value: "Arial", label: "Arial" },
  { value: "Arial Black", label: "Arial Black" },
  { value: "Avenir Next", label: "Avenir Next" },
  { value: "Futura", label: "Futura" },
  { value: "Gill Sans", label: "Gill Sans" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Courier New", label: "Courier New (mono)" },
  { value: "Menlo", label: "Menlo (mono)" },
  { value: "Verdana", label: "Verdana" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
  { value: "Impact", label: "Impact" },
];

const WEIGHTS = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 700, label: "Bold" },
  { value: 900, label: "Black" },
];

export default function TextPanel({ state, onPatch }) {
  const labels = state.labels;
  const set = (patch) => onPatch("labels", patch);

  const [sysFonts, setSysFonts] = useState([]);
  const [fontStatus, setFontStatus] = useState("");

  // Lee las fuentes instaladas en la máquina (Local Font Access API, Chrome/Edge
  // con permiso). Si no está disponible, se sigue con la lista fija + el campo
  // custom donde se puede tipear cualquier familia.
  const detectFonts = async () => {
    if (typeof window.queryLocalFonts !== "function") {
      setFontStatus(
        "Tu navegador no permite leer las fuentes instaladas (probá Chrome o Edge). Igual podés tipear cualquier familia en el campo de abajo.",
      );
      return;
    }
    try {
      const data = await window.queryLocalFonts();
      const fams = [...new Set(data.map((f) => f.family))].sort((a, b) =>
        a.localeCompare(b),
      );
      setSysFonts(fams);
      setFontStatus(`${fams.length} fuentes del sistema detectadas ✓`);
    } catch (err) {
      setFontStatus(`No se pudo leer las fuentes (${err.name}).`);
    }
  };

  // Si ya detectamos las del sistema, esas mandan; si no, la lista fija.
  const baseFonts = sysFonts.length
    ? [
        { value: "Satoshi", label: "Satoshi" },
        ...sysFonts.map((f) => ({ value: f, label: f })),
      ]
    : FONTS;
  const known = baseFonts.some((f) => f.value === labels.fontFamily);
  const fontOptions = known
    ? baseFonts
    : [{ value: labels.fontFamily, label: `Actual: ${labels.fontFamily}` }, ...baseFonts];

  return (
    <Section title="Texto" defaultOpen={false}>
      <Field label="Visibilidad">
        <Segmented
          value={labels.show}
          options={[
            { value: "always", label: "Siempre" },
            { value: "active", label: "Activa" },
            { value: "never", label: "Nunca" },
          ]}
          onChange={(v) => set({ show: v })}
        />
      </Field>

      <Field label="Contenido">
        <Segmented
          value={labels.content}
          options={[
            { value: "name", label: "Nombre" },
            { value: "hex", label: "Hex" },
            { value: "both", label: "Ambos" },
          ]}
          onChange={(v) => set({ content: v })}
        />
      </Field>

      <Slider
        label="Tamaño"
        value={labels.size}
        min={14}
        max={80}
        step={1}
        onChange={(v) => set({ size: v })}
        format={(v) => `${Math.round(v)}px`}
      />

      <Field label="Fuente">
        <Select
          value={labels.fontFamily}
          options={fontOptions}
          onChange={(v) => set({ fontFamily: v })}
        />
      </Field>
      <Button block onClick={detectFonts}>
        Leer fuentes del sistema
      </Button>
      {fontStatus && <p className="hint">{fontStatus}</p>}
      <Field label="Fuente custom (cualquiera del sistema)">
        <input
          className="text-input"
          placeholder="Ej: Helvetica, Söhne, PP Neue Montreal…"
          value={labels.fontFamily}
          spellCheck={false}
          onChange={(e) => set({ fontFamily: e.target.value })}
        />
      </Field>
      <Field label="Peso">
        <Segmented
          value={labels.fontWeight}
          options={WEIGHTS}
          onChange={(v) => set({ fontWeight: v })}
        />
      </Field>
      <div
        style={{
          padding: "10px 12px",
          border: "1px solid var(--stroke)",
          borderRadius: "var(--radius-sm)",
          background: "var(--panel-2)",
          fontFamily: `"${labels.fontFamily}", ui-sans-serif, system-ui, sans-serif`,
          fontWeight: labels.fontWeight,
          fontSize: 20,
          lineHeight: 1.2,
          color: "var(--text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        Verde crítico
      </div>

      <div className="divider" />

      <Field label="Contraste">
        <Segmented
          value={labels.autoContrast ? "auto" : "manual"}
          options={[
            { value: "auto", label: "Automático" },
            { value: "manual", label: "Manual" },
          ]}
          onChange={(v) => set({ autoContrast: v === "auto" })}
        />
      </Field>
      {!labels.autoContrast && (
        <Field label="Color del texto">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label className="swatch" style={{ background: labels.color }}>
              <input
                type="color"
                value={labels.color}
                onChange={(e) => set({ color: e.target.value.toUpperCase() })}
              />
            </label>
            <input
              className="text-input hex"
              style={{ fontFamily: "var(--mono)" }}
              value={labels.color}
              onChange={(e) => set({ color: e.target.value })}
            />
          </div>
        </Field>
      )}

      <Field label="Opacidad enganchada a">
        <Segmented
          value={labels.opacityHook}
          options={[
            { value: "none", label: "Nada" },
            { value: "prominence", label: "Peso" },
            { value: "scale", label: "Escala" },
          ]}
          onChange={(v) => set({ opacityHook: v })}
        />
      </Field>

      <Field label="Rotar a vertical en cards altas">
        <Segmented
          value={labels.verticalRotate ? "on" : "off"}
          options={[
            { value: "on", label: "Sí" },
            { value: "off", label: "No" },
          ]}
          onChange={(v) => set({ verticalRotate: v === "on" })}
        />
      </Field>
    </Section>
  );
}
