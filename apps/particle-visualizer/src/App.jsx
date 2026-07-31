import { useCallback, useEffect, useRef, useState } from "react";
import { ToolSidebar, TextSection, TextWindow } from "@bong/ui";
import AssetsPanel from "./components/AssetsPanel";
import { CameraNotice, CameraStatus } from "./components/CameraStatus";
import ControlsPanel from "./components/ControlsPanel";
import PresetsPanel from "./components/PresetsPanel";
import Stage from "./components/Stage";
import Transport from "./components/Transport";
import { normalizeFiles } from "./files";
import { getInitialConfig, RUNTIME_KEYS } from "./presetStore";
import { useHandTracking } from "./hooks/useHandTracking";
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
  // Cámara. Los dos interruptores que la encienden arrancan apagados y NO se
  // persisten (ver presetStore): abrir la tool nunca puede pedir permiso de
  // cámara por su cuenta. Lo estético sí se guarda.
  handTracking: false,
  cameraBackdrop: false,
  handSmoothing: 0.25,
  cameraMirror: true,
  cameraOpacity: 1,
  isPlaying: true,
  clearSignal: 0,
  // Capas de texto sobre la pieza. Contenido de autor, no parte del "look":
  // por eso están en RUNTIME_KEYS y no viajan dentro de un preset.
  texts: [],
};

export default function App() {
  const [items, setItems] = useState([]);
  // Si hay un preset marcado como default, la tool arranca con esos valores.
  const [config, setConfig] = useState(() => getInitialConfig(defaultConfig));
  // Qué capa de texto tiene abierta su ventana flotante — estado de interfaz.
  const [openText, setOpenText] = useState(null);
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

  const onConfigChange = useCallback(
    (key, value) => setConfig((current) => ({ ...current, [key]: value })),
    [],
  );

  // La cámara se abre si hace falta para cualquiera de las dos cosas; el modelo
  // sólo si se va a trackear. Así usar el video de fondo no descarga 40MB.
  const camera = useHandTracking({
    enabled: config.handTracking || config.cameraBackdrop,
    needsLandmarker: config.handTracking,
    onFail: useCallback(
      () => setConfig((c) => ({ ...c, handTracking: false, cameraBackdrop: false })),
      [],
    ),
  });

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
      // Volver a los valores por defecto es volver al look, no tirar el texto
      // que escribió el usuario.
      next.texts = current.texts;
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
          tracker={camera.tracker}
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
          <ControlsPanel
            config={config}
            onConfigChange={onConfigChange}
            slots={{
              cameraStatus: (
                <CameraStatus status={camera.status} tracker={camera.tracker} />
              ),
              cameraNotice: (
                <CameraNotice
                  status={camera.status}
                  error={camera.error}
                  onRetry={camera.retry}
                />
              ),
            }}
          />
          <TextSection
            texts={config.texts}
            onChange={(texts) => onConfigChange("texts", texts)}
            openId={openText}
            onOpen={setOpenText}
          />
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
      <TextWindow
        text={config.texts.find((t) => t.id === openText) ?? null}
        onChange={(next) =>
          onConfigChange(
            "texts",
            config.texts.map((t) => (t.id === next.id ? next : t)),
          )
        }
        onClose={() => setOpenText(null)}
      />
    </div>
  );
}
