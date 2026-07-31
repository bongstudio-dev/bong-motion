# Bong Motion

Familia de herramientas internas de Bong Studio para generar piezas animadas en
loop. Monorepo con npm workspaces; cada tool se despliega en su subpath de
GitHub Pages.

| Tool | Qué hace | Motor |
|---|---|---|
| [`plane-animator`](apps/plane-animator) | Posts a partir de varias imágenes en el espacio 3D | WebGL · función pura del tiempo |
| [`palette-animator`](apps/palette-animator) | Loops de paleta de color | Canvas 2D · función pura del tiempo |
| [`particle-visualizer`](apps/particle-visualizer) | Partículas con fuerzas y ruido, con emisor dirigible por webcam | Canvas 2D · simulación con estado |

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

**Capas de texto** (`src/text/`) son la excepción a "se comparte el chasis, no el
motor": acá se comparte también el dibujo. El modelo y el rasterizado viven en
`@bong/ui/text` —un subpath sin JSX, para que los tests que corren en Node crudo
lo puedan importar— y las tres tools lo llaman desde su único camino de dibujo,
así el texto sale idéntico en las tres y entra en el export sin caminos aparte.
El plane-animator, que renderiza en WebGL, rasteriza a un canvas 2D y lo sube
como textura de un quad ortográfico: el archivo sigue saliendo del mismo canvas
que se previsualiza.

En el sidebar la sección **Texto** sólo crea, ordena y prende/apaga capas. Los
once atributos tipográficos se desacoplan en una **ventana flotante**: no entran
en una columna de 360px que ya tiene seis secciones, y flotando se pueden ajustar
mirando la pieza en vez de la lista. Cada capa elige su ranura de profundidad
—**Frente / Medio / Fondo**— y `Fondo` va debajo del contenido de la tool
(los planos, las cards, las partículas) y encima del color de fondo.

El texto también se **arrastra sobre el stage** (`Shift` fija el eje), y agarrarlo
lo selecciona. Lo que mueve el arrastre es el offset, no el ancla: el ancla sigue
decidiendo de dónde cuelga el bloque al cambiar de ratio. El recuadro que se
agarra sale del mismo `layout()` que dibuja el texto — con dos cuentas separadas,
la caja y las letras se despegan.

---

## Librería de presets en `plane-animator`

La biblioteca es **su propia columna**, entre el rail y el stage. El orden de la
interfaz sigue el orden de las decisiones: el rail elige la herramienta, la
biblioteca elige qué animación, y el sidebar de la derecha la ajusta. Tenerla
adentro del panel de params mezclaba el segundo paso con el tercero y los hacía
competir por el mismo espacio.

Adentro: tabs **Templates / Custom**, buscador, y un navegador de dos niveles —
las familias (los cinco templates) abren sus variantes, cada una con una
miniatura que muestra el movimiento real.

Las miniaturas salen del **mismo `getScene()`** que el stage, así que no hay una
animación de ejemplo que pueda quedar desincronizada del engine. Lo único que se
simplifica es el dibujo: rectángulos planos en vez de texturas, y el giro se
sugiere con escorzo (`cos` del ángulo) en lugar de proyectar los cuatro
vértices. Todas comparten **un solo `requestAnimationFrame`** a 24fps — con
cinco familias abiertas serían veinte loops peleando con el render del stage.

Un preset guarda la receta de movimiento: template + params + timing + fov +
encuadre. **No** guarda ratio, fondo ni las guías: el formato de salida y las
ayudas de trabajo son del usuario. El `fov` sí entra porque cambia el look de
forma dramática — un orbit de radio grande con fov 45 deja todo fuera de cuadro
y con fov 90 se convierte en un túnel.

`npm test` verifica los 18 presets: que no haya params inventados (un typo se
tragaría el valor en silencio y el preset se vería como el default), que quede
algún plano en cuadro, y que exista un número de ciclos que cierre el loop.

---

## Hand-tracking en `particle-visualizer`

El emisor de partículas se puede manejar con la punta del índice por webcam, y
el video de la cámara puede ir de fondo. Dos interruptores separados en el panel
**Cámara**: se puede trackear la mano sobre fondo negro, sin que salga tu cara
en el render.

Decisiones que no son obvias:

- **El video se dibuja DENTRO del canvas**, no como un `<video>` detrás. La
  grabación sale de `canvas.captureStream()`, así que un elemento DOM no
  entraría al MP4 y el archivo no se parecería al preview.
- **La posición de la mano no pasa por el state de React** ni por `config`. Va a
  `ParticleSystem.setEmitterOverride()`, que vive aparte: `updateConfig` mergea
  el config entero en cada cambio, así que si la mano viviera ahí, mover
  cualquier slider la pisaría con la posición vieja.
- **Ningún interruptor que encienda la cámara se persiste** (están en
  `RUNTIME_KEYS`). Abrir la tool nunca puede disparar el prompt de permisos por
  su cuenta, ni siquiera cargando un preset marcado como default.
- **La cámara se suelta al ocultar la pestaña** y se reconecta al volver.
- **El WASM y el modelo se sirven locales**, no por CDN: el WASM se copia desde
  `node_modules` en `predev`/`prebuild` (no está en git) y el modelo `.task` sí
  está versionado. La feature anda sin internet.
- Se pide la cámara en **4:3** a propósito: con 16:9 en un stage 9:16 sólo
  sobrevive el 32% del encuadre al recortar, y hay que sacar la mano casi de
  cuadro para llegar al borde. Con 4:3 sube a 42%.

Se usa `@mediapipe/tasks-vision` con versión **pineada exacta**: publican
nightlies a diario y el JS del paquete tiene que parear con el WASM.

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
