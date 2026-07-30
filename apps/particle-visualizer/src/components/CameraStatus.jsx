import { useEffect, useState } from "react";
import { Button } from "@bong/ui";

// `tracker.hasHand` cambia a 30Hz, así que no puede vivir en state: se sondea
// cada 200ms y sólo se re-renderiza cuando el booleano realmente cambió. Son
// como mucho 5 renders/s, y sólo de este componente.
function useHasHand(status, tracker) {
  const [hasHand, setHasHand] = useState(false);
  useEffect(() => {
    if (status !== "live") {
      setHasHand(false);
      return undefined;
    }
    const id = setInterval(() => {
      setHasHand((prev) => (prev === tracker.hasHand ? prev : tracker.hasHand));
    }, 200);
    return () => clearInterval(id);
  }, [status, tracker]);
  return hasHand;
}

// Pastilla para el header de la sección. Sin botones: el header ya ES un
// <button> (el acordeón) y anidar botones es HTML inválido.
export function CameraStatus({ status, tracker }) {
  const hasHand = useHasHand(status, tracker);
  if (status === "off") return null;

  const tone =
    status === "error" ? "error" : status === "live" && hasHand ? "ok" : "wait";

  const label =
    status === "error"
      ? "error"
      : status === "loading-model"
        ? "cargando modelo…"
        : status === "starting"
          ? "pidiendo cámara…"
          : hasHand
            ? "mano ✓"
            : "sin mano";

  return (
    <span className={`cam-status ${tone}`}>
      <span className="cam-dot" />
      {label}
    </span>
  );
}

// El detalle del error va en el cuerpo de la sección, donde hay lugar para
// leerlo y para un botón de verdad.
export function CameraNotice({ status, error, onRetry }) {
  if (status !== "error" || !error) return null;
  return (
    <div className="notice">
      <span>{error}</span>
      <Button onClick={onRetry}>Reintentar</Button>
    </div>
  );
}

export default CameraStatus;
