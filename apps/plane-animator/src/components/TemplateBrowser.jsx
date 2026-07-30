import { useState } from "react";
import { Icon } from "@bong/ui";
import { TEMPLATES } from "../engine/templates.js";
import { LIBRARY } from "../engine/library.js";
import PresetThumb from "./PresetThumb.jsx";

// Navegador de dos niveles: familias → variantes.
//
// Elegir "template" y elegir "cómo se mueve" no son la misma decisión, y el
// grid de cinco botones que había antes sólo resolvía la primera: te dejaba en
// los defaults del template y con quince sliders por delante. Acá cada familia
// abre sus variantes ya compuestas, con la miniatura mostrando el movimiento
// real.

// ¿Los params actuales son exactamente los de esta variante? Sirve para marcar
// cuál está aplicada; en cuanto se toca un slider deja de coincidir, que es la
// señal correcta.
function matches(params, variant) {
  return Object.entries(variant.params).every(([k, v]) => params[k] === v);
}

export default function TemplateBrowser({ state, params, onPick, onTemplate }) {
  const [open, setOpen] = useState(null);
  const current = state.template.id;

  if (open) {
    const group = LIBRARY.find((g) => g.template === open);
    const tpl = TEMPLATES[open];
    return (
      <div className="browser">
        <button className="browser-head" onClick={() => setOpen(null)}>
          <Icon.Chevron style={{ transform: "rotate(180deg)" }} />
          <span>{tpl.name}</span>
          <span className="tag">{group.variants.length}</span>
        </button>
        <div className="preset-grid">
          {group.variants.map((v) => (
            <div key={v.id} onClick={() => onPick(v, open)}>
              <PresetThumb
                base={state}
                variant={v}
                template={open}
                active={current === open && matches(params, v)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="browser">
      {LIBRARY.map((group) => {
        const tpl = TEMPLATES[group.template];
        const active = current === group.template;
        return (
          <button
            key={group.template}
            className={`browser-row ${active ? "active" : ""}`}
            onClick={() => {
              if (!active) onTemplate(group.template);
              setOpen(group.template);
            }}
          >
            <span className="browser-name">{tpl.name}</span>
            <span className="tag">{group.variants.length}</span>
            <Icon.Chevron />
          </button>
        );
      })}
    </div>
  );
}
