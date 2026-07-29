# Plane Animator — Bong Studio

Herramienta interna para armar **posts animados en loop a partir de varias imágenes**
(JPG/PNG, típicamente 1080×1350) dispuestas en el espacio 3D. Preview y export salen del
mismo render → WYSIWYG garantizado.

Proyecto **independiente**. Es un fork conceptual del `palette-animator`, pero **no comparte
código**: los archivos reciclados se copian, no se importan. Ver `LINEAGE.md`.

---

## 1. Stack

- **React 19 + Vite**, CSS puro (sin librerías de UI), dark theme.
- **Three.js** — WebGL2. Cámara perspectiva, un `PlaneGeometry` texturizado por imagen.
- Motor de timing propio. **Sin GSAP, sin Framer Motion, sin librería de animación.**
- `requestAnimationFrame` como clock. **MediaRecorder** + **gif.js** para export.
- **Satoshi** como única tipografía (Fontshare, cae al system stack).

El engine es una **función pura del tiempo**. Eso es lo que hace exactos el scrub y el export.

---

## 2. Invariantes (no negociables)

1. **Pureza.** `getScene(t01, state)` → mismo input, mismo output, siempre. Sin `Date.now()`,
   sin estado mutable, sin random no-seedeado dentro del engine.
2. **Un solo renderer.** Preview y export llaman la misma función de dibujo. Si hay dos
   caminos de render, el export miente.
3. **Export determinístico.** Durante la grabación se avanza `t` **por frame**, nunca por
   reloj. El archivo no puede depender del rendimiento de la máquina.
4. **El loop cierra.** `getScene(0)` debe ser visualmente idéntico a `getScene(0.9999)`.
   Ver §7, que tiene una vuelta de tuerca respecto del palette animator.
5. **Los planos no rompen el encuadre por accidente.** Los templates animan posiciones
   relativas al stage, no coordenadas absolutas hardcodeadas.

---

## 3. Arquitectura

Tres capas puras en `src/engine/`, en este orden:

```
1. TEMPLATES   templates.js  → place(t01, i, N, params, timing, ease, geom) → plano en 3D
2. CÁMARA      camera.js     → cámara derivada del ratio + fov
3. COMPOSITOR  getScene.js   → resuelve templates, ordena por profundidad, asigna assets
```

### El contrato

```js
getScene(t01, state) → {
  camera: { fov, position: [x, y, z], lookAt: [x, y, z] },
  planes: [{
    id,             // estable entre frames
    assetIndex,     // índice en state.assets — cuál imagen va en este plano
    pos:    [x, y, z],   // unidades = px lógicos del stage
    rot:    [rx, ry, rz], // radianes
    size:   [w, h],      // px lógicos
    opacity,             // 0..1
    radius,              // px, corner radius
    renderOrder,         // derivado de z — ver §5 sobre transparencia
  }]
}
```

`t01 ∈ [0,1)` = un ciclo del loop. Preview, scrub y export consumen esta misma función.

### Sistema de coordenadas

**Unidad de mundo = 1 px lógico del stage.** El lado menor del stage es 1080, igual que en
el palette animator. La cámara se posiciona para que la altura visible en `z = 0` sea
exactamente `stage.h`:

```js
camera.aspect = stage.w / stage.h;
camera.position.z = (stage.h / 2) / Math.tan((fov * Math.PI) / 360);
```

Así un `Plane Size` de 600 significa 600px sobre un stage de 1080 y los números del panel
son legibles. Los templates piensan en px, no en unidades abstractas de Three.

**Los tamaños se miden contra el lado menor, no contra la altura.** Por construcción el lado
menor siempre es 1080 (en 16:9 es la altura; en el resto, el ancho). Si `planeSize` se
midiera contra `stage.h`, un plano de 600 ocuparía 55% del alto en 16:9 y 31% en 9:16 — la
composición se rompería al cambiar de ratio. Regla:

```js
const SHORT = 1080;                       // invariante en los cuatro ratios
const planePx = params.planeSize;         // ya expresado sobre SHORT
```

