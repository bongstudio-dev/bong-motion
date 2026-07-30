import { useCallback, useEffect, useRef, useState } from "react";
import { ToolSidebar } from "@bong/ui";
import AssetsPanel from "./components/AssetsPanel";
import ControlsPanel from "./components/ControlsPanel";
import PresetsPanel from "./components/PresetsPanel";
import Stage from "./components/Stage";
import Transport from "./components/Transport";
import { normalizeFiles } from "./files";
import { getInitialConfig, RUNTIME_KEYS } from "./presetStore";
import { useRecorder } from "./hooks/useRecorder";

const defaultConfig = {
  backgroundColor: "#121212",
  aspect: "4:5",
  maxParticles: 240,
  spawnRate: 6.5,
  emitterX: 0.38,
  emitterY: 0.22,
  direction: 360,
  spread: 0,
  speed: 1.6,
  lifespan: 6.1,
  scale: 0.29,
  scaleVariation: 0,
  rotationSpeed: 0,
  fadeIn: 0,
  fadeOut: 0,
  gravity: 1.6,
  turbulence: 5,
  turbulenceFrequency: 0.004,
  drag: 0.016,
  isPlaying: true,
  clearSignal: 0,
};

export default function App() {
  const [items, setItems] = useState([]);
  // Si hay un preset marcado como default, la tool arranca con esos valores.
  const [config, setConfig] = useState(() => getInitialConfig(defaultConfig));
  const canvasRef = useRef(null);
  const recorder = useRecorder(canvasRef);

  const replaceItems = useCallback((files) => {
    const nextItems = normalizeFiles(files);
    if (!nextItems.length) return;
    setItems((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.url));
      return nextItems;
    });
  }, []);

  const removeItem = useCallback((id) => {
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  // Evita que soltar imágenes fuera de una dropzone abra el archivo en el browser.
  useEffect(() => {
    const prevent = (event) => event.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const onConfigChange = (key, value) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const handleApplyPreset = (values) =>
    setConfig((current) => {
      const next = { ...current, ...values };
      // Nunca pisamos el estado de runtime al cargar un preset.
      RUNTIME_KEYS.forEach((key) => {
        next[key] = current[key];
      });
      return next;
    });

  const handleResetDefaults = () =>
    setConfig((current) => {
      const next = getInitialConfig(defaultConfig);
      next.isPlaying = current.isPlaying;
      next.clearSignal = current.clearSignal;
      return next;
    });

  // Revocamos las URLs sólo al desmontar: hacerlo en cada cambio de `items`
  // mataba los blobs de las imágenes que se conservaban.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  return (
    <div className="app">
      <ToolSidebar current="particle-visualizer" isDev={import.meta.env.DEV} />
      <div className="workspace">
        <Stage
          items={items}
          config={config}
          canvasRef={canvasRef}
          onConfigChange={onConfigChange}
          onDropFiles={replaceItems}
        />
        <aside className="sidebar">
          <div className="sidebar-head">
            <div className="brand">
              Particle Visualizer <span>· Bong Studio</span>
            </div>
            <div className="brand-sub">
              Partículas con fuerzas y ruido — fondos y texturas en movimiento
            </div>
          </div>
          <AssetsPanel
            items={items}
            onReplace={replaceItems}
            onRemove={removeItem}
            config={config}
            onConfigChange={onConfigChange}
          />
          <ControlsPanel config={config} onConfigChange={onConfigChange} />
          <PresetsPanel
            config={config}
            onApplyPreset={handleApplyPreset}
            onResetDefaults={handleResetDefaults}
          />
        </aside>
      </div>
      <Transport
        config={config}
        recorder={recorder}
        onConfigChange={onConfigChange}
        onClear={() => onConfigChange("clearSignal", config.clearSignal + 1)}
      />
    </div>
  );
}
