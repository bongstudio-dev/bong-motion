# Floss Tween - spec

Editor web de escenas para la animación del logo Floss del caso de estudio. Reemplaza
editar keyframes en After: se trabaja con **escenas** (dónde mira la cámara y con cuánto
zoom), **la curva entre escenas** y **una timeline** donde se estira cuánto dura cada una.

Esta spec es la entrada de cada fase. **Ninguna fase necesita abrir el .aep**: todo lo que
hace falta del After ya está acá o en `fixtures/`.

- Origen: `~/Documents/Bong/WEB/2026/Floss/Caso de Estudio/Editables/Flos log v7 empujes.aep`
  (backup previo en `_backups/`). Comp de salida `Floss Logo 1920x1080` (id 312); dibujo en
  la comp `base` (id 1, 6045x4000). Buscar comps por id, no por nombre.
- Fase 0 (hecha, 19/10/2026): rig relevado, motor en `src/engine.js`, escenas actuales en
  `src/escenas-floss.json`, validado contra After con `npm test`.

## Archivos

| Archivo | Qué es |
|---|---|
| `src/engine.js` | Motor puro, sin DOM. Toda la matemática. No duplicarla en la UI |
| `src/escenas-floss.json` | El documento editable: escenas, eventos, líneas. Es lo que guarda/abre la herramienta |
| `src/geometria-floss.json` | (fase 1) Dibujo del logo y la grilla en unidades de mundo. No se edita en la herramienta |
| `scripts/engine-test.mjs` | Compara el motor contra `fixtures/after-samples.txt`. Corre en CI con `npm test` |
| `scripts/dump.jsx` | Vuelca capas, keys y expresiones de After a `fixtures/rig.txt` y `fixtures/paths.txt` |
| `scripts/sample.jsx` | Muestrea cuadro a cuadro cámara y posiciones en pantalla a `fixtures/after-samples.txt` |
| `fixtures/rig.txt` | Volcado completo del rig (referencia para el exportador) |

Correr un .jsx en After (no hay MCP; `DoScript` siempre devuelve 0, el resultado va a archivo):

```bash
osascript -e 'tell application "Adobe After Effects 2026" to DoScript "$.evalFile(File(\"/ruta/al/script.jsx\"))"'
```

ExtendScript es ES3: sin JSON, forEach ni arrow functions; concatenar arrays o Error con
strings rompe (usar `.toString()`, `e.message`). Envolver todo en try/catch que escriba a
`err.txt`. Para valores sin expresión: `prop.valueAtTime(t, true)` (preExpression).

## Cómo está armado el rig en After

- La comp de salida tiene un null `CONTROL` con cinco controles: **Zoom** (slider),
  **Foco** (punto), **Ajuste F**, **Ajuste S1**, **Ajuste S2** (sliders 0-100).
- `NULL CONTROL` (dentro de `NULL CONTROL 1`) lleva la capa `base` y se mueve/escala por
  expresión a partir de Zoom y Foco. Nadie le pone keys a mano.
- En `base`, todo cuelga de su propio `NULL CONTROL` (escala 242%, posición
  3064.75, 2220.96, anchor 50,50). Sus hijos: el logo (`Floss logo`, 5 grupos, opacidad 35%),
  ~20 líneas de construcción punteadas con Trim Paths, ~36 marcadores cuadrados
  (`Rectangle 1`), los contornos `ORIGINAL F/S1/S2` y las etiquetas `COORD F/S1/S2`.
- `CTRL_DASHES` da ancho de trazo, dash, gap y offset a todo.

## El modelo (lo que implementa `engine.js`)

**Unidades de mundo (U)**: las de las etiquetas COORD y del punto Foco. Un punto `c` del
espacio del NULL CONTROL de base vale `U = c + [303.3, 177.9]`.

**Cámara**: `pantalla = centro + K * zoom * (lado_corto / 1080) * (U - foco)`, con
`K = 0.0065 * 2.42 = 0.01573`. El foco cae siempre en el centro. En 1920x1080 coincide con
After; en vertical (1080x1350, 1080x1920) se ve igual de grande que de alto en horizontal.

**Zoom en escala logarítmica**: entre dos valores, `a * (b/a)^u`. A mitad de camino el zoom
es la media geométrica (así lo hacía la expresión `zs()`); el foco va lineal en `u`.

**Curvas**: `cubic-bezier(x1, y1, x2, y2)` igual que CSS. Una key de After con velocidad 0
e influencias `o` (salida) e `i` (entrada) es `[o/100, 0, 1 - i/100, 1]`. La animación
actual usa casi todo `[1, 0, 0, 1]` (influencia 100/100): tangente vertical en el medio, la
cámara salta en uno o dos cuadros. Es el "empuje" de la v7, es a propósito; el editor debe
poder reproducirlo y también suavizarlo.