Todos los params de tamaño y distancia (`planeSize`, `gap`, `radius`, `offsetX/Y`) siguen
esta convención. Los templates deben verse **compuestos igual** en los cuatro ratios; lo que
cambia es cuánto se ve alrededor.

### Separación template ↔ timing

**Deliberadamente distinto del palette animator.** Ahí todo vivía en `motion.params` y eso
obliga a reescribir cada preset cuando cambia el modelo de timing. Acá:

- `state.timing` — **global**: `duration`, `cycles`, `stagger`, `delay`, `direction`, `ease`.
- `state.template.params` — **del template**: `count`, `planeSize`, `gap`, `tilt`, `fade`,
  `scaleCenter`, `offsetX/Y`, etc.

El compositor aplica el stagger antes de llamar al template:

```js
const tLocal = mod1(t01 - i * timing.stagger - timing.delay);
```

El template recibe su `t` ya desfasado y no sabe nada de stagger. Eso mantiene los
templates cortos.

---

## 4. Templates del MVP

Cada template exporta un `schema` y **la UI se dibuja sola** a partir de él (mismo patrón que
el palette animator — es lo mejor que tiene y se conserva tal cual).

```js
{
  id: 'carousel',
  name: 'Carousel',
  params: { count: 6, planeSize: 600, gap: 40, tilt: 'off', fade: 0, ... },
  schema: [
    { key: 'count',     label: 'Cantidad',  min: 2, max: 20, step: 1 },
    { key: 'planeSize', label: 'Tamaño',    min: 100, max: 1400, step: 10 },
    { key: 'tilt',      label: 'Tilt',      options: ['off','fan','uniform','alternate'] },
    ...
  ],
  place(t, i, N, params, timing, ease, geom) { ... }
}
```

### Tier 1 — profundidad, planos de frente a cámara

**`carousel`** — Planos en fila sobre un eje, desplazándose en loop.
Params: `direction` (up/down/left/right), `count`, `planeSize`, `gap`, `cornerRadius`,
`offsetX`, `offsetY`, `fade` (opacidad en los bordes), `scaleCenter` (el del centro crece),
`tilt` (off/fan/uniform/alternate), `solo`.
Este es el template de referencia — implementarlo primero y completo.

**`deck`** — Mazo apilado en Z. El de adelante sale (hacia cámara + fade) y el resto avanza
un lugar. Params: `count`, `planeSize`, `depthGap`, `offsetStep`, `rotJitter`, `exitDistance`.

**`parallax`** — Capas a distintas profundidades desplazándose a velocidades distintas.
Params: `count`, `planeSize`, `depthSpread`, `speedFalloff`, `direction`.

### Tier 2 — rotación real del plano

**`orbit`** — Planos distribuidos en círculo alrededor del eje Y, el conjunto rota.
Params: `count`, `radius`, `planeSize`, `facing` (billboard / hacia afuera / hacia el eje),
`tiltX`, `yWobble`.
Con `facing: 'outward'` es donde se paga el WebGL: los planos de atrás se ven en
perspectiva real.

**`flip`** — Cada plano rota 180° sobre X o Y y revela la imagen siguiente.
Params: `axis` (x/y), `count`, `layout` (single/grid), `planeSize`, `gap`, `backAsset`
(mismo asset espejado / asset siguiente).
Requiere `side: THREE.DoubleSide` y manejar la cara trasera — ver §5.

### Fuera del MVP (documentar como v2, no implementar)

Stack, Grid, Marquee, Scale, Wipe, Flicker, Frames, Stories, Field, Gravity, Proximity,
Carousel 3D, Wheel, Spin, Globe, Spiral, Tour, Magazine.

---

## 5. Render — detalles que hay que hacer bien de entrada

Estos cuatro puntos son los que arruinan el resultado si se descubren tarde:

### Color space
```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
texture.colorSpace = THREE.SRGBColorSpace;
```
Sin esto los JPG salen lavados o apagados. Innegociable en una tool de branding.

