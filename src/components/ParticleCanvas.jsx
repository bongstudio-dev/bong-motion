import { useEffect, useRef } from "react";
import { ParticleSystem } from "../engine/ParticleSystem";

function drawPlaceholder(ctx, width, height, backgroundColor) {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(149, 181, 169, 0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
  ctx.textAlign = "center";
  ctx.font = "600 42px Satoshi, sans-serif";
  ctx.fillText("Drop manual pages", width / 2, height / 2 - 12);

  ctx.fillStyle = "rgba(149, 181, 169, 0.92)";
  ctx.font = "400 24px 'Space Mono', monospace";
  ctx.fillText("Canvas 1080 x 1350 ready", width / 2, height / 2 + 36);
}

function ParticleCanvas({ width, height, items, config, canvasRef: externalRef }) {
  const internalRef = useRef(null);
  const canvasRef = externalRef || internalRef;
  const systemRef = useRef(null);
  const imagesRef = useRef([]);
  const frameRef = useRef(0);
  const previousTimeRef = useRef(0);

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

    const render = (time) => {
      const deltaMs = previousTimeRef.current ? time - previousTimeRef.current : 16.67;
      previousTimeRef.current = time;

      if (!imagesRef.current.length) {
        drawPlaceholder(ctx, width, height, config.backgroundColor);
      } else if (systemRef.current) {
        if (config.isPlaying) {
          systemRef.current.update(deltaMs / 1000, width, height);
        }
        systemRef.current.render(ctx, width, height);
      }

      frameRef.current = window.requestAnimationFrame(render);
    };

    frameRef.current = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      previousTimeRef.current = 0;
    };
  }, [config.backgroundColor, config.isPlaying, height, width]);

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
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block h-full w-full"
    />
  );
}

export default ParticleCanvas;
