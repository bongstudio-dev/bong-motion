// ShaderMaterial propio, no MeshBasicMaterial. BRIEF §5.
//
// Un solo shader resuelve crop, corner radius, opacidad, fondo de `contain` y
// cara trasera. Todos los planos comparten el mismo código de shader (three
// cachea el programa por source), así que clonar el material por plano cuesta
// un puñado de uniforms, no una recompilación.

import * as THREE from "three";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uMap;
  uniform sampler2D uBackMap;
  uniform vec4  uCrop;      // [scaleX, scaleY, offsetX, offsetY]
  uniform vec4  uBackCrop;
  uniform vec4  uBg;        // fondo de 'contain'
  uniform vec2  uSize;      // px lógicos — el SDF trabaja en esta escala
  uniform float uRadius;
  uniform float uOpacity;
  uniform float uHasBack;
  uniform float uTint;      // 1 = la imagen tal cual; 0 = silueta negra

  varying vec2 vUv;

  void main() {
    // Cara trasera: se ve espejada por construcción. Si hay un asset propio
    // atrás (flip con backAsset: 'next') corregimos el espejo para que lea
    // bien; si no, el espejado ES el efecto pedido.
    float back = gl_FrontFacing ? 0.0 : 1.0;
    float useBack = back * step(0.5, uHasBack);

    vec2 uv = vUv;
    uv.x = mix(uv.x, 1.0 - uv.x, useBack);

    vec4 crop = mix(uCrop, uBackCrop, useBack);
    vec2 t = uv * crop.xy + crop.zw;

    // Las dos muestras se toman siempre: ramificar alrededor de texture2D deja
    // las derivadas indefinidas y arruina los mipmaps en el borde.
    // Las texturas vienen PREMULTIPLICADAS (ver assetStore): un píxel
    // transparente es (0,0,0,0) y el filtrado no arrastra negro al borde de un
    // PNG. Todo el mezclado se hace premultiplicado y se despremultiplica al final.
    vec4 img = mix(texture2D(uMap, t), texture2D(uBackMap, t), useBack);

    // Fuera de [0,1] estamos en el letterbox de 'contain' → color de fondo.
    // El antialias cae AFUERA de [0,1]: dentro de la imagen inside = 1 exacto.
    // Si cayera adentro, en 'cover' (t toca 0 y 1 en el borde del plano) el
    // fondo se colaba en el borde y en las zonas transparentes de un PNG
    // dibujaba una línea.
    vec2 w = fwidth(t) + 1e-5;
    vec2 lo = smoothstep(-w, vec2(0.0), t);
    vec2 hi = smoothstep(-w, vec2(0.0), 1.0 - t);
    float inside = lo.x * lo.y * hi.x * hi.y;

    vec4 bg = vec4(uBg.rgb * uBg.a, uBg.a);
    vec4 col = mix(bg, img, inside);
    float alpha = col.a;
    vec3 rgb = col.rgb / max(alpha, 1e-5);

    // Corner radius: SDF de rounded box sobre las UV, en px. Crocante y sin
    // geometría extra. fwidth da el ancho de antialias correcto a cualquier
    // distancia de cámara.
    vec2 hs = uSize * 0.5;
    float r = min(uRadius, min(hs.x, hs.y));
    vec2 q = abs((vUv - 0.5) * uSize) - (hs - r);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    float aa = max(fwidth(d), 1e-4);
    float mask = 1.0 - smoothstep(-aa, aa, d);

    gl_FragColor = vec4(rgb * uTint, alpha * mask * uOpacity);
    if (gl_FragColor.a < 0.001) discard;

    #include <colorspace_fragment>
  }
`;

export function createPlaneMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uMap: { value: null },
      uBackMap: { value: null },
      uCrop: { value: new THREE.Vector4(1, 1, 0, 0) },
      uBackCrop: { value: new THREE.Vector4(1, 1, 0, 0) },
      uBg: { value: new THREE.Vector4(0, 0, 0, 1) },
      uSize: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: 0 },
      uOpacity: { value: 1 },
      uHasBack: { value: 0 },
      uTint: { value: 1 },
    },
    // Planos con opacidad < 1 y depth testing se pelean: se dibuja por
    // renderOrder (derivado de z) y no se escribe profundidad.
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