### Mipmaps y anisotropía
Los planos escalan mucho hacia abajo (carousel, orbit). Sin mipmaps aliasea feo:
```js
texture.generateMipmaps = true;
texture.minFilter = THREE.LinearMipmapLinearFilter;
texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
```

### Material: ShaderMaterial propio, no MeshBasicMaterial
Un solo shader resuelve todo y evita clonar texturas por plano:
- **Crop** vía uniform `uCrop = [scaleX, scaleY, offsetX, offsetY]` — por plano, no por
  textura, así una misma imagen puede aparecer con distinto encuadre en dos planos.
- **Corner radius** con un SDF de rounded box sobre la UV. Crocante y sin geometría extra.
- **Opacity** como uniform.

Cálculo del cover (base; ver §6.5 para los otros modos):
```js
const planeAspect = w / h;
const imgAspect = tex.image.width / tex.image.height;
if (imgAspect > planeAspect) { sx = planeAspect / imgAspect; sy = 1; }
else                         { sx = 1; sy = imgAspect / planeAspect; }
// offset = (1 - s) / 2 + focal   ← focal = punto de interés del asset, −0.5..0.5
```

### Transparencia y orden de dibujo
Planos con opacidad < 1 y depth testing se pelean. Regla:
```js
material.transparent = true;
material.depthWrite  = false;
mesh.renderOrder = -pos[2];   // más lejos primero
```
El compositor ya devuelve `renderOrder`; el renderer solo lo aplica.

### Flip y cara trasera
`side: THREE.DoubleSide`. En el fragment shader, si `!gl_FrontFacing`, o espejás `uv.x` o
samplés otra textura según `backAsset`.

---

## 6. Assets

Problema que el palette animator no tenía. Cuatro decisiones ya tomadas:

1. **Carga.** Drag & drop múltiple + file picker. Lista ordenable (drag to reorder), toggle
   de visibilidad por asset, botón de borrar, "Clear all".
2. **Pipeline.** `File` → `createImageBitmap()` → `THREE.Texture`. Subir a GPU **una sola vez**
   y reusar la textura entre planos (el crop va por uniform, no por textura clonada).
3. **Persistencia.** `localStorage` no aguanta imágenes. **MVP: no se persisten** — se
   recargan por sesión. El `state` (template, params, timing, canvas) sí persiste en
   localStorage, con el mismo merge defensivo del palette animator. IndexedDB queda para v2.
4. **Asignación plano → asset.** `assetIndex = (i + Math.floor(advance)) % M`, donde `M` es la
   cantidad de assets visibles. Si `M < count`, se repiten cíclicamente. Si `M === 0`, dibujar
   placeholders grises numerados (la tool tiene que ser usable antes de cargar nada).

**Resolución de export:** un source de 1080px exportado a 2× es upscale. Advertirlo en el
panel de Export cuando `resolution === 2` y algún asset mida menos de `stage.h * 2`.

**Downscale en ingesta:** cualquier asset con lado mayor > 2160px se reduce a 2160 antes de
subir a GPU. Un set de 12 imágenes a 4000px son ~700MB de VRAM con mipmaps. Guardar el
original solo si hace falta para export 2×.

### 6.5 — Fuentes de aspect mixto

**Las imágenes no van a ser todas 4:5.** El plano y la imagen tienen aspects independientes y
hay que resolver el desajuste explícitamente. Tres modos, seleccionables **globalmente** con
override **por asset**:

| Modo | Qué hace | Cuándo |
|---|---|---|
| `cover` *(default)* | Llena el plano, recorta el excedente. | Fotos, texturas, sets homogéneos. |
| `contain` | Entra completa, sobra fondo (color configurable). | Logos, lockups, piezas que no se pueden cortar. |
| `fitToAsset` | **El plano toma el aspect de la imagen.** No hay recorte ni sobra. | Sets mixtos retrato/paisaje donde recortar arruina la pieza. |

**`fitToAsset` tiene consecuencias en la geometría** y por eso se decide ahora, no después:

1. Los planos dejan de tener el mismo tamaño. `planeSize` pasa a ser el **lado mayor** (o el
   área, según template) y el otro lado se deriva del aspect del asset.
