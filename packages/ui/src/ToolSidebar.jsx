import { useState } from "react";
import { TOOLS, toolHref } from "./tools.js";
import { cycleMode, getMode, getSkin, toggleSkin } from "./skin.js";
import { GlassTweaker } from "./GlassTweaker.jsx";

// Isotipo de Bong. Va con currentColor para que tome el verde del tema y no
// arrastre un hex propio.
export function BongMark({ size = 19 }) {
  return (
    <svg
      viewBox="0 0 218 256"
      width={(size * 218) / 256}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M193.605 17.9034C204.496 28.8698 211.483 44.1209 211.483 60.851C211.483 77.5812 204.496 92.7812 193.605 103.799C182.56 114.969 167.405 121.702 150.555 121.702C133.704 121.702 118.549 114.918 107.658 103.799C96.7672 92.8323 89.7806 77.5812 89.7806 60.851C89.7806 44.1209 96.7672 28.9209 107.658 17.9034C118.549 6.73288 133.858 0 150.555 0C167.251 0 182.56 6.78388 193.605 17.9034Z" />
      <path d="M73.0789 18.6733C75.7969 25.7411 75.7969 34.1817 73.0789 41.4022C70.5148 47.809 65.9504 53.1987 59.1298 56.046C93.9512 62.0971 91.9512 119.707 52.8219 119.707H0V1.99536H48.104C61.0273 1.99536 69.3352 9.21569 73.0789 18.6733Z" />
      <path d="M0 133.673L0.102501 253.38H44.8445H83.7949V135.199H44.8445V185.106L1.99878 133.673H0Z" />
      <path d="M153.414 194.879L184.78 140.586C176.341 136.164 166.784 133.673 156.616 133.673C123.013 133.673 95.7653 160.921 95.7653 194.524C95.7653 228.127 123.013 255.375 156.616 255.375C190.219 255.375 217.315 228.33 217.467 194.829H153.414V194.879Z" />
    </svg>
  );
}

// Los tres motores son apps distintas: cambiar de tool recarga. La sidebar es
// lo que hace que se sientan una sola plataforma igual.
const GLYPHS = {
  "plane-animator": (
    <svg viewBox="0 0 22 22" width="19" height="19" aria-hidden="true">
      <rect x="1.5" y="6" width="4.5" height="10" rx="1" fill="currentColor" opacity=".4" />
      <rect x="7.5" y="3.5" width="7" height="15" rx="1.2" fill="currentColor" />
      <rect x="16" y="6" width="4.5" height="10" rx="1" fill="currentColor" opacity=".4" />
    </svg>
  ),
  "palette-animator": (
    <svg viewBox="0 0 22 22" width="19" height="19" aria-hidden="true">
      <rect x="2" y="4" width="4" height="14" rx="1" fill="currentColor" opacity=".35" />
      <rect x="7" y="4" width="4" height="14" rx="1" fill="currentColor" opacity=".6" />
      <rect x="12" y="4" width="4" height="14" rx="1" fill="currentColor" opacity=".85" />
      <rect x="17" y="4" width="3" height="14" rx="1" fill="currentColor" />
    </svg>
  ),
  "particle-visualizer": (
    <svg viewBox="0 0 22 22" width="19" height="19" aria-hidden="true">
      <circle cx="5" cy="7" r="1.6" fill="currentColor" opacity=".55" />
      <circle cx="11" cy="4.5" r="1.2" fill="currentColor" opacity=".4" />
      <circle cx="16.5" cy="8" r="2.1" fill="currentColor" />
      <circle cx="6.5" cy="14.5" r="2.1" fill="currentColor" opacity=".8" />
      <circle cx="13" cy="12" r="1.3" fill="currentColor" opacity=".5" />
      <circle cx="17" cy="16" r="1.5" fill="currentColor" opacity=".65" />
    </svg>
  ),
};

// Medio círculo lleno: el glifo clásico de contraste. Dice "cambia el material
// de la interfaz" sin prometer una función concreta.
const SkinGlyph = () => (
  <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
    <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M9 2a7 7 0 0 1 0 14z" fill="currentColor" />
  </svg>
);

// Auto sigue al sistema; los otros dos lo pisan. El glifo cuenta cuál está: el
// círculo partido para Auto —el mismo que dice "depende del contraste"—, sol y
// luna para los overrides.
const MODE_GLYPH = {
  system: (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
      <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 2a7 7 0 0 1 0 14z" fill="currentColor" />
    </svg>
  ),
  light: (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
      <circle cx="9" cy="9" r="3.5" fill="currentColor" />
      <path
        d="M9 1.2v2M9 14.8v2M1.2 9h2M14.8 9h2M3.5 3.5l1.4 1.4M13.1 13.1l1.4 1.4M14.5 3.5l-1.4 1.4M4.9 13.1l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
      <path
        d="M15 11.2A6.6 6.6 0 0 1 6.8 3a6.9 6.9 0 1 0 8.2 8.2z"
        fill="currentColor"
      />
    </svg>
  ),
};

