// Controles de UI reutilizables. CSS puro, sin librerías.
import { useState } from "react";

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
};

/* ---------- Section (accordion) ---------- */
export function Section({ title, defaultOpen = true, right = null, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`section ${open ? "open" : ""}`}>
      <button className="section-head" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {right}
          <Icon.Chevron className="chev" />
        </span>
      </button>
      {open && <div className="section-body">{children}</div>}
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

/* ---------- Slider ---------- */
export function Slider({ label, value, min, max, step = 0.01, onChange, format }) {
  const display = format ? format(value) : Number(value).toFixed(step < 1 ? 2 : 0);
  return (
    <Field label={label} value={display}>
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </Field>
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
    <button
      className={`btn ${variant} ${block ? "block" : ""}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({ children, danger, ...rest }) {
  return (
    <button className={`icon-btn ${danger ? "danger" : ""}`.trim()} {...rest}>
      {children}
    </button>
  );
}
