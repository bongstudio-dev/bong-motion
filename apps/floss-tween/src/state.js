// Documento con historial (deshacer / rehacer) y autoguardado en el navegador.
import { useCallback, useEffect, useState } from 'react';
import original from './escenas-floss.json';
import { normalizar, validar } from './docops.js';

const KEY = 'floss-tween:doc:v1';
const TOPE = 100;

export const docOriginal = () => normalizar(original);

function cargar() {
  try {
    const crudo = localStorage.getItem(KEY);
    if (crudo) {
      const d = JSON.parse(crudo);
      if (!validar(d)) return normalizar(d);
    }
  } catch { /* sin storage o JSON roto: arranca del original */ }
  return docOriginal();
}

export function useDoc() {
  const [s, setS] = useState(() => ({ doc: cargar(), pasado: [], futuro: [], clave: null, ts: 0 }));

  // `clave` junta en una sola entrada del historial los cambios seguidos de un mismo gesto
  // (arrastrar un borde, un scrub): un deshacer revierte el gesto entero.
  const cambiar = useCallback((fn, clave = null) => {
    setS((a) => {
      const doc = fn(a.doc);
      if (doc === a.doc) return a;
      const ahora = Date.now();
      const junta = clave && clave === a.clave && ahora - a.ts < 700;
      return { doc, pasado: junta ? a.pasado : [...a.pasado.slice(-(TOPE - 1)), a.doc], futuro: [], clave, ts: ahora };
    });
  }, []);

  const deshacer = useCallback(() => setS((a) => a.pasado.length
    ? { doc: a.pasado[a.pasado.length - 1], pasado: a.pasado.slice(0, -1), futuro: [a.doc, ...a.futuro], clave: null, ts: 0 } : a), []);
  const rehacer = useCallback(() => setS((a) => a.futuro.length
    ? { doc: a.futuro[0], pasado: [...a.pasado, a.doc], futuro: a.futuro.slice(1), clave: null, ts: 0 } : a), []);
  // Reemplazar todo el documento (restaurar el original, abrir un archivo) también se puede deshacer.
  const reemplazar = useCallback((doc) => cambiar(() => doc), [cambiar]);

  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(s.doc)); } catch { /* modo privado */ }
    }, 300);
    return () => clearTimeout(id);
  }, [s.doc]);

  return { doc: s.doc, cambiar, deshacer, rehacer, reemplazar, puedeDeshacer: s.pasado.length > 0, puedeRehacer: s.futuro.length > 0 };
}
