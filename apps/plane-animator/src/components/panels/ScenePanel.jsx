import { useState } from "react";
import {
  Section,
  Field,
  ScrubField,
  Segmented,
  Select,
  Toggle,
  Button,
  IconButton,
  Icon,
  Group,
} from "@bong/ui";
import { TEMPLATE_LIST } from "../../engine/templates.js";
import { resolveTemplate, resolveParams } from "../../engine/getScene.js";
import { presetFromState, applyPreset } from "../../state/defaults.js";
import { loadPresets, savePresets } from "../../state/storage.js";

// La UI se dibuja sola a partir del `schema` del template. Es lo mejor que
// tenía el palette-animator y se conserva tal cual: agregar un template no
// requiere tocar un solo componente.
function ParamControl({ item, value, onChange }) {
  if (item.type === "toggle") {
    return <Toggle label={item.label} value={!!value} onChange={onChange} />;
  }
  if (item.type === "select") {
    return (
      <Field label={item.label}>
        {item.options.length <= 4 ? (
          <Segmented value={value} options={item.options} onChange={onChange} />
        ) : (
          <Select value={value} options={item.options} onChange={onChange} />
        )}
      </Field>
    );
  }
  return (
    <ScrubField
      label={item.label}
      value={value}
      min={item.min}
      max={item.max}
      step={item.step}
      unit={item.unit ?? ""}
      onChange={onChange}
    />
  );
}

// Los params vienen ordenados y etiquetados desde el schema: composición
// primero, después movimiento, después el look y al final el encuadre fino.
// Es el orden en que se compone, no el orden en que se programó el template.
function byGroup(schema, params) {
  // Consolida por nombre respetando el orden de primera aparición: si un
  // template declara el mismo grupo en dos tramos, los controles terminan
  // juntos igual.
  const order = [];
  const bucket = new Map();
  for (const item of schema) {
    if (item.when && !item.when(params)) continue;
    const name = item.group ?? "";
    if (!bucket.has(name)) {
      bucket.set(name, []);
      order.push(name);
    }
    bucket.get(name).push(item);
  }
  return order.map((name) => [name, bucket.get(name)]);
}

export default function ScenePanel({ state, setState, onTemplate }) {
  const tpl = resolveTemplate(state);
  const params = resolveParams(state, tpl);
  const [presets, setPresets] = useState(loadPresets);
  const [name, setName] = useState("");

  const onParam = (key, value) =>
    setState((s) => ({
      ...s,
      template: {
        ...s.template,
        params: {
          ...s.template.params,
          [tpl.id]: { ...(s.template.params[tpl.id] ?? {}), [key]: value },
        },
      },
    }));

  const resetParams = () =>
    setState((s) => ({
      ...s,
      template: { ...s.template, params: { ...s.template.params, [tpl.id]: {} } },
    }));

  const saveCurrent = () => {
    const label = name.trim();
    if (!label) return;
    const next = [
      ...presets.filter((p) => p.name !== label),
      { name: label, ...presetFromState(state) },
    ];
    setPresets(next);
    savePresets(next);
    setName("");
  };

  const removePreset = (label) => {
    const next = presets.filter((p) => p.name !== label);
    setPresets(next);
    savePresets(next);
  };

  return (
    <Section title="Escena">
      <Field label="Template">
        <div className="template-grid">
          {TEMPLATE_LIST.map((t) => (
            <button
              key={t.id}
              className={`btn ${state.template.id === t.id ? "primary" : ""}`}
              onClick={() => onTemplate(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </Field>

      <div className="divider" />

      {byGroup(tpl.schema, params).map(([group, items]) => (
        <Group key={group} title={group}>
          {items.map((item) => (
            <ParamControl
              key={item.key}
              item={item}
              value={params[item.key]}
              onChange={(v) => onParam(item.key, v)}
            />
          ))}
        </Group>
      ))}

      <Button variant="ghost" block onClick={resetParams}>
        Reset params de {tpl.name}
      </Button>

      <div className="divider" />

      <Field label="Guardar como custom">
        <div className="btn-row">
          <input
            className="text-input"
            placeholder="Nombre del preset"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCurrent()}
          />
          <Button onClick={saveCurrent} disabled={!name.trim()}>
            Guardar
          </Button>
        </div>
      </Field>

      {presets.length > 0 && (
        <div className="saved-list">
          {presets.map((p) => (
            <div className="saved-row" key={p.name}>
              <span className="name">{p.name}</span>
              <div style={{ display: "flex", gap: 2 }}>
                <Button
                  variant="ghost"
                  onClick={() => setState((s) => applyPreset(s, p))}
                >
                  Cargar
                </Button>
                <IconButton danger onClick={() => removePreset(p.name)}>
                  <Icon.Trash />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="hint">
        Un preset guarda template + params + timing + encuadre. Los assets no:
        son de la sesión.
      </p>
    </Section>
  );
}
