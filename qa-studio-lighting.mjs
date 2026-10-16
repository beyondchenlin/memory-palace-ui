import * as THREE from 'three';
export function studioEnvironment(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#b4bdc9'); sky.addColorStop(0.45, '#525d6d');
  sky.addColorStop(0.7, '#343c49'); sky.addColorStop(1, '#20252d');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 256);
  for (const [x, width, intensity] of [[78, 42, 0.95], [300, 72, 0.7], [470, 24, 0.5]]) {
    const strip = ctx.createLinearGradient(x - width, 0, x + width, 0);
    strip.addColorStop(0, 'rgba(240,246,255,0)');
    strip.addColorStop(0.4, `rgba(240,246,255,${intensity})`);
    strip.addColorStop(0.6, `rgba(240,246,255,${intensity})`);
    strip.addColorStop(1, 'rgba(240,246,255,0)');
    ctx.fillStyle = strip; ctx.fillRect(x - width, 20, width * 2, 216);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(texture);
  texture.dispose();
  pmrem.dispose();
  return environment;
}
