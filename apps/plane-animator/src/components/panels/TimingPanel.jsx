import { Section, Field, ScrubField, Segmented } from "@bong/ui";
import { minCyclesFor } from "../../engine/loopTest.js";

// Timing GLOBAL, separado de los params del template (BRIEF §3). Cambiar el
// modelo de timing no obliga a tocar ni un template.
export default function TimingPanel({ state, onPatch }) {
  const t = state.timing;
  const min = minCyclesFor(state);
  const total = (t.duration * t.cycles).toFixed(1);

  return (
    <Section title="Timing">
      <ScrubField
        label="Duración del ciclo"
        value={t.duration}
        min={0.5}
        max={20}
        step={0.1}
        onChange={(v) => onPatch("timing", { duration: v })}
        format={(v) => `${v.toFixed(1)}s`}
      />

      {/* Hasta 32, que es el tope del modelo. Con 16 el badge podía ofrecer un
          cierre —deck-baraja pide 24— que el slider no dejaba alcanzar. */}
      <ScrubField
        label="Ciclos por pieza"
        value={t.cycles}
        min={1}
        max={32}
        step={1}
        onChange={(v) => onPatch("timing", { cycles: Math.round(v) })}
        format={(v) => `${Math.round(v)}×`}
      />
      <p className="hint">
        La pieza dura {total}s. {min > 1
          ? `Con esta configuración el loop cierra cada ${min} ciclos.`
          : "El loop cierra en 1 ciclo."}
      </p>

      <ScrubField
        label="Stagger"
        value={t.stagger}
        min={-0.5}
        max={0.5}
        step={0.005}
        onChange={(v) => onPatch("timing", { stagger: v })}
        format={(v) => `${v.toFixed(3)} ciclo`}
      />
      <ScrubField
        label="Delay"
        value={t.delay}
        min={-1}
        max={1}
        step={0.01}
        onChange={(v) => onPatch("timing", { delay: v })}
        format={(v) => `${v.toFixed(2)} ciclo`}
      />

      <Field label="Dirección">
        <Segmented
          value={t.direction}
          options={[
            { value: "forward", label: "Forward" },
            { value: "reverse", label: "Reverse" },
            { value: "pingpong", label: "Ping-pong" },
          ]}
          onChange={(v) => onPatch("timing", { direction: v })}
        />
      </Field>
    </Section>
  );
}
