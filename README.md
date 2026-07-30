# Bong Motion

Familia de herramientas internas de Bong Studio para generar piezas animadas en
loop. Monorepo con npm workspaces; cada tool se despliega en su subpath de
GitHub Pages.

| Tool | Qué hace | Motor |
|---|---|---|
| [`plane-animator`](apps/plane-animator) | Posts a partir de varias imágenes en el espacio 3D | WebGL · función pura del tiempo |
| [`palette-animator`](apps/palette-animator) | Loops de paleta de color | Canvas 2D · función pura del tiempo |
| [`particle-visualizer`](apps/particle-visualizer) | Partículas con fuerzas y ruido | Canvas 2D · simulación con estado |

```bash
npm install          # instala los tres workspaces (un solo lockfile)

npm run dev:plane    # localhost:5175
npm run dev:palette  # localhost:5174
npm run dev:particle # localhost:5173

npm test             # engine de plane-animator, sin browser
npm run build        # construye los tres
npm run build:site   # ensambla dist/ con la landing y los tres subpaths
```

---

## Por qué están juntas

Son **una familia de producto**: mismo usuario, mismo canvas de lado menor 1080,
los mismos cuatro ratios de salida y la misma necesidad de exportar un loop que
cierre. Hoy esa decisión está tomada tres veces por separado:

| Concepto | particle | palette | plane |
|---|---|---|---|
| Tabla de ratios (lado menor 1080) | `aspectRatios.js` | `stageDims()` | `camera.js` |
| Presets en localStorage | `amt-presets` | `palette-animator:presets` | `plane-animator:presets` |
| Export de video | `useRecorder.js` (tiempo real) | `exporters.js` | `exporters.js` (WebCodecs) |

**No son una familia de motor**, y esa distinción es la que manda en cómo se
comparte código. `palette` y `plane` son funciones puras del tiempo:
`f(t) → frame`, con scrub exacto y export determinístico. `particle` es una
simulación con estado — las partículas acumulan velocidad, no se puede saltar a
un `t` arbitrario — y por eso su recorder graba en tiempo real.

Conclusión práctica: **se comparte el chasis, no el motor.**

---

## `packages/ui` — el chasis

Primer paquete compartido: tema, controles y navegación. Las tres tools lo
consumen, así que un arreglo en un control las arregla a las tres.

**`ScrubField`** es el campo numérico de la plataforma. Label y valor van adentro
de la misma píldora, el fondo se llena como un nivel y una perilla marca el
valor. Se arrastra desde **cualquier punto** del control:

| Gesto | Qué hace |
|---|---|
| Arrastrar | Recorrer el ancho del control = el rango entero |
| `Shift` + arrastrar | 5× más fino |
| Doble click | Escribir el número a mano |
| `←` `→` | Un step (`Shift` = 10) |

El arrastre es **relativo**, no absoluto: agarrar en un costado no debe pegar un
salto al valor de ese punto, y así se afina sin tener que apuntarle a un thumb de
13px. Es el gesto de los campos numéricos de After Effects o Figma, y es lo que
justifica el cursor `ew-resize` en toda la superficie.

La perilla es el único verde de marca del control. El borde se queda en gris
incluso al arrastrar: dos señales verdes a la vez ensucian el micro-highlight.

**`ToolSidebar`** es la barra de la izquierda. Los motores son apps distintas, así
que cambiar de tool recarga la página; la barra es lo que las hace sentir una
sola plataforma igual. En dev apunta a los puertos, en producción a los subpaths.

---

## Hacia dónde va

Queda por extraer, en este orden y sin tocar los motores:

1. **`core/export`** — el exporter con WebCodecs de `plane-animator`, que fija el
   timestamp de cada frame y garantiza 30 o 60 fps exactos. Es el que más rinde:
   `particle` todavía graba en tiempo real y hereda todos los problemas de
   framerate que eso trae. La interfaz ya es agnóstica del renderer (recibe
   `draw(t01)`).
2. **`core/canvas`** — tabla de ratios, dims del stage, safe areas, safe frames.
   Una sola definición de "lado menor 1080".
3. **`core/storage`** — persistencia de state, presets con nombre, import/export
   JSON, con un esquema de claves consistente.

Cada paso se puede parar sin dejar nada a medias. Lo que **no** conviene unificar
es `engine/`: los motores son distintos por naturaleza y forzarlos a una
abstracción común sólo agrega indirección.

### El norte de más largo plazo

Una paleta de color es un plano con textura sólida. Eventualmente
`palette-animator` puede ser **una familia de templates dentro de
`plane-animator`**, no una app hermana (ver `apps/plane-animator/BRIEF.md` §13).
El material ya está diseñado como `plane.fill = { type: 'image' | 'color' |
'text' }` con sólo `'image'` implementado, así que la puerta está abierta sin
costo. No es tarea de ahora.

---

## Historia

`particle-visualizer` y `palette-animator` vivían en el mismo repo —el primero en
la raíz, el segundo anidado— con un nombre que sólo mencionaba a uno de los dos.
Los dos repos originales se absorbieron con `git subtree`, así que el historial
de cada tool está completo acá. Los repos viejos quedan como están y se pueden
archivar.
