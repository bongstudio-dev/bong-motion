import { useSyncExternalStore } from "react";
import { Icon } from "@bong/ui";
import { resolveParams } from "../engine/getFrame.js";
import { mod1 } from "../utils/math.js";

const RATIOS = ["1:1", "4:5", "16:9", "9:16"];
const ENTRY_PRESETS = new Set(["scale", "stack"]);

// Segmentos de fase para los presets de entrada, según holdRatio.
function phaseSegments(state) {
  if (!ENTRY_PRESETS.has(state.motion.preset)) return null;
  const hold = Math.max(0, Math.min(0.96, resolveParams(state).holdRatio ?? 0.5));
  const ramp = (1 - hold) / 2;
  return [
    { key: "in", w: ramp, color: "#3a3b42" },
    { key: "hold", w: hold, color: "#54555e" },
    { key: "out", w: ramp, color: "#3a3b42" },
  ];
}

function phaseAt(t, segments) {
  if (!segments) return "loop";
  const x = mod1(t);
  if (x < segments[0].w) return "in";
  if (x < segments[0].w + segments[1].w) return "hold";
  return "out";
}

export default function Transport({ state, clock, onDuration, onRatio }) {
  const t = useSyncExternalStore(clock.subscribe, clock.getT);
  const playing = useSyncExternalStore(clock.subscribe, clock.isPlaying);

  const segments = phaseSegments(state);
  const duration = state.motion.duration;
  const seconds = (mod1(t) * duration).toFixed(1);

  return (
    <div className="transport">
      <button
        className="play"
        onClick={() => clock.toggle()}
        title={playing ? "Pausa (space)" : "Play (space)"}
      >
        {playing ? <Icon.Pause /> : <Icon.Play />}
      </button>

      <div className="scrub-bar">
        <div className="scrub-track">
          <input
            className="slider"
            type="range"
            min={0}
            max={0.9999}
            step={0.0001}
            value={t}
            onChange={(e) => clock.setT(parseFloat(e.target.value))}
          />
        </div>
        <div className="phase-bar">
          {segments ? (
            segments.map((s) => (
              <div
                key={s.key}
                className="phase-seg"
                style={{ width: `${s.w * 100}%`, background: s.color }}
              />
            ))
          ) : (
            <div className="phase-seg" style={{ width: "100%", background: "#3a3b42" }} />
          )}
        </div>
        <div className="phase-label">
          <span>{phaseAt(t, segments)}</span>
          <span>
            {seconds}s / {duration}s
          </span>
        </div>
      </div>

      <div className="duration-field">
        <input
          className="num-input"
          type="number"
          min={0.5}
          max={60}
          step={0.5}
          value={duration}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v) && v > 0) onDuration(v);
          }}
        />
        <span className="field-value">s</span>
      </div>

      <div className="ratio-switch">
        {RATIOS.map((r) => (
          <button
            key={r}
            className={state.stage.ratio === r ? "active" : ""}
            onClick={() => onRatio(r)}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
