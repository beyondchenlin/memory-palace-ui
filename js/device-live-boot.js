/* The reference owns the app and controls. This adapter only adds a 3D body. */
const rig = document.getElementById('device-rig');
const unit = document.getElementById('device-unit');
const screen = document.querySelector('.device-screen');
const bezel = screen.parentElement;
const phoneQuery = matchMedia('(max-width: 540px)');
let mesh;
let modeVersion = 0;

function restoreReference() {
  const previous = mesh;
  mesh = null;
  delete window.LT_MESH;
  previous?.dispose();
  document.body.classList.remove('has-live-3d');
  screen.classList.remove('is-live-3d-screen');
  screen.removeAttribute('style');
  screen.removeAttribute('data-model');
  bezel.appendChild(screen);
}

function sync() {
  if (!mesh) return;
  mesh.setModelUiId(unit.dataset.model);
  mesh.setFinish(unit.dataset.shell);
  const orbit = window.LT_SHELL.getOrbit();
  mesh.setRotation(orbit.rotX, orbit.rotY);
}

async function updateMode() {
  const version = ++modeVersion;
  if (window.LT_SHELL.isRealPhone()) {
    restoreReference();
    return;
  }
  if (mesh) return;
  // Real phones never download Three.js. Resize imports the cached adapter on demand.
  let createDeviceMesh;
  try {
    ({ createDeviceMesh } = await import('./device-live-mesh.js'));
  } catch (error) {
    console.warn('[palace] 3D module unavailable; keeping the reference shell', error);
    return;
  }
  if (version !== modeVersion || window.LT_SHELL.isRealPhone()) return;
  const mount = document.createElement('div');
  mount.className = 'device-webgl-mount';
  mount.id = 'device-webgl-mount';
  mount.setAttribute('aria-hidden', 'true');
  rig.appendChild(mount);
  try {
    mesh = createDeviceMesh({ mount, screenEl: screen, unit, rig });
    window.LT_MESH = mesh;
    document.body.classList.add('has-live-3d');
    sync();
    mesh.resize();
  } catch (error) {
    mount.remove();
    restoreReference();
    console.warn('[palace] 3D unavailable; keeping the working reference shell', error);
  }
}

document.addEventListener('lt-shell-render', event => {
  mesh?.setRotation(event.detail.x, event.detail.y);
});
new MutationObserver(sync).observe(unit, {
  attributes: true, attributeFilter: ['data-model', 'data-shell'],
});
phoneQuery.addEventListener('change', updateMode);
screen.addEventListener('lt-3d-context-lost', () => { if (mesh) restoreReference(); });
window.addEventListener('pagehide', event => { if (!event.persisted) mesh?.dispose(); });
updateMode();
