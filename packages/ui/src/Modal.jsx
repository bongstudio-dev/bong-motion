// Modal. Lo mínimo para que una decisión que se toma una sola vez no compita
// con los controles que se tocan todo el tiempo.
//
// Vive en el chasis compartido y no en plane-animator porque las tres tools
// tienen el mismo problema con el export: es el último acordeón de un sidebar
// que se recorre mientras se compone, y se usa cuando ya terminaste de componer.
//
// Se cierra con Escape, con click afuera y con la ✕. El foco entra al abrir y
// vuelve a donde estaba al cerrar; mientras está abierto, el Tab no se escapa
// al fondo. Nada de esto es opcional en algo que tapa la pantalla entera.

import { useEffect, useRef } from "react";
import { Icon, IconButton } from "./controls.jsx";

const FOCUSABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, title, subtitle, onClose, footer, children, width = 760 }) {
  const boxRef = useRef(null);
  const antesRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    antesRef.current = document.activeElement;
    // El primer control del cuerpo, no la ✕: quien abre el modal viene a hacer
    // algo, no a cerrarlo.
    const primero = boxRef.current?.querySelector(FOCUSABLES);
    primero?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = [...(boxRef.current?.querySelectorAll(FOCUSABLES) ?? [])];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      antesRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="scrim"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="modal"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={boxRef}
      >
        <div className="modal-head">
          <b>{title}</b>
          {subtitle && <span className="tag">{subtitle}</span>}
          <IconButton onClick={onClose} title="Cerrar (Esc)" aria-label="Cerrar">
            <Icon.Close />
          </IconButton>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
