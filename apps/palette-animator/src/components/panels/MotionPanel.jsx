import { Section, Field, ScrubField, Segmented, Select } from "@bong/ui";
import { resolveParams, currentLayoutMode } from "../../engine/getFrame.js";
import { PRESET_LIST, PRESETS } from "../../engine/presets.js";
import { LAYOUT_MODES } from "../../engine/layout.js";
import { normalizeHex } from "../../utils/color.js";

// Renderiza un control por cada entrada del schema del preset.
function ParamControl({ item, value, onChange }) {
  if (item.type === "select") {
    if (item.options.length <= 3) {
      return (
        <Field label={item.label}>
          <Segmented value={value} options={item.options} onChange={onChange} />
        </Field>
      );
    }
    return (
      <Field label={item.label}>
        <Select value={value} options={item.options} onChange={onChange} />
      </Field>
    );
  }
  return (
    <ScrubField
      label={item.label}
      value={value}
      min={item.min}
      max={item.max}
      step={item.step}
      onChange={onChange}
    />
  );
}

export default function MotionPanel({ state, onPatch, onParam, onPreset }) {
  const preset = PRESETS[state.motion.preset] ?? PRESET_LIST[0];
  const params = resolveParams(state);
  const layoutMode = currentLayoutMode(state);
  const bleed = state.containers.mode === "bleed";
  const bg = state.stage.background;

  return (
    <Section title="Animación" value={`${preset.name} · ${layoutMode}`}>
      <Field label="Preset">
        <div className="ease-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {PRESET_LIST.map((p) => (
            <button
              key={p.id}
              className={`btn ${state.motion.preset === p.id ? "primary" : ""}`}
              style={{ padding: "9px 4px", fontSize: 12 }}
              onClick={() => onPreset(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Layout">
        <Segmented value={layoutMode} options={LAYOUT_MODES} onChange={(m) => onPatch("layout", { mode: m })} />
      </Field>
      <p className="hint">
        Layout y movimiento son independientes: probá {preset.name} sobre
        cualquier modo. Default del preset: {preset.defaultLayout}.
      </p>

      <div className="divider" />

      {preset.schema.map((item) => (
        <ParamControl
          key={item.key}
          item={item}
          value={params[item.key]}
          onChange={(v) => onParam(item.key, v)}
        />
      ))}

      <div className="divider" />

      <Field label="Contenedores">
        <Segmented
          value={state.containers.mode}
          options={[
            { value: "card", label: "Cards" },
            { value: "bleed", label: "Full-bleed" },
          ]}
          onChange={(m) => onPatch("containers", { mode: m })}
        />
      </Field>
      <ScrubField
        label="Gap"
        value={bleed ? 0 : state.containers.gap}
        min={0}
        max={0.08}
        step={0.002}
        onChange={(v) => onPatch("containers", { gap: v })}
        format={(v) => (bleed ? "0 (bleed)" : v.toFixed(3))}
      />
      <ScrubField
        label="Radius"
        value={bleed ? 0 : state.containers.radius}
        min={0}
        max={120}
        step={1}
        onChange={(v) => onPatch("containers", { radius: v })}
        format={(v) => (bleed ? "0 (bleed)" : `${Math.round(v)}px`)}
      />

      <div className="divider" />

      <ScrubField
        label="Padding del stage"
        value={state.stage.padding}
        min={0}
        max={0.15}
        step={0.005}
        onChange={(v) => onPatch("stage", { padding: v })}
        format={(v) => v.toFixed(3)}
      />
      <Field label="Fondo">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label className="swatch" style={{ background: bg }}>
            <input
              type="color"
              value={bg}
              onChange={(e) => onPatch("stage", { background: e.target.value.toUpperCase() })}
            />
          </label>
          <input
            className="text-input hex"
            style={{ fontFamily: "var(--mono)", textTransform: "uppercase" }}
            value={bg}
            onChange={(e) => onPatch("stage", { background: e.target.value })}
            onBlur={(e) => {
              const n = normalizeHex(e.target.value);
              if (n) onPatch("stage", { background: n });
            }}
          />
        </div>
      </Field>
    </Section>
  );
}
