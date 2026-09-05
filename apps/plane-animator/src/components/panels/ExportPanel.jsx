import { useMemo, useRef, useState } from "react";
import {
  Section,
  Field,
  Segmented,
  ScrubField,
  Button,
  Icon,
  ensureFontsReady,
} from "@bong/ui";
import { exportVideo, exportGIF, exportPNG, downloadBlob } from "../../export/exporters.js";
import { exportStateFile, importStateFile } from "../../state/storage.js";
import { RATIOS, stageDims, stageOf } from "../../engine/camera.js";
import { loopClosure } from "../../engine/loopTest.js";
import { visibleAssets } from "../../engine/getScene.js";
import { upscaleWarning } from "../../assets/assetStore.js";

const slug = (r) => r.replace(":", "x");

const hasWebCodecs =
  typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";

export default function ExportPanel({ state, setState, clock, engineRef, onReset }) {
  const cfg = state.export;
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");
  const [message, setMessage] = useState("");

  const closure = useMemo(() => loopClosure(state), [state]);
  const assets = visibleAssets(state);
  const upscale =
    cfg.resolution === 2 ? upscaleWarning(assets, 2160) : null;

  const set = (patch) =>
    setState((s) => ({ ...s, export: { ...s.export, ...patch } }));

  const ratios = cfg.ratios.length ? cfg.ratios : [state.stage.ratio];
  const toggleRatio = (r) => {
    const next = ratios.includes(r) ? ratios.filter((x) => x !== r) : [...ratios, r];
    set({ ratios: next.length ? next : [r] });
  };

  const fps = state.stage.fps;
  const totalFrames = Math.max(
    1,
    Math.round(fps * state.timing.duration * state.timing.cycles),
  );

  // Un pase por ratio: se rearma la cámara, se re-renderiza el ciclo completo
  // y se descarga un archivo aparte. Es la razón por la que el ratio es estado
  // y no un hardcodeo (BRIEF §9).
  const runBatch = async (kind) => {
    const engine = engineRef.current;
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
        setStep(`Ratio ${r + 1}/${ratios.length} · ${ratio}`);

        engine.configure(stage, cfg.resolution);
        const draw = (t01) => engine.drawFrame(t01, stage);
        draw(0); // el stream se arma sobre un canvas ya del tamaño final

        const base = `${cfg.name || "plane"}_${slug(ratio)}`;
        const onProgress = (p) => setProgress((r + p) / ratios.length);

        if (kind === "gif") {
          const blob = await exportGIF({
            canvas: engine.canvas,
            draw,
            fps,
            totalFrames,
            onProgress,
          });
          downloadBlob(blob, `${base}.gif`);
        } else {
          const { blob, container, requestedContainer, drift, exact } =
            await exportVideo({
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
              `⚠ Sin WebCodecs en este browser, la grabación tardó ${drift.toFixed(1)}× lo esperado y ${base} quedó por debajo de ${fps} fps. Repetilo con la pestaña visible.`,
            );
          }
        }
      }
      setMessage((m) => m || "Listo ✓");
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      engine.end();
      setBusy(false);
      setProgress(0);
      setStep("");
    }
  };

  const runPNG = async () => {
    const engine = engineRef.current;
    if (!engine || busy) return;
    setBusy(true);
    await ensureFontsReady();
    engine.begin();
    try {
      const stage = stageOf(state);
      engine.configure(stage, Math.max(2, cfg.resolution));
      const blob = await exportPNG({
        canvas: engine.canvas,
        draw: (t01) => engine.drawFrame(t01, stage),
        t01: clock.getT(),
      });
      if (blob) downloadBlob(blob, `${cfg.name || "plane"}_${slug(state.stage.ratio)}.png`);
      setMessage("PNG listo ✓");
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      engine.end();
      setBusy(false);
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const next = await importStateFile(file);
      // Los assets cargados en la sesión sobreviven al import de config.
      setState((s) => ({ ...next, assets: s.assets }));
      setMessage("Config importada ✓");
    } catch (err) {
      setMessage(`JSON inválido: ${err.message}`);
    }
    e.target.value = "";
  };

  return (
    <Section
      title="Export"
      defaultOpen={false}
      value={`${cfg.format} · ${cfg.resolution}×`}
    >
      <Field label="Nombre del archivo">
        <input
          className="text-input"
          value={cfg.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="plane"
        />
      </Field>

      <Field label="Ratios a exportar">
        <div className="ratio-grid">
          {[...RATIOS, { value: "custom", label: "Custom" }].map((r) => (
            <button
              key={r.value}
              className={`btn ${ratios.includes(r.value) ? "primary" : ""}`}
              onClick={() => toggleRatio(r.value)}
            >
              {r.label}
              <span className="ratio-dims">
                {(() => {
                  const d = stageDims(r.value, {
                    w: state.stage.customW,
                    h: state.stage.customH,
                  });
                  return `${d.w * cfg.resolution}×${d.h * cfg.resolution}`;
                })()}
              </span>
            </button>
          ))}
        </div>
      </Field>
      {ratios.length > 1 && (
        <p className="hint">
          {ratios.length} archivos, uno por ratio. La composición se rearma sola:
          los templates ubican relativo al stage.
        </p>
      )}

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
            { value: "30", label: "30 fps" },
            { value: "60", label: "60 fps" },
          ]}
          onChange={(v) => setState((s) => ({ ...s, stage: { ...s.stage, fps: Number(v) } }))}
        />
      </Field>

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
      {upscale && (
        <p className="hint warn">
          Upscale: {upscale.slice(0, 3).join(", ")}
          {upscale.length > 3 ? ` y ${upscale.length - 3} más` : ""} miden menos
          de 2160px.
        </p>
      )}

      <ScrubField
        label="Ciclos a grabar"
        value={state.timing.cycles}
        min={1}
        max={16}
        step={1}
        onChange={(v) =>
          setState((s) => ({
            ...s,
            timing: { ...s.timing, cycles: Math.round(v) },
          }))
        }
        format={(v) => `${Math.round(v)}×`}
      />

      {closure.status === "cycles" && (
        <div className="notice">
          <span>
            Con {state.timing.cycles} ciclo{state.timing.cycles > 1 ? "s" : ""} los
            assets no vuelven a su lugar. El más cercano que cierra es{" "}
            {closure.suggested}.
          </span>
          <Button
            onClick={() =>
              setState((s) => ({
                ...s,
                timing: { ...s.timing, cycles: closure.suggested },
              }))
            }
          >
            Usar {closure.suggested}
          </Button>
        </div>
      )}
      {closure.status === "broken" && (
        <p className="hint warn">
          El loop no cierra: hay un salto visible de Δ
          {(closure.maxDelta * 100).toFixed(1)}% entre el último frame y el
          primero.
        </p>
      )}

      <p className="hint">
        {totalFrames} frames a {fps} fps ·{" "}
        {(state.timing.duration * state.timing.cycles).toFixed(1)}s por archivo.
      </p>

      <div className="row-2">
        <Button onClick={() => runBatch("webm")} disabled={busy}>
          WebM
        </Button>
        <Button onClick={() => runBatch("mp4")} disabled={busy}>
          MP4
        </Button>
        <Button onClick={() => runBatch("gif")} disabled={busy}>
          GIF
        </Button>
        <Button onClick={runPNG} disabled={busy}>
          PNG
        </Button>
      </div>

      {busy && (
        <>
          <div className="progress">
            <div style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="hint">{step}</p>
        </>
      )}
      {message && <p className="hint">{message}</p>}
      <p className="hint">
        {hasWebCodecs
          ? `Se codifica con WebCodecs: el frame f va siempre en f/${fps}s, así que el archivo sale a ${fps} fps exactos aunque el encoder tarde. Podés cambiar de pestaña.`
          : "Este browser no tiene WebCodecs: se graba con MediaRecorder y hay que mantener la pestaña visible, o el video sale a menos fps de los pedidos."}
      </p>

      <div className="divider" />

      <Field label="Config (JSON)">
        <div className="btn-row">
          <Button block onClick={() => exportStateFile(state, `${cfg.name || "plane"}.json`)}>
            <Icon.Download /> Exportar
          </Button>
          <Button block onClick={() => fileRef.current?.click()}>
            Importar
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={onImport}
        />
        <Button variant="ghost" block onClick={onReset} style={{ marginTop: 6 }}>
          Reset a defaults
        </Button>
      </Field>
    </Section>
  );
}
