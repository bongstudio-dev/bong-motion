import { sampleNoise } from "./noise.js";

export function applyGravity(particle, gravity = 0, deltaSeconds = 0) {
  particle.vy += gravity * 220 * deltaSeconds;
}

export function applyDrag(particle, drag = 0, deltaSeconds = 0) {
  const damping = Math.max(0, 1 - drag * deltaSeconds * 60);
  particle.vx *= damping;
  particle.vy *= damping;
}

export function applyTurbulence(
  particle,
  intensity = 0,
  frequency = 0.01,
  elapsed = 0,
  deltaSeconds = 0,
) {
  const horizontal = sampleNoise(
    particle.x * frequency,
    particle.y * frequency,
    elapsed * 0.35,
  );
  const vertical = sampleNoise(
    (particle.y + 400) * frequency,
    (particle.x - 260) * frequency,
    elapsed * 0.25,
  );

  particle.vx += horizontal * intensity * 36 * deltaSeconds;
  particle.vy += vertical * intensity * 10 * deltaSeconds;
}
