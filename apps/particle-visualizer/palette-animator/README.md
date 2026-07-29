# Palette Animator — Bong Studio

Herramienta interna para generar **loops animados de paletas de color** (casos de estudio, manuales de marca, redes). Preview y export salen del mismo canvas → WYSIWYG garantizado.

Subproyecto aislado dentro del repo `animacion-manual-tool`, independiente del *Brand Manual Particle Visualizer* de la raíz. No comparten stack ni build.

## Correr

```bash
cd palette-animator
npm install
npm run dev      # http://localhost:5174
npm run build
```

## Stack

- **React 19 + Vite**, CSS puro (sin librerías de UI), dark theme.
- **Satoshi** como única tipografía (cargada desde Fontshare; cae al system stack si no hay red).
- **Canvas 2D** para el stage. Motor de timing propio — sin Framer Motion ni GSAP.
- `requestAnimationFrame` como clock. **MediaRecorder** + **gif.js** para export.

Sin librería de animación a propósito: el engine es una **función pura del tiempo**, y eso es lo que hace exactos el scrub y el export.

## Arquitectura

Tres capas puras (`src/engine/`), en orden:

```
1. MOTION TRACKS   presets.js  → track(t01, i, N, params, ease) → deltas por card
2. LAYOUT ENGINE   layout.js   → layout(weights, mode, stage) → [{x,y,w,h}] en px lógicos
3. COMPOSITOR      getFrame.js → rect de layout + deltas = rect real; ordena por z
```

La firma que importa:

```js
getFrame(t01, state) → [{ id, x, y, w, h, hex, name, opacity, rotate, z }]
```

`t01 ∈ [0,1)` = un ciclo del loop. Preview, scrub y export consumen esta misma función.
El renderer (`src/render/renderFrame.js`) es el único, compartido por preview y export.

**Track y layout son independientes**: un preset describe movimiento, no posición.
Por eso *cascade sobre grid* o *scale sobre row* salen gratis (elegís el layout aparte
del preset). Stack y Swap no rompen ese desacople: el track emite `collapse` (apilar al
centro) y `slotA/slotB/slotBlend` (reordenar entre slots), y el compositor hace la
geometría contra el layout activo.

### Contrato del loop

`getFrame(0)` debe ser idéntico a `getFrame(1)`. `src/engine/loopTest.js` compara
`getFrame(0)` vs `getFrame(0.9999)` ponderando por opacidad (un teletransporte fuera de
cuadro con opacidad ~0 no cuenta). El resultado se muestra en vivo en el badge del stage
(`loop ✓ cierra`).

## Presets (6, todos loops cerrados)

`expand` · `wave` · `cascade` · `scale` · `stack` · `swap`
— definidos en `src/engine/presets.js` con su schema de params (la UI los renderiza sola).

**Cascade** es un conveyor vertical tipo waterfall: la card de arriba es la más
grande y cada una debajo decrece por un factor geométrico (`sizeDecay`, alto y ancho
juntos según `taper`), ancladas a la izquierda. Al pasar el turno, la de arriba se
encoge y se desliza hacia arriba hasta salir de cuadro mientras la de abajo crece y
la cola sube un lugar (una card nueva entra diminuta por abajo). No encaja en el
modelo genérico `weight→layout`, así que define `place(t, i, N, params, ease, geom)`
— un placer dedicado al que `getFrame` le pasa la caja interior y que ubica cada card
directo. Es la vía de escape para presets con geometría propia.

## Layout

`row` · `column` · `grid` · `stack`. Stage lógico con 1080 en el lado menor.
Grid con columnas según ratio (landscape → filas cortas; 9:16 → 2 columnas; 1:1 → cuadrado).
Con N impar, la última card ocupa el sobrante. Regla dura: las cards nunca desbordan
(los tracks animan `weight`, no anchos absolutos).

## Aspect ratios

1:1 (1080²) · 4:5 (1080×1350) · 16:9 (1920×1080) · 9:16 (1080×1920).
El **stitch** anima el rect del stage entre ratios (config en el panel Ease); como el
layout es relativo, las cards se reacomodan solas. Se puede apagar (cambio instantáneo).

## Export

Todo desde el mismo `getFrame(t)`, en modo determinístico (se avanza `t` por frame, no
por reloj → el archivo no depende del rendimiento de la máquina).

- **WebM / MP4** — `captureStream(0)` + `MediaRecorder` con `requestFrame()` manual.
  MP4 si el browser lo soporta; si no, cae a WebM y avisa.
- **GIF** — gif.js (import dinámico + worker).
- **PNG** — frame actual.

Controles: fps (30/60), ciclos a grabar, resolución (1× = 1080, 2× = 4K).

> Nota: mantené la pestaña en foreground durante el export de video. Si queda en segundo
> plano, el browser throttlea los timers y la grabación va más lenta (el contenido sigue
> siendo correcto).

## Labels y tipografía

Contenido (nombre/hex/ambos), visibilidad (siempre/activa/nunca), contraste
automático por luminancia, rotación a vertical en cards altas, y opacidad
enganchable al peso/escala. La **tipografía es configurable** (panel Texto):
familia elegible de una lista de fuentes del sistema + Satoshi, campo custom para
tipear cualquier familia instalada, y peso (Regular/Medium/Bold/Black). El canvas
usa `labels.fontFamily` con fallback; si la familia no existe cae al stack del
sistema.

## Persistencia

`localStorage` (estado + paletas guardadas) + import/export JSON (panel Export).
`src/state/defaults.js` define el modelo y hace un merge defensivo al cargar.

## Estructura

```
src/
  engine/    ease.js · layout.js · presets.js · getFrame.js · loopTest.js
  render/    renderFrame.js
  export/    exporters.js
  state/     defaults.js · storage.js
  utils/     math.js · color.js
  components/ Stage · Transport · ui/controls · panels/{Palette,Motion,Ease,Text,Export}
  clock.js · App.jsx · main.jsx · styles.css
```
