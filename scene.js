// scene.js — единая Three.js-сцена приложения
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadModel, prefetchModels } from './models.js';

const COLORS = {
  bg: 0xffffff,
  bone: 0xe8e2d3,
  muscle: 0xa04552,
};

const HIGHLIGHT = {
  bone: { emissive: 0x8a231b, intensity: 0.22 },
  muscle: { emissive: 0x5c130d, intensity: 0.55 },
};

const MUSCLE_XRAY_OPACITY = 0.3;
const TARGET_SKELETON_HEIGHT = 1.8;
const HOVER_THROTTLE_MS = 28;
const TAP_SLOP_PX2 = 36;

let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let canvasEl = null;
let containerEl = null;
let resizeObserver = null;
let observedContainer = null;
let visibilityObserver = null;
let rafId = null;
let disposed = false;
let stageVisible = true;
const containerVisibility = new Map();
let observedVisibilityTarget = null;
let lastTime = performance.now();

let activeSection = null;
let skeletonReady = false;
let skeletonLoading = null;

let groups = null;
let layers = null;
let boneMaterial = null;
let muscleMaterial = null;
let hoverMaterials = null;

const frameSubscribers = new Set();

// --- Наведение: рейкаст по костям и мышцам ---
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let hoverMesh = null;
let hoverPartId = null;
let hoverSubscribers = new Set();
let lastHoverTime = 0;
let pointerDownAt = null;
let touchPinTimer = null;

const HOME = {
  skeleton: {
    pos: new THREE.Vector3(0.2, 1.4, 7.2),
    target: new THREE.Vector3(0, 0.9, 0),
  },
  organs: {
    pos: new THREE.Vector3(0, 1.05, 8.2),
    target: new THREE.Vector3(0, 0, 0),
  },
};

let cameraTween = null;

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function tweenCamera(pos, target, duration = 700, immediate = false) {
  if (!camera || !controls) return;

  if (immediate) {
    camera.position.copy(pos);
    controls.target.copy(target);
    controls.update();
    cameraTween = null;
    return;
  }

  cameraTween = {
    t0: performance.now(),
    duration,
    p0: camera.position.clone(),
    p1: pos.clone(),
    target0: controls.target.clone(),
    target1: target.clone(),
  };
}

function updateCameraTween() {
  if (!cameraTween) return;

  const k = Math.min(1, (performance.now() - cameraTween.t0) / cameraTween.duration);
  const e = easeInOutCubic(k);

  camera.position.lerpVectors(cameraTween.p0, cameraTween.p1, e);
  controls.target.lerpVectors(cameraTween.target0, cameraTween.target1, e);

  if (k >= 1) cameraTween = null;
}

function createMaterials() {
  boneMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.bone,
    roughness: 0.74,
    metalness: 0.02,
  });

  muscleMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.muscle,
    roughness: 0.56,
    metalness: 0.02,
    transparent: true,
    opacity: MUSCLE_XRAY_OPACITY,
    depthWrite: false,
  });

  hoverMaterials = {
    bone: boneMaterial.clone(),
    muscle: muscleMaterial.clone(),
  };
  hoverMaterials.bone.emissive = new THREE.Color(HIGHLIGHT.bone.emissive);
  hoverMaterials.bone.emissiveIntensity = HIGHLIGHT.bone.intensity;
  hoverMaterials.muscle.emissive = new THREE.Color(HIGHLIGHT.muscle.emissive);
  hoverMaterials.muscle.emissiveIntensity = HIGHLIGHT.muscle.intensity;
}

function setupLights() {
  scene.add(new THREE.HemisphereLight(0xfff4e2, 0x9c8c6a, 0.9));

  const key = new THREE.DirectionalLight(0xffe9d0, 0.85);
  key.position.set(0.55, 1.0, 0.85);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xd9e0ec, 0.32);
  fill.position.set(-0.9, 0.35, -0.55);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffe0c2, 0.35);
  rim.position.set(-3, 4, -6);
  scene.add(rim);
}

function setupEnvironment() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();

  scene.environment = pmrem.fromScene(room, 0.04).texture;

  room.dispose?.();
  pmrem.dispose();
}

function disposeMaterial(material) {
  if (!material) return;

  for (const value of Object.values(material)) {
    if (value?.isTexture) value.dispose();
  }

  material.dispose();
}