**Factor de trazo**: `min(1, 221 / zoom)`. Multiplica, en unidades de mundo, ancho de
trazo, dash, gap, tamaño de marcadores y de etiquetas: por encima de zoom 221 dejan de
crecer en pantalla (un trazo de 1 llega a ~3.5 px y se queda ahí).

**Escenas y tiempo**: cada escena empieza cuando la cámara llega. Dura `parada` segundos
(con `deriva` opcional: un acercamiento lento durante la parada) y después viaja
`transicion.dur` segundos a la siguiente con `transicion.curva`. Los tiempos absolutos
salen de sumar; **nada guarda tiempos absolutos**, así estirar una escena corre todo lo que
viene después.

**Eventos atados a escena**: `{ escena, offset, dur, curva }`, con `offset` en segundos
desde que empieza esa escena (puede ser negativo: arrancar antes de que llegue la cámara).

**Ajuste de letra** (F, S1, S2), de `ajusteEn()`:
- `p` 0..1: la letra pasa de su forma A a su forma B (interpolación lineal de vértices de
  las dos keys del path) y sus marcadores se corren `dx * p` en X.
- `ventana` 0..1: sube en los 0.25 s previos al inicio y baja entre fin+0.2 y fin+0.35.
  Es la opacidad de la etiqueta COORD de esa letra y agranda sus marcadores `1 + 0.35 * ventana`.
- `original` 0..0.85: opacidad del contorno ORIGINAL punteado (sube entre inicio-0.25 e
  inicio-0.05 con smoothstep; baja con el evento `salidaOriginales`).

**Línea** (`lineaEn()`): `entra * (1 - sale)`, cada uno un tramo atado a escena. Se dibuja
del final hacia el principio (en After era Trim Start 100 -> 0).

## Formato de `escenas-floss.json`

```jsonc
{
  "version": 1, "nombre": "...", "fps": 29.97, "fondo": "#003BA4",
  "escenas": [{
    "id": "f", "nombre": "F",
    "foco": [110.35, 105.63], "zoom": 403.4,          // cómo llega la cámara
    "parada": 1.11,                                    // segundos quieta (o derivando)
    "deriva": { "foco": [..], "zoom": 585, "curva": [1,0,0,1] } | null,  // foco y zoom opcionales
    "transicion": { "dur": 0.79, "curva": [1,0,0,1], "curvaFoco": [..] } // no va en la última
  }],
  "eventos": [
    { "tipo": "ajuste", "letra": "F", "escena": "f", "offset": -0.036, "dur": 0.7, "curva": [1,0,0,1] },
    { "tipo": "salidaOriginales", "escena": "cierre", "offset": 1.0, "dur": 0.3, "curva": [0.6,0,0.4,1] }
  ],
  "lineas": { "<id de línea>": { "entra": { tramo }, "sale": { tramo } | null } }
}
```

`curvaFoco` es opcional y hoy aparece una sola vez (traslado F -> S1, donde en After el Foco
tenía influencia 88 y el Zoom 100). En la UI va como opción avanzada, "curva del paneo
separada", apagada por defecto: separar paneo y zoom tiende a que el logo "se condense".

`lineas` está vacío hasta la fase 1.

## Fases que siguen

Cada fase es una sesión nueva de **Sonnet** que lee esta spec, salvo donde dice Opus.
Rama de trabajo: `feat/floss-tween`. No mergear a `main` hasta la fase 4 (main despliega).

### Fase 1 - Exportador de geometría (Sonnet)

`scripts/export.jsx` corre en After y escribe `src/geometria-floss.json` +
completa `lineas` en `escenas-floss.json` (escribir un `export-datos.txt` simple desde el
jsx y armar los JSON con un `scripts/export.mjs` en Node: en ES3 no hay JSON).

Recorre las capas **habilitadas** de la comp `base` hijas del NULL CONTROL y pasa todo a U:
`U = layer.position + (layer.scale/100) * (group.position + local - layer.anchor) + [303.3, 177.9]`, sumando anchor y escala del grupo si no son neutros
(sin rotaciones en este archivo; verificar y avisar si aparece alguna). Leer escalas con
`valueAtTime(0, true)`: el valor visible ya trae el factor de trazo aplicado.

```jsonc
{
  "logo": { "opacidad": 0.35, "grupos": [
    { "id": "Group 1", "letra": "S1", "trazo": 1, "color": "#fff",
      "a": { "v": [[x,y]...], "in": [...], "out": [...], "cerrado": true }, "b": { ... } },  // b solo si tiene ajuste
    { "id": "Group 3", "letra": null, "paths": [ ...formas ] } ] },
  "originales": { "F": forma, "S1": forma, "S2": forma },   // ver nota de enabled abajo
  "lineas": [{ "id": "L64", "forma": forma, "trazo": 1, "punteada": true }],
  "marcadores": [{ "id": "L49", "centro": [Ux,Uy], "lado": U, "letra": "F" | null, "dx": -6.40 }],
  "etiquetas": [{ "letra": "F", "grupo": "Group 5", "vertice": 6 }]
}
```

