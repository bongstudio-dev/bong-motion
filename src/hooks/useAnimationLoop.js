import { useEffect, useRef } from "react";

export function useAnimationLoop(callback, enabled = true) {
  const frameRef = useRef(0);
  const previousTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const tick = (time) => {
      const delta = time - previousTimeRef.current;
      previousTimeRef.current = time;
      callback(delta);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      previousTimeRef.current = 0;
    };
  }, [callback, enabled]);
}