2. El espaciado de `carousel` y `orbit` no puede asumir paso fijo. Los templates que soporten
   `fitToAsset` calculan las posiciones por **acumulación** (`pos += sizePrevio/2 + gap +
   sizeActual/2`), no por multiplicación (`pos = i * step`).
3. **Cuando los assets rotan entre planos, el tamaño del plano cambia.** Si un slot pasa de
   tener una horizontal a una vertical, el plano cambia de forma a mitad del loop. Dos salidas:
   interpolar el tamaño con el mismo ease del movimiento (queda bien, es lo que se recomienda),
   o congelar el tamaño del slot al del primer asset que le tocó (más rígido pero predecible).
   **Default: interpolar.** Param `fitTransition: 'morph' | 'lock'`.
4. Los templates que **no** soporten `fitToAsset` lo declaran en su definición
   (`supportsFitToAsset: false`) y la UI deshabilita la opción con un tooltip. `flip` es el
   caso obvio: una cara vertical y una horizontal en el mismo plano no cierran.

**Focal point por asset.** En `cover`, qué parte se recorta importa. Cada asset lleva
`focal: [x, y]` en −0.5..0.5 (default `[0,0]` = centrado), editable arrastrando sobre el
thumbnail en el panel de Assets. Va directo al `offset` del uniform `uCrop`.

**Nota:** el thumbnail del panel de Assets muestra el aspect real de la imagen, no un cuadrado
recortado. Es la única forma de darse cuenta de que el set es mixto antes de exportar.

---

## 7. Contrato del loop (con imágenes cambia)

En el palette animator alcanzaba con `getFrame(0) ≈ getFrame(0.9999)`. Con assets rotando
hay un caso nuevo: un carousel que avanza **un slot por ciclo** tiene movimiento continuo,
pero el frame final **no** es igual al inicial — cada slot quedó con la imagen del siguiente.

Regla:

> El loop cierra si y solo si el avance total de slots durante la grabación es múltiplo de
> la cantidad de assets visibles: `(cycles × slotsPerCycle) % assetCount === 0`.

Implementación:
- `src/engine/loopTest.js` compara `getScene(0)` vs `getScene(0.9999)` **incluyendo
  `assetIndex`**, ponderando por opacidad (un plano fuera de cuadro con opacidad ~0 no cuenta).
- El badge del stage muestra tres estados: `loop ✓ cierra` / `loop ✓ (× N ciclos)` con el
  N mínimo que cierra / `loop ✗`.
- En el panel de Export, si `cycles` no cierra, sugerir el valor más cercano que sí.

---

## 8. Canvas

- **Aspect ratios:** 1:1 (1080²) · 4:5 (1080×1350) · 9:16 (1080×1920) · 16:9 (1920×1080)
  · **custom** (input libre W:H, lado menor normalizado a 1080). Default **4:5**.
- **Stitch:** transición animada del rect del stage entre ratios (duración + ease propios).
  Como el layout es relativo, los planos se reacomodan solos. Se puede apagar.
- **Safe-frame multi-ratio:** overlay opcional que dibuja el recorte de los otros ratios sobre
  el actual. Sirve para componer una sola vez algo que va a salir en feed y en stories.
- **Background:** color sólido. (Gradiente e imagen: v2.)
- **Safe area:** overlay on/off con los márgenes de Instagram. Solo guía visual, nunca se
  exporta.
- **FPS:** 30 / 60.

---

## 9. Export

Todo desde `getScene(t)`, en modo determinístico.

```js
exportVideo(state, { fps, cycles, resolution, container, onProgress, draw })
```

El exporter recibe un callback `draw(t01)` — **no** importa el engine directamente. Así el
mismo exporter sirve si mañana cambia el renderer.

- **WebM / MP4** — `canvas.captureStream(0)` + `MediaRecorder` con `requestFrame()` manual.
  MP4 si el browser lo soporta; si no cae a WebM y avisa.
- **GIF** — gif.js (import dinámico + worker).
- **PNG** — frame actual.

