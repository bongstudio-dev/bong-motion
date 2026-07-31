import { useMemo, useState } from "react";
import { Button, Icon, IconButton } from "@bong/ui";
import { TEMPLATES } from "../engine/templates.js";
import { LIBRARY, ALL_VARIANTS, variantState } from "../engine/library.js";
import { presetFromState, applyPreset } from "../state/defaults.js";
import { loadPresets, savePresets } from "../state/storage.js";
import PresetThumb from "./PresetThumb.jsx";

// La biblioteca, en su propia columna al lado del rail.
//
// El orden de la interfaz sigue el orden de las decisiones: el rail elige la
// herramienta, esta columna elige QUÉ animación, y el sidebar de la derecha
// ajusta esa animación. Meter la biblioteca adentro del panel de params —como
// estaba— mezclaba el segundo paso con el tercero y los hacía competir por el
// mismo espacio.

// ¿Los params actuales son exactamente los de esta variante? Marca cuál está
// aplicada; se desmarca al tocar cualquier slider, que es cuando dejó de serlo.
const matches = (params, variant) =>
  Object.entries(variant.params ?? {}).every(([k, v]) => params[k] === v);

// Sin tildes: "tunel" tiene que encontrar "Túnel". Nadie escribe los acentos
// cuando busca.
const fold = (s) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

// Un preset guardado por el usuario tiene la forma del state; se adapta a la
// misma forma que una variante de fábrica para poder reusar la miniatura.
const asVariant = (preset) => ({
  id: preset.name,
  name: preset.name,
  params: preset.template?.params?.[preset.template.id] ?? {},
  timing: preset.timing,
  fit: preset.fit,
  fov: preset.fov,
});

export default function LibraryPanel({ state, params, onTemplate, setState }) {
  const [tab, setTab] = useState("templates");
  const [open, setOpen] = useState(null);
  const [query, setQuery] = useState("");
  const [presets, setPresets] = useState(loadPresets);
  const [name, setName] = useState("");

  const current = state.template.id;
  const q = fold(query.trim());

  const results = useMemo(() => {
    if (!q) return null;
    return ALL_VARIANTS.filter(
      (v) =>
        fold(v.name).includes(q) ||
        fold(TEMPLATES[v.template]?.name ?? "").includes(q),
    );
  }, [q]);

  const pick = (variant, template) =>
    setState((s) => variantState(s, variant, template));

  const saveCurrent = () => {
    const label = name.trim();
    if (!label) return;
    const next = [
      ...presets.filter((p) => p.name !== label),
      { name: label, ...presetFromState(state) },
    ];
    setPresets(next);
    savePresets(next);
    setName("");
    setTab("custom");
  };

  const removePreset = (label) => {
    const next = presets.filter((p) => p.name !== label);
    setPresets(next);
    savePresets(next);
  };

  const grid = (variants, template) => (
    <div className="preset-grid">
      {variants.map((v) => (
        <div key={v.id} onClick={() => pick(v, template ?? v.template)}>
          <PresetThumb
            base={state}
            variant={v}
            template={template ?? v.template}
            active={current === (template ?? v.template) && matches(params, v)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <aside className="library">
      <div className="library-tabs">
        <button
          className={tab === "templates" ? "active" : ""}
          onClick={() => setTab("templates")}
        >
          Templates
        </button>
        <button
          className={tab === "custom" ? "active" : ""}
          onClick={() => setTab("custom")}
        >
          Custom
        </button>
      </div>

      {tab === "templates" && (
        <div className="library-search">
          <Icon.Search />
          <input
            value={query}
            placeholder={`Buscar en ${ALL_VARIANTS.length} presets`}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="library-clear" onClick={() => setQuery("")}>
              ×
            </button>
          )}
        </div>
      )}

      <div className="library-body">
        {tab === "custom" ? (
          <>
            <div className="library-save">
              <input
                className="text-input"
                placeholder="Nombre del preset"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveCurrent()}
              />
              <Button onClick={saveCurrent} disabled={!name.trim()}>
                Guardar
              </Button>
            </div>
            <p className="hint">
              Guarda la escena actual: template, params, timing, perspectiva y
              encuadre. Los assets no — son de la sesión.
            </p>
            {presets.length === 0 ? (
              <p className="library-empty">Todavía no guardaste ninguno.</p>
            ) : (
              <div className="preset-grid">
                {presets.map((p) => {
                  const v = asVariant(p);
                  return (
                    <div key={p.name} className="custom-cell">
                      <div onClick={() => setState((s) => applyPreset(s, p))}>
                        <PresetThumb
                          base={state}
                          variant={v}
                          template={p.template.id}
                          active={current === p.template.id && matches(params, v)}
                        />
                      </div>
                      <IconButton
                        danger
                        title={`Borrar ${p.name}`}
                        onClick={() => removePreset(p.name)}
                      >
                        <Icon.Trash />
                      </IconButton>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : results ? (
          results.length ? (
            grid(results)
          ) : (
            <p className="library-empty">Nada que coincida con “{query}”.</p>
          )
        ) : open ? (
          <>
            <button className="browser-head" onClick={() => setOpen(null)}>
              <Icon.Chevron style={{ transform: "rotate(180deg)" }} />
              <span>{TEMPLATES[open].name}</span>
              <span className="tag">
                {LIBRARY.find((g) => g.template === open).variants.length}
              </span>
            </button>
            {grid(LIBRARY.find((g) => g.template === open).variants, open)}
          </>
        ) : (
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
        )}
      </div>
    </aside>
  );
}
