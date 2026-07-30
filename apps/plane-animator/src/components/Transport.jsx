import { useSyncExternalStore } from "react";
import { Icon } from "@bong/ui";
import { mod1 } from "../utils/math.js";
import { RATIOS } from "../engine/camera.js";

// El scrub recorre la PIEZA entera (duration × cycles), no un ciclo: es lo que
// se va a exportar. La barra de fase marca dónde termina cada ciclo.
export default function Transport({ state, clock, onDuration, onRatio }) {
  const t = useSyncExternalStore(clock.subscribe, clock.getT);
  const playing = useSyncExternalStore(clock.subscribe, clock.isPlaying);

  const { duration, cycles } = state.timing;
  const total = duration * cycles;
  const seconds = (mod1(t) * total).toFixed(1);
  const currentCycle = Math.min(cycles, Math.floor(mod1(t) * cycles) + 1);

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
          {Array.from({ length: cycles }, (_, i) => (
            <div
              key={i}
              className="phase-seg"
              style={{
                width: `${100 / cycles}%`,
                background: i + 1 === currentCycle ? "#54555e" : "#3a3b42",
              }}
            />
          ))}
        </div>
        <div className="phase-label">
          <span>
            {cycles > 1 ? `ciclo ${currentCycle}/${cycles}` : state.template.id}
          </span>
          <span>
            {seconds}s / {total.toFixed(1)}s
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
            key={r.value}
            className={state.stage.ratio === r.value ? "active" : ""}
            onClick={() => onRatio(r.value)}
          >
            {r.label}
          </button>
        ))}
        <button
          className={state.stage.ratio === "custom" ? "active" : ""}
          onClick={() => onRatio("custom")}
        >
          custom
        </button>
      </div>
    </div>
  );
}
