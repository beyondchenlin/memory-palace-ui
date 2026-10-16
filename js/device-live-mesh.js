import * as THREE from 'three';

const WIDTH = 422, HEIGHT = 876, SCREEN_W = 390, SCREEN_H = 844;
const MODELS = {
  island: { radius: 52, screenRadius: 40, depth: 36 },
  notch: { radius: 48, screenRadius: 36, depth: 38 },
  hole: { radius: 34, screenRadius: 24, depth: 32 },
  clean: { radius: 44, screenRadius: 32, depth: 30 },
};
const FINISHES = {
  obsidian: '#1a1c20', sterling: '#c5cad3', champagne: '#c9a86a',
  cobalt: '#1e3a6e', crimson: '#8b1e2d', glacier: '#7eb8d4',
  amethyst: '#5b3d8a', graphite: '#4a4d52', pearl: '#e8e4dc', sand: '#b5a894',
};

function roundedShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function slab(w, h, r, depth, bevel, material) {
  const geom = new THREE.ExtrudeGeometry(roundedShape(w - bevel * 2, h - bevel * 2, r - bevel), {
    depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelSegments: 4,
    steps: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: 20,
  });
  geom.translate(0, 0, -depth + bevel);
  return new THREE.Mesh(geom, material);
}

// Homography from native UI coordinates to the four projected screen corners.
// Semantic TL/TR/BR/BL never changes with rotation, avoiding mirrored or twisted UI.
function screenMatrix(points) {
  const [a, b, c, d] = points;
  const dx1 = b.x - c.x, dx2 = d.x - c.x;
  const dy1 = b.y - c.y, dy2 = d.y - c.y;
  const dx3 = a.x - b.x + c.x - d.x, dy3 = a.y - b.y + c.y - d.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  const m = [
    (b.x - a.x + g * b.x) / SCREEN_W, (b.y - a.y + g * b.y) / SCREEN_W, 0, g / SCREEN_W,
    (d.x - a.x + h * d.x) / SCREEN_H, (d.y - a.y + h * d.y) / SCREEN_H, 0, h / SCREEN_H,
    0, 0, 1, 0, a.x, a.y, 0, 1,
  ];
  return 'matrix3d(' + m.join(',') + ')';
}

// Small procedural studio environment: broad softboxes give metal continuous reflections.
// No external HDR, model, texture, screenshot capture or network request is needed.
function studioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#69717f');
  const panels = [
    [-450, 200, 500, 200, 1100, '#ffffff', 4],
    [500, 80, 200, 100, 950, '#d8e7ff', 3],
    [0, 750, -150, 950, 200, '#ffffff', 5],
    [-250, -500, -500, 600, 250, '#c6cbd4', 1.5],
  ];
  for (const [x, y, z, w, h, color, strength] of panels) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, 0.035, 1, 2000);
  studio.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  pmrem.dispose();
  return environment;
}

