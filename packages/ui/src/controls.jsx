// Controles compartidos por las tres tools. CSS puro, sin librerías de UI.
import { useEffect, useState } from "react";

/* ---------- Iconos (SVG inline) ---------- */
export const Icon = {
  Chevron: (p) => (
    <svg width="12" height="12" viewBox="0 0 12 12" {...p}>
      <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  Play: (p) => (
    <svg width="15" height="15" viewBox="0 0 15 15" {...p}>
      <path d="M3.5 2.5l9 5-9 5z" fill="currentColor" />
    </svg>
  ),
  Pause: (p) => (
    <svg width="15" height="15" viewBox="0 0 15 15" {...p}>
      <rect x="3.5" y="2.5" width="3" height="10" fill="currentColor" />
      <rect x="8.5" y="2.5" width="3" height="10" fill="currentColor" />
    </svg>
  ),
  Plus: (p) => (
    <svg width="13" height="13" viewBox="0 0 13 13" {...p}>
      <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  Minus: (p) => (
    <svg width="13" height="13" viewBox="0 0 13 13" {...p}>
      <path d="M2 6.5h9" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  Trash: (p) => (
    <svg width="13" height="13" viewBox="0 0 14 14" {...p}>
      <path
        d="M2.5 3.5h9M5 3.5V2.5h4v1M3.5 3.5l.5 8h6l.5-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  ),
  Drag: (p) => (
    <svg width="10" height="14" viewBox="0 0 10 14" {...p}>
      <circle cx="3" cy="3" r="1" fill="currentColor" />
      <circle cx="7" cy="3" r="1" fill="currentColor" />
      <circle cx="3" cy="7" r="1" fill="currentColor" />
      <circle cx="7" cy="7" r="1" fill="currentColor" />
      <circle cx="3" cy="11" r="1" fill="currentColor" />
      <circle cx="7" cy="11" r="1" fill="currentColor" />
    </svg>
  ),
  Eye: (p) => (
    <svg width="14" height="14" viewBox="0 0 14 14" {...p}>
      <path
        d="M1 7s2.2-3.5 6-3.5S13 7 13 7s-2.2 3.5-6 3.5S1 7 1 7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <circle cx="7" cy="7" r="1.7" fill="currentColor" />
    </svg>
  ),
  EyeOff: (p) => (
    <svg width="14" height="14" viewBox="0 0 14 14" {...p}>
      <path
        d="M2.4 4.2C1.6 5.2 1 7 1 7s2.2 3.5 6 3.5c1 0 1.9-.25 2.7-.62M11.9 9C12.6 8.2 13 7 13 7s-2.2-3.5-6-3.5c-.5 0-1 .06-1.4.17M2 2l10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  ),
  Search: (p) => (
    <svg width="13" height="13" viewBox="0 0 14 14" {...p}>
      <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9.2 9.2L12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  Download: (p) => (
    <svg width="13" height="13" viewBox="0 0 14 14" {...p}>
      <path
        d="M7 2v7m0 0L4.5 6.5M7 9l2.5-2.5M2.5 11.5h9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  ),
  Copy: (p) => (
    <svg width="13" height="13" viewBox="0 0 14 14" {...p}>
      <rect
        x="4.6"
        y="1.9"
        width="7.5"
        height="7.5"
        rx="1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M9.4 11.1v.5a1.4 1.4 0 0 1-1.4 1.4H3.3a1.4 1.4 0 0 1-1.4-1.4V6.9a1.4 1.4 0 0 1 1.4-1.4h.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  ),
  // El clásico de "condensar panel": el marco del panel con su columna, y la
  // flecha diciendo hacia dónde se va.
  PanelCollapse: (p) => (
    <svg width="15" height="15" viewBox="0 0 16 16" {...p}>
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="11"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M6 2.5v11" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M11.6 6.4L9.6 8l2 1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Close: (p) => (
    <svg width="13" height="13" viewBox="0 0 14 14" {...p}>
      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
};

/* ---------- Section (accordion) ---------- */
// `value` es el ajuste más representativo de la sección y se muestra SÓLO
// cerrada: con el panel plegado es lo único que dice en qué quedó, y abierta
// sobraría porque el control que lo fija está tres píxeles más abajo.
//
// Es distinto de `right`, que se muestra siempre: eso es para indicadores que
// importan aunque estés adentro de la sección (el estado de la cámara, cuántos
// assets hay).
export function Section({ title, defaultOpen = true, value = null, right = null, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`section ${open ? "open" : ""}`}>
      <button className="section-head" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!open && value != null && value !== "" && (
            <span className="section-value">{value}</span>
          )}
          {right}
          <Icon.Chevron className="chev" />
        </span>
      </button>
      {/* El cuerpo se monta siempre y lo esconde el CSS (`display: none` cuando
          la sección no está abierta). Desmontarlo dejaba el cierre sin nada que
          animar: la salida necesita que el nodo siga ahí mientras se contrae. */}
      <div className="section-body">{children}</div>
    </div>
  );
}

/* ---------- Agrupador dentro de una Section ---------- */
export function Group({ title, children }) {
  return (
    <div className="group">
      {title && <div className="group-title">{title}</div>}
      {children}
    </div>
  );
}

/* ---------- Field ---------- */
export function Field({ label, value, children }) {
  return (
    <div className="field">
      {label && (
        <div className="field-row">
          <span className="field-label">{label}</span>
          {value != null && <span className="field-value">{value}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------- Segmented ---------- */
export function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented">
      {options.map((opt) => {
        const v = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        return (
          <button
            key={v}
            className={value === v ? "active" : ""}
            onClick={() => onChange(v)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Select ---------- */
export function Select({ value, options, onChange }) {
  return (
    <select
      className="text-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/* ---------- Number input ---------- */
export function NumberInput({ value, min, max, step = 1, onChange, suffix }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <input
        className="num-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
      {suffix && <span className="field-value">{suffix}</span>}
    </div>
  );
}

/* ---------- Buttons ---------- */
export function Button({ children, variant = "", block, ...rest }) {
  return (
    <button className={`btn ${variant} ${block ? "block" : ""}`.trim()} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({ children, danger, active, ...rest }) {
  return (
    <button
      className={`icon-btn ${danger ? "danger" : ""} ${active ? "active" : ""}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Toggle ---------- */
export function Toggle({ label, value, onChange, hint }) {
  return (
    <div className="field">
      <div className="field-row">
        <span className="field-label">{label}</span>
        <button
          className={`toggle ${value ? "on" : ""}`}
          onClick={() => onChange(!value)}
          role="switch"
          aria-checked={!!value}
        >
          <span />
        </button>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

/* ---------- Color ---------- */
export function ColorInput({ label, value, onChange }) {
  // El texto se edita en un draft local: validar en cada tecla contra el value
  // controlado haría imposible borrar un dígito.
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <Field label={label}>
      <div className="color-input">
        <span className="swatch" style={{ background: value }}>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </span>
        <input
          className="text-input hex"
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            if (/^#[0-9a-fA-F]{6}$/.test(v.trim())) onChange(v.trim());
          }}
          onBlur={() => setDraft(value)}
        />
      </div>
    </Field>
  );
}