function applyMaterial(root, material, kind) {
  const replaced = new Set();

  root.traverse(obj => {
    if (!obj.isMesh) return;

    const oldMaterials = Array.isArray(obj.material) ? obj.material : [obj.material];
    oldMaterials.forEach(m => {
      if (m && m !== material) replaced.add(m);
    });

    obj.material = material;
    obj.castShadow = false;
    obj.receiveShadow = false;

    // Имя части: у BodyParts3D узлы зовутся FJxxxx; GLTFLoader суффиксует
    // дочерние меши ("_1", "M"), поэтому достаём числовой код регуляркой.
    const own = (obj.name || '').match(/^FJ(\d+)/i);
    const up = (obj.parent?.name || '').match(/^FJ(\d+)/i);
    const code = own || up;
    if (code) {
      obj.userData.partId = 'FJ' + code[1];
      obj.userData.partKind = kind;
    }
  });

  replaced.forEach(disposeMaterial);
}

function computeSkeletonHome() {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();

  if (layers.skeletal.visible) {
    tmp.setFromObject(layers.skeletal);
    box.union(tmp);
  }

  if (layers.muscular.visible) {
    tmp.setFromObject(layers.muscular);
    box.union(tmp);
  }

  if (box.isEmpty()) box.setFromObject(groups.skeleton);
  if (box.isEmpty()) return HOME.skeleton;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 0.001) * 0.5;

  const aspect = camera?.aspect || 1;
  const vFov = THREE.MathUtils.degToRad(camera?.fov || 38);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

  const dV = radius / Math.tan(vFov / 2);
  const dH = radius / Math.tan(hFov / 2);
  const distance = Math.max(dV, dH) * 1.22;

  const dir = new THREE.Vector3(0.22, 0.14, 1).normalize();

  return {
    pos: center.clone().add(dir.multiplyScalar(distance)),
    target: center,
  };
}

async function ensureSkeleton(onProgress) {
  if (skeletonReady) {
    onProgress?.(100);
    return;
  }

  if (!skeletonLoading) {
    const progress = { skeleton: 0, muscular: 0 };
    const weight = { skeleton: 2566648, muscular: 10537672 };
    const total = weight.skeleton + weight.muscular;

    const report = () => {
      const pct = Math.round(
        100 * (
          progress.skeleton * weight.skeleton +
          progress.muscular * weight.muscular
        ) / total
      );
      onProgress?.(Math.min(100, pct));
    };

    skeletonLoading = Promise.all([
      loadModel('skeleton', evt => {
        if (evt?.total) {
          progress.skeleton = evt.loaded / evt.total;
          report();
        }
      }),
      loadModel('muscular', evt => {
        if (evt?.total) {
          progress.muscular = evt.loaded / evt.total;
          report();
        }
      }),
    ]).then(([skeletal, muscular]) => {
      applyMaterial(skeletal.scene, boneMaterial, 'bone');
      applyMaterial(muscular.scene, muscleMaterial, 'muscle');

      layers.skeletal.add(skeletal.scene);
      layers.muscular.add(muscular.scene);

      // Модели измеряются в сантиметрах (рост ~171 ед.), а вся камера
      // рассчитана на человека высотой ~1.8 ед. Нормализуем масштаб.
      const raw = new THREE.Box3().setFromObject(groups.skeleton);
      const rawSize = raw.getSize(new THREE.Vector3());
      const k = TARGET_SKELETON_HEIGHT / Math.max(rawSize.y, 0.001);
      groups.skeleton.scale.setScalar(k);

      const scaled = new THREE.Box3().setFromObject(groups.skeleton);
      const center = scaled.getCenter(new THREE.Vector3());
      groups.skeleton.position.set(-center.x, -scaled.min.y, -center.z);

      skeletonReady = true;
      HOME.skeleton = computeSkeletonHome();
      onProgress?.(100);
    });
  }

  await skeletonLoading;
}

function observeContainer(container) {
  if (!container) return;

  if (!resizeObserver && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(resize);
  }

  if (resizeObserver) {
    if (observedContainer && observedContainer !== container) {
      resizeObserver.unobserve(observedContainer);
    }
    if (observedContainer !== container) {
      resizeObserver.observe(container);
      observedContainer = container;
    }
  } else {
    window.addEventListener('resize', resize);
  }
}

// Рендер ставится на паузу, когда сцена вне вьюпорта — экономит батарею.
// Видимость отслеживается по каждому контейнеру отдельно: canvas
// переезжает между секциями, и «последний entry» здесь не годится.
function observeVisibility(container) {
  if (!('IntersectionObserver' in window)) return;

  if (!visibilityObserver) {
    visibilityObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        containerVisibility.set(entry.target, entry.isIntersecting);
      }
      syncStageVisibility();
    }, { rootMargin: '120px 0px 120px 0px' });
  }

  if (observedVisibilityTarget && observedVisibilityTarget !== container) {
    visibilityObserver.unobserve(observedVisibilityTarget);
    containerVisibility.delete(observedVisibilityTarget);
  }
  observedVisibilityTarget = container;
  visibilityObserver.observe(container);
}

