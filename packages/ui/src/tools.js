// Registro de las tools de la plataforma. La sidebar se dibuja de acá, así que
// agregar una tool nueva es agregar una entrada.
//
// En dev cada app corre en su propio puerto; en producción las tres cuelgan del
// mismo Pages bajo /<tool>/, así que alcanza con una ruta relativa.

export const TOOLS = [
  {
    id: "plane-animator",
    name: "Plane",
    title: "Plane Animator — imágenes en el espacio 3D",
    port: 5175,
  },
  {
    id: "palette-animator",
    name: "Palette",
    title: "Palette Animator — loops de paleta de color",
    port: 5174,
  },
  {
    id: "particle-visualizer",
    name: "Particle",
    title: "Particle Visualizer — partículas con fuerzas y ruido",
    port: 5173,
  },
];

export function toolHref(tool, isDev) {
  return isDev ? `http://localhost:${tool.port}/` : `../${tool.id}/`;
}
