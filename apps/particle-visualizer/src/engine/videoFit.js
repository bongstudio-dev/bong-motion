// Mapeo entre el frame de la cámara y el stage.
//
// El frame de la webcam (4:3 o 16:9) casi nunca tiene el aspect del stage (4:5,
// 9:16, 1:1...), así que hay que recortar. Este módulo es la ÚNICA fuente de esa
// matemática: `drawVideoCover` y `videoPointToStage` llaman las dos a
// `coverRect` en vez de reimplementarla. Si divergieran, la partícula dejaría de
// nacer en la punta del dedo que se ve en el fondo — y ese desfasaje no se
// detecta a ojo, sólo se siente raro.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

const EMPTY = { sx: 0, sy: 0, sw: 0, sh: 0 };

// Rectángulo del frame que sobrevive al recorte "cover": llena el stage sin
// deformar, sacrificando lo que sobra del lado largo.
export function coverRect(videoW, videoH, stageW, stageH) {
  if (!(videoW > 0) || !(videoH > 0) || !(stageW > 0) || !(stageH > 0)) {
    return EMPTY; // el video todavía no tiene dimensiones
  }

  const stageAspect = stageW / stageH;
  const videoAspect = videoW / videoH;

  if (videoAspect > stageAspect) {
    // El video es más ancho que el stage: se recorta a los costados.
    const sw = videoH * stageAspect;
    return { sx: (videoW - sw) / 2, sy: 0, sw, sh: videoH };
  }

  // El video es más alto: se recorta arriba y abajo.
  const sh = videoW / stageAspect;
  return { sx: 0, sy: (videoH - sh) / 2, sw: videoW, sh };
}

// Dibuja el frame cubriendo el stage. Devuelve false si el video no está listo,
// para que el caller sepa que tiene que dejar el fondo sólido.
export function drawVideoCover(ctx, video, stageW, stageH, options = {}) {
  const { mirror = true, opacity = 1 } = options;
  const { sx, sy, sw, sh } = coverRect(
    video.videoWidth,
    video.videoHeight,
    stageW,
    stageH,
  );
  if (!(sw > 0) || !(sh > 0)) return false;

  ctx.save();
  ctx.globalAlpha = opacity;
  if (mirror) {
    // Espejo sobre el eje vertical del stage: mover la mano a la derecha tiene
    // que mover la imagen a la derecha, como un espejo real.
    ctx.translate(stageW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, stageW, stageH);
  ctx.restore();
  return true;
}

// Landmark normalizado del frame (0..1 sobre el frame COMPLETO, como lo entrega
// MediaPipe) → posición normalizada del stage (0..1), aplicando el mismo recorte
// y el mismo espejo que el dibujo.
export function videoPointToStage(lx, ly, videoW, videoH, stageW, stageH, mirror = true) {
  const { sx, sy, sw, sh } = coverRect(videoW, videoH, stageW, stageH);
  if (!(sw > 0) || !(sh > 0)) return { x: 0.5, y: 0.5 };

  // Píxel del frame → fracción dentro del rect recortado.
  let u = (lx * videoW - sx) / sw;
  const v = (ly * videoH - sy) / sh;

  // El flip del canvas manda el píxel de x a stageW - x, así que el punto tiene
  // que hacer el mismo recorrido para seguir cayendo sobre su propia imagen.
  if (mirror) u = 1 - u;

  // Fuera del recorte el emisor se pega al borde, que es lo intuitivo.
  return { x: clamp01(u), y: clamp01(v) };
}
