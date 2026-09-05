import { useRef, useState } from "react";
import { Section, Field, Button, Icon } from "@bong/ui";
import { exportStateFile, importStateFile } from "../../state/storage.js";

// Lo que quedó del viejo panel de Export cuando el export del VIDEO se fue al
// modal: guardar y cargar la receta, y volver a cero.
//
// No entró al modal a propósito. Un JSON de configuración no es un archivo de
// salida: se guarda a mitad de camino, para seguir mañana o para pasarle la
// escena a otro. Meterlo ahí adentro habría hecho que el modal signifique dos
// cosas distintas.
export default function ProjectPanel({ state, setState, onReset }) {
  const fileRef = useRef(null);
  const [message, setMessage] = useState("");

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const next = await importStateFile(file);
      // Los assets cargados en la sesión sobreviven al import de config.
      setState((s) => ({ ...next, assets: s.assets }));
      setMessage("Config importada ✓");
    } catch (err) {
      setMessage(`JSON inválido: ${err.message}`);
    }
    e.target.value = "";
  };

  return (
    <Section title="Proyecto" defaultOpen={false} value="JSON">
      <Field label="Config (JSON)">
        <div className="btn-row">
          <Button
            block
            onClick={() => exportStateFile(state, `${state.export.name || "plane"}.json`)}
          >
            <Icon.Download /> Guardar
          </Button>
          <Button block onClick={() => fileRef.current?.click()}>
            Cargar
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={onImport}
        />
      </Field>
      <p className="hint">
        Guarda la receta —template, params, timing, cámara, encuadre— no las
        imágenes. Los assets son de la sesión.
      </p>
      {message && <p className="hint">{message}</p>}

      <div className="divider" />

      <Button variant="ghost" block onClick={onReset}>
        Reset a defaults
      </Button>
    </Section>
  );
}
