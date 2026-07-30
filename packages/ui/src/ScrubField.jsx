import { useCallback, useEffect, useRef, useState } from "react";

// Campo numérico "scrubby": label y valor adentro de la misma píldora, el fondo
// se llena como un nivel, y una línea vertical marca dónde está el valor.
//
// Se arrastra desde CUALQUIER punto del control, no desde la línea. Por eso el
// arrastre es relativo (suma un delta) y no absoluto (saltar a donde clickeaste):
// agarrar en cualquier lado no debe pegar un salto, y así se puede afinar sin
// tener que apuntarle a un thumb de 13px. Es el mismo gesto que los campos
// numéricos de After Effects o Figma.
//
// - arrastrar   → cambia el valor; recorrer el ancho del control = el rango entero
// - shift       → 5× más fino
// - doble click → escribir el número a mano
// - ← →         → un step (shift = 10)

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

// Geometría del nivel y la perilla.
//
// La perilla va DENTRO del nivel, no sobre su filo: el nivel la abraza dejando
// el mismo aire a los dos lados, y ese aire es constante en todo el recorrido.
// Montarla en el borde la hace ver cortada por la mitad.
//
//   pct = 0        [ gap|▮|gap ]
//   pct = 50       [ ▔▔▔▔▔▔ gap|▮|gap ]
//   pct = 100      [ ▔▔▔▔▔▔▔▔▔▔▔▔▔ gap|▮|gap ]
//                  ↑ INSET                    ↑ INSET
const INSET = 4; // aire entre el nivel y el borde del control
const GAP = 3; // aire entre la perilla y el borde del nivel
const KNOB = 3; // ancho de la perilla

// Centro de la perilla cuando el valor está en el mínimo. El recorrido va de
// acá hasta el espejo del otro lado, así los dos extremos quedan simétricos.
const EDGE = INSET + GAP + KNOB / 2;
// Ancho del nivel en el mínimo: justo lo necesario para abrazar la perilla.
const FILL_MIN = EDGE + KNOB / 2 + GAP - INSET;

const decimalsOf = (step) => {
  const s = String(step);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
};

export function ScrubField({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  format,
  unit = "",
  disabled = false,
}) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const decimals = decimalsOf(step);
  const span = max - min || 1;
  const pct = clamp(((value - min) / span) * 100, 0, 100);
  const shown = format ? format(value) : `${value.toFixed(decimals)}${unit}`;
  // Nivel y perilla comparten este desplazamiento, así el aire entre los dos
  // no puede desincronizarse.
  const travel = `(100% - ${EDGE * 2}px) * ${pct / 100}`;

  const commit = useCallback(
    (raw) => {
      const snapped = Math.round(raw / step) * step;
      const next = clamp(Number(snapped.toFixed(decimals + 2)), min, max);
      if (next !== value) onChange(next);
    },
    [step, decimals, min, max, value, onChange],
  );

  const onPointerDown = (e) => {
    if (disabled || editing || e.button !== 0) return;
    const el = ref.current;
    // El capture es lo que deja seguir arrastrando fuera del control, pero no
    // es esencial: si el navegador lo rechaza, el gesto tiene que funcionar
    // igual dentro del elemento.
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* sin capture */
    }
    drag.current = {
      x: e.clientX,
      from: value,
      width: el.getBoundingClientRect().width,
      moved: false,
    };
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 2) return; // tolerancia: un click no es un drag
    d.moved = true;
    commit(d.from + (dx / d.width) * span * (e.shiftKey ? 0.2 : 1));
  };

  const endDrag = (e) => {
    if (!drag.current) return;
    try {
      ref.current?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* nunca se capturó */
    }
    drag.current = null;
    setDragging(false);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    const mult = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      commit(value + step * mult);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      commit(value - step * mult);
    } else if (e.key === "Enter") {
      e.preventDefault();
      startEditing();
    }
  };

  const startEditing = () => {
    if (disabled) return;
    setDraft(String(Number(value.toFixed(decimals))));
    setEditing(true);
  };

  const applyDraft = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n)) commit(n);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="scrub editing">
        <span className="scrub-label">{label}</span>
        <input
          className="scrub-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={applyDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyDraft();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`scrub ${dragging ? "dragging" : ""} ${disabled ? "disabled" : ""}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={startEditing}
      onKeyDown={onKeyDown}
    >
      <span
        className="scrub-fill"
        style={{ width: `calc(${FILL_MIN}px + ${travel})` }}
      />
      <span className="scrub-knob" style={{ left: `calc(${EDGE}px + ${travel})` }} />
      <span className="scrub-label">{label}</span>
      <span className="scrub-value">{shown}</span>
    </div>
  );
}

export default ScrubField;
