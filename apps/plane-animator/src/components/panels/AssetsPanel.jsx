import { useRef, useState } from "react";
import { Section, Field, Segmented, Button, Icon, IconButton, ColorInput } from "@bong/ui";
import { ingestFile, getThumb, release, releaseAll, MAX_SIDE } from "../../assets/assetStore.js";
import { MAX_ASSETS } from "../../state/defaults.js";
import { resolveTemplate } from "../../engine/getScene.js";
import { clamp } from "../../utils/math.js";

const FIT_MODES = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
  { value: "fitToAsset", label: "Fit" },
];

const PER_ASSET_FIT = [{ value: "auto", label: "Global" }, ...FIT_MODES];

// El thumbnail muestra el aspect REAL de la imagen, no un cuadrado recortado.
// Es la única forma de darse cuenta de que el set es mixto antes de exportar.
function Thumb({ asset, editable, onFocal }) {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);
  const url = getThumb(asset.id);

  const apply = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onFocal([
      clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5),
      clamp(0.5 - (e.clientY - r.top) / r.height, -0.5, 0.5),
    ]);
  };

  return (
    <div
      ref={ref}
      className={`asset-thumb ${editable ? "editable" : ""}`}
      style={{ aspectRatio: `${asset.w} / ${asset.h}` }}
      onPointerDown={
        editable
          ? (e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
              apply(e);
            }
          : undefined
      }
      onPointerMove={editable && dragging ? apply : undefined}
      onPointerUp={editable ? () => setDragging(false) : undefined}
      title={editable ? "Arrastrá para mover el punto de interés" : undefined}
    >
      {url && <img src={url} alt="" draggable={false} />}
      {editable && (
        <span
          className="focal-dot"
          style={{
            left: `${(asset.focal[0] + 0.5) * 100}%`,
            top: `${(0.5 - asset.focal[1]) * 100}%`,
          }}
        />
      )}
    </div>
  );
}

export default function AssetsPanel({ state, setState, onPatch }) {
  const assets = state.assets;
  const fileRef = useRef(null);
  const [over, setOver] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [error, setError] = useState("");

  const tpl = resolveTemplate(state);
  const fitBlocked = tpl.supportsFitToAsset === false;

  const setAssets = (next) =>
    setState((s) => ({ ...s, assets: typeof next === "function" ? next(s.assets) : next }));

  const patchAsset = (id, patch) =>
    setAssets((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const addFiles = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    const room = MAX_ASSETS - assets.length;
    const errs = [];
    const added = [];
    for (const f of list.slice(0, Math.max(0, room))) {
      try {
        added.push(await ingestFile(f));
      } catch (err) {
        errs.push(err.message);
      }
    }
    if (added.length) setAssets((l) => [...l, ...added]);
    setError(
      [
        list.length > room ? `Máximo ${MAX_ASSETS} assets.` : "",
        ...errs,
      ]
        .filter(Boolean)
        .join(" "),
    );
  };

  const removeAsset = (id) => {
    release(id);
    setAssets((l) => l.filter((a) => a.id !== id));
  };

  const clearAll = () => {
    releaseAll();
    setAssets([]);
  };

  const reorder = (from, to) => {
    if (from === to || from == null || to == null) return;
    setAssets((l) => {
      const next = [...l];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const visibleCount = assets.filter((a) => a.visible !== false).length;
  const mixed =
    new Set(assets.map((a) => (a.w / a.h).toFixed(2))).size > 1 && assets.length > 1;

  return (
    <Section title="Assets" right={<span className="tag">{visibleCount}</span>}>
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
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => fileRef.current?.click()}
      >
        <Icon.Plus />
        <span>Arrastrá imágenes o hacé click</span>
        <small>JPG · PNG · WEBP — se reducen a {MAX_SIDE}px</small>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <p className="hint warn">{error}</p>}

      {assets.length > 0 && (
        <div className="asset-list">
          {assets.map((a, i) => (
            <div
              key={a.id}
              className={`asset-row ${dragIndex === i ? "dragging" : ""} ${
                dropIndex === i ? "drop-target" : ""
              } ${a.visible === false ? "hidden" : ""}`}
              draggable={dragIndex === i}
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setDropIndex(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                reorder(dragIndex, i);
                setDragIndex(null);
                setDropIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDropIndex(null);
              }}
            >
              <span
                className="drag-handle"
                onPointerDown={() => setDragIndex(i)}
                onPointerUp={() => setDragIndex(null)}
              >
                <Icon.Drag />
              </span>

              <Thumb
                asset={a}
                editable={(a.fit === "auto" ? state.fit.mode : a.fit) === "cover"}
                onFocal={(focal) => patchAsset(a.id, { focal })}
              />

              <div className="asset-meta">
                <span className="asset-name" title={a.name}>
                  {a.name}
                </span>
                <span className="asset-dims">
                  {a.srcW}×{a.srcH}
                  {a.srcW !== a.w && " ↓"}
                </span>
                <select
                  className="text-input tiny"
                  value={a.fit}
                  onChange={(e) => patchAsset(a.id, { fit: e.target.value })}
                >
                  {PER_ASSET_FIT.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="asset-actions">
                <IconButton
                  title={a.visible === false ? "Mostrar" : "Ocultar"}
                  active={a.visible !== false}
                  onClick={() => patchAsset(a.id, { visible: a.visible === false })}
                >
                  {a.visible === false ? <Icon.EyeOff /> : <Icon.Eye />}
                </IconButton>
                <IconButton danger title="Borrar" onClick={() => removeAsset(a.id)}>
                  <Icon.Trash />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {assets.length > 0 && (
        <Button variant="ghost" block onClick={clearAll}>
          Clear all
        </Button>
      )}

      <div className="divider" />

      <Field label="Encuadre global">
        <Segmented
          value={state.fit.mode}
          options={FIT_MODES}
          onChange={(v) => onPatch("fit", { mode: v })}
        />
      </Field>
      <p className="hint">
        {state.fit.mode === "cover" &&
          "Llena el plano y recorta el excedente. Arrastrá sobre el thumbnail para elegir qué parte se conserva."}
        {state.fit.mode === "contain" &&
          "La imagen entra completa y sobra fondo. Para logos y piezas que no se pueden cortar."}
        {state.fit.mode === "fitToAsset" &&
          "El plano toma el aspect de la imagen: no hay recorte ni sobra. El espaciado se calcula por acumulación."}
      </p>
      {fitBlocked && state.fit.mode === "fitToAsset" && (
        <p className="hint warn">
          {tpl.name} no soporta fitToAsset — una cara vertical y una horizontal
          en el mismo plano no cierran. Cae a cover.
        </p>
      )}

      {state.fit.mode === "fitToAsset" && !fitBlocked && (
        <Field label="Cambio de forma entre assets">
          <Segmented
            value={state.fit.transition}
            options={[
              { value: "morph", label: "Interpolar" },
              { value: "lock", label: "Congelar" },
            ]}
            onChange={(v) => onPatch("fit", { transition: v })}
          />
        </Field>
      )}

      {state.fit.mode === "contain" && (
        <ColorInput
          label="Fondo del contain"
          value={state.fit.containBg}
          onChange={(v) => onPatch("fit", { containBg: v })}
        />
      )}

      {mixed && state.fit.mode === "cover" && (
        <p className="hint">
          El set tiene aspects mixtos. Si recortar arruina alguna pieza, probá
          Fit.
        </p>
      )}
      {assets.length === 0 && (
        <p className="hint">
          Sin assets se dibujan placeholders numerados: podés componer la
          animación antes de tener las imágenes finales.
        </p>
      )}
    </Section>
  );
}
