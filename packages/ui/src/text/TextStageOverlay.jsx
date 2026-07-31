// Arrastre de las capas de texto sobre el stage.
//
// Es DOM sobre el canvas, no algo dibujado adentro: el archivo sale del canvas
// (`captureStream`, `VideoFrame`, `toBlob`), así que un recuadro pintado ahí se
// exportaría. Es el mismo criterio que el handle del emisor en particle y que
// las guías de safe area en plane.
//
// Lo que mueve el arrastre es el OFFSET, no el ancla: el ancla sigue siendo de
// dónde cuelga el bloque (y por lo tanto qué pasa al cambiar de ratio), y el
// arrastre es sólo una forma más rápida de escribir el mismo par de campos que
// ya están en la ventana. Por eso también respeta su rango, ±50%.

import { useEffect, useRef } from "react";
import { textBounds } from "./drawTexts.js";

const LIMIT = 50; // % — el mismo tope que los campos X/Y de la ventana
// Aire alrededor del bloque para poder agarrarlo. Va en px lógicos del stage,
// así que en pantalla son un par de píxeles: lo justo para que un texto chico
// no exija puntería.
const PAD = 8;

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
const round = (v) => Math.round(v * 10) / 10;

export function TextStageOverlay({
  texts = [],
  stage,
  onChange,
  selectedId = null,
  onSelect,
}) {
  const areaRef = useRef(null);
  const drag = useRef(null);
  // El handler vive en un ref porque los listeners se registran en `window` una
  // sola vez, y necesitan ver siempre el `onChange` y el `texts` del render
  // actual — no los del render en que arrancó el arrastre.
  const latest = useRef(null);
  latest.current = { texts, onChange };

  // El arrastre se sigue desde `window`, no desde el recuadro: el recuadro se
  // mueve con el texto y es chico, así que un movimiento rápido se le escapa.
  // `setPointerCapture` cubriría el caso, pero no en todos lados —y si falla,
  // falla en silencio dejando un arrastre que se corta solo.
  useEffect(() => {
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      const text = latest.current.texts.find((t) => t.id === d.id);
      if (!text) return;
      let dx = (e.clientX - d.x0) * d.kx;
      let dy = (e.clientY - d.y0) * d.ky;
      // Shift restringe a un eje, como en cualquier editor.
      if (e.shiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      latest.current.onChange({
        ...text,
        offsetX: round(clamp(d.offsetX + dx, -LIMIT, LIMIT)),
        offsetY: round(clamp(d.offsetY + dy, -LIMIT, LIMIT)),
      });
    };
    const up = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  if (!texts.length || !stage?.w || !stage?.h) return null;

  const onPointerDown = (e, text) => {
    const area = areaRef.current?.getBoundingClientRect();
    if (!area?.width || !area?.height) return;
    e.preventDefault();
    drag.current = {
      id: text.id,
      x0: e.clientX,
      y0: e.clientY,
      offsetX: text.offsetX || 0,
      offsetY: text.offsetY || 0,
      // px de pantalla → % del stage. Se toma en el pointerdown y no en cada
      // movimiento: si el stage se reescalara a mitad de arrastre, cambiar la
      // regla en el medio pegaría un salto.
      kx: 100 / area.width,
      ky: 100 / area.height,
    };
    onSelect?.(text.id);
  };

  return (
    <div className="text-stage-overlay" ref={areaRef}>
      {texts.map((text) => {
        if (text.visible === false) return null;
        const box = textBounds(text, stage);
        if (!box) return null;
        return (
          <div
            key={text.id}
            className={`text-handle ${selectedId === text.id ? "selected" : ""}`.trim()}
            style={{
              left: `${((box.x - PAD) / stage.w) * 100}%`,
              top: `${((box.y - PAD) / stage.h) * 100}%`,
              width: `${((box.w + PAD * 2) / stage.w) * 100}%`,
              height: `${((box.h + PAD * 2) / stage.h) * 100}%`,
            }}
            title="Arrastrá para mover · Shift fija el eje"
            onPointerDown={(e) => onPointerDown(e, text)}
          />
        );
      })}
    </div>
  );
}

export default TextStageOverlay;
