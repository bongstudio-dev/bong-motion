# Run autónomo — 5 de septiembre de 2026

Diez tareas, nueve hechas, una hecha con un recorte que está anotado abajo.
Cero revertidas, cero salteadas, sin rollback.

**Producción está actualizada y verificada en vivo.**

| | |
|---|---|
| SHA en producción antes | `3181a23b782244fc8116f3420e91898920bf5525` |
| SHA en producción ahora | `68840de4fd15be2a1644838778488d1be04a4dcd` |
| Tag de respaldo | `pre-run-2026-09-05` (en el remoto, apunta al SHA de antes) |
| Rama de trabajo | `feat/templates-y-camara` — viva, mergeada, no borrada |
| Pipeline | [run 33985184196](https://github.com/bongstudio-dev/bong-motion/actions/runs/33985184196) · success |
| Rollback automático | no hizo falta |

---

## Cómo se deploya (Tarea 0)

Es un **workflow de GitHub Actions** que buildea, no una rama `gh-pages` con el
build ya hecho. `.github/workflows/deploy.yml` corre en cada push a `main`:
`npm ci` → `npm test` → `npm run build` → `npm run build:site` →
`actions/deploy-pages`. No existe ninguna rama `gh-pages`, ni local ni remota,
así que el paso 3 de la tarea 0 (duplicarla como backup) no aplicaba.

El respaldo es el tag, y quedó creado y pusheado **antes de tocar un solo
archivo**.

### Comando de rollback

Copiable, y verificado con `--dry-run` contra el remoto real:

```bash
git push --force origin pre-run-2026-09-05^{}:refs/heads/main
```

Eso deja `main` exactamente en el commit que estaba en producción y dispara el
mismo pipeline, que reconstruye y republica. Después:

```bash
gh run watch $(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId')
```

Si preferís no forzar el push —queda historia más prolija y no reescribe
nada— el equivalente no destructivo es revertir el merge:

```bash
git checkout main && git pull && git revert -m 1 68840de && git push origin main
```

Las dos formas usan el pipeline que ya existía. No se tocó ningún archivo de
workflow ni la configuración de Pages.

---

## Estado de cada tarea

| # | Tarea | Estado |
|---|---|---|
| 0 | Respaldo | Hecha — tag creado y pusheado antes de todo |
| 1 | Template Tunnel | Hecha |
| 2 | Template Wall | Hecha |
| 3 | Template Hero | Hecha |
| 4 | Capa de cámara | Hecha |
| 5 | Valor activo en los headers | Hecha — las tres apps |
| 6 | Shuffle del template activo | Hecha |
| 7 | Resolución en los botones de ratio | Hecha — las tres apps |
| 8 | Hojas de contacto | Hecha — sin agregar dependencias |
| 9 | Deploy y verificación en vivo | Hecha — sin rollback |
| 10 | Informe | Este archivo |

Ninguna tarea falló sus checks dos veces, así que no se revirtió ninguna.

### Lo único que quedó recortado

En la tarea 4, el orbit de la cámara es un **barrido pendular** —sale del
frente, llega hasta `amplitud × 180°` y vuelve— y no una revolución continua.
El brief pedía "una vuelta entera o una fracción exacta". Una revolución
unidireccional sólo cierra el loop cuando el barrido es de exactamente 360°, y
con eso el control de Amplitud quedaría muerto en todos los valores menos uno.
El péndulo cierra exacto con cualquier amplitud y deja el control vivo en todo
su rango. Con amplitud 1 la cámara igual llega justo detrás de la escena, que
es el extremo que el brief quería alcanzar.

---

## Checks de cada tarea, y cómo se verificaron

Los cinco checks de las tareas 1, 2 y 3 están automatizados en
`apps/plane-animator/scripts/engine-test.mjs`, que corre en `npm test` y por lo
tanto **en el pipeline antes de cada deploy**. No son una verificación de una
vez: si mañana alguien rompe una familia, el deploy no sale.

- **Compila** — los tres builds, en cada tarea.
- **Aparece en el selector** — el selector lista `LIBRARY`, no `TEMPLATE_LIST`.
  Una familia sin variantes de fábrica existiría en el motor y sería invisible
  en la interfaz. El test lo verifica; cada familia nueva trae 3 presets.
- **Placeholders numerados sin assets** — verificado, y descontando las
  sombras del hero, que comparten el número de su card.
- **La composición no depende del ratio** — mismo tamaño de plano en los
  cuatro ratios. Para el tunnel se verifica además que la distancia a cámara
  de cada card sea idéntica en los cuatro.
- **El indicador de loop reporta cierre** — y además se comprueba que con los
  ciclos que sugiere, cierre de verdad.

Para la tarea 4, el check crítico —"con Movimiento en Fija las ocho familias
se comportan exactamente igual que antes"— se verificó de dos formas:

1. Contra el commit anterior, con un worktree: **840 escenas** (los 27 presets
   de fábrica × 24 frames, más los defaults de las ocho familias) salieron
   idénticas número por número.
2. Como test permanente: con `Fija`, `getScene` da lo mismo que un state sin
   sección de cámara, y `applyCameraMove` devuelve la **misma referencia**, no
   una copia igual.

Para la tarea 6, el test corre los diez shuffles seguidos sobre las ocho
familias con una secuencia repetible, y verifica que ningún param se salga de
su rango y que ningún frame se quede sin composición.

Para la tarea 7, la verificación fue en vivo contra el motor de cada app: los
botones muestran lo mismo que calcula el propio código de export, y en
particle además coincide con `canvas.width`/`canvas.height`, que es
literalmente lo que graba `captureStream()`.

---

## Verificación en vivo del deploy

Las cuatro URLs, con requests reales:

| URL | Código | Cuerpo |
|---|---|---|
| `/bong-motion/` | 200 | landing |
| `/bong-motion/plane-animator/` | 200 | app |
| `/bong-motion/palette-animator/` | 200 | app |
| `/bong-motion/particle-visualizer/` | 200 | app |

Y el bundle **servido** de plane-animator (807.794 bytes,
`assets/index-CaxFeKYj.js`) contiene `Tunnel`, `Wall`, `Hero`, los ids de los
nueve presets nuevos, `Shuffle`, `Tilt` y las etiquetas de los params de
cámara. El CSS servido trae `.section-value` y `.ratio-dims`. El deploy salió
del commit nuevo, no de uno viejo.

Abriendo la URL en vivo, el selector lista las ocho familias y 27 presets.

---

## Decisiones que tomé por mi cuenta

**Params que el brief no listaba pero el template necesitaba.** Tunnel y Wall
no tenían param de tamaño, y Hero no tenía cantidad de cards. Sin eso los
templates no se pueden dibujar. Se agregaron en unidades relativas como el
resto.

**El mínimo de cards del Hero es 3, no 2.** La rotación necesita una saliente,
una en el centro y una esperando abajo; con dos, la misma card tendría que
estar saliendo por arriba y esperando abajo en el mismo frame.

**El Wall declara que cierra en `cols / gcd(cols, deriva)` ciclos, no en uno.**
La geometría sí vuelve a su lugar cada ciclo, pero el contrato de loop del
repo mide también qué imagen quedó en cada posición, y ahí no cierra: después
de un ciclo cada columna muestra la imagen de su vecina. Declarar 1 haría que
el badge prometa un frame que no se repite, que es exactamente lo que el badge
existe para no hacer.

**"Ciclos de cámara por ciclo de template" se implementó al revés de como
suena.** El param es *cada cuántos ciclos de template la cámara completa su
recorrido*. Es la lectura que hace verdadero el paréntesis del brief ("para
poder tener cámara lenta sobre template rápido") y la única que hace no
trivial el mínimo común múltiplo: si la cámara fuera más rápida, el mcm sería
siempre el del template y el control nunca cambiaría el cierre.

**La cámara no entra en los presets.** Los 27 presets de fábrica no declaran
cámara, así que aplicar cualquiera te apagaría el movimiento que tenías
puesto. Dejándola afuera, la cámara es una capa que sobrevive al cambio de
preset — que es lo que pide "aplica sobre cualquier familia".

**La sombra del hero toca código compartido.** El brief prefiere lo simple
contenido en el template, pero el shader no tenía forma de pintar una silueta.
Se agregó un uniform `tint` que por defecto vale 1 y no cambia nada; hay un
test que verifica que las cinco familias viejas no emiten un solo plano
teñido. La alternativa era dropear un param que el brief pedía explícitamente.

**El slider de ciclos pasó de 16 a 32.** Al poner el techo de "cierre
razonable" en 16 se rompió `deck-baraja`, un preset de fábrica que pide 24
ciclos. El tope real del modelo siempre fue 32; el slider llegaba hasta 16 y
por eso el badge podía ofrecer un cierre que el panel no dejaba alcanzar.

**Las hojas de contacto no agregaron Playwright.** El repo no lo tenía, y
sumarlo por seis imágenes que se regeneran cada tanto habría metido un browser
al `npm ci` del deploy. Se usa el Chrome que ya está en la máquina, headless,
contra un harness que Vite sirve en dev y no construye.

**El acordeón muestra el valor sólo cerrado.** Abierto sobra: el control que
lo fija está tres píxeles más abajo. Los indicadores que ya se mostraban
siempre (estado de cámara, cuenta de assets) quedaron como estaban.

**Los píxeles en los botones de ratio van en dos líneas.** Inline,
`4:5 · 1080×1350` son cinco botones de 110px en una barra que ya comparte
lugar con el scrub, y el que se achica es el scrub.

---

## Params nuevos, por template

Las unidades relativas van como fracción del **lado menor del frame** (1080)
salvo donde se aclara otra cosa. En el panel se muestran como porcentaje.

### Tunnel (`tunnel`)

| Param | Rango | Default | Unidad |
|---|---|---|---|
| Cards visibles | 3–24, paso 1 | 6 | — |
| Tamaño | 0.1–1.6, paso 0.01 | 0.62 | × lado menor |
| Aspect del plano | 1:1 / 4:5 / 3:4 / 5:4 / 16:9 / 9:16 | 4:5 | — |
| Separación en Z | 0.08–2, paso 0.01 | 0.55 | × lado menor |
| Dirección | hacia cámara / alejándose | hacia cámara | — |
| Avance por ciclo | 1–8, paso 1 | 1 | slots |
| Dispersión lateral | 0–1.2, paso 0.01 | 0.5 | × lado menor |
| Semilla | 0–999, paso 1 | 7 | — |
| Rotación por card | 0–45, paso 1 | 6 | grados |
| Corner radius | 0–0.2, paso 0.002 | 0.022 | × lado menor |
| Fade de aparición | 0–1, paso 0.01 | 0.35 | fracción de la profundidad total |

### Wall (`wall`)

| Param | Rango | Default | Unidad |
|---|---|---|---|
| Filas | 1–8, paso 1 | 4 | — |
| Columnas | 1–10, paso 1 | 4 | — |
| Tamaño | 0.06–0.8, paso 0.01 | 0.3 | × lado menor |
| Aspect del plano | 1:1 / 4:5 / 3:4 / 5:4 / 16:9 / 9:16 | 4:5 | — |
| Gap | 0–0.2, paso 0.005 | 0.03 | × lado menor |
| Deriva por ciclo | 1–6, paso 1 | 1 | tiles |
| Sentido por fila | uniforme / alterno | alterno | — |
| Inclinación en X | −60–60, paso 1 | 12 | grados |
| Inclinación en Y | −60–60, paso 1 | −18 | grados |
| Escala de la fila central | 0–1.5, paso 0.01 | 0.25 | multiplicador (0 = todas iguales) |
| Corner radius | 0–0.1, paso 0.002 | 0.014 | × lado menor |
| Fade en los bordes | 0–1, paso 0.01 | 0.35 | fracción del semiancho visible |

### Hero (`hero`)

| Param | Rango | Default | Unidad |
|---|---|---|---|
| Cards | 3–16, paso 1 | 6 | — |
| Escala del hero | 0.3–1.4, paso 0.01 | 0.78 | × lado menor |
| Aspect del plano | 1:1 / 4:5 / 3:4 / 5:4 / 16:9 / 9:16 | 4:5 | — |
| Sostén del ciclo | 0–0.95, paso 0.01 | 0.55 | fracción del ciclo |
| Solapamiento | 0–1, paso 0.01 | 0.7 | fracción de la transición |
| Arco de la trayectoria | 0–0.8, paso 0.01 | 0.18 | × lado menor (0 = recta) |
| Rotación en el pase | 0–45, paso 1 | 8 | grados |
| Peek de la siguiente | 0–0.6, paso 0.01 | 0.12 | fracción del alto de la card |
| Corner radius | 0–0.1, paso 0.002 | 0.024 | × lado menor |
| Sombra proyectada | on / off | on | — |
| Intensidad de la sombra | 0–1, paso 0.01 | 0.45 | — |

### Cámara — sección propia, debajo de Canvas

| Param | Rango | Default | Unidad |
|---|---|---|---|
| Movimiento | Fija / Dolly / Orbit / Tilt | Fija | — |
| Amplitud | −1–1, paso 0.01 | 0.5 | con signo: elige hacia dónde arranca |
| Fase inicial | 0–1, paso 0.01 | 0 | fracción del ciclo de cámara |
| Ciclos por vuelta de cámara | 1–8, paso 1 | 1 | ciclos de template |
| Ease de la cámara | bézier | `[0.65, 0, 0.35, 1]` | el editor que ya existía |

Topes con amplitud 1: dolly ±50% de la distancia base, orbit 180° de barrido,
tilt 55° de elevación.

### Presets de fábrica nuevos

`tunnel`: Corredor, Enjambre, Pozo · `wall`: Muro, Marquesina, Pared ·
`hero`: Hero, Pase seco, Naipe. La biblioteca pasó de 18 a 27.

---

## Cosas que vi de paso, fuera de alcance

**El export a PNG ignora el selector de resolución.** `runPNG` usa
`Math.max(2, cfg.resolution)`, así que con 1× seleccionado igual salen 2160.
El video sí respeta el selector. Los botones de ratio ahora muestran la
resolución del video, que es la que el selector controla; el PNG queda como
la excepción silenciosa que ya era. No lo toqué porque cambiar el
comportamiento del export estaba explícitamente fuera de alcance.

**`deck-baraja` no cierra con los ciclos que declara.** El preset declara 8 y
necesita 24 (8 cards con jitter, mcm con 6 assets). No es nuevo, y el badge lo
reporta bien; ahora además el slider llega hasta ahí.

**El bundle de plane-animator pesa 795 kB minificado.** Vite lo avisa en cada
build. Three.js es la mayor parte. Un `manualChunks` lo partiría, pero toca la
configuración de build.

**La biblioteca busca presets por nombre en las ocho familias.** Ya había un
preset llamado "Túnel" en `orbit`, así que el del tunnel se llama "Corredor"
para que buscar no devuelva dos cosas iguales.

**Sigue existiendo el deploy duplicado** en
`bongstudio-dev.github.io/particle-visualizer/`. Estaba fuera de alcance a
propósito y no se tocó.

---

## Qué mirar primero

1. **`docs/preview/`** — seis hojas de contacto. Es lo más rápido para ver qué
   hace cada familia nueva sin abrir nada. El hero se lee especialmente bien:
   sostiene cuatro frames y resuelve en dos.
2. **La URL en vivo**, con la sección **Cámara** debajo de Canvas. Poné Orbit
   sobre cualquier familia vieja y mirá el badge de loop: reporta el mínimo
   común múltiplo entre el template y la cámara, y avisa cuando la combinación
   pide más ciclos de los que se pueden grabar.
3. **El botón Shuffle**, al lado de Reset params. Dale diez veces seguidas
   sobre cada familia. Está pensado para que no salga nunca una composición
   vacía ni una card tapando el cuadro.
4. **`apps/plane-animator/src/engine/templates.js`** — las tres familias
   nuevas están al final, después de las cinco viejas, que no se tocaron.
   Los comentarios explican por qué el túnel se ancla en la cámara y por qué
   el wall declara el cierre que declara.
5. **`apps/plane-animator/src/engine/cameraMove.js`** — 84 líneas. Es donde
   vive la garantía de que el movimiento de cámara cierra solo.
6. **`npm test`** — 3 suites, todas verdes, y corren en el pipeline antes de
   cada deploy.

---

## Commits de la rama

```
d664fbd  Hojas de contacto de las tres familias nuevas
a7ae03b  Los botones de ratio dicen qué resolución sale
38fae05  Shuffle de los params formales del template activo
391a773  El acordeón cerrado muestra en qué quedó cada sección
9c62337  Capa de cámara: dolly, orbit y tilt sobre cualquiera de las ocho familias
cad731a  Tunnel: la dispersión por defecto pasa a medio lado menor
55d5e43  Template Hero: una card grande que se sostiene y la releva la que sube
318bdb4  Template Wall: grilla que deriva y envuelve
bb9f6c9  Template Tunnel: cards en Z que pasan de largo
```

Más el merge `68840de`, que es lo que está en producción.

**39 archivos, +1911 / −47.** Archivos nuevos:

```
apps/plane-animator/contact-sheet.html
apps/plane-animator/scripts/contact-sheet.mjs
apps/plane-animator/src/components/panels/CameraPanel.jsx
apps/plane-animator/src/engine/cameraMove.js
apps/plane-animator/src/engine/shuffle.js
docs/preview/  (6 PNG + README)
```
