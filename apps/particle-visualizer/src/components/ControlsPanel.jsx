import { Section, Group, ScrubField, Toggle } from "@bong/ui";

// Mismo patrón que las otras dos tools: la UI se dibuja sola desde el schema.
// El orden sigue cómo se ajusta un sistema de partículas: primero de dónde
// salen y cuántas, después cómo es cada una, y al final qué las empuja.
const SCHEMA = [
  {
    title: "Emisión",
    groups: [
      {
        name: "Caudal",
        fields: [
          { key: "maxParticles", label: "Máximo de partículas", min: 10, max: 300, step: 1 },
          { key: "spawnRate", label: "Nacimiento", min: 1, max: 20, step: 0.5, unit: "/s" },
        ],
      },
      {
        name: "Origen",
        fields: [
          { key: "emitterX", label: "Emisor X", min: 0, max: 1, step: 0.01, pct: true },
          { key: "emitterY", label: "Emisor Y", min: 0, max: 1, step: 0.01, pct: true },
        ],
      },
      {
        name: "Disparo",
        fields: [
          { key: "direction", label: "Dirección", min: 0, max: 360, step: 1, unit: "°" },
          { key: "spread", label: "Apertura", min: 0, max: 180, step: 1, unit: "°" },
          { key: "speed", label: "Velocidad", min: 0.5, max: 10, step: 0.1 },
        ],
      },
    ],
  },
  {
    title: "Partícula",
    groups: [
      {
        name: "Tamaño",
        fields: [
          { key: "scale", label: "Escala", min: 0.05, max: 0.5, step: 0.01 },
          { key: "scaleVariation", label: "Variación", min: 0, max: 0.2, step: 0.01 },
        ],
      },
      {
        name: "Vida",
        fields: [
          { key: "lifespan", label: "Duración", min: 1, max: 15, step: 0.1, unit: "s" },
          { key: "fadeIn", label: "Fade in", min: 0, max: 2, step: 0.05, unit: "s" },
          { key: "fadeOut", label: "Fade out", min: 0, max: 3, step: 0.05, unit: "s" },
        ],
      },
      {
        name: "Giro",
        fields: [
          { key: "rotationSpeed", label: "Rotación", min: 0, max: 0.05, step: 0.001 },
        ],
      },
    ],
  },
  {
    title: "Fuerzas",
    groups: [
      {
        name: "",
        fields: [
          { key: "gravity", label: "Gravedad", min: -2, max: 2, step: 0.05 },
          { key: "turbulence", label: "Turbulencia", min: 0, max: 5, step: 0.1 },
          { key: "turbulenceFrequency", label: "Frecuencia", min: 0.001, max: 0.05, step: 0.001 },
          { key: "drag", label: "Resistencia", min: 0, max: 0.1, step: 0.001 },
        ],
      },
    ],
  },
  {
    title: "Cámara",
    // El indicador va en el header (es lo que se mira de reojo) y el detalle
    // del error arriba del cuerpo, donde hay lugar para leerlo.
    slot: "cameraStatus",
    notice: "cameraNotice",
    groups: [
      {
        name: "Origen",
        fields: [
          {
            key: "handTracking",
            label: "La mano mueve el emisor",
            type: "toggle",
            hint: "Sigue la punta del índice. Mientras esté activo, Emisor X/Y quedan como posición de reserva.",
          },
          { key: "handSmoothing", label: "Suavizado", min: 0.05, max: 0.6, step: 0.01 },
        ],
      },
      {
        name: "Fondo",
        fields: [
          {
            key: "cameraBackdrop",
            label: "Video de fondo",
            type: "toggle",
            hint: "Se dibuja dentro del canvas, así que también sale en la grabación.",
          },
          { key: "cameraMirror", label: "Espejar", type: "toggle" },
          { key: "cameraOpacity", label: "Opacidad", min: 0, max: 1, step: 0.01 },
        ],
      },
    ],
  },
];

function Control({ field, config, onConfigChange }) {
  if (field.type === "toggle") {
    return (
      <Toggle
        label={field.label}
        value={!!config[field.key]}
        hint={field.hint}
        onChange={(v) => onConfigChange(field.key, v)}
      />
    );
  }
  return (
    <ScrubField
      label={field.label}
      value={config[field.key]}
      min={field.min}
      max={field.max}
      step={field.step}
      unit={field.unit ?? ""}
      format={field.pct ? (v) => `${Math.round(v * 100)}%` : undefined}
      onChange={(v) => onConfigChange(field.key, v)}
    />
  );
}

export default function ControlsPanel({ config, onConfigChange, slots = {} }) {
  return (
    <>
      {SCHEMA.map((section) => (
        <Section
          key={section.title}
          title={section.title}
          right={section.slot ? slots[section.slot] : null}
        >
          {section.notice ? slots[section.notice] : null}
          {section.groups.map((group, i) => (
            <Group key={group.name || i} title={group.name}>
              {group.fields.map((field) => (
                <Control
                  key={field.key}
                  field={field}
                  config={config}
                  onConfigChange={onConfigChange}
                />
              ))}
            </Group>
          ))}
        </Section>
      ))}
    </>
  );
}
