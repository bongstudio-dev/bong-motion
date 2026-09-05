# Hojas de contacto

Seis frames repartidos a lo largo de un ciclo, en 4:5 y en 9:16. Sirven para
ver qué hace cada template sin tener que abrir la tool.

| | 4:5 | 9:16 |
|---|---|---|
| Tunnel | [tunnel-4x5.png](tunnel-4x5.png) | [tunnel-9x16.png](tunnel-9x16.png) |
| Wall | [wall-4x5.png](wall-4x5.png) | [wall-9x16.png](wall-9x16.png) |
| Hero | [hero-4x5.png](hero-4x5.png) | [hero-9x16.png](hero-9x16.png) |
| Wall · Ladrillo zoom | [ladrillo-zoom-4x5.png](ladrillo-zoom-4x5.png) | [ladrillo-zoom-9x16.png](ladrillo-zoom-9x16.png) |

Cada hoja usa la primera variante de fábrica de su familia y placeholders
numerados, que es lo que se ve entrando a la familia sin cargar imágenes. Con
`?variant=<id>` se puede pedir cualquier otro preset — así sale la del Ladrillo
zoom, que es un preset y no una familia.

## Cómo se regeneran

```bash
node apps/plane-animator/scripts/contact-sheet.mjs
```

El script levanta el dev server de Vite y dibuja
`apps/plane-animator/contact-sheet.html` con el Chrome que ya está instalado en
la máquina, en headless. No agrega ninguna dependencia y no corre en CI: son
PNG commiteados que se rehacen a mano cuando cambia un template.

La página usa el renderer real, el mismo que dibuja el preview y el export, así
que no hay un segundo camino de dibujo que pueda mentir. Se puede abrir a mano
con el dev server andando:

```
http://localhost:5175/contact-sheet.html?tpl=wall&variant=wall-ladrillo-zoom&ratio=9:16
```
