import { applyDrag, applyGravity, applyTurbulence } from "./forces";

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class ParticleSystem {
  constructor(config = {}) {
    this.config = config;
    this.particles = [];
    this.assets = [];
    this.spawnAccumulator = 0;
    this.nextAssetIndex = 0;
    this.elapsed = 0;
  }

  setAssets(assets) {
    this.assets = assets;
    this.nextAssetIndex = 0;
  }

  updateConfig(nextConfig) {
    this.config = { ...this.config, ...nextConfig };
  }

  clear() {
    this.particles = [];
    this.spawnAccumulator = 0;
  }

  spawnParticle(stageWidth, stageHeight) {
    if (!this.assets.length) {
      return;
    }

    const asset = this.assets[this.nextAssetIndex];
    this.nextAssetIndex = (this.nextAssetIndex + 1) % this.assets.length;

    const emitterX = stageWidth * this.config.emitterX;
    const emitterY = stageHeight * this.config.emitterY;
    const direction = toRadians(this.config.direction);
    const spread = toRadians(this.config.spread);
    const angle = direction + (Math.random() - 0.5) * spread;
    const speed = this.config.speed * 90 * (0.8 + Math.random() * 0.4);
    const scale =
      this.config.scale +
      (Math.random() * 2 - 1) * this.config.scaleVariation;
    const rotationSpeed =
      this.config.rotationSpeed * (Math.random() * 2 - 1) * 8;

    this.particles.push({
      asset,
      x: emitterX,
      y: emitterY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: 0,
      rotationSpeed,
      scale: Math.max(0.04, scale),
      opacity: 0,
      age: 0,
      lifespan: this.config.lifespan,
    });
  }

  update(deltaSeconds, stageWidth, stageHeight) {
    if (!this.assets.length) {
      this.clear();
      return;
    }

    this.elapsed += deltaSeconds;
    this.spawnAccumulator += deltaSeconds;

    const nextParticles = [];

    for (const particle of this.particles) {
      particle.age += deltaSeconds;

      applyGravity(particle, this.config.gravity, deltaSeconds);
      applyTurbulence(
        particle,
        this.config.turbulence,
        this.config.turbulenceFrequency,
        this.elapsed,
        deltaSeconds,
      );
      applyDrag(particle, this.config.drag, deltaSeconds);

      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.rotation += particle.rotationSpeed * deltaSeconds;
      particle.opacity = this.computeOpacity(particle.age, particle.lifespan);

      if (particle.age >= particle.lifespan) {
        continue;
      }

      if (
        particle.x < -stageWidth * 0.5 ||
        particle.x > stageWidth * 1.5 ||
        particle.y < -stageHeight * 0.5 ||
        particle.y > stageHeight * 1.5
      ) {
        continue;
      }

      nextParticles.push(particle);
    }

    this.particles = nextParticles;

    const spawnRate = Math.max(this.config.spawnRate, 0.001);
    const spawnInterval = 1 / spawnRate;

    if (this.particles.length >= this.config.maxParticles) {
      // Avoid building up spawn debt while the system is saturated.
      this.spawnAccumulator = Math.min(this.spawnAccumulator, spawnInterval);
      return;
    }

    while (
      this.spawnAccumulator >= spawnInterval &&
      this.particles.length < this.config.maxParticles
    ) {
      this.spawnParticle(stageWidth, stageHeight);
      this.spawnAccumulator -= spawnInterval;
    }
  }

  computeOpacity(age, lifespan) {
    const fadeIn = this.config.fadeIn;
    const fadeOut = this.config.fadeOut;

    if (fadeIn > 0 && age < fadeIn) {
      return clamp(age / fadeIn, 0, 1);
    }

    if (fadeOut > 0 && age > lifespan - fadeOut) {
      return clamp((lifespan - age) / fadeOut, 0, 1);
    }

    return 1;
  }

  render(ctx, stageWidth, stageHeight) {
    ctx.clearRect(0, 0, stageWidth, stageHeight);
    ctx.fillStyle = this.config.backgroundColor;
    ctx.fillRect(0, 0, stageWidth, stageHeight);

    for (const particle of this.particles) {
      const image = particle.asset.image;
      const drawWidth = image.naturalWidth * particle.scale;
      const drawHeight = image.naturalHeight * particle.scale;

      ctx.save();
      ctx.globalAlpha = particle.opacity;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.drawImage(
        image,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight,
      );
      ctx.restore();
    }
  }
}