// Dos láminas superpuestas con un brillo cruzándolas: el material, no una
// tuerca. Lo que se ajusta acá es el vidrio, no la configuración de la app.
const GlassGlyph = () => (
  <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
    <rect x="1.5" y="4" width="11" height="8" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.3" opacity=".45" />
    <rect x="5.5" y="6" width="11" height="8" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <path d="M7.4 12.6L13.6 6.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const MODE_LABEL = { system: "Auto", light: "Claro", dark: "Oscuro" };
const MODE_TITLE = {
  system: "Claro / oscuro: sigue al sistema — click para forzar claro",
  light: "Claro / oscuro: forzado en claro — click para forzar oscuro",
  dark: "Claro / oscuro: forzado en oscuro — click para volver a seguir al sistema",
};

// El skin es de la plataforma, no de la tool: por eso los dos interruptores
// viven en el rail y no en el sidebar de ajustes de la pieza.
//
// Van con la misma forma y la misma etiqueta que las tools. Un ícono suelto sin
// texto acá abajo no se encuentra: el rail entrenó al ojo a leer glifo + palabra.
/* Las perillas son una herramienta de ajuste, no una preferencia: sirven para
   encontrar el material y volcarlo al stylesheet. Una vez volcado, en la tool
   desplegada no tienen nada que hacer. Vite reemplaza esto por `false` al
   compilar, así que el panel entero se cae del bundle de producción. */
const TWEAKER = import.meta.env?.DEV ?? false;

function RailSettings({ tweaking, onTweak }) {
  const [skin, setSkinLocal] = useState(getSkin);
  const [mode, setModeLocal] = useState(getMode);
  const glass = skin === "glass";

  return (
    <>
      {/* Las perillas del material. Sólo existen en Glass: el chasis viejo no
          tiene cristal que ajustar. */}
      {glass && TWEAKER && (
        <button
          type="button"
          className={`tool-rail-item glass-toggle ${tweaking ? "on" : ""}`.trim()}
          onClick={onTweak}
          title="Ajustar el cristal"
          aria-pressed={tweaking}
        >
          <GlassGlyph />
          <span>Cristal</span>
        </button>
      )}

      {/* Claro/oscuro sólo tiene sentido dentro de Glass: el chasis viejo es
          oscuro y punto. */}
      {glass && (
        <button
          type="button"
          className="tool-rail-item mode-toggle"
          onClick={() => setModeLocal(cycleMode())}
          title={MODE_TITLE[mode]}
        >
          {MODE_GLYPH[mode]}
          <span>{MODE_LABEL[mode]}</span>
        </button>
      )}

      <button
        type="button"
        className="tool-rail-item skin-toggle"
        onClick={() => setSkinLocal(toggleSkin())}
        title={glass ? "Skin Glass — click para volver al chasis oscuro" : "Chasis oscuro — click para pasar a Glass"}
        aria-pressed={glass}
      >
        <SkinGlyph />
        <span>{glass ? "Glass" : "Skin"}</span>
      </button>
    </>
  );
}

export function ToolSidebar({ current, isDev = false, library = null }) {
  // El panel de perillas se monta FUERA del <nav>. Adentro lo alcanzaba la
  // regla "el contenido va encima del reflejo", que le pone position: relative
  // a todo hijo directo de una superficie de cristal — y eso lo sacaba de
  // fixed y lo metía en el flujo del rail.
  const [tweaking, setTweaking] = useState(false);

  return (
    <>
    <nav className="tool-rail" aria-label="Herramientas">
      <a className="tool-rail-mark" href="../" title="Bong Motion">
        <BongMark />
      </a>

      {TOOLS.map((tool) => {
        const active = tool.id === current;

        // Sobre la tool en la que ya estás, el rail no tiene a dónde llevarte:
        // ese click queda libre y lo usa la biblioteca. Es el gesto de barra
        // lateral de siempre — volver a tocar el ítem en el que estás muestra y
        // esconde su panel.
        if (active && library) {
          return (
            <button
              key={tool.id}
              type="button"
              className="tool-rail-item active is-toggle"
              onClick={library.onToggle}
              title={library.open ? "Esconder la biblioteca" : "Mostrar la biblioteca"}
              aria-pressed={library.open}
            >
              {GLYPHS[tool.id]}
              <span>{tool.name}</span>
            </button>
          );
        }

        return (
          <a
            key={tool.id}
            className={`tool-rail-item ${active ? "active" : ""}`}
            href={active ? undefined : toolHref(tool, isDev)}
            title={tool.title}
            aria-current={active ? "page" : undefined}
          >
            {GLYPHS[tool.id]}
            <span>{tool.name}</span>
          </a>
        );
      })}

      <RailSettings tweaking={tweaking} onTweak={() => setTweaking((v) => !v)} />
    </nav>
    {TWEAKER && <GlassTweaker open={tweaking} onClose={() => setTweaking(false)} />}
    </>
  );
}

export default ToolSidebar;