function syncStageVisibility() {
  const current = containerEl && containerVisibility.get(containerEl);
  stageVisible = current !== false;
  if (stageVisible) resumeLoop();
}

function resize() {
  if (!renderer || !camera || !containerEl) return;

  const w = containerEl.clientWidth;
  const h = containerEl.clientHeight;
  if (!w || !h) return;

  // Динамический pixelRatio: на больших вьюпортах снижаем, чтобы держать 60 fps.
  const dpr = window.devicePixelRatio || 1;
  const cap = w * h > 1300000 ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(dpr, cap));
  renderer.setSize(w, h, false);

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  if (activeSection === 'skeleton' && skeletonReady) {
    HOME.skeleton = computeSkeletonHome();
  }
}

function resumeLoop() {
  if (disposed || rafId || !renderer) return;
  lastTime = performance.now();
  rafId = requestAnimationFrame(renderLoop);
}

function renderLoop(now) {
  rafId = requestAnimationFrame(renderLoop);

  if (disposed || !renderer || !scene || !camera) return;
  if (!canvasEl?.isConnected) return;

  // Пауза вне вьюпорта и на скрытой вкладке: кадры не рисуем вовсе.
  if (document.hidden || !stageVisible) {
    lastTime = now;
    cancelAnimationFrame(rafId);
    rafId = null;
    return;
  }

  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  updateCameraTween();
  controls?.update();

  for (const fn of frameSubscribers) {
    fn({ dt, now, activeSection });
  }

  renderer.render(scene, camera);
}

// ------------------- Наведение -------------------

function canvasPoint(event) {
  const rect = canvasEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    rect,
  };
}

function pickPart(event) {
  if (!layers || !skeletonReady || activeSection !== 'skeleton') return null;

  const point = canvasPoint(event);
  if (!point) return null;

  const targets = [];
  if (layers.skeletal.visible) targets.push(layers.skeletal);
  if (layers.muscular.visible) targets.push(layers.muscular);
  if (targets.length === 0) return null;

  pointerNDC.set(
    (point.x / point.rect.width) * 2 - 1,
    -(point.y / point.rect.height) * 2 + 1
  );

  raycaster.setFromCamera(pointerNDC, camera);

  const hits = raycaster.intersectObjects(targets, true);
  for (const hit of hits) {
    const obj = hit.object;
    if (obj?.userData?.partId) {
      return { partId: obj.userData.partId, kind: obj.userData.partKind, mesh: obj, point: clampPlatePoint(point) };
    }
  }
  return null;
}

// Плашка не должна выезжать за рамку сцены.
function clampPlatePoint(point) {
  const w = point.rect.width;
  const h = point.rect.height;
  return {
    ...point,
    x: Math.min(Math.max(point.x, 10), Math.max(10, w - 268)),
    y: Math.min(Math.max(point.y, 10), Math.max(10, h - 104)),
  };
}

function setHoverMesh(mesh) {
  if (hoverMesh === mesh) return;

  if (hoverMesh) {
    const kind = hoverMesh.userData.partKind;
    const base = kind === 'muscle' ? muscleMaterial : boneMaterial;
    hoverMesh.material = base;
  }

  hoverMesh = mesh;

  if (hoverMesh) {
    const kind = hoverMesh.userData.partKind;
    hoverMesh.material = hoverMaterials[kind];
  }
}

function emitHover(payload) {
  for (const fn of hoverSubscribers) fn(payload);
}

function clearHover(silent = false) {
  setHoverMesh(null);
  hoverPartId = null;
  canvasEl?.classList.remove('stage-pick');
  if (!silent) emitHover({ type: 'leave' });
}

function handlePointerMove(event) {
  if (activeSection !== 'skeleton' || !skeletonReady) return;

  const now = performance.now();
  if (now - lastHoverTime < HOVER_THROTTLE_MS) return;
  lastHoverTime = now;

  // Во время вращения модели подсказки не нужны.
  if (pointerDownAt) return;

  const picked = pickPart(event);
  if (!picked) {
    if (hoverPartId) clearHover();
    return;
  }

  canvasEl.classList.add('stage-pick');

  if (picked.partId !== hoverPartId) {
    setHoverMesh(picked.mesh);
    hoverPartId = picked.partId;
    emitHover({
      type: 'hover',
      partId: picked.partId,
      kind: picked.kind,
      x: picked.point.x,
      y: picked.point.y,
    });
  } else {
    emitHover({
      type: 'move',
      partId: picked.partId,
      kind: picked.kind,
      x: picked.point.x,
      y: picked.point.y,
    });
  }
}

