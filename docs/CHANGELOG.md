# Changelog

Lo que cambió y por qué. Lo más nuevo arriba.

---

## 2026-09-05

Tres familias de templates nuevas, la capa de cámara, y el export fuera del
sidebar. **49 archivos, +3370 / −511.** Cuatro deploys, todos verificados en
vivo, ningún rollback.

Estado en producción al empezar: `3181a23`. Al terminar: `435498f`.
Tag de respaldo del día: `pre-run-2026-09-05` — no se borra.

El detalle del primer tramo, con las decisiones una por una, está en
[INFORME-run-autonomo.md](INFORME-run-autonomo.md). Acá va el resumen del día
entero.

### Agregado

**Tres familias nuevas en plane-animator** — de 5 a 8. Las primeras con los
params espaciales en unidades relativas al lado menor del frame en vez de px;
las cinco viejas se quedan en px a propósito, porque migrarlas rompería todos
los presets guardados.

- **Tunnel** — cards alineadas en Z que avanzan hacia cámara y vuelven al
  fondo. Se ancla en la CÁMARA y no en `z = 0`: lo único que define el tamaño
  en pantalla es la distancia a cámara, y así la composición no depende del
  ratio.
- **Wall** — grilla que deriva y envuelve, con las filas alternas en sentido
  contrario. La inclinación rota la posición con la misma matriz que three le
  aplica al plano, así las cards quedan coplanares con el muro.
- **Hero** — una card grande que se sostiene mientras la siguiente sube y la
  reemplaza. La posición en la cola es continua, así que ninguna card cambia de
  rol de golpe entre ciclos.

**Capa de cámara** — dolly, orbit y tilt sobre cualquiera de las ocho familias,
en su propia sección debajo de Canvas. Los templates se anclan a la cámara
BASE; el movimiento sale sólo en la cámara que recibe el renderer. Todos los
recorridos son de ida y vuelta sobre una onda triangular, así que con cualquier
curva de ease la cámara vuelve exactamente a donde arrancó.

El cierre real de la pieza pasa a ser el **mínimo común múltiplo** entre lo que
pide el template y lo que pide la cámara, y el badge lo reporta. Cuando el mcm
supera los ciclos que se pueden grabar, avisa en vez de callarse.

**Modal de exportación** — reemplaza al último acordeón del sidebar. Muestra
las consecuencias antes de apretar: cuántos archivos, cuánto duran, cuánto
pesan. El peso usa la misma cuenta que el encoder — `ancho × alto × fps ×
calidad` — que es el bitrate que se le pide al `VideoEncoder`. El estado del
loop entra al modal con su arreglo al lado.

**Shuffle** — botón al lado de Reset params, aleatoriza los params formales del
template activo. Sortea, mide lo que salió y vuelve a sortear si no se ve una
composición: un sorteo uniforme sobre los rangos crudos tira frames vacíos muy
seguido.

**Hojas de contacto** — ocho PNG en [docs/preview/](preview/), seis frames de
un ciclo en 4:5 y en 9:16. Sin dependencias nuevas: un harness que Vite sirve
en dev y no construye, dibujado con el Chrome de la máquina en headless.

**Nueve presets de fábrica más** — de 18 a 29. Tunnel: Corredor, Enjambre,
Pozo. Wall: Muro, Marquesina, Ladrillo, Ladrillo zoom, Pared. Hero: Hero, Pase
seco, Naipe.

**Ladrillo zoom** merece su propia línea: grilla plana 5×5 con la cámara
arrancando lejos y entrando con cada paso, para mostrar páginas de un manual de
marca. La sincronización no es un ajuste fino — un paso de grilla por ciclo y
un viaje de cámara por ciclo es la misma cuenta.

### Cambiado

- **Los acordeones cerrados muestran su valor** en gris a la derecha, en las
  tres tools. `Section` acepta un `value` que se dibuja sólo plegada; `right`
  sigue siendo para los indicadores que importan también abiertos.
- **Los botones de ratio dicen qué resolución sale**, en las tres tools. Los
  números salen del mismo lugar que el export: plane y palette multiplican por
  la resolución elegida, particle no multiplica nada porque `captureStream()`
  graba el canvas a su tamaño de backing.
- **Un preset puede traer su propia cámara.** Si no la declara, no la pisa: la
  capa de cámara sobrevive al cambio de preset.
- **El indicador de loop pasa a píldora**, con fondo propio y peso. Es la
  respuesta a "¿esto va a empalmar?" y tenía el mismo peso tipográfico que los
  píxeles del canvas.
- **El slider de ciclos llega a 32** y no a 16. El modelo siempre permitió 32; con
  el tope en 16 el badge podía ofrecer un cierre —`deck-baraja` pide 24— que el
  panel no dejaba alcanzar.
- **El dibujo de la miniatura se extrajo** de `PresetThumb` a `ScenePreview`,
  que es lo que el modal necesitaba. `PresetThumb` quedó siendo el nombre
  debajo.

### Roto a propósito

Dos cambios de comportamiento que pueden sorprender:

- **PNG ahora respeta el selector de resolución.** Antes forzaba 2× siempre y
  lo ignoraba. Era una rareza mientras nadie mostraba el número; con el modal
  mostrando los píxeles de salida pasaba a ser una mentira.
- **Ya no existe la sección Export en el sidebar.** Guardar y cargar el JSON, y
  el reset, viven ahora en **Proyecto**.

