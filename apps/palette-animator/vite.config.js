import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Base relativa para poder servir desde un subpath (GitHub Pages, etc.).
  base: "./",
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
  },
});
