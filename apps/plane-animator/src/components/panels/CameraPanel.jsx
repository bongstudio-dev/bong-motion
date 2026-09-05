import { Section, Field, ScrubField, Segmented } from "@bong/ui";
import { CAMERA_MOVES, cameraActive } from "../../engine/cameraMove.js";
import { closureParts, MAX_CYCLES } from "../../engine/loopTest.js";
import { EaseControl } from "./EasePanel.jsx";

// La cámara no es un template: se aplica sobre cualquiera de las ocho familias
// y por eso vive en su propia sección, debajo de Canvas.
export default function CameraPanel({ state, onPatch }) {
  const cam = state.camera;
  const activa = cameraActive(cam);
  const partes = closureParts(state);
  const excede = partes.total > MAX_CYCLES;

  return (
    <Section title="Cámara" defaultOpen={false}>
      <Field label="Movimiento">
        <Segmented
          value={cam.move}
          options={CAMERA_MOVES}
          onChange={(v) => onPatch("camera", { move: v })}
        />
      </Field>

      {cam.move === "fixed" ? (
        <p className="hint">
          La escena se ve exactamente como se compuso. Los otros tres movimientos
          son una capa encima: no tocan el template, mueven el punto de vista.
        </p>
      ) : (
        <>
          <ScrubField
            label="Amplitud"
            value={cam.amplitude}
            min={-1}
            max={1}
            step={0.01}
            onChange={(v) => onPatch("camera", { amplitude: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <p className="hint">
            {cam.move === "dolly" && "Negativo acerca la cámara, positivo la aleja."}
            {cam.move === "orbit" && "Barrido alrededor del centro de la escena; el signo elige para qué lado sale."}
            {cam.move === "tilt" && "Positivo arranca mirando desde abajo, negativo desde arriba."}
          </p>

          <ScrubField
            label="Fase inicial"
            value={cam.phase}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => onPatch("camera", { phase: v })}
            format={(v) => `${Math.round(v * 100)}% del ciclo`}
          />

          <ScrubField
            label="Ciclos por vuelta de cámara"
            value={cam.period}
            min={1}
            max={8}
            step={1}
            onChange={(v) => onPatch("camera", { period: Math.round(v) })}
            format={(v) => (v === 1 ? "1 ciclo" : `${Math.round(v)} ciclos`)}
          />
          <p className="hint">
            Cada cuántos ciclos del template la cámara completa su recorrido. Con
            más de uno queda cámara lenta sobre template rápido.
          </p>

          <div className="divider" />

          <EaseControl
            value={cam.ease}
            onChange={(v) => onPatch("camera", { ease: v })}
            presetsLabel="Ease de la cámara"
          />

          <div className="divider" />

          <Field label="Cierre de la pieza" value={`${partes.total} ciclos`}>
            <p className="hint" style={excede ? { color: "var(--danger)" } : undefined}>
              {excede
                ? `El template cierra cada ${partes.template} ciclos y la cámara cada ${partes.camera}: juntos piden ${partes.total}, más de los ${MAX_CYCLES} que se pueden grabar. Cambiá los ciclos por vuelta de cámara —o los assets— hasta que uno divida al otro.`
                : `El template cierra cada ${partes.template} ${partes.template === 1 ? "ciclo" : "ciclos"} y la cámara cada ${partes.camera}: la pieza entera cierra a los ${partes.total}.`}
            </p>
          </Field>
        </>
      )}

      {activa && cam.move !== "fixed" && (
        <p className="hint">
          El recorrido es de ida y vuelta, así que la cámara siempre vuelve
          exactamente a donde arrancó. El ease moldea el camino, no los extremos.
        </p>
      )}
    </Section>
  );
}
