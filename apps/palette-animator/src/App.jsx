import { useEffect, useRef, useState } from "react";
import Stage from "./components/Stage.jsx";
import Transport from "./components/Transport.jsx";
import PalettePanel from "./components/panels/PalettePanel.jsx";
import MotionPanel from "./components/panels/MotionPanel.jsx";
import EasePanel from "./components/panels/EasePanel.jsx";
import TextPanel from "./components/panels/TextPanel.jsx";
import ExportPanel from "./components/panels/ExportPanel.jsx";
import { ToolSidebar, TextSection, TextWindow } from "@bong/ui";
import { createClock } from "./clock.js";
import { PRESETS } from "./engine/presets.js";
import { defaultState } from "./state/defaults.js";
import { loadState, saveState } from "./state/storage.js";

export default function App() {
  const [state, setState] = useState(loadState);
  // Qué capa de texto tiene abierta su ventana flotante. Es estado de la
  // interfaz, no de la pieza: no se persiste ni entra al JSON exportado.
  const [openText, setOpenText] = useState(null);
  const clockRef = useRef(null);
  if (!clockRef.current) clockRef.current = createClock();
  const clock = clockRef.current;

  // Arranque / parada del reloj.
  useEffect(() => {
    clock.setDuration(state.motion.duration);
    clock.start();
    return () => clock.stop();
  }, [clock]);

  // La duración del ciclo alimenta el reloj.
  useEffect(() => {
    clock.setDuration(state.motion.duration);
  }, [clock, state.motion.duration]);

  // Persistencia en localStorage (con un pequeño debounce).
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

  // ---- Helpers de update ----
  const onPatch = (section, patch) =>
    setState((s) => ({ ...s, [section]: { ...s[section], ...patch } }));

  const onParam = (key, value) =>
    setState((s) => ({
      ...s,
      motion: { ...s.motion, params: { ...s.motion.params, [key]: value } },
    }));

  const onPreset = (id) =>
    setState((s) => ({
      ...s,
      motion: { ...s.motion, preset: id, params: {} },
      layout: { mode: PRESETS[id]?.defaultLayout ?? "row" },
    }));

  const setPalette = (updater) =>
    setState((s) => ({
      ...s,
      palette: typeof updater === "function" ? updater(s.palette) : updater,
    }));

  const onReset = () => {
    setOpenText(null);
    setState(defaultState());
  };

  const setTexts = (texts) => setState((s) => ({ ...s, texts }));
  const openTextLayer = state.texts.find((t) => t.id === openText) ?? null;

  return (
    <div className="app">
      <ToolSidebar current="palette-animator" isDev={import.meta.env.DEV} />
      <div className="workspace">
        <Stage state={state} clock={clock} />
        <aside className="sidebar">
          <div className="sidebar-head">
            <div className="brand">
              Palette Animator <span>· Bong Studio</span>
            </div>
            <div className="brand-sub">Loops de paleta — un solo canvas, WYSIWYG</div>
          </div>
          <PalettePanel palette={state.palette} setPalette={setPalette} />
          <MotionPanel
            state={state}
            onPatch={onPatch}
            onParam={onParam}
            onPreset={onPreset}
          />
          <EasePanel state={state} onPatch={onPatch} />
          <TextPanel state={state} onPatch={onPatch} />
          <TextSection
            texts={state.texts}
            onChange={setTexts}
            openId={openText}
            onOpen={setOpenText}
          />
          <ExportPanel
            state={state}
            clock={clock}
            onReplaceState={setState}
            onReset={onReset}
          />
        </aside>
      </div>
      <Transport
        state={state}
        clock={clock}
        onDuration={(v) => onPatch("motion", { duration: v })}
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
