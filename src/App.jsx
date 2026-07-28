import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Controls from "./components/Controls";
import Dropzone from "./components/Dropzone";
import PreviewGrid from "./components/PreviewGrid";
import Presets from "./components/Presets";
import Stage from "./components/Stage";
import { normalizeFiles } from "./files";
import { getInitialConfig, RUNTIME_KEYS } from "./presetStore";
import { useRecorder } from "./hooks/useRecorder";

const defaultConfig = {
  backgroundColor: "#121212",
  aspect: "4:5",
  maxParticles: 40,
  spawnRate: 9,
  emitterX: 0.36,
  emitterY: 0.57,
  direction: 360,
  spread: 0,
  speed: 1.7,
  lifespan: 6.1,
  scale: 0.3,
  scaleVariation: 0,
  rotationSpeed: 0,
  fadeIn: 0,
  fadeOut: 0,
  gravity: -1.65,
  turbulence: 4.5,
  turbulenceFrequency: 0.01,
  drag: 0.01,
  isPlaying: true,
  clearSignal: 0,
};

function App() {
  const [items, setItems] = useState([]);
  // Si hay un preset marcado como default, la tool arranca con esos valores.
  const [config, setConfig] = useState(() => getInitialConfig(defaultConfig));
  const canvasRef = useRef(null);
  const recorder = useRecorder(canvasRef);

  const hasAssets = items.length > 0;

  const replaceItems = useCallback((files) => {
    const nextItems = normalizeFiles(files);
    if (!nextItems.length) {
      return;
    }
    setItems((currentItems) => {
      currentItems.forEach((item) => URL.revokeObjectURL(item.url));
      return nextItems;
    });
  }, []);

  const removeItem = useCallback((id) => {
    setItems((currentItems) => {
      const target = currentItems.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
      }
      return currentItems.filter((item) => item.id !== id);
    });
  }, []);

  // Evita que soltar imágenes fuera de una dropzone abra el archivo en el navegador.
  useEffect(() => {
    const prevent = (event) => event.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const handleConfigChange = (key, value) => {
    setConfig((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleTogglePlayback = () => {
    setConfig((current) => ({
      ...current,
      isPlaying: !current.isPlaying,
    }));
  };

  const handleClearParticles = () => {
    setConfig((current) => ({
      ...current,
      clearSignal: current.clearSignal + 1,
    }));
  };

  const handleApplyPreset = (values) => {
    setConfig((current) => {
      const next = { ...current, ...values };
      // Nunca pisamos el estado de runtime al cargar un preset.
      RUNTIME_KEYS.forEach((key) => {
        next[key] = current[key];
      });
      return next;
    });
  };

  const handleResetDefaults = () => {
    setConfig((current) => {
      const next = getInitialConfig(defaultConfig);
      next.isPlaying = current.isPlaying;
      next.clearSignal = current.clearSignal;
      return next;
    });
  };

  const stats = useMemo(
    () => ({
      count: items.length,
      first: items[0]?.file.name ?? "Sin archivos",
    }),
    [items],
  );

  // Revocamos las URLs solo al desmontar. La revocación de imágenes puntuales ya
  // la manejan replaceItems (reemplazo) y removeItem (borrado individual); hacerlo
  // en cada cambio de `items` mataba los blobs de las imágenes que se conservaban.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  return (
    <main className="h-screen overflow-hidden bg-app text-white">
      <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col gap-4 p-4 md:gap-6 md:p-6 xl:flex-row">
        {/* CONTROLES (sidebar izquierda) — el único que scrollea, por dentro */}
        <aside className="order-last min-h-0 w-full flex-1 overflow-y-auto xl:order-none xl:max-w-[420px] xl:flex-none">
          <div className="rounded-[32px] border border-stroke bg-panel/85 p-5 shadow-glow backdrop-blur">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
                  Phase 1
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-white">
                  Brand Manual Particle Visualizer
                </h1>
                <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
                  Base lista para cargar manuales, validar el orden y montar un
                  stage vertical 1080x1350 con escalado visual responsivo.
                </p>
              </div>
              <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 font-mono text-xs text-accent">
                React + Vite
              </div>
            </div>

            <Dropzone items={items} onReplace={replaceItems} />

            <div className="mt-6">
              <Controls
                count={stats.count}
                firstFileName={stats.first}
                config={config}
                onConfigChange={handleConfigChange}
                onTogglePlayback={handleTogglePlayback}
                onClearParticles={handleClearParticles}
              />
            </div>

            <div className="mt-6">
              <Presets
                config={config}
                onApplyPreset={handleApplyPreset}
                onResetDefaults={handleResetDefaults}
              />
            </div>

            {hasAssets ? (
              <div className="mt-6">
                <PreviewGrid items={items} onRemove={removeItem} />
              </div>
            ) : null}
          </div>
        </aside>

        {/* STAGE (derecha) — fijo, no scrollea nunca */}
        <div className="flex min-h-0 shrink-0 items-start justify-center xl:min-w-0 xl:flex-1 xl:shrink">
          <div className="w-full">
            <Stage
              items={items}
              config={config}
              canvasRef={canvasRef}
              recorder={recorder}
              onConfigChange={handleConfigChange}
              onDropFiles={replaceItems}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
