import { useEffect, useState } from "react";
import {
  loadDefaultId,
  loadPresets,
  saveDefaultId,
  savePresets,
  snapshotConfig,
} from "../presetStore";

function Presets({ config, onApplyPreset, onResetDefaults }) {
  const [presets, setPresets] = useState(loadPresets);
  const [defaultId, setDefaultId] = useState(loadDefaultId);
  const [name, setName] = useState("");
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  useEffect(() => {
    saveDefaultId(defaultId);
  }, [defaultId]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const values = snapshotConfig(config);

    setPresets((current) => {
      const existing = current.find(
        (preset) => preset.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) {
        setActiveId(existing.id);
        return current.map((preset) =>
          preset.id === existing.id ? { ...preset, values } : preset,
        );
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setActiveId(id);
      return [...current, { id, name: trimmed, values }];
    });
    setName("");
  };

  const handleApply = (preset) => {
    setActiveId(preset.id);
    onApplyPreset(preset.values);
  };

  const handleDelete = (id) => {
    setPresets((current) => current.filter((preset) => preset.id !== id));
    setActiveId((current) => (current === id ? null : current));
    setDefaultId((current) => (current === id ? null : current));
  };

  const handleToggleDefault = (id) => {
    setDefaultId((current) => (current === id ? null : id));
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-black/10 p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
          Presets
        </h2>
        <button
          type="button"
          onClick={onResetDefaults}
          className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition hover:border-white/25 hover:text-white"
        >
          Reset
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSave();
          }}
          placeholder="Nombre del preset"
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white placeholder:text-muted/70 focus:border-accent/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim()}
          className="rounded-full border border-accent/20 bg-accent px-4 py-2 text-sm font-medium text-app transition hover:bg-[#3ce09b] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar
        </button>
      </div>

      {presets.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Ajustá los parámetros y guardá la configuración actual como preset.
          Marcá uno con ★ para que la tool arranque con esos valores.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {presets.map((preset) => {
            const isDefault = defaultId === preset.id;
            return (
              <div
                key={preset.id}
                className={`flex items-center gap-1 rounded-full border px-1 py-1 transition ${
                  activeId === preset.id
                    ? "border-accent/50 bg-accent/10"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggleDefault(preset.id)}
                  aria-pressed={isDefault}
                  aria-label={
                    isDefault
                      ? `Quitar ${preset.name} como default`
                      : `Marcar ${preset.name} como default`
                  }
                  title={isDefault ? "Default de la tool" : "Marcar como default"}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm transition ${
                    isDefault
                      ? "text-accent"
                      : "text-muted hover:text-white"
                  }`}
                >
                  {isDefault ? "★" : "☆"}
                </button>
                <button
                  type="button"
                  onClick={() => handleApply(preset)}
                  className={`min-w-0 flex-1 truncate rounded-full px-2 py-1 text-left text-xs font-medium transition ${
                    activeId === preset.id ? "text-accent" : "text-white"
                  }`}
                >
                  {preset.name}
                  {isDefault ? (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-accent/80">
                      default
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(preset.id)}
                  aria-label={`Borrar ${preset.name}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white/10 hover:text-white"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default Presets;
