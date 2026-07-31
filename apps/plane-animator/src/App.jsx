import { useEffect, useRef, useState } from "react";
import Stage from "./components/Stage.jsx";
import Transport from "./components/Transport.jsx";
import LibraryPanel from "./components/LibraryPanel.jsx";
import AssetsPanel from "./components/panels/AssetsPanel.jsx";
import ScenePanel from "./components/panels/ScenePanel.jsx";
import TimingPanel from "./components/panels/TimingPanel.jsx";
import EasePanel from "./components/panels/EasePanel.jsx";
import CanvasPanel from "./components/panels/CanvasPanel.jsx";
import ExportPanel from "./components/panels/ExportPanel.jsx";
import { ToolSidebar, TextSection, TextWindow } from "@bong/ui";
import { createClock } from "./clock.js";
import { defaultState } from "./state/defaults.js";
import { resolveParams } from "./engine/getScene.js";
import { loadState, saveState } from "./state/storage.js";
import { releaseAll } from "./assets/assetStore.js";

export default function App() {
  const [state, setState] = useState(loadState);
  // Qué capa de texto tiene abierta su ventana flotante. Es estado de la
  // interfaz, no de la pieza: no se persiste ni entra al JSON exportado.
  const [openText, setOpenText] = useState(null);
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
    <div className="app with-library">
      <ToolSidebar current="plane-animator" isDev={import.meta.env.DEV} />
      <LibraryPanel
        state={state}
        params={resolveParams(state)}
        onTemplate={onTemplate}
        setState={setState}
      />
      <div className="workspace">
        <Stage state={state} clock={clock} engineRef={engineRef} />
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
          <TextSection
            texts={state.texts}
            onChange={setTexts}
            openId={openText}
            onOpen={setOpenText}
          />
          <ExportPanel
            state={state}
            setState={setState}
            clock={clock}
            engineRef={engineRef}
            onReset={onReset}
          />
        </aside>
      </div>
      <Transport
        state={state}
        clock={clock}
        onDuration={(v) => onPatch("timing", { duration: v })}
        onRatio={(v) => onPatch("stage", { ratio: v })}
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