function handlePointerLeave() {
  if (pointerDownAt) return;
  clearHover();
}

function handlePointerDown(event) {
  pointerDownAt = { x: event.clientX, y: event.clientY };
  if (touchPinTimer) {
    clearTimeout(touchPinTimer);
    touchPinTimer = null;
    emitHover({ type: 'leave' });
  }
}

function handlePointerUp(event) {
  if (!pointerDownAt) return;

  const dx = event.clientX - pointerDownAt.x;
  const dy = event.clientY - pointerDownAt.y;
  pointerDownAt = null;

  // Быстрый тап (мобильные): закрепляем плашку у выбранной части.
  if (dx * dx + dy * dy > TAP_SLOP_PX2) return;

  const picked = pickPart(event);
  if (picked) {
    canvasEl.classList.add('stage-pick');
    setHoverMesh(picked.mesh);
    hoverPartId = picked.partId;
    emitHover({
      type: 'pin',
      partId: picked.partId,
      kind: picked.kind,
      x: picked.point.x,
      y: picked.point.y,
    });
  } else {
    clearHover();
  }
}

function attachHoverListeners() {
  if (!canvasEl) return;
  canvasEl.addEventListener('pointermove', handlePointerMove);
  canvasEl.addEventListener('pointerleave', handlePointerLeave);
  canvasEl.addEventListener('pointerdown', handlePointerDown);
  canvasEl.addEventListener('pointerup', handlePointerUp);
}

function detachHoverListeners() {
  if (!canvasEl) return;
  canvasEl.removeEventListener('pointermove', handlePointerMove);
  canvasEl.removeEventListener('pointerleave', handlePointerLeave);
  canvasEl.removeEventListener('pointerdown', handlePointerDown);
  canvasEl.removeEventListener('pointerup', handlePointerUp);
}

// -------------------------------------------------

export function init(container) {
  if (renderer) {
    attachCanvas(container);
    return;
  }

  disposed = false;
  containerEl = container;

  canvasEl = document.createElement('canvas');
  canvasEl.className = 'stage';
  canvasEl.setAttribute('aria-label', 'Трёхмерная анатомическая модель');

  renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });

  renderer.setClearColor(COLORS.bg, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
  camera.position.copy(HOME.skeleton.pos);

  controls = new OrbitControls(camera, canvasEl);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.85;
  controls.autoRotateSpeed = 0.7;
  controls.enablePan = false;
  controls.minDistance = 0.5;
  controls.maxDistance = 12;
  controls.zoomToCursor = true;
  controls.target.copy(HOME.skeleton.target);

  groups = {
    skeleton: new THREE.Group(),
    organs: new THREE.Group(),
  };

  layers = {
    skeletal: new THREE.Group(),
    muscular: new THREE.Group(),
  };

  groups.skeleton.name = 'skeleton-section';
  groups.organs.name = 'organs-section';
  layers.skeletal.name = 'skeletal-layer';
  layers.muscular.name = 'muscular-layer';

  groups.skeleton.add(layers.skeletal, layers.muscular);
  groups.skeleton.visible = false;
  groups.organs.visible = false;

  scene.add(groups.skeleton, groups.organs);

  createMaterials();
  setupLights();
  setupEnvironment();

  attachCanvas(container);
  attachHoverListeners();
  observeVisibility(container);

  lastTime = performance.now();
  rafId = requestAnimationFrame(renderLoop);
}

export function attachCanvas(container) {
  if (!container) return;
  if (!renderer) {
    init(container);
    return;
  }

  containerEl = container;

  if (canvasEl.parentElement !== container) {
    container.appendChild(canvasEl);
  }

  observeContainer(container);
  observeVisibility(container);
  syncStageVisibility();
  resize();
}

export async function showSection(id, options = {}) {
  if (disposed || !groups) return;

  activeSection = id;
  setAutoRotate(false);
  if (id !== 'skeleton') clearHover(true);

  if (id === 'skeleton') {
    await ensureSkeleton(options.onProgress);
    if (activeSection !== id) return;

    groups.skeleton.visible = true;
    groups.organs.visible = false;

    HOME.skeleton = computeSkeletonHome();
    tweenCamera(HOME.skeleton.pos, HOME.skeleton.target, 700, options.immediate === true);
    return;
  }

  if (id === 'organs') {
    groups.skeleton.visible = false;
    groups.organs.visible = true;

    tweenCamera(HOME.organs.pos, HOME.organs.target, 700, options.immediate === true);
  }
}

