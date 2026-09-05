// El modal de export.
//
// Reemplaza al último acordeón del sidebar. El argumento no es de orden sino de
// naturaleza: las otras siete secciones se tocan MIENTRAS componés, y esta se
// toca UNA vez, cuando ya terminaste. Puestas en la misma columna compiten por
// la misma atención y gana la que se usa más, que no es ésta.
//
// Lo que cambia además de dónde vive: acá se ven las consecuencias antes de
// apretar. Cuántos archivos, cuánto duran, cuánto pesan y si el loop cierra —
// y si no cierra, se arregla desde acá en vez de mandarte de vuelta a Timing a
// buscar el número.

import { useMemo, useState } from "react";
import { Modal, Field, Segmented, ScrubField, Button, ensureFontsReady } from "@bong/ui";
import { exportVideo, exportGIF, exportPNG, downloadBlob } from "../export/exporters.js";
import { exportSummary, summaryLine, exportRatios, ratioDims } from "../export/summary.js";
import { RATIOS, stageDims } from "../engine/camera.js";
import { loopClosure, MAX_CYCLES } from "../engine/loopTest.js";
import { visibleAssets, resolveTemplate } from "../engine/getScene.js";
import { upscaleWarning } from "../assets/assetStore.js";
import ScenePreview from "./ScenePreview.jsx";

const slug = (r) => r.replace(":", "x");

const hasWebCodecs =
  typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";

// Qué es cada formato, en una línea. Elegir "webm" o "mp4" sin saber para qué
// sirve cada uno es la parte del export que nadie debería tener que recordar.
const FORMATS = [
  { id: "webm", name: "WebM", note: "Liviano, para web" },
  { id: "mp4", name: "MP4", note: "Para redes" },
  { id: "gif", name: "GIF", note: "Sin sonido, pesado" },
  { id: "png", name: "PNG", note: "Un frame suelto" },
];

const RATIO_OPTIONS = [...RATIOS, { value: "custom", label: "Custom" }];

