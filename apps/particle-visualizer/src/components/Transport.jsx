import { Icon } from "@bong/ui";
import { ASPECT_RATIOS, resolveAspect } from "../aspectRatios";

const pad = (v) => String(v).padStart(2, "0");

// Mismo transport que las otras dos tools. La diferencia real del motor asoma
// acá: particle es una simulación con estado, no una función pura del tiempo,
// así que no hay scrub — se graba lo que va pasando.
export default function Transport({ config, recorder, onConfigChange, onClear }) {
  const aspect = resolveAspect(config.aspect);
  const clock = recorder
    ? `${pad(Math.floor(recorder.seconds / 60))}:${pad(recorder.seconds % 60)}`
    : "00:00";

  return (
    <div className="transport">
      <button
        className="play"
        onClick={() => onConfigChange("isPlaying", !config.isPlaying)}
        title={config.isPlaying ? "Pausa" : "Play"}
      >
        {config.isPlaying ? <Icon.Pause /> : <Icon.Play />}
      </button>

      <div className="scrub-bar">
        <div className="phase-label" style={{ marginTop: 2 }}>
          <span>{config.isPlaying ? "simulando" : "en pausa"}</span>
          <span>{recorder?.isRecording ? `grabando ${clock}` : ""}</span>
        </div>
      </div>

      <button className="btn" onClick={onClear}>
        Limpiar
      </button>

      {recorder?.supported && (
        <button
          className={`btn ${recorder.isRecording ? "" : "accent"}`}
          onClick={recorder.isRecording ? recorder.stop : recorder.start}
          style={
            recorder.isRecording
              ? { borderColor: "var(--danger)", color: "var(--danger)" }
              : undefined
          }
        >
          <span className={`rec-dot ${recorder.isRecording ? "on" : ""}`} />
          {recorder.isRecording ? `Detener · ${clock}` : `Grabar ${recorder.format}`}
        </button>
      )}

      <div className="ratio-switch">
        {Object.keys(ASPECT_RATIOS).map((key) => (
          <button
            key={key}
            className={aspect === key ? "active" : ""}
            onClick={() => onConfigChange("aspect", key)}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
