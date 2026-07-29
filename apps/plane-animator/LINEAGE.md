# Linaje — de dónde viene este proyecto

Fork conceptual de **`palette-animator`** (Bong Studio). Decisión explícita: **fork limpio,
sin código compartido**. Los archivos de abajo se **copiaron**, no se importan.

Consecuencia asumida: van a divergir. Está bien. Si arreglás un bug en uno, fijate si aplica
en el otro — nadie lo va a hacer automáticamente.

## Copiado tal cual

| Archivo | Nota |
|---|---|
| `src/engine/ease.js` | Bezier cúbica propia (Newton-Raphson + bisección) + 13 presets. Sin cambios. |
| `src/clock.js` | Play/pausa/scrub. Agnóstico del renderer. Sin cambios. |
| `src/state/storage.js` | localStorage + import/export JSON + `triggerDownload`. Sin cambios. |
| `src/utils/math.js` | `clamp`, `lerp`, `mod1`, `triangle`, `circularDist`. **+ `frac`, `mod`, `hash01`, `gcd`, `lcm`** para la cinta de assets y el §7. |
| `src/styles.css` | Dark theme, Satoshi. Nombres de paneles ajustados + bloque nuevo al final (assets, overlays, toggle, color). |
| `src/components/ui/controls.jsx` | Slider, segmented, number, color. **+ `Toggle`, `ColorInput`, iconos `Eye`/`EyeOff`.** |
| `src/components/Transport.jsx` | Adaptar: el badge de loop ahora tiene 3 estados (ver BRIEF §7). |
| `src/components/panels/EasePanel.jsx` | Editor de curva. Sin cambios. |

## Copiado y adaptado

| Archivo | Qué cambia |
|---|---|
| `src/state/defaults.js` | Modelo nuevo: `assets`, `template`, `timing` separado de params. Se conserva el patrón `mergeState` defensivo. |
| `src/export/exporters.js` | Refactor: recibe un callback `draw(t01)` en vez de importar `getFrame`/`renderFrame`. Canvas WebGL en vez de 2D. Camino nuevo con **WebCodecs** para que el framerate salga exacto; MediaRecorder queda de fallback. |
| `src/engine/loopTest.js` | Compara también `assetIndex` (BRIEF §7), empareja los planos **por posición** en vez de por id, y pondera la visibilidad por escorzo. Ver README. |

## Reescrito de cero

| Archivo del original | Reemplazo | Por qué |
|---|---|---|
| `src/engine/getFrame.js` | `src/engine/getScene.js` | Devuelve planos en 3D (`pos`, `rot`, `size`), no rects alineados al eje. |
| `src/engine/layout.js` | `src/engine/camera.js` | El modelo `weights → rects` no aplica; los templates ubican en el espacio. |
| `src/engine/presets.js` | `src/engine/templates.js` | Se conserva el **patrón** (schema declarativo que genera la UI solo), no el contenido. |
| `src/render/renderFrame.js` | `src/render/renderer.js` | Canvas 2D → Three.js/WebGL. |

## El motivo del fork

El engine original es 2D-nativo: `getFrame` devuelve `{x, y, w, h, rotate}` — rects alineados
al eje con una sola rotación en Z. Canvas 2D solo hace transforms **afines**, así que una
imagen rotada en X o Y sale cizallada, no en perspectiva.

Los templates que justifican esta tool (Orbit, Flip, y toda la familia Tier 2) necesitan
**proyección en perspectiva real**. Eso es un segundo renderer, no un preset más.

Lo que sí sobrevive intacto es lo mejor del original y no tiene nada de 2D: la **pureza del
engine** (`f(t) → frame`), el **contrato de loop** verificado en vivo, el **export
determinístico** desde la misma función que el preview, y el **schema declarativo** que hace
que agregar un template no requiera tocar la UI.
