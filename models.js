// models.js — загрузка, кэширование и освобождение 3D-моделей
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const cache = new Map();
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const MODEL_PATHS = {
  skeleton: './skeletal.glb',
  muscular: './muscular.glb',
  heart: './heart.glb',
  brain: './brain.glb',
  lungs: './lungs.glb',
  liver: './liver.glb',
  kidneys: './kidneys.glb',
  eyeball: './eyeball.glb',
  intestine: './intestine.glb',
  pancreas: './pancreas.glb',
  skin: './skin.glb',
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