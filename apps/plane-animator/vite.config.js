import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Base relativa para poder servir desde un subpath (GitHub Pages, etc.).
  base: "./",
  plugins: [react()],
  server: {
    // Puerto distinto al del palette-animator (5174): las dos tools conviven.
    port: 5175,
    strictPort: true,
  },
});