export function setLayerVisible(layer, visible) {
  if (!layers?.[layer]) return;
  layers[layer].visible = Boolean(visible);

  if (activeSection === 'skeleton' && skeletonReady) {
    HOME.skeleton = computeSkeletonHome();
  }
}

export function setMuscleOpacity(opacity) {
  if (!muscleMaterial) return;

  muscleMaterial.opacity = opacity;
  muscleMaterial.transparent = opacity < 1;
  muscleMaterial.depthWrite = opacity >= 0.9;
  muscleMaterial.needsUpdate = true;

  if (hoverMaterials?.muscle) {
    hoverMaterials.muscle.opacity = opacity;
    hoverMaterials.muscle.transparent = opacity < 1;
    hoverMaterials.muscle.depthWrite = opacity >= 0.9;
    hoverMaterials.muscle.needsUpdate = true;
  }
}

export function setAutoRotate(on) {
  if (controls) controls.autoRotate = Boolean(on);
}

export function resetView() {
  const home = HOME[activeSection] || HOME.skeleton;
  tweenCamera(home.pos, home.target);
}

// Пресеты фокуса камеры: голова, туловище, рука, ноги.
// Модель нормализована: стоит на y=0, рост 1.8, центр по X/Z в нуле.
const FOCUS_PRESETS = {
  head: { target: new THREE.Vector3(0, 1.62, 0), dist: 1.15, dir: new THREE.Vector3(0.18, 0.1, 1) },
  torso: { target: new THREE.Vector3(0, 1.18, 0), dist: 1.45, dir: new THREE.Vector3(0.22, 0.08, 1) },
  arm: { target: new THREE.Vector3(0.42, 1.28, 0), dist: 0.95, dir: new THREE.Vector3(1, 0.12, 0.5) },
  leg: { target: new THREE.Vector3(0, 0.45, 0), dist: 1.5, dir: new THREE.Vector3(0.2, 0.05, 1) },
};

export function focusPart(name) {
  if (!camera || !controls || !skeletonReady) return;

  const preset = FOCUS_PRESETS[name];
  if (!preset) return;

  setAutoRotate(false);
  const pos = preset.target.clone().add(preset.dir.clone().normalize().multiplyScalar(preset.dist));
  tweenCamera(pos, preset.target, 650);
}

export function subscribeFrame(fn) {
  frameSubscribers.add(fn);
  return () => frameSubscribers.delete(fn);
}

export function subscribeHover(fn) {
  hoverSubscribers.add(fn);
  return () => hoverSubscribers.delete(fn);
}

export function hidePartPlate() {
  clearHover(true);
  emitHover({ type: 'leave' });
}

export function getRenderer() { return renderer; }
export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getControls() { return controls; }
export function getCanvas() { return canvasEl; }
export function getOrgansGroup() { return groups?.organs || null; }
export function getSkeletonGroup() { return groups?.skeleton || null; }
export function getSkeletonLayer(layer) { return layers?.[layer] || null; }
export function getActiveSection() { return activeSection; }

export { prefetchModels };

export function dispose() {
  if (disposed) return;
  disposed = true;

  cancelAnimationFrame(rafId);
  rafId = null;
  frameSubscribers.clear();
  hoverSubscribers.clear();
  detachHoverListeners();
  clearHover(true);

  if (touchPinTimer) {
    clearTimeout(touchPinTimer);
    touchPinTimer = null;
  }

  resizeObserver?.disconnect();
  resizeObserver = null;
  observedContainer = null;
  visibilityObserver?.disconnect();
  visibilityObserver = null;
  observedVisibilityTarget = null;
  containerVisibility.clear();
  window.removeEventListener('resize', resize);

  controls?.dispose();

  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  scene?.traverse(obj => {
    if (obj.geometry) geometries.add(obj.geometry);

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(mat => {
      if (!mat) return;
      materials.add(mat);
      Object.values(mat).forEach(value => {
        if (value?.isTexture) textures.add(value);
      });
    });
  });

  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
  textures.forEach(t => t.dispose());

  hoverMaterials?.bone?.dispose();
  hoverMaterials?.muscle?.dispose();
  hoverMaterials = null;

  scene?.environment?.dispose?.();
  renderer?.dispose();
  renderer?.forceContextLoss?.();

  canvasEl?.remove();

  renderer = null;
  scene = null;
  camera = null;
  controls = null;
  canvasEl = null;
  containerEl = null;
  groups = null;
  layers = null;
  boneMaterial = null;
  muscleMaterial = null;
  hoverMesh = null;
  hoverPartId = null;
  skeletonReady = false;
  skeletonLoading = null;
  activeSection = null;
  stageVisible = true;
}