- `letra` de un grupo, marcador o etiqueta: sale de qué `Ajuste X` cita su expresión.
- `dx` de un marcador: el coeficiente de `p` en su expresión de X Position (ej. `-6.40275573730469`).
- Tramos de cada línea: keys de Trim Start (k1->k2 entra, k3->k4 sale), convertidos con la
  regla de curvas de arriba y atados a la escena en curso cuando arranca cada tramo
  (`armarLinea()` da los inicios). Si el inPoint de la capa es posterior al arranque, avisar.
- `ORIGINAL S1` y `ORIGINAL S2` están **deshabilitadas** en After (solo `ORIGINAL F` se ve).
  Exportarlas igual con `"visible": false` y preguntarle a Marcos.
- Hecho cuando: el JSON se genera de punta a punta con un comando y un render SVG estático
  rápido del logo en t=0 se superpone con `comp.saveFrameToPng(0, ...)` de la comp 312.

### Fase 2 - Editor (Sonnet)

App React + Vite en este workspace, sobre `@bong/ui` (ScrubField, Section, ToolSidebar,
transport, skin Glass). Copiar la estructura de `apps/plane-animator`.

- **Vista**: SVG a pantalla completa. Cada cuadro: `estadoEn(doc, linea, t)` y se proyecta
  la geometría con `proyectar()`. Sin `vector-effect: non-scaling-stroke`: el ancho sale del factor de
  trazo en U * escala. Líneas con `stroke-dasharray` + `stroke-dashoffset` para el trim.
  Aspectos 16:9, 4:5, 9:16 elegibles (el motor ya resuelve por lado corto).
- **Escena** (panel): foco X/Y, zoom, parada, deriva on/off con su foco/zoom. Botón
  "tomar foco de la vista": arrastrar/pellizcar la vista mueve la cámara y se guarda en la
  escena seleccionada. Agregar, duplicar, borrar, reordenar escenas.
- **Curva**: editor bezier de la transición elegida (dos manejadores arrastrables en un
  cuadrado, valores numéricos, presets: After 100/100 `[1,0,0,1]`, iOS
  `[0.32,0.72,0,1]`, ease `[0.25,0.1,0.25,1]`, lineal). La misma pieza edita la curva de la
  deriva y la de los eventos.
- **Timeline**: un bloque por escena (parada) y uno por transición; arrastrar el borde
  cambia la duración; los eventos se ven como pastillas sobre su escena y se arrastran
  (cambia `offset`). Cabezal con scrub, play/pausa, loop.
- Hecho cuando: con `escenas-floss.json` sin tocar se ve lo mismo que el render de After,
  y cambiar una duración corre todo lo que sigue.

### Fase 3 - Celular (Sonnet)

Con la skill `mobile-native`: panel inferior en vez de sidebar, timeline con scroll
horizontal y bloques de 44 px mínimo, pellizcar para zoom de cámara, `100dvh`, sin zoom de
inputs, safe areas. Probar en el teléfono de verdad.

### Fase 4 - Guardar, exportar, publicar (Sonnet)

- Guardar/abrir JSON (archivo y localStorage con try/catch). El JSON es la versión: se
  comparte por archivo.
- Exportar video: WebCodecs + `mp4-muxer` (ya es dependencia de plane-animator), a 29.97 o
  30 fps, tamaño según aspecto.
- Sumar la app a `scripts/build-site.mjs` y a `packages/ui/src/tools.js`; firma de Bong en el
  HTML (memoria `bong-firma-codigo`). Merge a `main` = deploy a
  `bongstudio-dev.github.io/bong-motion/`.

### Fase 5 - Pasada de movimiento (Opus, corta)

Comparar cuadro a cuadro contra After, medir px por cuadro en el centro de pantalla, ajustar
presets y defaults de curvas. Criterio, no código.

### Fase 6 - Vuelta a After (Sonnet, opcional)

`scripts/import.jsx`: lee el JSON y escribe keys en `CONTROL` (Zoom, Foco, Ajustes) y en los
Trim Paths, con temporal ease de velocidad 0 e influencias desde las curvas (solo se puede
volver si `y1 = 0` e `y2 = 1`; avisar si no). `beginUndoGroup` y backup antes.

## Pendientes de decisión (Marcos)

1. "Para mobile": ¿la herramienta se usa desde el celu, la pieza sale vertical, o las dos?
   El motor banca cualquier aspecto; cambia el peso de la fase 3.
2. `ORIGINAL S1` / `S2` deshabilitadas en After: ¿a propósito?
