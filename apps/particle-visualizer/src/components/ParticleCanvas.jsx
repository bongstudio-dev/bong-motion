import { useEffect, useRef } from "react";
import { drawTexts } from "@bong/ui/text";
import { ParticleSystem } from "../engine/ParticleSystem";
import { drawVideoCover, videoPointToStage } from "../engine/videoFit";

// El fondo lo pinta `backdrop`; acá quedan sólo el marco y el texto, para que
// prender la cámara sin sprites cargados muestre el video y no un rectángulo
// opaco. Ése es, además, el primer estado en el que se prueba la feature.
function drawPlaceholderOverlay(ctx, width, height) {
  ctx.strokeStyle = "rgba(149, 181, 169, 0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
  ctx.textAlign = "center";
  ctx.font = "600 42px Satoshi, sans-serif";
  ctx.fillText("Drop manual pages", width / 2, height / 2 - 12);

  ctx.fillStyle = "rgba(149, 181, 169, 0.92)";
  ctx.font = "400 24px 'Space Mono', monospace";
  ctx.fillText(`Canvas ${width} x ${height} ready`, width / 2, height / 2 + 36);
}

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

// Si se perdió la mano un rato largo, al recuperarla conviene saltar en vez de
// que el emisor "viaje" interpolando desde donde había quedado.
const RESYNC_MS = 700;

function ParticleCanvas({ width, height, items, config, canvasRef: externalRef, tracker, handleRef }) {
  const internalRef = useRef(null);
  const canvasRef = externalRef || internalRef;
  const systemRef = useRef(null);
  const imagesRef = useRef([]);
  const frameRef = useRef(0);
  const previousTimeRef = useRef(0);
  const emaRef = useRef(null);

  useEffect(() => {
    systemRef.current = new ParticleSystem(config);
  }, []);

  useEffect(() => {
    if (systemRef.current) {
      systemRef.current.updateConfig(config);
    }
  }, [config]);

  useEffect(() => {
    let cancelled = false;

    async function preloadImages() {
      const loaded = await Promise.all(
        items.map(
          (item) =>
            new Promise((resolve) => {
              const image = new Image();
              image.onload = () => resolve({ ...item, image });
              image.onerror = () => resolve(null);
              image.src = item.url;
            }),
        ),
      );

      if (cancelled) {
        return;
      }

      imagesRef.current = loaded.filter(Boolean);

      if (systemRef.current) {
        // Actualizamos los assets sin limpiar las partículas vivas: agregar o
        // quitar imágenes ya no reinicia la animación.
        systemRef.current.setAssets(imagesRef.current);
      }
    }

    preloadImages();

    return () => {
      cancelled = true;
    };
  }, [items]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return undefined;
    }

    // Fondo sólido y, encima, el video si corresponde. El fill va SIEMPRE
    // primero: así `cameraOpacity` funciona como un dimmer contra el color
    // elegido en vez de acumular sobre el frame anterior.
    const backdrop = (c, w, h) => {
      const cfg = systemRef.current.config;
      c.fillStyle = cfg.backgroundColor;
      c.fillRect(0, 0, w, h);
      if (cfg.cameraBackdrop && tracker?.ready && tracker.video) {
        drawVideoCover(c, tracker.video, w, h, {
          mirror: cfg.cameraMirror !== false,
          opacity: cfg.cameraOpacity ?? 1,
        });
      }
      // Las capas `back` van acá y no antes de llamar a `render`: ese método
      // arranca con un clearRect que borraría cualquier cosa pintada antes.
      drawTexts(c, cfg.texts, { w, h }, "back");
    };

    // Texto encima de todo. Va sobre el canvas, no en un div: `captureStream`
    // graba el canvas, así que un overlay DOM no entraría en la grabación.
    const textOverlay = (c, w, h) => {
      const texts = systemRef.current.config.texts;
      drawTexts(c, texts, { w, h }, "middle");
      drawTexts(c, texts, { w, h }, "front");
    };

    // La EMA corre acá (60Hz) y no en el callback de detección (30Hz): así el
    // emisor interpola entre muestras de cámara y α queda anclado a una tasa
    // constante, no a la de la webcam — que baja a 15fps con poca luz.
    const followHand = (now) => {
      const system = systemRef.current;
      const cfg = system.config;

      if (!cfg.handTracking || !tracker?.ready || !tracker.video) {
        system.setEmitterOverride(null);
        emaRef.current = null;
        return;
      }

      const target = videoPointToStage(
        tracker.x,
        tracker.y,
        tracker.video.videoWidth,
        tracker.video.videoHeight,
        width,
        height,
        cfg.cameraMirror !== false,
      );

      const stale = now - tracker.lastAt > RESYNC_MS;
      if (!emaRef.current || stale) {
        emaRef.current = { x: target.x, y: target.y };
      } else {
        const a = clamp(cfg.handSmoothing ?? 0.25, 0.01, 1);
        emaRef.current.x += (target.x - emaRef.current.x) * a;
        emaRef.current.y += (target.y - emaRef.current.y) * a;
      }

      system.setEmitterOverride(emaRef.current);

      // El handle es DOM: con tracking activo este rAF es su único dueño (React
      // deja de rendir su `style`, ver Stage.jsx).
      if (handleRef?.current) {
        handleRef.current.style.left = `${emaRef.current.x * 100}%`;
        handleRef.current.style.top = `${emaRef.current.y * 100}%`;
      }
    };

    const render = (time) => {
      // Clamp del dt: al volver de una pestaña en background el delta es de
      // segundos y las partículas se teletransportan de golpe.
      const raw = previousTimeRef.current ? time - previousTimeRef.current : 16.67;
      const deltaMs = Math.min(raw, 50);
      previousTimeRef.current = time;

      const system = systemRef.current;
      if (system) {
        // La config se lee de `system.config`, no del closure: si dependiera
        // del closure habría que meterla en las deps del efecto y el rAF se
        // destruiría y recrearía en cada tick de un slider.
        const cfg = system.config;
        followHand(time);

        if (!imagesRef.current.length) {
          ctx.clearRect(0, 0, width, height);
          backdrop(ctx, width, height);
          drawPlaceholderOverlay(ctx, width, height);
        } else {
          if (cfg.isPlaying) {
            system.update(deltaMs / 1000, width, height);
          }
          system.render(ctx, width, height, backdrop);
        }
        textOverlay(ctx, width, height);
      }

      frameRef.current = window.requestAnimationFrame(render);
    };

    frameRef.current = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      previousTimeRef.current = 0;
    };
  }, [height, width, tracker, handleRef, canvasRef]);

  useEffect(() => {
    if (!items.length && systemRef.current) {
      systemRef.current.clear();
      imagesRef.current = [];
    }

    return undefined;
  }, [items.length]);

  useEffect(() => {
    if (systemRef.current) {
      systemRef.current.clear();
    }
  }, [config.clearSignal]);

  return (
    // El backing store va a resolución lógica completa (1080×1350) porque
    // `captureStream` graba exactamente eso: acá el canvas ES la resolución de
    // export, no un preview. Por eso tampoco entra devicePixelRatio, aunque las
    // otras dos tools sí lo usen. En pantalla se muestra downscaleado por CSS.
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="stage-canvas"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

export default ParticleCanvas;
