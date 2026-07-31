export { ScrubField } from "./ScrubField.jsx";
export { ToolSidebar } from "./ToolSidebar.jsx";
export { TOOLS, toolHref } from "./tools.js";
export {
  Icon,
  Section,
  Group,
  Field,
  Segmented,
  Select,
  NumberInput,
  Button,
  IconButton,
  Toggle,
  ColorInput,
} from "./controls.jsx";

/* Capas de texto. El modelo y el dibujo se re-exportan por comodidad, pero el
   engine y los renderers deben importarlos de "@bong/ui/text": ese subpath no
   arrastra JSX y por eso funciona en los tests que corren en Node crudo. */
export { TextSection } from "./text/TextSection.jsx";
export { TextWindow } from "./text/TextWindow.jsx";
export { ensureFontsReady } from "./text/fonts.js";
export * from "./text/core.js";
