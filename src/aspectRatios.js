// Dimensiones en px del canvas por relación de aspecto (lado corto = 1080).
export const ASPECT_RATIOS = {
  "1:1": { width: 1080, height: 1080 },
  "3:4": { width: 1080, height: 1440 },
  "4:5": { width: 1080, height: 1350 },
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
};

export const DEFAULT_ASPECT = "4:5";

export function resolveAspect(key) {
  return ASPECT_RATIOS[key] ? key : DEFAULT_ASPECT;
}
