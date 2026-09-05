import {
  Section,
  Field,
  ScrubField,
  Segmented,
  Select,
  Toggle,
  Button,
  Group,
} from "@bong/ui";
import { resolveTemplate, resolveParams } from "../../engine/getScene.js";

// Sólo los ajustes de la escena. Elegir QUÉ animación es un paso anterior y
// vive en la biblioteca, a la izquierda: son dos decisiones distintas y tenerlas
// en el mismo panel las hacía competir por el espacio.
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
      // Los templates nuevos declaran sus params espaciales en fracción del
      // lado menor del frame. Mostrarlos como porcentaje es lo que los hace
      // legibles: "62%" del cuadro se entiende, "0.62" no.
      format={item.pct ? (v) => `${Math.round(v * 100)}%` : undefined}
      onChange={onChange}
    />
  );
}

// Los params vienen ordenados y etiquetados desde el schema: composición
// primero, después movimiento, después el look y al final el encuadre fino.
// Es el orden en que se compone, no el orden en que se programó el template.
function byGroup(schema, params) {
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

export default function ScenePanel({ state, setState }) {
  const tpl = resolveTemplate(state);
  const params = resolveParams(state, tpl);

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

  return (
    <Section title="Escena" right={<span className="tag">{tpl.name}</span>}>
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
    </Section>
  );
}
