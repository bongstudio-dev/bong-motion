import { useMemo } from "react";
import { variantState } from "../engine/library.js";
import ScenePreview, { FAKE_ASSETS } from "./ScenePreview.jsx";

// Miniatura de un preset. El dibujo vive en ScenePreview, que es el mismo que
// usa el modal de export: lo que aporta este componente es armar el state del
// preset y ponerle el nombre debajo.

export default function PresetThumb({ base, variant, template, active }) {
  // El state del preset se arma una sola vez; el ratio sale del stage real del
  // usuario, así la miniatura muestra cómo queda en el formato en el que está
  // trabajando.
  const state = useMemo(
    () => variantState({ ...base, assets: FAKE_ASSETS }, variant, template),
    [base, variant, template],
  );

  return (
    <button className={`preset-thumb ${active ? "active" : ""}`} title={variant.name} type="button">
      {/* El backing store es fijo para que el dibujo sea siempre el mismo, pero
          en pantalla se estira al ancho de la celda: el panel puede cambiar de
          ancho sin que las miniaturas se corten. */}
      <ScenePreview state={state} width={150} />
      <span>{variant.name}</span>
    </button>
  );
}