export function createDeviceMesh({ mount, screenEl, unit, rig }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.className = 'device-webgl';
  renderer.domElement.style.filter = 'drop-shadow(0 24px 24px #00000055)';
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const environment = studioEnvironment(renderer);
  scene.environment = environment.texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
  camera.position.set(0, 0, 2400);
  const key = new THREE.DirectionalLight('#fff8ef', 2.2);
  key.position.set(-500, 800, 1500);
  scene.add(key, new THREE.HemisphereLight('#edf3ff', '#404753', 1.4));
  const fill = new THREE.DirectionalLight('#b8d4ff', 1);
  fill.position.set(500, -100, 700);
  scene.add(fill);

  const root = new THREE.Group();
  root.rotation.order = 'XYZ';
  scene.add(root);
  const metal = new THREE.MeshPhysicalMaterial({ color: FINISHES.obsidian, metalness: 0.92, roughness: 0.28, envMapIntensity: 1.2, clearcoat: 0.3, clearcoatRoughness: 0.24 });
  const trim = new THREE.MeshPhysicalMaterial({ color: '#abb1ba', metalness: 1, roughness: 0.18, envMapIntensity: 1.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#080a0e', metalness: 0.05, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 });
  const back = new THREE.MeshPhysicalMaterial({ color: FINISHES.obsidian, metalness: 0.3, roughness: 0.42, clearcoat: 0.5 });
  const antenna = new THREE.MeshStandardMaterial({ color: '#9fa6af', metalness: 0.1, roughness: 0.7 });
  const lens = new THREE.MeshPhysicalMaterial({ color: '#06101c', metalness: 0.35, roughness: 0.12, clearcoat: 1 });
  const materials = [metal, trim, glass, back, antenna, lens];

  let modelId, finishId, disposed = false, raf = 0;
  let targetX = 0, targetY = 0, viewX = 0, viewY = 0;
  let lastTime = 0, dirty = true, lastWidth = 0, lastHeight = 0;
  let projection;
  let reduced = matchMedia('(prefers-reduced-motion: reduce)');

  function clearGeometry() {
    root.traverse(o => o.geometry?.dispose());
    root.clear();
  }

  function buildModel(id) {
    const model = MODELS[id] || MODELS.island;
    clearGeometry();
    root.add(slab(WIDTH, HEIGHT, model.radius, model.depth, 3.2, metal));
    const lip = slab(WIDTH - 8, HEIGHT - 8, model.radius - 4, 0.7, 0.2, trim);
    lip.position.z = 0.9;
    root.add(lip);
    const front = slab(WIDTH - 10, HEIGHT - 10, model.radius - 5, 0.4, 0.1, glass);
    front.position.z = 1.4;
    root.add(front);
    const rear = slab(WIDTH - 6, HEIGHT - 6, model.radius - 3, 1.5, 0.5, back);
    rear.rotation.y = Math.PI;
    rear.position.z = -model.depth - 0.3;
    root.add(rear);
    // Recessed antenna lines and separate mechanical side keys.
    for (const side of [-1, 1]) {
      for (const y of [-HEIGHT * 0.34, HEIGHT * 0.34]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, model.depth - 7), antenna);
        band.position.set(side * (WIDTH / 2 - 0.2), y, -model.depth / 2);
        root.add(band);
      }
      const keys = side < 0 ? [[220, 28], [135, 57], [55, 57]] : [[105, 82]];
      for (const [y, h] of keys) {
        const button = slab(5, h, 2.4, 16, 0.8, metal);
        button.position.set(side * (WIDTH / 2 + 1), y, -model.depth / 2 + 8);
        root.add(button);
      }
    }
    const cameraPlate = slab(150, 166, 28, 7, 2, metal);
    cameraPlate.rotation.y = Math.PI;
    cameraPlate.position.set(-104, 316, -model.depth - 1);
    root.add(cameraPlate);
    for (const [x, y] of [[-140, 356], [-70, 316], [-140, 276]]) {
      for (const [radius, depth, mat] of [[27, 6, trim], [23, 7, glass], [15, 7.5, lens]]) {
        const eye = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 48), mat);
        eye.rotation.x = Math.PI / 2;
        eye.position.set(x, y, -model.depth - 8);
        root.add(eye);
      }
    }
    screenEl.dataset.model = id;
    screenEl.style.setProperty('--live-screen-radius', model.screenRadius + 'px');
  }

  function setModelUiId(id) {
    id = MODELS[id] ? id : 'island';
    if (id === modelId) return;
    modelId = id;
    buildModel(id);
    invalidate();
  }

  function setFinish(id) {
    if (finishId === id) return;
    finishId = id;
    const color = new THREE.Color(FINISHES[id] || FINISHES.obsidian);
    metal.color.copy(color);
    back.color.copy(color);
    trim.color.copy(color).lerp(new THREE.Color('#eef2f7'), 0.28);
    invalidate();
  }

  function setRotation(x, y) {
    const nextX = THREE.MathUtils.clamp(Number(x) || 0, -68, 68);
    const nextY = THREE.MathUtils.clamp(Number(y) || 0, -80, 80);
    if (nextX === targetX && nextY === targetY) return;
    targetX = nextX;
    targetY = nextY;
    invalidate();
  }

  function layout() {
    const rect = mount.getBoundingClientRect();
    const box = unit.getBoundingClientRect();
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    if (w !== lastWidth || h !== lastHeight) {
      renderer.setSize(w, h, false);
      lastWidth = w; lastHeight = h;
    }
    const centerX = box.left + box.width / 2 - rect.left;
    const centerY = box.top + box.height / 2 - rect.top;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(h / (2 * camera.position.z)));
    camera.aspect = w / h;
    camera.setViewOffset(w, h, w / 2 - centerX, h / 2 - centerY, w, h);
    camera.updateProjectionMatrix();
    root.scale.setScalar(box.width / WIDTH);
    root.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const corners = [[-SCREEN_W / 2, SCREEN_H / 2], [SCREEN_W / 2, SCREEN_H / 2], [SCREEN_W / 2, -SCREEN_H / 2], [-SCREEN_W / 2, -SCREEN_H / 2]];
    const points = corners.map(([x, y]) => {
      const p = new THREE.Vector3(x, y, 1.6).applyMatrix4(root.matrixWorld).project(camera);
      return { x: (p.x + 1) * w / 2 + rect.left + scrollX, y: (1 - p.y) * h / 2 + rect.top + scrollY };
    });
    projection = { tl: points[0], tr: points[1], br: points[2], bl: points[3] };
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    projection.aabb = { left: Math.min(...xs) - scrollX, top: Math.min(...ys) - scrollY, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    screenEl.style.transform = screenMatrix(points);
  }

  function render(time) {
    raf = 0;
    if (disposed || document.hidden) return;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = time;
    const damping = reduced.matches ? 1 : 1 - Math.exp(-19 * dt);
    viewX += (targetX - viewX) * damping;
    viewY += (targetY - viewY) * damping;
    const moving = Math.abs(viewX - targetX) + Math.abs(viewY - targetY) > 0.015;
    if (!moving) { viewX = targetX; viewY = targetY; }
    root.rotation.x = THREE.MathUtils.degToRad(-viewX);
    root.rotation.y = THREE.MathUtils.degToRad(viewY);
    layout();
    renderer.render(scene, camera);
    dirty = false;
    if (moving) raf = requestAnimationFrame(render);
  }
  function invalidate() {
    dirty = true;
    if (!disposed && !raf && !document.hidden) raf = requestAnimationFrame(render);
  }
  function visibility() { if (!document.hidden) { lastTime = 0; invalidate(); } }
  const observer = new ResizeObserver(invalidate);
  observer.observe(rig);
  observer.observe(unit);
  observer.observe(document.querySelector('.stage'));
  document.fonts?.ready.then(invalidate);
  window.addEventListener('resize', invalidate);
  window.addEventListener('scroll', invalidate, { passive: true });
  document.addEventListener('visibilitychange', visibility);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    screenEl.dispatchEvent(new CustomEvent('lt-3d-context-lost', { bubbles: true }));
  });
  document.body.appendChild(screenEl);
  screenEl.classList.add('is-live-3d-screen');
  setModelUiId(unit.dataset.model);
  setFinish(unit.dataset.shell);
  invalidate();

  return {
    setModelUiId, setFinish, setRotation, resize: invalidate,
    getProjection: () => projection,
    getOverlayMode: () => true,
    getState: () => ({ model: modelId, finish: finishId, viewX, viewY, targetX, targetY, draws: renderer.info.render.calls, pending: !!raf, dirty }),
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('scroll', invalidate);
      document.removeEventListener('visibilitychange', visibility);
      clearGeometry();
      materials.forEach(material => material.dispose());
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      mount.remove();
    },
  };
}
