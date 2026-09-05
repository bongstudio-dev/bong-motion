import { useRef, useState } from "react";
import { Section, Field, Segmented, ScrubField, Button, Icon } from "@bong/ui";
import { exportVideo, exportGIF, exportPNG, downloadBlob } from "../../export/exporters.js";
import { exportStateFile, importStateFile } from "../../state/storage.js";

export default function ExportPanel({ state, clock, onReplaceState, onReset }) {
  const cfg = state.export;
  const set = (patch) => onReplaceState({ ...state, export: { ...cfg, ...patch } });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const fileRef = useRef(null);

  const baseName = () =>
    `palette-${state.motion.preset}-${state.stage.ratio.replace(":", "x")}`;

  const runVideo = async (container) => {
    if (busy) return;
    setBusy(true);
    setProgress(0);
    setMessage(`Grabando ${container.toUpperCase()}…`);
    try {
      const { blob, container: used, requestedContainer } = await exportVideo(state, {
        fps: cfg.fps,
        cycles: cfg.cycles,
        resolution: cfg.resolution,
        container,
        onProgress: setProgress,
      });
      downloadBlob(blob, `${baseName()}.${used}`);
      setMessage(
        used !== requestedContainer
          ? `MP4 no soportado en este browser — se exportó WebM.`
          : "Listo ✓",
      );
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const runGIF = async () => {
    if (busy) return;
    setBusy(true);
    setProgress(0);
    setMessage("Generando GIF…");
    try {
      const blob = await exportGIF(state, {
        fps: cfg.fps,
        cycles: cfg.cycles,
        resolution: cfg.resolution,
        onProgress: setProgress,
      });
      downloadBlob(blob, `${baseName()}.gif`);
      setMessage("Listo ✓");
    } catch (err) {
      setMessage(`Error GIF: ${err.message}`);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const runPNG = async () => {
    setMessage("Exportando PNG…");
    await exportPNG(state, clock.getT(), Math.max(2, cfg.resolution));
    setMessage("PNG listo ✓");
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const next = await importStateFile(file);
      onReplaceState(next);
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
      value={`${cfg.fps}fps · ${cfg.resolution}×`}
    >
      <Field label="FPS">
        <Segmented
          value={String(cfg.fps)}
          options={[
            { value: "30", label: "30 fps" },
            { value: "60", label: "60 fps" },
          ]}
          onChange={(v) => set({ fps: Number(v) })}
        />
      </Field>

      <Field label="Resolución">
        <Segmented
          value={String(cfg.resolution)}
          options={[
            { value: "1", label: "1× · 1080" },
            { value: "2", label: "2× · 4K" },
          ]}
          onChange={(v) => set({ resolution: Number(v) })}
        />
      </Field>

      <ScrubField
        label="Ciclos a grabar"
        value={cfg.cycles}
        min={1}
        max={6}
        step={1}
        onChange={(v) => set({ cycles: Math.round(v) })}
        format={(v) => `${Math.round(v)}×`}
      />

      <div className="row-2">
        <Button onClick={() => runVideo("webm")} disabled={busy}>
          WebM
        </Button>
        <Button onClick={() => runVideo("mp4")} disabled={busy}>
          MP4
        </Button>
        <Button onClick={runGIF} disabled={busy}>
          GIF
        </Button>
        <Button onClick={runPNG} disabled={busy}>
          PNG
        </Button>
      </div>

      {busy && (
        <div className="progress">
          <div style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {message && <p className="hint">{message}</p>}

      <div className="divider" />

      <Field label="Config (JSON)">
        <div className="btn-row">
          <Button block onClick={() => exportStateFile(state, `${baseName()}.json`)}>
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
