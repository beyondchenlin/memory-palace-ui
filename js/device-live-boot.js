/* The reference owns the app and controls. This adapter only adds a 3D body. */
const rig = document.getElementById('device-rig');
const unit = document.getElementById('device-unit');
const screen = document.querySelector('.device-screen');
const bezel = screen.parentElement;
const phoneQuery = matchMedia('(max-width: 540px)');
// Optional fonts must never hold the working app or 3D behind a network request.
const fontSheet = document.getElementById('optional-webfonts');
if (fontSheet) {
  if (fontSheet.sheet) fontSheet.media = 'all';
  else fontSheet.addEventListener('load', () => { fontSheet.media = 'all'; }, { once: true });
}
let mesh;
let modeVersion = 0;
let warmModel;
function requestInitialModel() {
  const profile = window.LT_DEVICES.get(unit.dataset.model);
  const controller = new AbortController();
  const bytes = fetch(profile.asset, {signal: controller.signal}).then(response => {
    if (!response.ok) throw Error('Handset '+response.status);
    return response.arrayBuffer();
  });
  // Observe early failures immediately; the renderer handles the same rejection.
  bytes.catch(() => {});
  return {id: profile.id, bytes, abort: () => controller.abort()};
}
const loadStatus = document.createElement('p');
loadStatus.className = 'device-load-status';
loadStatus.setAttribute('role', 'status');
loadStatus.hidden = true;
document.getElementById('shell-model-panel').appendChild(loadStatus);

function restoreReference() {
  warmModel?.abort(); warmModel = null;
  const previous = mesh;
  mesh = null;
  delete window.LT_MESH;
  previous?.dispose();
  document.body.classList.remove('has-live-3d');
  screen.classList.remove('is-live-3d-screen');
  screen.removeAttribute('style');
  screen.removeAttribute('data-model');
  screen.removeAttribute('data-top-chrome');
  screen.inert = false;
  bezel.appendChild(screen);
}

function sync() {
  if (!mesh) return;
  mesh.setModelUiId(unit.dataset.model).catch(error => {
    console.warn('[palace] Selected handset unavailable', error);
  });
  mesh.setFinish(unit.dataset.shell);
  const orbit = window.LT_SHELL.getOrbit();
  mesh.setRotation(orbit.rotX, orbit.rotY);
}

async function updateMode() {
  if (window.LT_SHELL.isRealPhone()) {
    ++modeVersion;
    restoreReference();
    return;
  }
  if (mesh) return;
  // A viewport query can change without leaving forced-shell mode. Do not
  // invalidate the renderer that is already waiting for its first handset.
  const version = ++modeVersion;
  // Fetch the desktop renderer dependency in parallel with its small adapter.
  if (!document.querySelector('link[data-three-preload]')) {
    const preload = document.createElement('link');
    preload.rel = 'modulepreload'; preload.href = 'vendor/three/three.module.js?v=20261016-appearance1';
    preload.dataset.threePreload = 'true'; document.head.appendChild(preload);
  }
  // Leave a browser paint for the already working CSS shell and app controls.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (version !== modeVersion || window.LT_SHELL.isRealPhone()) return;
  // Only the selected asset: overlap its download with engine and HDR setup.
  const initialModel = warmModel = requestInitialModel();
  // Real phones never download Three.js. Resize imports the cached adapter on demand.
  let createDeviceMesh, lightingImage;
  try {
    const module = await import('./device-live-mesh.js?v=20261016-appearance1');
    createDeviceMesh = module.createDeviceMesh;
    lightingImage = await module.loadStudioLighting();
  } catch (error) {
    initialModel.abort();
    if (warmModel === initialModel) warmModel = null;
    console.warn('[palace] 3D module unavailable; keeping the reference shell', error);
    return;
  }
  if (version !== modeVersion || window.LT_SHELL.isRealPhone()) {
    initialModel.abort();
    if (warmModel === initialModel) warmModel = null;
    return;
  }
  if (initialModel.id !== unit.dataset.model) {
    initialModel.abort();
    warmModel = requestInitialModel();
  }
  const mount = document.createElement('div');
  mount.className = 'device-webgl-mount';
  mount.id = 'device-webgl-mount';
  mount.setAttribute('aria-hidden', 'true');
  rig.appendChild(mount);
  let candidate;
  try {
    candidate = createDeviceMesh({ mount, screenEl: screen, unit, rig, lightingImage, initialModel: warmModel });
    warmModel = null; // Its lifetime now belongs to the renderer.
    mesh = candidate;
    sync();
    await candidate.ready;
    if (mesh !== candidate || version !== modeVersion || window.LT_SHELL.isRealPhone()) {
      candidate.dispose();
      return;
    }
    document.body.classList.add('has-live-3d');
    candidate.activate();
    window.LT_MESH = candidate;
    sync();
    mesh.resize();
  } catch (error) {
    warmModel?.abort(); warmModel = null;
    mount.remove();
    candidate?.dispose();
    if (!candidate || mesh === candidate) restoreReference();
    console.warn('[palace] 3D unavailable; keeping the working reference shell', error);
  }
}

document.addEventListener('lt-shell-render', event => {
  mesh?.setRotation(event.detail.x, event.detail.y);
});
new MutationObserver(sync).observe(unit, {
  attributes: true, attributeFilter: ['data-model', 'data-shell'],
});
screen.addEventListener('lt-model-load-error', () => {
  const previous = mesh?.getState().model;
  if (!previous) return; // First-load failures use the working CSS shell below.
  window.LT_SHELL.applyModel(previous);
  const messages = {
    en: 'This phone could not load. Select it again to retry.',
    zh: '这款手机加载失败，可以再次选择重试。',
    ja: '読み込めませんでした。もう一度選択してください。',
    es: 'No se pudo cargar. Selecciónalo de nuevo para reintentar.',
    ko: '휴대폰을 불러오지 못했습니다. 다시 선택해 주세요.',
  };
  loadStatus.textContent = messages[document.documentElement.lang.split('-')[0]] || messages.en;
  loadStatus.hidden = false;
});
document.getElementById('shell-model-panel').addEventListener('click', event => {
  if (event.target.closest('.shell-model')) loadStatus.hidden = true;
}, true);
phoneQuery.addEventListener('change', updateMode);
screen.addEventListener('lt-3d-context-lost', () => { if (mesh) restoreReference(); });
window.addEventListener('pagehide', event => { if (!event.persisted) mesh?.dispose(); });
updateMode();
