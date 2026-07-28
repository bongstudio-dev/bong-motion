import { useEffect, useState } from "react";

const groups = [
  {
    title: "Emitter",
    fields: [
      { key: "maxParticles", label: "Max Particles", min: 10, max: 300, step: 1 },
      { key: "spawnRate", label: "Spawn Rate", min: 1, max: 20, step: 0.5 },
      { key: "emitterX", label: "Emitter X", min: 0, max: 1, step: 0.01 },
      { key: "emitterY", label: "Emitter Y", min: 0, max: 1, step: 0.01 },
      { key: "direction", label: "Direction", min: 0, max: 360, step: 1 },
      { key: "spread", label: "Spread", min: 0, max: 180, step: 1 },
      { key: "speed", label: "Speed", min: 0.5, max: 10, step: 0.1 },
    ],
  },
  {
    title: "Particles",
    fields: [
      { key: "lifespan", label: "Lifespan", min: 1, max: 15, step: 0.1 },
      { key: "scale", label: "Scale", min: 0.05, max: 0.5, step: 0.01 },
      {
        key: "scaleVariation",
        label: "Scale Variation",
        min: 0,
        max: 0.2,
        step: 0.01,
      },
      {
        key: "rotationSpeed",
        label: "Rotation Speed",
        min: 0,
        max: 0.05,
        step: 0.001,
      },
      { key: "fadeIn", label: "Fade In", min: 0, max: 2, step: 0.05 },
      { key: "fadeOut", label: "Fade Out", min: 0, max: 3, step: 0.05 },
    ],
  },
  {
    title: "Forces",
    fields: [
      { key: "gravity", label: "Gravity", min: -2, max: 2, step: 0.05 },
      {
        key: "turbulence",
        label: "Turbulence",
        min: 0,
        max: 5,
        step: 0.1,
      },
      {
        key: "turbulenceFrequency",
        label: "Turbulence Freq",
        min: 0.001,
        max: 0.05,
        step: 0.001,
      },
      { key: "drag", label: "Drag", min: 0, max: 0.1, step: 0.001 },
    ],
  },
];

function formatValue(key, value) {
  if (key === "emitterX" || key === "emitterY") {
    return `${Math.round(value * 100)}%`;
  }

  if (key === "turbulenceFrequency" || key === "rotationSpeed" || key === "drag") {
    return value.toFixed(3);
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2);
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function BackgroundControl({ value, onChange }) {
  const [hex, setHex] = useState(value);

  useEffect(() => {
    setHex(value);
  }, [value]);

  const handleHexChange = (event) => {
    const next = event.target.value;
    setHex(next);
    if (HEX_PATTERN.test(next)) {
      onChange("backgroundColor", next);
    }
  };

  return (
    <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.02] p-4">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
        Background
      </h3>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="color"
          value={HEX_PATTERN.test(hex) ? hex : value}
          onChange={(event) => onChange("backgroundColor", event.target.value)}
          aria-label="Color de fondo"
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-1"
        />
        <input
          type="text"
          value={hex}
          onChange={handleHexChange}
          spellCheck={false}
          placeholder="#FFF3E4"
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 font-mono text-sm uppercase text-white placeholder:text-muted/70 focus:border-accent/40 focus:outline-none"
        />
      </div>
    </div>
  );
}

function Controls({
  count,
  firstFileName,
  config,
  onConfigChange,
  onTogglePlayback,
  onClearParticles,
}) {
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(groups.map((group) => [group.title, false])),
  );

  const toggleGroup = (title) => {
    setOpenGroups((current) => ({ ...current, [title]: !current[title] }));
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-black/10 p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
          Session
        </h2>
        <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 font-mono text-xs text-accent">
          Scaffold ready
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
            Images
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">{count}</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
            First File
          </p>
          <p className="mt-2 truncate text-sm text-white">{firstFileName}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onTogglePlayback}
          className="rounded-full border border-accent/20 bg-accent px-4 py-2 text-sm font-medium text-app transition hover:bg-[#3ce09b]"
        >
          {config.isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={onClearParticles}
          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.08]"
        >
          Clear
        </button>
      </div>

      <BackgroundControl
        value={config.backgroundColor}
        onChange={onConfigChange}
      />

      <div className="mt-4 space-y-4">
        {groups.map((group) => {
          const isOpen = openGroups[group.title];
          return (
            <div
              key={group.title}
              className="rounded-[24px] border border-white/10 bg-white/[0.02]"
            >
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 rounded-[24px] px-4 py-3 text-left transition hover:bg-white/[0.03]"
              >
                <h3 className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
                  {group.title}
                </h3>
                <span
                  className={`font-mono text-xs text-muted transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                >
                  ▾
                </span>
              </button>

              {isOpen ? (
                <div className="space-y-4 px-4 pb-4">
                  {group.fields.map((field) => (
                    <label key={field.key} className="block">
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <span className="text-sm text-white">{field.label}</span>
                        <span className="font-mono text-xs text-accent">
                          {formatValue(field.key, config[field.key])}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={config[field.key]}
                        onChange={(event) =>
                          onConfigChange(field.key, Number(event.target.value))
                        }
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-accent"
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default Controls;
