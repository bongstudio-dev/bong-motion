import { useEffect, useRef, useState } from "react";
import { Section, Button, IconButton, Icon } from "@bong/ui";
import { normalizeHex, isValidHex, parsePalette } from "../../utils/color.js";
import { uid } from "../../utils/math.js";
import { MIN_COLORS, MAX_COLORS, NEW_COLOR_POOL } from "../../state/defaults.js";
import { loadSavedPalettes, saveSavedPalettes } from "../../state/storage.js";

// Fila de color con su propio draft de hex (valida en vivo, commit al salir).
function ColorRow({ color, index, canRemove, onChange, onRemove, drag }) {
  const [draft, setDraft] = useState(color.hex);
  const valid = isValidHex(draft);

  useEffect(() => setDraft(color.hex), [color.hex]);

  const commitHex = () => {
    const norm = normalizeHex(draft);
    if (norm) onChange({ ...color, hex: norm });
    else setDraft(color.hex);
  };

  return (
    <div
      className={`color-row ${drag.isDragging ? "dragging" : ""} ${
        drag.isTarget ? "drop-target" : ""
      }`}
      draggable
      onDragStart={() => drag.onStart(index)}
      onDragEnter={() => drag.onEnter(index)}
      onDragEnd={drag.onEnd}
      onDragOver={(e) => e.preventDefault()}
    >
      <span className="drag-handle" title="Arrastrá para reordenar">
        <Icon.Drag />
      </span>

      <label className="swatch" style={{ background: color.hex }}>
        <input
          type="color"
          value={isValidHex(color.hex) ? color.hex : "#000000"}
          onChange={(e) => onChange({ ...color, hex: e.target.value.toUpperCase() })}
        />
      </label>

      <div className="color-fields">
        <input
          className={`text-input hex ${valid ? "" : "invalid"}`}
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <input
          className="text-input name"
          placeholder="Nombre (opcional)"
          value={color.name}
          onChange={(e) => onChange({ ...color, name: e.target.value })}
        />
      </div>

      <IconButton
        danger
        disabled={!canRemove}
        onClick={() => canRemove && onRemove(color.id)}
        title={canRemove ? "Quitar" : `Mínimo ${MIN_COLORS} colores`}
        style={canRemove ? undefined : { opacity: 0.3, cursor: "not-allowed" }}
      >
        <Icon.Trash />
      </IconButton>
    </div>
  );
}

export default function PalettePanel({ palette, setPalette }) {
  const [pasteText, setPasteText] = useState("");
  const [saved, setSaved] = useState(() => loadSavedPalettes());
  const [saveName, setSaveName] = useState("");
  const dragFrom = useRef(null);
  const [dragState, setDragState] = useState({ from: null, over: null });

  const persistSaved = (list) => {
    setSaved(list);
    saveSavedPalettes(list);
  };

  const updateColor = (next) =>
    setPalette((p) => p.map((c) => (c.id === next.id ? next : c)));

  const addColor = () =>
    setPalette((p) => {
      if (p.length >= MAX_COLORS) return p;
      const hex = NEW_COLOR_POOL[p.length % NEW_COLOR_POOL.length];
      return [...p, { id: uid(), hex, name: "" }];
    });

  const removeColor = (id) =>
    setPalette((p) => (p.length > MIN_COLORS ? p.filter((c) => c.id !== id) : p));

  // Drag reorder
  const onStart = (i) => {
    dragFrom.current = i;
    setDragState({ from: i, over: i });
  };
  const onEnter = (i) => setDragState((s) => ({ ...s, over: i }));
  const onEnd = () => {
    const from = dragFrom.current;
    const to = dragState.over;
    if (from != null && to != null && from !== to) {
      setPalette((p) => {
        const next = [...p];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
    dragFrom.current = null;
    setDragState({ from: null, over: null });
  };

  const applyPaste = (replace) => {
    const hexes = parsePalette(pasteText).slice(0, MAX_COLORS);
    if (hexes.length < 1) return;
    setPalette((p) => {
      const parsed = hexes.map((hex) => ({ id: uid(), hex, name: "" }));
      if (replace) return parsed.slice(0, MAX_COLORS);
      return [...p, ...parsed].slice(0, MAX_COLORS);
    });
    setPasteText("");
  };

  const saveCurrent = () => {
    const name = saveName.trim() || `Paleta ${saved.length + 1}`;
    persistSaved([
      ...saved,
      { id: uid("p"), name, colors: palette.map((c) => ({ ...c })) },
    ]);
    setSaveName("");
  };

  const loadPalette = (entry) =>
    setPalette(entry.colors.map((c) => ({ ...c, id: uid() })));

  const deletePalette = (id) => persistSaved(saved.filter((s) => s.id !== id));

  return (
    <Section title="Paleta" right={<span className="tag">{palette.length}/{MAX_COLORS}</span>}>
      <div className="color-list">
        {palette.map((color, i) => (
          <ColorRow
            key={color.id}
            color={color}
            index={i}
            canRemove={palette.length > MIN_COLORS}
            onChange={updateColor}
            onRemove={removeColor}
            drag={{
              isDragging: dragState.from === i,
              isTarget: dragState.over === i && dragState.from !== i,
              onStart,
              onEnter,
              onEnd,
            }}
          />
        ))}
      </div>

      <div className="btn-row">
        <Button block onClick={addColor} disabled={palette.length >= MAX_COLORS}>
          <Icon.Plus /> Agregar
        </Button>
      </div>

      <div className="divider" />

      <div className="field">
        <span className="field-label">Paste masivo</span>
        <textarea
          className="text-input"
          placeholder="#004831, #0C6347, #20C683 — o una lista con saltos de línea"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />
        <div className="btn-row">
          <Button block onClick={() => applyPaste(true)} disabled={!pasteText.trim()}>
            Reemplazar
          </Button>
          <Button block onClick={() => applyPaste(false)} disabled={!pasteText.trim()}>
            Agregar
          </Button>
        </div>
      </div>

      <div className="divider" />

      <div className="field">
        <span className="field-label">Paletas guardadas</span>
        <div className="btn-row">
          <input
            className="text-input"
            placeholder="Nombre de la paleta"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCurrent()}
          />
          <Button onClick={saveCurrent}>Guardar</Button>
        </div>
        {saved.length > 0 && (
          <div className="color-list" style={{ marginTop: 6 }}>
            {saved.map((entry) => (
              <div key={entry.id} className="saved-row">
                <span className="name">{entry.name}</span>
                <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ display: "flex", gap: 2 }}>
                    {entry.colors.slice(0, 6).map((c, i) => (
                      <span
                        key={i}
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 3,
                          background: c.hex,
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      />
                    ))}
                  </span>
                  <Button variant="ghost" onClick={() => loadPalette(entry)}>
                    Cargar
                  </Button>
                  <IconButton danger onClick={() => deletePalette(entry.id)}>
                    <Icon.Trash />
                  </IconButton>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
