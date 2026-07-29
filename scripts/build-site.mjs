// Ensambla el dist/ que se publica en GitHub Pages:
//
//   /                        → landing (site/index.html)
//   /plane-animator/         → build del workspace
//   /palette-animator/       → build del workspace
//   /particle-visualizer/    → build del workspace
//
// Cada app tiene `base: "./"` en su vite.config, así que sus assets resuelven
// bien desde el subpath sin acoplar el nombre del repo.

import { cp, mkdir, rm, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

const APPS = ["plane-animator", "palette-animator", "particle-visualizer"];

const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await cp(resolve(root, "site"), dist, { recursive: true });
console.log("landing → /");

let missing = 0;
for (const app of APPS) {
  const from = resolve(root, "apps", app, "dist");
  if (!(await exists(from))) {
    console.error(`✗ falta ${app}/dist — corré \`npm run build\` primero`);
    missing++;
    continue;
  }
  await cp(from, resolve(dist, app), { recursive: true });
  console.log(`${app} → /${app}/`);
}

if (missing) process.exit(1);
console.log("\ndist/ listo");
