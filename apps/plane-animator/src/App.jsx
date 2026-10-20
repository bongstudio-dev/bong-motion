import { useEffect, useRef, useState } from "react";
import Stage from "./components/Stage.jsx";
import Transport from "./components/Transport.jsx";
import LibraryPanel from "./components/LibraryPanel.jsx";
import AssetsPanel from "./components/panels/AssetsPanel.jsx";
import ScenePanel from "./components/panels/ScenePanel.jsx";
import TimingPanel from "./components/panels/TimingPanel.jsx";
import EasePanel from "./components/panels/EasePanel.jsx";
import CanvasPanel from "./components/panels/CanvasPanel.jsx";
import CameraPanel from "./components/panels/CameraPanel.jsx";
import ProjectPanel from "./components/panels/ProjectPanel.jsx";
import ExportModal from "./components/ExportModal.jsx";
import { ToolSidebar, TextSection, TextWindow } from "@bong/ui";
import { createClock } from "./clock.js";
import { defaultState } from "./state/defaults.js";
import { resolveParams } from "./engine/getScene.js";
import { loadState, saveState } from "./state/storage.js";
import { releaseAll, ingestFile, getFile } from "./assets/assetStore.js";
import { loadSavedAssets, syncAssets, markPersisted } from "./assets/assetDb.js";

// Los assets guardados se recuperan UNA vez por carga de página (el modo
// estricto de React monta dos veces en desarrollo y duplicaría las texturas).
let hydration = null;
function hydrateAssets() {
  hydration ??= (async () => {
    const out = [];
    for (const rec of await loadSavedAssets()) {
      try {
        out.push(await ingestFile(rec.file, rec));
      } catch {
        /* un archivo roto no tiene que frenar a los demás */
      }
    }
    markPersisted(out.map((a) => a.id));
    return out;
  })();
  return hydration;
}

export default function App() {
  const [state, setState] = useState(loadState);
  // Qué capa de texto tiene abierta su ventana flotante. Es estado de la
  // interfaz, no de la pieza: no se persiste ni entra al JSON exportado.
  const [openText, setOpenText] = useState(null);
  // Exportar es un momento, no un ajuste: vive en un modal y no en la columna
  // que se recorre mientras se compone.
  const [exporting, setExporting] = useState(false);
  // La biblioteca se puede esconder para darle la pantalla al stage. El
  // interruptor vive en el rail —que es la barra de la plataforma— y no adentro
  // de la propia columna: un botón que se esconde con lo que esconde deja de
  // poder traerlo de vuelta.
  const [libraryOpen, setLibraryOpen] = useState(true);
  const clockRef = useRef(null);
  if (!clockRef.current) clockRef.current = createClock();
  const clock = clockRef.current;

  // Handle del renderer, para que el panel de Export dibuje con el MISMO
  // renderer y el MISMO canvas que el preview.
  const engineRef = useRef(null);

  // El reloj corre sobre la pieza entera: duration × cycles.
  const total = state.timing.duration * state.timing.cycles;

  useEffect(() => {
    clock.setDuration(total);
    clock.start();
    return () => clock.stop();
  }, [clock]);

  useEffect(() => {
    clock.setDuration(total);
  }, [clock, total]);

  // Persistencia en localStorage (con un pequeño debounce). Los assets no
  // entran: los descarta `saveState`.
  useEffect(() => {
    const id = setTimeout(() => saveState(state), 250);
    return () => clearTimeout(id);
  }, [state]);

  // Los assets (imágenes, orden, recorte) viven en IndexedDB: al abrir la tool
  // vuelven solos, y cada cambio se guarda. No se sincroniza nada hasta que
  // terminó de leerse lo guardado, para no borrarlo por error.
  const [assetsReady, setAssetsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    hydrateAssets().then((saved) => {
      if (!alive) return;
      setState((s) => (s.assets.length ? s : { ...s, assets: saved }));
      setAssetsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!assetsReady) return undefined;
    const id = setTimeout(() => syncAssets(state.assets, getFile), 400);
    return () => clearTimeout(id);
  }, [state.assets, assetsReady]);

  // Barra espaciadora = play/pausa (salvo escribiendo en un input).
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== "Space") return;
      const el = document.activeElement;
      const typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      clock.toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clock]);

  const onPatch = (section, patch) =>
    setState((s) => ({ ...s, [section]: { ...s[section], ...patch } }));

  const onTemplate = (id) =>
    setState((s) => ({ ...s, template: { ...s.template, id } }));

  const onReset = () => {
    releaseAll();
    setOpenText(null);
    setState(defaultState());
  };

  const setTexts = (texts) => setState((s) => ({ ...s, texts }));
  const openTextLayer = state.texts.find((t) => t.id === openText) ?? null;

  return (
    <div className={`app ${libraryOpen ? "with-library" : ""}`.trim()}>
      <ToolSidebar
        current="plane-animator"
        isDev={import.meta.env.DEV}
        library={{ open: libraryOpen, onToggle: () => setLibraryOpen((v) => !v) }}
      />
      {libraryOpen && (
        <LibraryPanel
          state={state}
          params={resolveParams(state)}
          onTemplate={onTemplate}
          setState={setState}
          onCollapse={() => setLibraryOpen(false)}
        />
      )}
      <div className="workspace">
        <Stage
          state={state}
          clock={clock}
          engineRef={engineRef}
          onTexts={setTexts}
          selectedText={openText}
          onSelectText={setOpenText}
        />
        <aside className="sidebar">
          <div className="sidebar-head">
            <div className="brand">
              Plane Animator <span>· Bong Studio</span>
            </div>
            <div className="brand-sub">
              Loops de imágenes en 3D — un solo render, WYSIWYG
            </div>
          </div>
          <AssetsPanel state={state} setState={setState} onPatch={onPatch} />
          <ScenePanel state={state} setState={setState} />
          <TimingPanel state={state} onPatch={onPatch} />
          <EasePanel state={state} onPatch={onPatch} />
          <CanvasPanel state={state} onPatch={onPatch} />
          <CameraPanel state={state} onPatch={onPatch} />
          <TextSection
            texts={state.texts}
            onChange={setTexts}
            openId={openText}
            onOpen={setOpenText}
          />
          <ProjectPanel state={state} setState={setState} onReset={onReset} />
        </aside>
      </div>
      <Transport
        state={state}
        clock={clock}
        onDuration={(v) => onPatch("timing", { duration: v })}
        onRatio={(v) => onPatch("stage", { ratio: v })}
        onExport={() => setExporting(true)}
      />
      <ExportModal
        open={exporting}
        onClose={() => setExporting(false)}
        state={state}
        setState={setState}
        clock={clock}
        engineRef={engineRef}
      />
      <TextWindow
        text={openTextLayer}
        onChange={(next) =>
          setTexts(state.texts.map((t) => (t.id === next.id ? next : t)))
        }
        onClose={() => setOpenText(null)}
      />
    </div>
  );
}
