// Sección "Texto" del sidebar. Deliberadamente chica: acá sólo se crean, se
// ordenan y se prenden/apagan las capas. Todos los atributos tipográficos viven
// en la ventana flotante — son demasiados para una columna de 360px, y meterlos
// acá empuja Export fuera de la pantalla.

import { Section, Icon, IconButton, Button } from "../controls.jsx";
import { createTextLayer, duplicateTextLayer, textLabel } from "./model.js";

export function TextSection({
  texts = [],
  onChange,
  openId = null,
  onOpen,
  title = "Texto",
  defaultOpen = false,
}) {
  const replace = (id, patch) =>
    onChange(texts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const add = () => {
    const next = createTextLayer();
    onChange([...texts, next]);
    onOpen?.(next.id);
  };

  const duplicate = (text) => {
    const copy = duplicateTextLayer(text);
    const i = texts.findIndex((t) => t.id === text.id);
    onChange([...texts.slice(0, i + 1), copy, ...texts.slice(i + 1)]);
    onOpen?.(copy.id);
  };

  const remove = (id) => {
    onChange(texts.filter((t) => t.id !== id));
    if (openId === id) onOpen?.(null);
  };

  return (
    <Section
      title={title}
      defaultOpen={defaultOpen}
      right={texts.length ? <span className="tag">{texts.length}</span> : null}
    >
      <Button block onClick={add}>
        <Icon.Plus /> Agregar texto
      </Button>

      {!!texts.length && (
        <div className="text-list">
          {texts.map((text) => (
            <div
              key={text.id}
              className={`text-row ${openId === text.id ? "active" : ""} ${
                text.visible === false ? "hidden" : ""
              }`.trim()}
            >
              <button
                className="name"
                onClick={() => onOpen?.(openId === text.id ? null : text.id)}
                title="Abrir los ajustes de este texto"
              >
                {textLabel(text)}
              </button>
              <IconButton
                onClick={() => replace(text.id, { visible: text.visible === false })}
                title={text.visible === false ? "Mostrar" : "Ocultar"}
                aria-label={text.visible === false ? "Mostrar" : "Ocultar"}
              >
                {text.visible === false ? <Icon.EyeOff /> : <Icon.Eye />}
              </IconButton>
              <IconButton onClick={() => duplicate(text)} title="Duplicar" aria-label="Duplicar">
                <Icon.Copy />
              </IconButton>
              <IconButton
                danger
                onClick={() => remove(text.id)}
                title="Eliminar"
                aria-label="Eliminar"
              >
                <Icon.Close />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export default TextSection;