export default function ExportModal({ open, onClose, state, setState, clock, engineRef }) {
  const cfg = state.export;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");
  const [message, setMessage] = useState("");

  const closure = useMemo(() => loopClosure(state), [state]);
  const summary = useMemo(() => exportSummary(state, cfg.format), [state, cfg.format]);
  const tpl = resolveTemplate(state);
  const upscale = cfg.resolution === 2 ? upscaleWarning(visibleAssets(state), 2160) : null;

  const set = (patch) => setState((s) => ({ ...s, export: { ...s.export, ...patch } }));
  const setTiming = (patch) =>
    setState((s) => ({ ...s, timing: { ...s.timing, ...patch } }));

  const ratios = exportRatios(state);
  const toggleRatio = (r) => {
    const next = ratios.includes(r) ? ratios.filter((x) => x !== r) : [...ratios, r];
    set({ ratios: next.length ? next : [r] });
  };

  const fps = state.stage.fps;
  const totalFrames = summary.frames;

  // Un pase por ratio: se rearma la cámara, se re-renderiza el ciclo completo
  // y se descarga un archivo aparte. Es la razón por la que el ratio es estado
  // y no un hardcodeo (BRIEF §9).
  const run = async () => {
    const engine = engineRef.current;
    const kind = cfg.format;
    if (!engine || busy) return;

    setBusy(true);
    setProgress(0);
    setMessage("");
    // Si una fuente todavía se está cargando, los primeros frames saldrían con
    // la fallback y el archivo mentiría respecto del preview.
    await ensureFontsReady();
    engine.begin();

    try {
      for (let r = 0; r < ratios.length; r++) {
        const ratio = ratios[r];
        const stage = stageDims(ratio, {
          w: state.stage.customW,
          h: state.stage.customH,
        });
        setStep(`${ratio} · ${r + 1} de ${ratios.length}`);

        engine.configure(stage, cfg.resolution);
        const draw = (t01) => engine.drawFrame(t01, stage);
        draw(0); // el stream se arma sobre un canvas ya del tamaño final

        const base = `${cfg.name || "plane"}_${slug(ratio)}`;
        const onProgress = (p) => setProgress((r + p) / ratios.length);

        if (kind === "png") {
          // Respeta la resolución elegida como todo lo demás. Antes forzaba 2×
          // siempre, y con el modal mostrando los píxeles de salida eso pasaba
          // de ser una rareza a ser una mentira.
          const blob = await exportPNG({
            canvas: engine.canvas,
            draw,
            t01: clock.getT(),
          });
          if (blob) downloadBlob(blob, `${base}.png`);
          onProgress(1);
        } else if (kind === "gif") {
          const blob = await exportGIF({ canvas: engine.canvas, draw, fps, totalFrames, onProgress });
          downloadBlob(blob, `${base}.gif`);
        } else {
          const { blob, container, requestedContainer, drift, exact } = await exportVideo({
            canvas: engine.canvas,
            draw,
            fps,
            totalFrames,
            container: kind,
            quality: cfg.quality,
            onProgress,
          });
          downloadBlob(blob, `${base}.${container}`);
          if (container !== requestedContainer) {
            setMessage("MP4 no soportado en este browser — salió WebM.");
          } else if (!exact && drift > 1.3) {
            setMessage(
              `Sin WebCodecs en este browser, la grabación tardó ${drift.toFixed(1)}× lo esperado y ${base} quedó por debajo de ${fps} fps. Repetilo con la pestaña visible.`,
            );
          }
        }
      }
      setMessage((m) => m || `Listo: ${ratios.length === 1 ? "1 archivo" : `${ratios.length} archivos`} ✓`);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      engine.end();
      setBusy(false);
      setProgress(0);
      setStep("");
    }
  };

  // El estado del loop, con el arreglo al lado. Es lo que antes obligaba a
  // cerrar el panel, ir a Timing y volver.
  const loop = (() => {
    if (cfg.format === "png") {
      return { tono: "", titulo: "Un frame no tiene loop", texto: "Sale el frame donde esté el scrub." };
    }
    if (closure.status === "ok") {
      return {
        tono: "ok",
        titulo: "El loop cierra",
        texto: `Con ${state.timing.cycles} ciclo${state.timing.cycles > 1 ? "s" : ""} el último frame empalma con el primero.`,
      };
    }
    if (closure.status === "cycles") {
      return {
        tono: "warn",
        titulo: `No cierra con ${state.timing.cycles} ciclo${state.timing.cycles > 1 ? "s" : ""}`,
        texto: "Los assets no vuelven a su lugar: el frame final muestra otras imágenes que el inicial.",
        accion: { label: `Usar ${closure.suggested}`, run: () => setTiming({ cycles: closure.suggested }) },
      };
    }
    if (closure.status === "over") {
      return {
        tono: "warn",
        titulo: `Necesitaría ${closure.minCycles} ciclos`,
        texto: `Más de los ${MAX_CYCLES} que se pueden grabar. Cambiá los ciclos de cámara, la cantidad de assets o los params del template.`,
      };
    }
    return {
      tono: "warn",
      titulo: "El loop no cierra",
      texto: `Hay un salto de Δ${(closure.maxDelta * 100).toFixed(1)}% entre el último frame y el primero.`,
    };
  })();

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title="Exportar"
      subtitle={tpl.name}
      width={780}
      footer={
        <>
          <div className="export-summary">
            {busy ? (
              <>
                <span className="export-step">{step}</span>
                <div className="progress">
                  <div style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              </>
            ) : (
              summaryLine(summary)
            )}
          </div>
          <Button variant="primary" onClick={run} disabled={busy}>
            {busy
              ? "Exportando…"
              : summary.files > 1
                ? `Exportar ${summary.files} archivos`
                : "Exportar"}
          </Button>
        </>
      }
    >
      <div className="export-layout">
      <div className="export-preview">
        <ScenePreview state={state} width={190} />
        <dl className="export-facts">
          <dt>Pieza</dt>
          <dd>{cfg.format === "png" ? "1 frame" : `${summary.seconds.toFixed(1)}s`}</dd>
          <dt>Frames</dt>
          <dd>{summary.frames}</dd>
          <dt>Ciclos</dt>
          <dd>{state.timing.cycles}</dd>
        </dl>
        <Field label="Nombre del archivo">
          <input
            className="text-input"
            value={cfg.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="plane"
          />
        </Field>
      </div>

      <div className="export-controls">
        <Field label="Formato">
          <div className="pick-grid">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`pick ${cfg.format === f.id ? "on" : ""}`}
                aria-pressed={cfg.format === f.id}
                onClick={() => set({ format: f.id })}
              >
                <b>{f.name}</b>
                <em>{f.note}</em>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Salida">
          <div className="pick-grid four">
            {RATIO_OPTIONS.map((r) => {
              const on = ratios.includes(r.value);
              const d = ratioDims(state, r.value);
              return (
                <button
                  key={r.value}
                  type="button"
                  className={`pick ${on ? "on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggleRatio(r.value)}
                >
                  <b>{r.label}</b>
                  <em>
                    {d.w}×{d.h}
                  </em>
                </button>
              );
            })}
          </div>
          <p className="hint">
            {ratios.length > 1
              ? `${ratios.length} archivos, uno por ratio. La composición se rearma sola: los templates ubican relativo al stage.`
              : "Elegí más de uno y sale un archivo por cada uno."}
          </p>
        </Field>

        <div className="row-2">
          <Field label="Resolución">
            <Segmented
              value={String(cfg.resolution)}
              options={[
                { value: "1", label: "1× · 1080" },
                { value: "2", label: "2× · 2160" },
              ]}
              onChange={(v) => set({ resolution: Number(v) })}
            />
          </Field>
          <Field label="FPS">
            <Segmented
              value={String(fps)}
              options={[
                { value: "30", label: "30" },
                { value: "60", label: "60" },
              ]}
              onChange={(v) =>
                setState((s) => ({ ...s, stage: { ...s.stage, fps: Number(v) } }))
              }
            />
          </Field>
        </div>

        {cfg.format !== "png" && (
          <>
            <Field label="Calidad">
              <Segmented
                value={String(cfg.quality)}
                options={[
                  { value: "0.08", label: "Media" },
                  { value: "0.14", label: "Alta" },
                  { value: "0.25", label: "Máxima" },
                ]}
                onChange={(v) => set({ quality: Number(v) })}
              />
            </Field>

            <ScrubField
              label="Ciclos a grabar"
              value={state.timing.cycles}
              min={1}
              max={MAX_CYCLES}
              step={1}
              onChange={(v) => setTiming({ cycles: Math.round(v) })}
              format={(v) => `${Math.round(v)}×`}
            />
          </>
        )}

        <div className={`loop-state ${loop.tono}`}>
          <span className="dot" />
          <div>
            <b>{loop.titulo}</b>
            <span>{loop.texto}</span>
          </div>
          {loop.accion && (
            <Button onClick={loop.accion.run}>{loop.accion.label}</Button>
          )}
        </div>

        {upscale && (
          <p className="hint warn">
            Upscale: {upscale.slice(0, 3).join(", ")}
            {upscale.length > 3 ? ` y ${upscale.length - 3} más` : ""} miden menos de 2160px.
          </p>
        )}
        {message && <p className="hint">{message}</p>}
        <p className="hint">
          {hasWebCodecs
            ? `Se codifica con WebCodecs: el frame f va siempre en f/${fps}s, así que el archivo sale a ${fps} fps exactos aunque el encoder tarde. Podés cambiar de pestaña.`
            : "Este browser no tiene WebCodecs: se graba con MediaRecorder y hay que mantener la pestaña visible, o el video sale a menos fps de los pedidos."}
        </p>
      </div>
      </div>
    </Modal>
  );
}
