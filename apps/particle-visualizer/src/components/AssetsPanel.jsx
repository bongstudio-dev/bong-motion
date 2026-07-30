import { useRef, useState } from "react";
import { Section, Button, Icon, IconButton, ColorInput } from "@bong/ui";

export default function AssetsPanel({ items, onReplace, onRemove, config, onConfigChange }) {
  const fileRef = useRef(null);
  const [over, setOver] = useState(false);

  return (
    <Section title="Assets" right={<span className="tag">{items.length}</span>}>
      <div
        className={`dropzone ${over ? "over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files?.length) onReplace(e.dataTransfer.files);
        }}
        onClick={() => fileRef.current?.click()}
      >
        <Icon.Plus />
        <span>Arrastrá imágenes o hacé click</span>
        <small>JPG · PNG · WEBP — cada una es una partícula</small>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) onReplace(e.target.files);
          e.target.value = "";
        }}
      />

      {items.length > 0 && (
        <div className="asset-list">
          {items.map((item, i) => (
            <div className="asset-row" key={item.id}>
              <span className="tag" style={{ width: 18, textAlign: "right" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="asset-thumb" style={{ aspectRatio: "1 / 1" }}>
                <img src={item.url} alt="" draggable={false} />
              </div>
              <div className="asset-meta">
                <span className="asset-name" title={item.file.name}>
                  {item.file.name}
                </span>
              </div>
              <div className="asset-actions">
                <IconButton danger title="Borrar" onClick={() => onRemove(item.id)}>
                  <Icon.Trash />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="hint">
          Sin imágenes no hay nada que emitir: el sistema usa cada archivo como
          sprite de partícula.
        </p>
      )}

      <div className="divider" />

      <ColorInput
        label="Background"
        value={config.backgroundColor}
        onChange={(v) => onConfigChange("backgroundColor", v)}
      />
    </Section>
  );
}
