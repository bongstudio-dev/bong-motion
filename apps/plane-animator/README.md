# Plane Animator — Bong Studio

Herramienta interna para armar posts animados en loop a partir de varias imágenes
dispuestas en el espacio 3D. Ver `BRIEF.md` (spec) y `LINEAGE.md` (de dónde viene).

```bash
npm install
npm run dev      # http://localhost:5175
```

---

## Estado

Las 8 fases del BRIEF §11 están implementadas.

| # | Entrega | Estado |
|---|---|---|
| 0 | Scaffold Vite + React + Three, stage con cámara | ✅ |
| 1 | `getScene` + `carousel` + clock + scrub + loop test | ✅ |
| 2 | Panel de Assets, `cover`/`contain`, focal point | ✅ |
| 3 | `deck` + `parallax` + `orbit` + `flip`, schema-driven | ✅ |
| 4 | Timing global + editor de easing | ✅ |
| 5 | Ratios (incl. custom), stitch, safe area, background | ✅ |
| 6 | Export webm/mp4/gif/png + lote multi-ratio + presets + JSON | ✅ |
| 7 | `fitToAsset` + espaciado por acumulación + `fitTransition` | ✅ |

Fuera del MVP, como pide el brief: los 18 templates de v2, gradiente/imagen de
fondo, audio, overlay de logo, capa de texto, IndexedDB para assets.

---

## Verificación

`getScene` no importa Three, así que el engine se testea en Node sin browser:

```bash
node scripts/engine-test.mjs
```

34 aserciones: pureza, validez geométrica de los 5 templates, orden de dibujo,
contrato de loop del §7, `fitToAsset` sin superposiciones, crop cover/contain,
independencia del ratio, placeholders, stagger y las tres direcciones.

Verificado además en browser sobre el archivo exportado de verdad: MP4 1080×1350,
duración 6.000s para 180 frames → **30.00 fps exactos**, y el primer frame contra
el último dan una diferencia de 0.9/255 (ruido de compresión) → el loop cierra.

---

## Dónde se apartó del BRIEF, y por qué

El brief se escribió antes de implementar. Estos son los puntos donde seguirlo al
pie de la letra daba un resultado peor, con el motivo:

1. **`renderOrder` va con `+z`, no con `-z`** (§5). Three dibuja los transparentes
   en `renderOrder` **ascendente**, así que `-pos[2]` pintaba lo más cercano
   primero — al revés de lo que se buscaba.

2. **`t01` recorre la pieza entera, no un ciclo** (§7). Con `cycles` repeticiones,
   si `t` se envolviera en cada ciclo el avance de assets se resetearía y la regla
   `(cycles × slotsPerCycle) % assetCount === 0` no podría cumplirse nunca. Por lo
   mismo el stagger resta **sin** `mod1`: la cinta de assets es infinita.

3. **El test de loop empareja planos por posición, no por id** (§7). En un carousel
   cada plano avanza un slot por ciclo: comparando por id, `p2` "se movió medio
   stage" cuando el frame es idéntico. Lo que tiene que cerrar es la imagen
   renderizada. La visibilidad se pondera además por escorzo — un plano de canto
   proyecta área cero.

4. **Export con WebCodecs, MediaRecorder sólo de fallback** (§9). MediaRecorder
   timestampea por reloj real: si dibujar un frame tarda más que 1/fps, el archivo
   sale con menos fps y se ve a saltos — y si la pestaña pasa a background, el
   browser clampea los timers y el video queda a 1 fps sin avisar. `VideoEncoder`
   deja fijar el timestamp de cada frame, así que sale a 30 o 60 fps exactos
   tarde lo que tarde el encoder. Es lo único que cumple el invariante §3.
   Cuando no hay WebCodecs se graba con MediaRecorder y se mide la deriva para
   avisar si el archivo quedó mal, en vez de entregarlo en silencio.

5. **`orbit` avanza una posición del anillo por ciclo, no una vuelta entera.**
   Con una vuelta por ciclo el anillo terminaba exactamente donde empezó y el
   frente repetía siempre la misma imagen. Cada plano se queda con su asset y
   nunca lo cambia: en un anillo se ve todo el tiempo y —por la perspectiva— ni
   los planos del costado quedan de canto, así que no hay dónde esconder un
   cambio de textura. Girando de a una posición no hace falta esconder nada.
   `stepsPerCycle = count` recupera el giro continuo.

6. **`fitToAsset` iguala el ÁREA, no el lado mayor** (§6.5.1 — el brief permite
   ambas). Con el lado mayor una horizontal se ve enorme al lado de una vertical;
   con el área pesan visualmente lo mismo.

7. **`fitTransition` terminó siendo menos necesario de lo previsto** (§6.5.3). El
   modelo de cinta hace que las posiciones dependan del slot y no del plano que lo
   ocupa, así que cambiar de asset no corre a los vecinos. `morph` interpola el
   tamaño alrededor del wrap (visible sólo si el `count` es muy bajo) y `lock`
   congela la forma al primer asset del slot, como describe el brief.

8. **`deck`: la carta del fondo entra desvanecida y el jitter se siembra con el
   índice del plano.** Sin el fade, mientras una carta sale por adelante el fondo
   del mazo queda vacío y el frame final tiene una carta menos que el inicial.
   Y sembrando el jitter con el índice de cinta —que crece sin límite— el mazo no
   cerraba nunca.

9. **Los ratios custom se redondean a lado par.** H.264 no acepta lados impares:
   el export a MP4 fallaría sólo en custom, que es el peor momento para enterarse.

10. **`carousel.fade` viene en 1.** Ahí la opacidad en el punto de wrap es
    exactamente 0 y el loop cierra sin depender de que el `count` y el tamaño
    dejen los extremos fuera de cuadro.

---

## Notas de uso

- **El badge del stage es la fuente de verdad.** `✓ cierra` / `✓ (× N ciclos)` con
  el N mínimo que cierra / `✗`. El panel de Export tiene el botón para aplicarlo.
- **Los assets no se persisten.** `localStorage` no aguanta imágenes: se recargan
  por sesión. Todo el resto del state sí, y "Guardar como custom" serializa la
  receta (template + params + timing + encuadre).
- **`orbit` muestra tantas imágenes como `count`.** Si cargás más assets que
  planos, los sobrantes no entran al anillo — subí `count`.
- **Export 2×** avisa cuando algún asset mide menos de 2160px y va a upscalear.
- En ingesta todo asset con lado mayor > 2160px se reduce: 12 imágenes a 4000px
  son ~700MB de VRAM con mipmaps.
