// Reloj en segundos para el reproductor. Store externo: el tiempo avanza a 60 fps sin
// re-renderizar el árbol; la vista y el cabezal de la timeline se suscriben.
export function createClock() {
  let t = 0, playing = true, loop = true, duration = 1, last = null, raf = null;
  const oyentes = new Set();
  const emitir = () => { for (const l of oyentes) l(); };

  const cuadro = (ahora) => {
    if (last === null) last = ahora;
    const dt = Math.min(0.1, (ahora - last) / 1000); // si la pestaña estuvo dormida, no saltar
    last = ahora;
    if (playing && duration > 0) {
      t += dt;
      if (t >= duration) {
        if (loop) t %= duration;
        else { t = duration; playing = false; }
      }
    }
    emitir();
    raf = requestAnimationFrame(cuadro);
  };

  return {
    start() { if (raf === null) { last = null; raf = requestAnimationFrame(cuadro); } },
    stop() { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } },
    getT: () => t,
    setT(v) { t = Math.max(0, Math.min(duration, v)); emitir(); },
    isPlaying: () => playing,
    setPlaying(p) {
      if (p && !loop && t >= duration) t = 0;
      playing = p; last = null; emitir();
    },
    toggle() { this.setPlaying(!playing); },
    isLoop: () => loop,
    setLoop(v) { loop = v; emitir(); },
    setDuration(d) { if (d > 0) { duration = d; if (t > d) t = d; } },
    getDuration: () => duration,
    subscribe(l) { oyentes.add(l); return () => oyentes.delete(l); },
  };
}
