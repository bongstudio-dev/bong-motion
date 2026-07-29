export function sampleNoise(x, y, z = 0) {
  const value =
    Math.sin(x * 2.13 + z * 1.7) +
    Math.cos(y * 1.37 - z * 1.11) +
    Math.sin((x + y) * 0.73 + z * 0.53);

  return value / 3;
}
