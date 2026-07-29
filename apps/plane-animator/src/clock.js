// Reloj de animación con requestAnimationFrame como clock.
// Store externo: el t01 avanza a 60fps sin re-renderizar todo el árbol React.
// El Stage se suscribe para dibujar; el transport para mover el scrubber.
// El export NO usa este reloj: avanza t por frame para ser determinístico.

export function createClock() {
  let t = 0;
  let playing = true;
  let duration = 6;
  let last = null;
  let raf = null;
  const listeners = new Set();

  const emit = () => {
    for (const l of listeners) l();
  };

  const frame = (now) => {
    if (last === null) last = now;
    const dt = (now - last) / 1000;
    last = now;
    if (playing && duration > 0) {
      t = (t + dt / duration) % 1;
      if (t < 0) t += 1;
    }
    emit();
    raf = requestAnimationFrame(frame);
  };

  return {
    start() {
      if (raf === null) {
        last = null;
        raf = requestAnimationFrame(frame);
      }
    },
    stop() {
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    },
    getT: () => t,
    setT(v) {
      t = ((v % 1) + 1) % 1;
      emit();
    },
    isPlaying: () => playing,
    setPlaying(p) {
      playing = p;
      last = null;
      emit();
    },
    toggle() {
      this.setPlaying(!playing);
    },
    setDuration(d) {
      if (d > 0) duration = d;
    },
    getDuration: () => duration,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
