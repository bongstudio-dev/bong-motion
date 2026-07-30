import { Section, Field, ScrubField, Segmented, Toggle, ColorInput, NumberInput } from "@bong/ui";
import { RATIOS, stageOf } from "../../engine/camera.js";

export default function CanvasPanel({ state, onPatch }) {
  const st = state.stage;
  const dims = stageOf(state);

  return (
    <Section title="Canvas">
      <Field label="Aspect ratio" value={`${dims.w}×${dims.h}`}>
        <div className="ratio-grid">
          {[...RATIOS, { value: "custom", label: "Custom" }].map((r) => (
            <button
              key={r.value}
              className={`btn ${st.ratio === r.value ? "primary" : ""}`}
              onClick={() => onPatch("stage", { ratio: r.value })}
            >
              {r.label}
            </button>
          ))}
        </div>
      </Field>

      {st.ratio === "custom" && (
        <Field label="Proporción libre (lado menor → 1080)">
          <div className="row-2">
            <NumberInput
              value={st.customW}
              min={1}
              max={10000}
              onChange={(v) => onPatch("stage", { customW: v })}
              suffix="W"
            />
            <NumberInput
              value={st.customH}
              min={1}
              max={10000}
              onChange={(v) => onPatch("stage", { customH: v })}
              suffix="H"
            />
          </div>
        </Field>
      )}

      <ColorInput
        label="Background"
        value={st.background}
        onChange={(v) => onPatch("stage", { background: v })}
      />

      <ScrubField
        label="Field of view"
        value={st.fov}
        min={15}
        max={90}
        step={1}
        onChange={(v) => onPatch("stage", { fov: Math.round(v) })}
        format={(v) => `${Math.round(v)}°`}
      />
      <p className="hint">
        Menos fov = perspectiva más plana; más fov = los planos rotados y en
        profundidad se exageran.
      </p>

      <Field label="FPS">
        <Segmented
          value={String(st.fps)}
          options={[
            { value: "30", label: "30 fps" },
            { value: "60", label: "60 fps" },
          ]}
          onChange={(v) => onPatch("stage", { fps: Number(v) })}
        />
      </Field>

      <div className="divider" />

      <Toggle
        label="Safe area"
        value={st.safeArea}
        onChange={(v) => onPatch("stage", { safeArea: v })}
        hint="Márgenes de Instagram. Sólo guía visual: nunca se exporta."
      />
      <Toggle
        label="Safe frame multi-ratio"
        value={st.safeFrames}
        onChange={(v) => onPatch("stage", { safeFrames: v })}
        hint="Dibuja el recorte de los otros ratios sobre el actual. Sirve para componer una sola vez algo que va a salir en feed y en stories."
      />
    </Section>
  );
}
