import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Base relativa: los assets se cargan bien desde el subpath de GitHub Pages
  // (https://usuario.github.io/repo/) sin acoplar el nombre del repo.
  base: "./",
  plugins: [react()],
});