**Export por lote multi-ratio.** El panel permite tildar varios ratios y exportar todos en una
corrida: por cada ratio se rearma la cámara, se re-renderiza el ciclo completo y se descarga
un archivo aparte (`nombre_4x5.mp4`, `nombre_9x16.mp4`, …). Es la razón principal por la que
el ratio es estado y no un hardcodeo: una pieza compuesta una vez sale para feed, stories y
YouTube sin volver a tocar nada. Barra de progreso con dos niveles (ratio N de M, frame X
de Y).

En WebGL, para que `captureStream` y `toBlob` sean confiables:
```js
new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias: true });
renderer.setPixelRatio(resolution);
```

Advertir en UI: mantener la pestaña en foreground durante el export de video (los browsers
throttlean timers en background).

---

## 10. UI

Layout idéntico al palette animator: stage a la izquierda, sidebar de paneles a la derecha,
transport abajo. Dark theme, CSS puro, Satoshi.

Paneles, en orden:
1. **Assets** — drop zone, lista ordenable, visibilidad, clear all.
2. **Escena** — selector de template + params (renderizados desde el `schema`).
3. **Timing** — duration, cycles, stagger, delay, direction.
4. **Easing** — grid de presets + editor de curva bezier arrastrable (dos handles).
5. **Canvas** — ratio, fps, background, safe area.
6. **Export** — formato, resolución, ciclos, + import/export del state en JSON.

**Transport:** play/pausa (barra espaciadora), scrub del ciclo, duration, badge de loop.

**"Guardar como custom":** serializa `{ template, params, timing, ease }` a un preset con
nombre, guardado en localStorage. Sin esto la tool no se usa dos veces.

---

## 11. Fases

Cada fase termina con algo que se puede abrir y mirar.

| # | Entrega | Hecho cuando |
|---|---|---|
| 0 | Scaffold Vite + React + Three. Stage con cámara, un plano gris centrado. | Se ve un plano y responde al resize. |
| 1 | `getScene` + `carousel` completo + clock + scrub + loop test. Assets hardcodeados. | El carousel loopea y el badge dice que cierra. |
| 2 | Panel de Assets real: drop, orden, visibilidad, placeholders, modos `cover`/`contain` + focal point. | Se arrastran 8 JPG de aspects distintos y ninguno se ve mal por default. |
| 3 | `deck` + `parallax` + `orbit` + `flip`, todos schema-driven. | Cambiar de template no rompe nada y la UI se redibuja sola. |
| 4 | Timing global + editor de easing. | Stagger y ease afectan a todos los templates igual. |
| 5 | Canvas: ratios (incl. custom), stitch, safe area, background. | 4:5 → 9:16 con stitch, y la composición se ve equivalente en los cuatro. |
| 6 | Export (webm/mp4/gif/png) + lote multi-ratio + presets custom + JSON. | Una pieza sale en 4:5 y 9:16 de una corrida, y loopea sin salto. |
| 7 | `fitToAsset` + espaciado por acumulación + `fitTransition`. | Un carousel con verticales y horizontales mezcladas se ve bien sin recortar nada. |

---

## 12. Qué NO hacer

- No agregar GSAP, Framer Motion, ni ninguna librería de animación. El engine es la tool.
- No usar CSS 3D transforms para el stage. No se puede capturar y rompe el WYSIWYG.
- No implementar los 18 templates de la lista v2. Terminar 5 bien antes que 20 a medias.
- No meter audio, logo overlay ni capa de texto en el MVP.
- No compartir código con `palette-animator` vía imports o symlinks. Copiar y anotar.

---

## 13. Norte a largo plazo (contexto, no tarea)

Una paleta de color es un plano con textura sólida. Eventualmente el `palette-animator`
puede ser **una familia de templates dentro de esta tool**, no una app hermana.

No perseguirlo ahora. Pero diseñar el material como `plane.fill = { type: 'image' | 'color' |
'text', ... }` desde el día uno — hoy solo se implementa `'image'`, y la puerta queda abierta
sin costo.
