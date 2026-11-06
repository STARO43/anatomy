// models.js — загрузка, кэширование и освобождение 3D-моделей
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const cache = new Map();
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

// База путей: по умолчанию модели лежат рядом со сборкой;
// можно переопределить переменной окружения VITE_MODELS_BASE.
const MODELS_BASE = import.meta.env.VITE_MODELS_BASE || './';

const MODEL_PATHS = {
  skeleton: `${MODELS_BASE}skeletal.glb`,
  muscular: `${MODELS_BASE}muscular.glb`,
  heart: `${MODELS_BASE}heart.glb`,
  brain: `${MODELS_BASE}brain.glb`,
  lungs: `${MODELS_BASE}lungs.glb`,
  liver: `${MODELS_BASE}liver.glb`,
  kidneys: `${MODELS_BASE}kidneys.glb`,
  eyeball: `${MODELS_BASE}eyeball.glb`,
  intestine: `${MODELS_BASE}intestine.glb`,
  pancreas: `${MODELS_BASE}pancreas.glb`,
  skin: `${MODELS_BASE}skin.glb`,
};

export async function loadModel(id, onProgress) {
  if (cache.has(id)) return cache.get(id);
  const path = MODEL_PATHS[id];
  if (!path) throw new Error(`models.js: unknown model id "${id}"`);
  const gltf = await loader.loadAsync(path, onProgress);
  cache.set(id, gltf);
  return gltf;
}

export function getModel(id) {
  return cache.get(id) || null;
}

// Прогрев HTTP-кэша двумя ключевыми моделями в простое:
// когда читатель дойдёт до скелета, модели загрузятся мгновенно.
export function prefetchModels() {
  if (cache.size > 0) return;

  const conn = navigator.connection;
  if (conn && (conn.saveData || /^2g$/i.test(conn.effectiveType || ''))) return;

  const warm = path => {
    try {
      fetch(path, { priority: 'low', mode: 'cors' }).catch(() => {});
    } catch {
      /* prefetch — необязательная оптимизация */
    }
  };

  warm(MODEL_PATHS.skeleton);
  warm(MODEL_PATHS.muscular);
}

export function disposeModel(id) {
  const gltf = cache.get(id);
  if (!gltf) return;
  gltf.scene.traverse(obj => {
    if (obj.isMesh) {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => m?.dispose());
    }
  });
  cache.delete(id);
}

export function disposeAllModels() {
  for (const id of Array.from(cache.keys())) disposeModel(id);
}
