/* Las perillas del cristal, en vivo y sobre la interfaz de verdad.
 *
 * No es un panel de preferencias: es una herramienta de ajuste. El material se
 * mira mientras se mueve, contra el contenido real, y por eso vive flotando
 * sobre la app en vez de en una pantalla de settings. Cuando el ajuste está
 * bueno, "Copiar CSS" lo devuelve listo para pegar en skin-glass.css.
 *
 * Cada tema guarda lo suyo: el mismo reflejo que sobre crema es sutil, sobre
 * verde profundo es una mancha.
 */

import { useEffect, useRef, useState } from "react";
import { Button, Icon, IconButton } from "./controls.jsx";
import { ScrubField } from "./ScrubField.jsx";
import {
  GLASS_PARAMS,
  anyGlassTweaked,
  getGlass,
  glassAsCss,
  glassDefault,
  isGlassTweaked,
  resetGlass,
  setGlass,
} from "./skin.js";

const WIDTH = 268;
let lastPos = null; // recordado por sesión, como la ventana de texto

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

const GROUPS = [...new Set(GLASS_PARAMS.map((p) => p.group))];

export function GlassTweaker({ open, onClose }) {
  if (!open) return null;
  return <GlassTweakerInner onClose={onClose} />;
}

function GlassTweakerInner({ onClose }) {
  const [pos, setPos] = useState(() => {
    if (lastPos) return lastPos;
    return { x: Math.max(8, window.innerWidth - WIDTH - 400), y: 76 };
  });
  // El store vive fuera de React: este contador es lo único que hace falta para
  // repintar cuando cambia. Duplicar los valores en estado sería tener dos
  // fuentes de verdad para el mismo número.
  const [, bump] = useState(0);
  const [copied, setCopied] = useState(false);
  const [dump, setDump] = useState(null);
  const drag = useRef(null);

  useEffect(() => {
    lastPos = pos;
  }, [pos]);

  // Las perillas que se muestran son las del tema activo, así que hay que
  // repintar cuando cambia. Se observa `data-theme` en <html> y no los eventos
  // que podrían causarlo: el tema cambia desde el botón de modo, desde el
  // sistema y al recuperar el foco, y escuchar las tres fuentes es tener tres
  // maneras de olvidarse de una. El atributo es el único lugar por el que
  // pasan todas.
  useEffect(() => {
    const obs = new MutationObserver(() => bump((n) => n + 1));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  const onGrab = (e) => {
    if (e.target.closest("button")) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onDrag = (e) => {
    if (!drag.current) return;
    setPos({
      x: clamp(e.clientX - drag.current.dx, 4, window.innerWidth - WIDTH - 4),
      y: clamp(e.clientY - drag.current.dy, 4, window.innerHeight - 60),
    });
  };

  /* Muestra el volcado SIEMPRE, y de paso intenta copiarlo. El portapapeles se
     niega en más contextos de los que uno espera —sin gesto de usuario, sin
     https, con el permiso denegado— y si eso fallara en silencio, la
     herramienta entera no tendría salida: los valores quedarían adentro de la
     sesión. El textarea es el camino que no depende de un permiso. */
  const copy = async () => {
    setDump(glassAsCss());
    try {
      await navigator.clipboard.writeText(glassAsCss());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const theme = document.documentElement.dataset.theme || "light";

  return (
    <div className="float-panel glass-tweaker" style={{ left: pos.x, top: pos.y, width: WIDTH }}>
      <div
        className="float-panel-head"
        onPointerDown={onGrab}
        onPointerMove={onDrag}
        onPointerUp={() => (drag.current = null)}
      >
        <span className="float-panel-grip" />
        <span className="float-panel-title">
          Cristal <em>{theme === "dark" ? "oscuro" : "claro"}</em>
        </span>
        <IconButton onClick={onClose} title="Cerrar">
          <Icon.Close />
        </IconButton>
      </div>

      <div className="float-panel-body">
        {GROUPS.map((group) => (
          <div className="group" key={group}>
            <div className="group-title">{group}</div>
            {GLASS_PARAMS.filter((p) => p.group === group).map((p) => (
              <Knob key={p.key} spec={p} onChange={() => bump((n) => n + 1)} />
            ))}
          </div>
        ))}

        <div className="divider" />

        <p className="hint">
          Los valores se guardan por tema. Lo que no tocaste sale del stylesheet,
          así que sólo se copia lo que moviste.
        </p>

        <div className="btn-row">
          <Button block onClick={copy} disabled={!anyGlassTweaked()}>
            {copied ? "Copiado" : "Copiar CSS"}
          </Button>
          <Button
            onClick={() => {
              resetGlass();
              setDump(null);
              bump((n) => n + 1);
            }}
            disabled={!anyGlassTweaked()}
          >
            Reset
          </Button>
        </div>

        {dump && (
          <textarea
            className="text-input glass-dump"
            readOnly
            rows={Math.min(12, dump.split("\n").length + 1)}
            value={dump}
            onFocus={(e) => e.target.select()}
          />
        )}
      </div>
    </div>
  );
}

// Una perilla. El botón de la derecha aparece sólo si el valor está fuera del
// default, y hace dos cosas a la vez: marca qué se tocó —después de veinte
// movimientos uno ya no se acuerda— y lo devuelve.
function Knob({ spec, onChange }) {
  const value = getGlass(spec.key);
  const tweaked = isGlassTweaked(spec.key);
  return (
    <div className={`knob ${tweaked ? "tweaked" : ""}`.trim()} title={spec.hint ?? ""}>
      <ScrubField
        label={spec.label}
        value={value}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        unit={spec.unit ?? ""}
        onChange={(v) => {
          setGlass(spec.key, v);
          onChange();
        }}
      />
      {tweaked && (
        <button
          className="knob-reset"
          title={`Volver al default (${glassDefault(spec.key)})`}
          onClick={() => {
            setGlass(spec.key, glassDefault(spec.key));
            onChange();
          }}
        />
      )}
    </div>
  );
}

export default GlassTweaker;
