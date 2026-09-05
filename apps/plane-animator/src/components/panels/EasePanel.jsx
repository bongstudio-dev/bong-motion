import { useEffect, useRef, useState } from "react";
import { Section, Field, ScrubField, Segmented } from "@bong/ui";
import { EASE_PRESETS, sameBezier } from "../../engine/ease.js";
import { clamp } from "../../utils/math.js";

const PAD = 14;
const map = (x, y) => ({
  x: PAD + x * (100 - 2 * PAD),
  y: 100 - PAD - y * (100 - 2 * PAD),
});

// Miniatura de la curva de ease.
export function EaseCurve({ value }) {
  const [x1, y1, x2, y2] = value;
  const a = map(0, 0);
  const b = map(x1, y1);
  const c = map(x2, y2);
  const d = map(1, 1);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <path
        className="curve"
        d={`M ${a.x} ${a.y} C ${b.x} ${b.y}, ${c.x} ${c.y}, ${d.x} ${d.y}`}
      />
    </svg>
  );
}

const round2 = (v) => Math.round(v * 100) / 100;

// Editor bézier: dos handles arrastrables sobre un canvas cuadrado.
export function BezierEditor({ value, onChange }) {
  const svgRef = useRef(null);
  const [active, setActive] = useState(null);
  const [x1, y1, x2, y2] = value;

  useEffect(() => {
    if (active === null) return;
    const move = (e) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      const nx = clamp((px - PAD) / (100 - 2 * PAD), 0, 1);
      const ny = clamp((100 - PAD - py) / (100 - 2 * PAD), -0.6, 1.6);
      const next = [...value];
      if (active === 1) {
        next[0] = round2(nx);
        next[1] = round2(ny);
      } else {
        next[2] = round2(nx);
        next[3] = round2(ny);
      }
      onChange(next);
    };
    const up = () => setActive(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [active, value, onChange]);

  const a = map(0, 0);
  const p1 = map(x1, y1);
  const p2 = map(x2, y2);
  const d = map(1, 1);

  return (
    <svg ref={svgRef} className="bezier-editor" viewBox="0 0 100 100">
      <line x1={a.x} y1={a.y} x2={p1.x} y2={p1.y} stroke="#4a4b53" strokeWidth="0.8" />
      <line x1={d.x} y1={d.y} x2={p2.x} y2={p2.y} stroke="#4a4b53" strokeWidth="0.8" />
      <path
        d={`M ${a.x} ${a.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${d.x} ${d.y}`}
        fill="none"
        stroke="var(--active)"
        strokeWidth="1.6"
      />
      <circle cx={a.x} cy={a.y} r="1.6" fill="#63646b" />
      <circle cx={d.x} cy={d.y} r="1.6" fill="#63646b" />
      <circle
        cx={p1.x}
        cy={p1.y}
        r="3.4"
        fill="var(--active)"
        style={{ cursor: "grab" }}
        onPointerDown={() => setActive(1)}
      />
      <circle
        cx={p2.x}
        cy={p2.y}
        r="3.4"
        fill="var(--active)"
        style={{ cursor: "grab" }}
        onPointerDown={() => setActive(2)}
      />
    </svg>
  );
}

// El editor de ease completo: grid de presets, bézier arrastrable y los cuatro
// números. Se extrajo del panel para que la capa de cámara lo use TAL CUAL en
// vez de escribir otro — es el mismo control, sobre otra curva.
export function EaseControl({ value, onChange, presetsLabel = "Presets" }) {
  const setComponent = (i, v) => {
    const next = [...value];
    next[i] = v;
    onChange(next);
  };

  return (
    <>
      <Field label={presetsLabel}>
        <div className="ease-grid">
          {EASE_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`ease-cell ${sameBezier(value, p.value) ? "active" : ""}`}
              title={p.label}
              onClick={() => onChange([...p.value])}
            >
              <EaseCurve value={p.value} />
            </button>
          ))}
        </div>
      </Field>

      <Field label="Editor bézier">
        <BezierEditor value={value} onChange={onChange} />
      </Field>

      <div className="bezier-inputs">
        {["x1", "y1", "x2", "y2"].map((lbl, i) => (
          <div className="field" key={lbl}>
            <span className="field-label" style={{ textAlign: "center" }}>
              {lbl}
            </span>
            <input
              className="num-input"
              type="number"
              step={0.01}
              value={value[i]}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                if (!Number.isNaN(n)) setComponent(i, n);
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}

// El ease es global y vive en `timing` (BRIEF §3): moldea cada ciclo por
// separado, no la pieza entera. Con `linear` el movimiento es continuo; con una
// curva inOut el template "pisa" un slot por ciclo.
export default function EasePanel({ state, onPatch }) {
  const ease = state.timing.ease;
  const setEase = (val) => onPatch("timing", { ease: val });

  return (
    <Section title="Easing" defaultOpen={false}>
      <EaseControl value={ease} onChange={setEase} />

      <div className="divider" />

      <Field label="Stitch (transición entre ratios)">
        <Segmented
          value={state.stitch.enabled ? "on" : "off"}
          options={[
            { value: "on", label: "Animado" },
            { value: "off", label: "Instantáneo" },
          ]}
          onChange={(v) => onPatch("stitch", { enabled: v === "on" })}
        />
      </Field>
      <ScrubField
        label="Duración stitch"
        value={state.stitch.duration}
        min={0.1}
        max={2}
        step={0.05}
        onChange={(v) => onPatch("stitch", { duration: v })}
        format={(v) => `${v.toFixed(2)}s`}
      />
    </Section>
  );
}
