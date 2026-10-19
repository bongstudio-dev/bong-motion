import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Base relativa para servir desde un subpath (GitHub Pages).
  base: "./",
  plugins: [react()],
  server: { port: 5176, strictPort: true },
});
