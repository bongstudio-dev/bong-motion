import { useEffect, useState } from "react";
import { Section, Field, Button, IconButton, Icon } from "@bong/ui";
import {
  loadDefaultId,
  loadPresets,
  saveDefaultId,
  savePresets,
  snapshotConfig,
} from "../presetStore";

export default function PresetsPanel({ config, onApplyPreset, onResetDefaults }) {
  const [presets, setPresets] = useState(loadPresets);
  const [defaultId, setDefaultId] = useState(loadDefaultId);
  const [name, setName] = useState("");
  const [activeId, setActiveId] = useState(null);

  useEffect(() => savePresets(presets), [presets]);
  useEffect(() => saveDefaultId(defaultId), [defaultId]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const values = snapshotConfig(config);
    setPresets((current) => {
      const existing = current.find(
        (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) {
        setActiveId(existing.id);
        return current.map((p) => (p.id === existing.id ? { ...p, values } : p));
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setActiveId(id);
      return [...current, { id, name: trimmed, values }];
    });
    setName("");
  };

  const handleDelete = (id) => {
    setPresets((current) => current.filter((p) => p.id !== id));
    setActiveId((c) => (c === id ? null : c));
    setDefaultId((c) => (c === id ? null : c));
  };

  return (
    <Section title="Presets" defaultOpen={false} value={presets.length}>
      <Field label="Guardar configuración actual">
        <div className="btn-row">
          <input
            className="text-input"
            placeholder="Nombre del preset"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <Button onClick={handleSave} disabled={!name.trim()}>
            Guardar
          </Button>
        </div>
      </Field>

      {presets.length === 0 ? (
        <p className="hint">
          Marcá uno con ★ para que la tool arranque con esos valores.
        </p>
      ) : (
        <div className="saved-list">
          {presets.map((preset) => {
            const isDefault = defaultId === preset.id;
            return (
              <div
                className="saved-row"
                key={preset.id}
                style={
                  activeId === preset.id
                    ? { borderColor: "var(--accent-line)" }
                    : undefined
                }
              >
                <button
                  className="icon-btn"
                  title={isDefault ? "Default de la tool" : "Marcar como default"}
                  onClick={() =>
                    setDefaultId((c) => (c === preset.id ? null : preset.id))
                  }
                  style={isDefault ? { color: "var(--accent)" } : undefined}
                >
                  {isDefault ? "★" : "☆"}
                </button>
                <span className="name" style={{ flex: 1 }}>
                  {preset.name}
                </span>
                <div style={{ display: "flex", gap: 2 }}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setActiveId(preset.id);
                      onApplyPreset(preset.values);
                    }}
                  >
                    Cargar
                  </Button>
                  <IconButton danger onClick={() => handleDelete(preset.id)}>
                    <Icon.Trash />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button variant="ghost" block onClick={onResetDefaults}>
        Reset a defaults
      </Button>
    </Section>
  );
}
