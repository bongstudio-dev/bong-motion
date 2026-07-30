import { Section, Group, ScrubField } from "@bong/ui";

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
];

export default function ControlsPanel({ config, onConfigChange }) {
  return (
    <>
      {SCHEMA.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.groups.map((group, i) => (
            <Group key={group.name || i} title={group.name}>
              {group.fields.map((f) => (
                <ScrubField
                  key={f.key}
                  label={f.label}
                  value={config[f.key]}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  unit={f.unit ?? ""}
                  format={f.pct ? (v) => `${Math.round(v * 100)}%` : undefined}
                  onChange={(v) => onConfigChange(f.key, v)}
                />
              ))}
            </Group>
          ))}
        </Section>
      ))}
    </>
  );
}
