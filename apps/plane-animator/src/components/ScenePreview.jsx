// Miniatura animada de una escena.
//
// Se extrajo de PresetThumb, que ahora la usa: el dibujo era el mismo y el
// modal de export necesitaba exactamente esto, con el state de la pieza en vez
// del de un preset.
//
// Sale del MISMO getScene() que el stage, así que el movimiento es el real y no
// una animación dibujada aparte. Lo que se simplifica es el dibujo:
// rectángulos planos en vez de texturas, y el giro se sugiere con escorzo (cos
// del ángulo) en vez de proyectar los cuatro vértices. Alcanza para reconocer
// el movimiento y cuesta nada.
//
// Todas las miniaturas montadas comparten UN solo rAF: con 5 familias abiertas
// serían 20 loops compitiendo con el render del stage.

import { useEffect, useMemo, useRef } from "react";
import { getScene } from "../engine/getScene.js";
import { stageOf } from "../engine/camera.js";

const registry = new Set();
let raf = 0;
let last = 0;
const FPS = 24; // no hace falta más para una miniatura

function tick(now) {
  raf = registry.size ? requestAnimationFrame(tick) : 0;
  if (now - last < 1000 / FPS) return;
  last = now;
  for (const draw of registry) draw(now);
}

function subscribe(draw) {
  registry.add(draw);
  if (!raf) raf = requestAnimationFrame(tick);
  return () => {
    registry.delete(draw);
    if (!registry.size && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}

// Assets simulados: la miniatura muestra la COMPOSICIÓN, no las imágenes del
// usuario. Seis uniformes mantienen la geometría estable y comparable.
export const FAKE_ASSETS = Array.from({ length: 6 }, (_, i) => ({
  id: `t${i}`, name: "", w: 1080, h: 1350, visible: true, focal: [0, 0], fit: "auto",
}));

export default function ScenePreview({ state, width = 150, className, style }) {
  const canvasRef = useRef(null);
  const stage = useMemo(() => stageOf(state), [state]);
  const h = Math.round((width * stage.h) / stage.w);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = h * dpr;

    const total = state.timing.duration * state.timing.cycles;
    const scale = width / stage.w;

    const draw = (now) => {
      const t = (now / 1000 / total) % 1;
      const scene = getScene(t, state);
      const camZ = scene.camera.position[2];

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0e0e10";
      ctx.fillRect(0, 0, width, h);

      const cx = width / 2;
      const cy = h / 2;

      for (const p of scene.planes) {
        if (p.opacity <= 0.02) continue;
        const dist = camZ - p.pos[2];
        if (dist <= 1) continue;
        // Perspectiva: lo que está más cerca de cámara se agranda.
        const k = (camZ / dist) * scale;

        // El giro no se proyecta vértice a vértice; se sugiere achicando el
        // lado que se aleja. Es lo que hace que un flip se lea como flip.
        const fx = Math.abs(Math.cos(p.rot[1]));
        const fy = Math.abs(Math.cos(p.rot[0]));
        const w = p.size[0] * k * fx;
        const hh = p.size[1] * k * fy;
        if (w < 0.5 || hh < 0.5) continue;

        ctx.save();
        ctx.translate(cx + p.pos[0] * k, cy - p.pos[1] * k);
        if (p.rot[2]) ctx.rotate(-p.rot[2]);
        ctx.globalAlpha = p.opacity;
        if (p.tint === 0) {
          // Las sombras del hero: negras, como en el render real.
          ctx.fillStyle = "rgba(0, 0, 0, 1)";
        } else {
          // Más cerca = más claro: da profundidad sin dibujar sombras.
          const depth = Math.max(0, Math.min(1, camZ / dist / 1.6));
          ctx.fillStyle = `rgba(${180 + depth * 60}, ${182 + depth * 58}, ${188 + depth * 55}, 1)`;
        }
        ctx.fillRect(-w / 2, -hh / 2, w, hh);
        ctx.restore();
      }
    };

    return subscribe(draw);
  }, [state, stage, h, width]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ aspectRatio: `${stage.w} / ${stage.h}`, ...style }}
    />
  );
}