### Arreglado

- El script de las hojas de contacto hacía `rm -rf docs/preview` y se comía el
  README que él mismo documentaba. Ahora borra sólo los PNG.
- La sección Texto mostraba la cuenta de capas sólo si había alguna, así que
  quedaba sin valor justo cuando estaba vacía.

### Bugs que el test agarró y no se llegaron a ver

Van acá porque son la parte que más costó y la que no deja rastro en la
interfaz:

- **Los planos del Tunnel medían 0.62 px.** El compositor lee `planeSize` en
  px y el template lo declaraba en fracción del lado menor. Pasaba todos los
  demás checks: un plano de 0.62px sigue estando "en cuadro". Ahora los
  templates declaran `relativeUnits` y hay un test que verifica que los planos
  midan píxeles de verdad.
- **La sombra del Hero se quedaba adentro del cuadro** con la card ya afuera,
  porque estaba en otro z y por lo tanto en un frustum más ancho. Ahora
  comparte el z de su card y el recorrido de salida le alcanza a ella.
- **Con peek en 0**, la card siguiente quedaba apoyada exactamente sobre el
  umbral de "fuera de cuadro" del test de loop, y un error de coma flotante
  decidía si contaba como visible. Ahora tiene dos píxeles de margen.
- **El Wall no cerraba** donde decía cerrar. La geometría vuelve cada ciclo,
  pero el contrato del §7 mide también qué imagen quedó en cada posición, y
  después de un ciclo cada columna muestra la de su vecina. Ahora declara el
  cierre real: `cols / gcd(cols, deriva)`.
- **El Tunnel llegaba a la cámara con 5% de opacidad**, o sea tapando el cuadro
  entero con un velo antes de saltar al fondo. Ahora reserva un último tramo
  donde la opacidad ya es 0.

### Se vio de paso, no se tocó

- El bundle de plane-animator pesa 813 kB minificado (227 kB gzip) y Vite lo
  avisa en cada build; Three.js es la mayor parte. Un `manualChunks` lo
  partiría, pero toca la configuración de build.
- `deck-baraja` declara 8 ciclos y necesita 24. No es nuevo, y el badge lo
  reporta bien.
- Sigue existiendo el deploy duplicado en
  `bongstudio-dev.github.io/particle-visualizer/`.

### Pendiente

- **Revisar la interfaz.** Queda para una pasada de UX propia; no se tocó ni la
  tipografía, ni los espaciados, ni el chasis.
- El modal vive en `@bong/ui`, así que palette y particle pueden usarlo para lo
  mismo cuando toque.

### Archivos nuevos

```
apps/plane-animator/contact-sheet.html
apps/plane-animator/scripts/contact-sheet.mjs
apps/plane-animator/src/components/ExportModal.jsx
apps/plane-animator/src/components/ScenePreview.jsx
apps/plane-animator/src/components/panels/CameraPanel.jsx
apps/plane-animator/src/components/panels/ProjectPanel.jsx
apps/plane-animator/src/engine/cameraMove.js
apps/plane-animator/src/engine/shuffle.js
apps/plane-animator/src/export/summary.js
packages/ui/src/Modal.jsx
docs/INFORME-run-autonomo.md
docs/preview/  (8 PNG + README)
```

Eliminado: `apps/plane-animator/src/components/panels/ExportPanel.jsx`.

### Commits

| | |
|---|---|
| `bb9f6c9` | Template Tunnel: cards en Z que pasan de largo |
| `318bdb4` | Template Wall: grilla que deriva y envuelve |
| `55d5e43` | Template Hero: una card grande que se sostiene y la releva la que sube |
| `cad731a` | Tunnel: la dispersión por defecto pasa a medio lado menor |
| `9c62337` | Capa de cámara: dolly, orbit y tilt sobre cualquiera de las ocho familias |
| `391a773` | El acordeón cerrado muestra en qué quedó cada sección |
| `38fae05` | Shuffle de los params formales del template activo |
| `a7ae03b` | Los botones de ratio dicen qué resolución sale |
| `d664fbd` | Hojas de contacto de las tres familias nuevas |
| `a17addd` | Informe del run autónomo |
| `2d405c2` | Ladrillo: grilla plana con el zoom atado al paso de la grilla |
| `124c190` | El export sale del sidebar y pasa a ser un modal |

Merges: `68840de` (templates y cámara), `2160648` (grilla manual), `435498f`
(modal de export).

### Deploys

| SHA | Hora | Qué salió |
|---|---|---|
| `68840de` | 18:48 | Tres familias, capa de cámara, shuffle, valores en headers, resoluciones en los ratios, hojas de contacto |
| `a17addd` | 19:00 | Sólo el informe — `docs/` no entra al build, el `dist` salió idéntico |
| `2160648` | 19:59 | Presets Ladrillo, y presets que pueden traer cámara |
| `435498f` | 20:25 | Modal de export, Proyecto, píldora del loop |

Los cuatro verificados en vivo: las cuatro URLs devolviendo 200 y sirviendo la
app, y el bundle servido conteniendo lo que tenía que contener.

### Cómo volver atrás

```bash
git push --force origin pre-run-2026-09-05^{}:refs/heads/main
```

Deja `main` en el commit que estaba en producción a la mañana y dispara el
mismo pipeline. Verificado con `--dry-run` contra el remoto.
