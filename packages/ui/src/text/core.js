// Núcleo de las capas de texto: modelo y dibujo, sin React ni JSX.
//
// Existe como subpath propio (`@bong/ui/text`) porque los tests del engine
// corren en Node crudo, sin bundler: si `state/defaults.js` importara del barrel
// de la UI, Node se toparía con un .jsx y la suite no arrancaría. La regla que
// deja eso resuelto es simple — lo que toque el engine o el render importa de
// acá; lo que sea interfaz, del barrel.

export {
  TEXT_ALIGNS,
  TEXT_ANCHORS,
  TEXT_CASES,
  TEXT_FONTS,
  TEXT_MARGIN,
  TEXT_SLOTS,
  TEXT_SLOT_OPTIONS,
  TEXT_WEIGHTS,
  applyTextCase,
  createTextLayer,
  duplicateTextLayer,
  mergeTextLayers,
  textLabel,
} from "./model.js";

export { drawTexts, hasTexts, textBounds } from "./drawTexts.js";
