import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const params = new URLSearchParams(location.search);
const modelUrl = params.get('model') || './model.glb';
const spin = params.get('spin') !== '0';
const animationEnabled = params.get('animate') !== '0';
const requestedAnimationIndex = Math.max(0, Number.parseInt(params.get('clip') || '0', 10) || 0);
const requestedAnimationProgressValue = Number(params.get('animationFrame'));
const requestedAnimationProgress = Number.isFinite(requestedAnimationProgressValue)
  ? Math.max(0, Math.min(1, requestedAnimationProgressValue))
  : null;
const fixedView = params.get('view');
const strictComparison = params.get('strict') === '1';
const onlyEngine = params.get('only') === 'three' ? 'three' : null;
const animationEpoch = performance.now();
let sharedFrameSize = null;
const $ = (selector) => document.querySelector(selector);
if (onlyEngine) document.body.dataset.only = onlyEngine;

const viewYaw = { front: 0, 'three-quarter': 45, side: 90, back: 180 };
const comparisonYaw = (now) => Object.hasOwn(viewYaw, fixedView)
  ? viewYaw[fixedView]
  : spin
    ? ((now - animationEpoch) * 0.006) % 360
    : 15;

const state = {
  status: 'loading',
  modelUrl,
  animationState: { status: 'loading', playing: false },
  validation: { status: 'loading' },
  inspection: null,
  config: null,
  reference: { status: 'loading' },
  three: { status: 'loading' },
  playcanvas: { status: 'loading' },
};
window.__SKETCHFAB_AB__ = state;

const animationController = {
  playing: animationEnabled && requestedAnimationProgress === null,
  selectedIndex: requestedAnimationIndex,
  seekTime: 0,
  epoch: animationEpoch,
  catalog: [],
  engines: new Map(),
};

function animationTime(duration, now = performance.now()) {
  if (!duration) return 0;
  const elapsed = animationController.playing ? (now - animationController.epoch) / 1000 : 0;
  return (animationController.seekTime + elapsed) % duration;
}

function resetAnimationClock(time = 0) {
  animationController.seekTime = Math.max(0, time);
  animationController.epoch = performance.now();
}

function currentAnimation() {
  return animationController.catalog[animationController.selectedIndex] || null;
}

function refreshAnimationState() {
  const clip = currentAnimation();
  const now = performance.now();
  const extrapolate = (engineState) => {
    if (!Number.isFinite(engineState.animationTime)) return null;
    if (!animationController.playing || !clip?.duration || !Number.isFinite(engineState.animationSampleAt)) {
      return engineState.animationTime;
    }
    return (engineState.animationTime + (now - engineState.animationSampleAt) / 1000) % clip.duration;
  };
  const threeTime = extrapolate(state.three);
  const hasClip = Boolean(clip);
  const status = !hasClip
    ? 'none'
    : !Number.isFinite(threeTime)
      ? 'loading'
        : animationController.playing
          ? 'playing'
          : 'paused';
  state.animationState = {
    status,
    playing: Boolean(hasClip && animationController.playing),
    selectedIndex: hasClip ? animationController.selectedIndex : null,
    name: clip?.name || null,
    duration: clip?.duration || 0,
    channels: clip?.channels ?? null,
    jointChannels: clip?.jointChannels ?? null,
    morphChannels: clip?.morphChannels ?? null,
    morphTargets: clip?.morphTargets ?? null,
    threeTime,
    deltaSeconds: null,
    synchronized: true,
  };
  document.body.dataset.animationState = state.animationState.status;
  document.body.dataset.animationDetails = JSON.stringify(state.animationState);
}

function updateAnimationControls(now = performance.now()) {
  const clip = currentAnimation();
  if (!clip) return;
  const time = animationTime(clip.duration, now);
  $('#animation-scrub').value = clip.duration ? String(time / clip.duration) : '0';
  $('#animation-output').textContent = `${time.toFixed(2)} / ${clip.duration.toFixed(2)}s`;
  $('#animation-toggle').textContent = animationController.playing ? 'Pause' : 'Play';
}

function configureAnimationControls(catalog) {
  if (!catalog.length || animationController.catalog.length) return;
  const inspectedAnimations = state.inspection?.animations || [];
  const inspectedJoints = (state.inspection?.skins || []).reduce((sum, skin) => sum + skin.joints, 0);
  animationController.catalog = catalog.map((clip, index) => ({
    ...clip,
    channels: inspectedAnimations[index]?.channels ?? clip.channels,
    jointChannels: inspectedAnimations[index]?.jointChannels ?? clip.jointChannels,
    morphChannels: inspectedAnimations[index]?.morphChannels ?? clip.morphChannels,
    joints: inspectedJoints || clip.joints,
    morphTargets: state.inspection?.morphTargets ?? clip.morphTargets,
  }));
  animationController.selectedIndex = Math.min(animationController.selectedIndex, catalog.length - 1);
  if (requestedAnimationProgress !== null) {
    animationController.seekTime = requestedAnimationProgress * animationController.catalog[animationController.selectedIndex].duration;
    animationController.epoch = performance.now();
  }
  const select = $('#animation-select');
  select.replaceChildren(...catalog.map((clip, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${clip.name} (${clip.duration.toFixed(2)}s)`;
    return option;
  }));
  select.value = String(animationController.selectedIndex);
  $('#animation-controls').hidden = false;
  const selected = currentAnimation();
  $('#animation-shape-counts').textContent = `${selected.joints ?? 0} joints · ${selected.morphTargets ?? 0} morph targets`;
  updateAnimationControls();
  refreshAnimationState();
}

async function loadReports() {
  try {
    const [inspectionResponse, validationResponse, configResponse] = await Promise.all([
      fetch(`${modelUrl}.inspection.json`),
      fetch(`${modelUrl}.validation.json`),
      fetch('./viewer-config.json'),
    ]);
    if (!inspectionResponse.ok || !validationResponse.ok || !configResponse.ok) {
      throw new Error(`inspection HTTP ${inspectionResponse.status}; validation HTTP ${validationResponse.status}; config HTTP ${configResponse.status}`);
    }
    state.inspection = await inspectionResponse.json();
    const validation = await validationResponse.json();
    state.config = await configResponse.json();
    state.validation = {
      status: validation.valid ? 'valid' : 'invalid',
      valid: validation.valid,
      summary: validation.validator?.summary || {},
      unsupportedExtensions: validation.extensions?.unsupported || [],
      archivedExtensions: validation.extensions?.archived || [],
      oversizedTextures: validation.textures?.oversized || [],
    };
    const summary = state.validation.summary;
    const node = $('#validation-summary');
    node.dataset.valid = String(validation.valid);
    node.textContent = `Khronos: ${summary.errors || 0} errors · ${summary.warnings || 0} warnings`;
  } catch (error) {
    state.validation = { status: 'missing', error: error instanceof Error ? error.message : String(error) };
    $('#validation-summary').textContent = 'Validation report unavailable';
  }
}

function selectAnimation(index) {
  animationController.selectedIndex = Math.max(0, Math.min(index, animationController.catalog.length - 1));
  resetAnimationClock(0);
  for (const engine of animationController.engines.values()) engine.select(animationController.selectedIndex);
  const selected = currentAnimation();
  $('#animation-shape-counts').textContent = `${selected?.joints ?? 0} joints · ${selected?.morphTargets ?? 0} morph targets`;
  updateAnimationControls();
}

$('#animation-select').addEventListener('change', (event) => selectAnimation(Number(event.target.value)));
$('#animation-toggle').addEventListener('click', () => {
  const clip = currentAnimation();
  if (!clip) return;
  if (animationController.playing) {
    animationController.seekTime = animationTime(clip.duration);
    animationController.playing = false;
  } else {
    animationController.playing = true;
    animationController.epoch = performance.now();
  }
  updateAnimationControls();
  refreshAnimationState();
});
$('#animation-scrub').addEventListener('input', (event) => {
  const clip = currentAnimation();
  if (!clip) return;
  animationController.playing = false;
  resetAnimationClock(Number(event.target.value) * clip.duration);
  updateAnimationControls();
  refreshAnimationState();
});

function publish(engine, status, details = {}) {
  Object.assign(state[engine], details, { status });
  const node = $(`#${engine}-state`);
  if (node) {
    node.textContent = status === 'ready' ? 'Rendered' : status === 'error' ? 'Failed' : 'Loading';
    node.dataset.state = status;
  }
  const panel = document.querySelector(`[data-engine="${engine}"]`);
  if (panel) panel.dataset.details = JSON.stringify(state[engine]);
  const engines = [state.reference.status, state.three.status];
  state.status = engines.every((value) => value === 'ready')
    ? 'ready'
    : engines.some((value) => value === 'error')
      ? 'error'
      : 'loading';
  document.body.dataset.compareState = state.status;
  $('#summary').textContent = state.status === 'ready'
    ? 'Reference + Three.js rendered'
    : state.status === 'error'
      ? 'One or more A/B surfaces failed'
      : 'A/B loading…';
  refreshAnimationState();
  window.dispatchEvent(new CustomEvent('sketchfab-ab-state', { detail: structuredClone(state) }));
}

function publishRuntime(engine, details) {
  Object.assign(state[engine], details);
  const panel = document.querySelector(`[data-engine="${engine}"]`);
  if (panel) panel.dataset.details = JSON.stringify(state[engine]);
  refreshAnimationState();
}

function setMetric(engine, metric, value) {
  const node = $(`#${engine}-${metric}`);
  if (node) node.textContent = value;
}

function createEnvironmentCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#cde5ff');
  gradient.addColorStop(0.46, '#7d91aa');
  gradient.addColorStop(0.5, '#9b8d83');
  gradient.addColorStop(1, '#252a35');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(255, 244, 220, 0.7)';
  context.beginPath();
  context.arc(28, 17, 8, 0, Math.PI * 2);
  context.fill();
  return canvas;
}

async function loadAttribution() {
  try {
    const response = await fetch(`${modelUrl}.attribution.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const attribution = await response.json();
    $('#model-name').textContent = attribution.name || 'Sketchfab model';
    $('#attribution').textContent = `${attribution.author || 'Unknown author'} · ${attribution.license || 'Unknown license'} · ${Number(attribution.glbBytes || 0).toLocaleString()} bytes`;
    if (!attribution.thumbnailUrl) throw new Error('No reference thumbnail in attribution');
    const image = $('#reference-image');
    await new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', () => reject(new Error('Reference thumbnail failed')), { once: true });
      image.src = attribution.thumbnailUrl;
    });
    publish('reference', 'ready', { attribution });
  } catch (error) {
    $('#model-name').textContent = 'Sketchfab model';
    $('#attribution').textContent = error instanceof Error ? error.message : String(error);
    publish('reference', 'error', { error: String(error) });
  }
}

function threeStats(root) {
  let meshes = 0;
  let triangles = 0;
  const materials = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    meshes += 1;
    triangles += object.geometry.index
      ? object.geometry.index.count / 3
      : (object.geometry.attributes.position?.count || 0) / 3;
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of objectMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });
  return { meshes, triangles: Math.round(triangles), materials: materials.size, textures: textures.size };
}

function frameThree(root, camera, controls) {
  root.updateWorldMatrix(true, true);
  const sourceBox = new THREE.Box3().setFromObject(root);
  if (sourceBox.isEmpty()) throw new Error('Three.js found no scene bounds');
  root.position.sub(sourceBox.getCenter(new THREE.Vector3()));
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  sharedFrameSize = maxSize;
  const distance = (maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * 1.55;
  camera.position.set(distance * 0.68, distance * 0.42, distance);
  camera.near = Math.max(maxSize / 1000, 0.001);
  camera.far = Math.max(maxSize * 100, distance * 10);
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.minDistance = maxSize * 0.3;
  controls.maxDistance = maxSize * 8;
  controls.update();
  return {
    bounds: { x: size.x, y: size.y, z: size.z },
    center: { x: 0, y: 0, z: 0 },
    camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
  };
}

async function loadThree() {
  const canvas = $('#three-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x0b101b, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b101b);
  const environment = new THREE.CanvasTexture(createEnvironmentCanvas());
  environment.mapping = THREE.EquirectangularReflectionMapping;
  environment.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(environment).texture;
  environment.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xdbeaff, 0x332b2d, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 7, 5);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 10000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotate = false;

  let model = null;
  let animation = null;
  let frames = 0;
  let metricStarted = performance.now();
  function render(now) {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    if (canvas.width !== width || canvas.height !== height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    if (animation) {
      const currentTime = animationTime(animation.duration, now);
      animation.mixer.setTime(currentTime);
      if (now - animation.lastSample >= 250) {
        animation.samples += 1;
        animation.lastSample = now;
        setMetric('three', 'animation-time', `${currentTime.toFixed(2)} / ${animation.duration.toFixed(2)}s`);
        publishRuntime('three', {
          animationTime: currentTime,
          animationProgress: currentTime / animation.duration,
          animationSamples: animation.samples,
          animationSampleAt: now,
          animationPlaying: animationController.playing,
        });
        updateAnimationControls(now);
      }
    }
    if (model) model.rotation.y = THREE.MathUtils.degToRad(comparisonYaw(now));
    controls.update();
    renderer.render(scene, camera);
    frames += 1;
    if (now - metricStarted >= 1000) {
      setMetric('three', 'fps', Math.round((frames * 1000) / (now - metricStarted)));
      setMetric('three', 'draws', renderer.info.render.calls.toLocaleString());
      frames = 0;
      metricStarted = now;
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  const started = performance.now();
  try {
    const dracoLoader = new DRACOLoader().setDecoderPath('./decoders/draco/');
    const ktx2Loader = new KTX2Loader().setTranscoderPath('./decoders/basis/').detectSupport(renderer);
    const gltfLoader = new GLTFLoader()
      .setDRACOLoader(dracoLoader)
      .setKTX2Loader(ktx2Loader)
      .setMeshoptDecoder(MeshoptDecoder);
    const gltf = await gltfLoader.loadAsync(modelUrl);
    dracoLoader.dispose();
    ktx2Loader.dispose();
    model = gltf.scene;
    scene.add(model);
    const clips = gltf.animations || [];
    const boneNames = new Set();
    let morphTargets = 0;
    model.traverse((object) => {
      if (object.isBone) boneNames.add(object.name);
      for (const bone of object.skeleton?.bones || []) boneNames.add(bone.name);
      morphTargets += object.morphTargetInfluences?.length || 0;
    });
    const animationCatalog = clips.map((clip, index) => ({
      index,
      name: clip.name || `animation-${index}`,
      duration: clip.duration,
      channels: clip.tracks.length,
      jointChannels: clip.tracks.filter((track) => boneNames.has(track.name.split('.')[0])).length,
      morphChannels: clip.tracks.filter((track) => track.name.includes('morphTargetInfluences')).length,
      joints: boneNames.size,
      morphTargets,
    }));
    if (clips.length) {
      const mixer = new THREE.AnimationMixer(model);
      const selectClip = (index) => {
        const clip = clips[index] || clips[0];
        mixer.stopAllAction();
        mixer.clipAction(clip).reset().play();
        animation = { mixer, duration: clip.duration, samples: 0, lastSample: 0 };
        setMetric('three', 'animation', `${clip.name || `animation-${index}`} · ${clip.duration.toFixed(2)}s`);
        publishRuntime('three', {
          animationName: clip.name || `animation-${index}`,
          animationDuration: clip.duration,
          animationChannels: clip.tracks.length,
          animationPlaying: animationController.playing,
          animationSamples: 0,
        });
      };
      configureAnimationControls(animationCatalog);
      animationController.engines.set('three', { select: selectClip, catalog: animationCatalog });
      selectClip(animationController.selectedIndex);
    }
    const framing = frameThree(model, camera, controls);
    const stats = threeStats(model);
    const loadMs = performance.now() - started;
    setMetric('three', 'load', `${Math.round(loadMs)} ms`);
    setMetric('three', 'meshes', stats.meshes.toLocaleString());
    setMetric('three', 'triangles', stats.triangles.toLocaleString());
    setMetric('three', 'materials', `${stats.materials} / ${stats.textures} tex`);
    publish('three', 'ready', {
      ...stats,
      ...framing,
      loadMs,
      sourceUrl: modelUrl,
      animationCount: clips.length,
      animationName: clips[animationController.selectedIndex]?.name || null,
      animationDuration: clips[animationController.selectedIndex]?.duration || 0,
      animationChannels: clips[animationController.selectedIndex]?.tracks.length || 0,
      jointCount: boneNames.size,
      morphTargetCount: morphTargets,
      animationPlaying: Boolean(animation && animationController.playing),
      animationSamples: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    $('#three-error').textContent = message;
    publish('three', 'error', { error: message });
  }
}

function playCanvasStats(entity) {
  const meshInstances = entity.findComponents('render').flatMap((render) => render.meshInstances || []);
  const materials = new Set();
  const textures = new Set();
  let triangles = 0;
  for (const instance of meshInstances) {
    materials.add(instance.material);
    for (const primitive of instance.mesh?.primitive || []) {
      if (primitive.type === pc.PRIMITIVE_TRIANGLES) triangles += primitive.count / 3;
    }
    for (const value of Object.values(instance.material || {})) {
      if (value instanceof pc.Texture) textures.add(value);
    }
  }
  return { meshInstances, meshes: meshInstances.length, triangles: Math.round(triangles), materials: materials.size, textures: textures.size };
}

function playCanvasVisualBounds(stats) {
  let bounds = null;
  for (const instance of stats.meshInstances) {
    let visualBounds = instance.aabb;
    if (instance.skinInstance && instance.mesh?.aabb && instance.node) {
      visualBounds = new pc.BoundingBox();
      visualBounds.setFromTransformedAabb(instance.mesh.aabb, instance.node.getWorldTransform());
    }
    if (bounds) bounds.add(visualBounds);
    else bounds = visualBounds.clone();
  }
  return bounds;
}

function framePlayCanvas(entity, centerer, camera, stats) {
  let bounds = playCanvasVisualBounds(stats);
  if (!bounds) throw new Error('PlayCanvas found no scene bounds');
  centerer.setPosition(-bounds.center.x, -bounds.center.y, -bounds.center.z);
  centerer.syncHierarchy();
  bounds = playCanvasVisualBounds(stats);
  const size = bounds.halfExtents.clone().mulScalar(2);
  const measuredMaxSize = Math.max(size.x, size.y, size.z);
  const maxSize = sharedFrameSize || measuredMaxSize;
  const distance = (maxSize / (2 * Math.tan((camera.camera.fov * Math.PI) / 360))) * 1.55;
  camera.setPosition(
    bounds.center.x + distance * 0.68,
    bounds.center.y + distance * 0.42,
    bounds.center.z + distance,
  );
  camera.lookAt(bounds.center);
  camera.camera.nearClip = Math.max(maxSize / 1000, 0.001);
  camera.camera.farClip = Math.max(maxSize * 100, distance * 10);
  return {
    bounds: { x: size.x, y: size.y, z: size.z },
    framingSize: maxSize,
    center: { x: bounds.center.x, y: bounds.center.y, z: bounds.center.z },
    camera: {
      x: camera.getPosition().x,
      y: camera.getPosition().y,
      z: camera.getPosition().z,
    },
  };
}

function configurePlayCanvasEnvironment(app) {
  const source = new pc.Texture(app.graphicsDevice, {
    name: 'neutral-environment',
    width: 128,
    height: 64,
    projection: pc.TEXTUREPROJECTION_EQUIRECT,
    mipmaps: false,
  });
  source.setSource(createEnvironmentCanvas());
  const lighting = pc.EnvLighting.generateLightingSource(source, { size: 32 });
  app.scene.envAtlas = pc.EnvLighting.generateAtlas(lighting, {
    size: 128,
    numReflectionSamples: 128,
    numAmbientSamples: 256,
  });
  app.scene.ambientLight = new pc.Color(0.16, 0.18, 0.21);
}

async function loadPlayCanvas() {
  const canvas = $('#playcanvas-canvas');
  const viewport = canvas.parentElement;
  const app = new pc.Application(canvas, {
    graphicsDeviceOptions: { antialias: true, alpha: false, preserveDrawingBuffer: true },
  });
  pc.dracoInitialize({
    jsUrl: './decoders/draco/draco_wasm_wrapper.js',
    wasmUrl: './decoders/draco/draco_decoder.wasm',
    numWorkers: 1,
    lazyInit: true,
  });
  pc.basisInitialize({
    glueUrl: './decoders/basis/basis_transcoder.js',
    wasmUrl: './decoders/basis/basis_transcoder.wasm',
    numWorkers: 1,
    lazyInit: true,
  });
  app.graphicsDevice.maxPixelRatio = 1;
  app.scene.exposure = strictComparison ? 1 : 0.5;
  configurePlayCanvasEnvironment(app);
  if (strictComparison) app.scene.skybox = null;

  const camera = new pc.Entity('camera');
  camera.addComponent('camera', { clearColor: new pc.Color(0.043, 0.063, 0.106), fov: 42 });
  camera.camera.toneMapping = pc.TONEMAP_ACES;
  app.root.addChild(camera);

  const key = new pc.Entity('key-light');
  key.addComponent('light', { type: 'directional', color: new pc.Color(1, 1, 1), intensity: 2.2, castShadows: false });
  key.setEulerAngles(45, 35, 0);
  app.root.addChild(key);

  const pivot = new pc.Entity('model-pivot');
  pivot.setEulerAngles(0, comparisonYaw(performance.now()), 0);
  app.root.addChild(pivot);
  const centerer = new pc.Entity('model-centerer');
  pivot.addChild(centerer);
  const initialWidth = Math.max(1, viewport.clientWidth);
  const initialHeight = Math.max(1, viewport.clientHeight);
  app.setCanvasFillMode(pc.FILLMODE_NONE, initialWidth, initialHeight);
  app.setCanvasResolution(pc.RESOLUTION_AUTO, initialWidth, initialHeight);
  app.start();

  let animation = null;
  let frames = 0;
  let metricStarted = performance.now();
  app.on('update', () => {
    const now = performance.now();
    pivot.setEulerAngles(0, comparisonYaw(now), 0);
    if (animation) {
      const currentTime = animationTime(animation.duration, now);
      animation.layer.activeStateCurrentTime = currentTime;
      if (now - animation.lastSample >= 250) {
        animation.samples += 1;
        animation.lastSample = now;
        setMetric('playcanvas', 'animation-time', `${currentTime.toFixed(2)} / ${animation.duration.toFixed(2)}s`);
        publishRuntime('playcanvas', {
          animationTime: currentTime,
          animationProgress: currentTime / animation.duration,
          animationSamples: animation.samples,
          animationSampleAt: now,
          animationPlaying: animationController.playing,
        });
        if (onlyEngine === 'playcanvas') updateAnimationControls(now);
      }
    }
    const width = Math.max(1, viewport.clientWidth);
    const height = Math.max(1, viewport.clientHeight);
    if (canvas.width !== width || canvas.height !== height) {
      app.resizeCanvas(width, height);
      app.setCanvasResolution(pc.RESOLUTION_AUTO, width, height);
    }
  });
  app.on('frameend', () => {
    frames += 1;
    const now = performance.now();
    if (now - metricStarted >= 1000) {
      setMetric('playcanvas', 'fps', Math.round((frames * 1000) / (now - metricStarted)));
      setMetric('playcanvas', 'draws', Number(app.stats.drawCalls.total || 0).toLocaleString());
      frames = 0;
      metricStarted = now;
    }
  });

  const started = performance.now();
  await new Promise((resolve) => {
    app.assets.loadFromUrl(playCanvasModelUrl, 'container', (error, asset) => {
      if (error) {
        const message = String(error);
        $('#playcanvas-error').textContent = message;
        publish('playcanvas', 'error', { error: message });
        resolve();
        return;
      }
      try {
        pivot.setEulerAngles(0, 0, 0);
        const entity = asset.resource.instantiateRenderEntity({ castShadows: false });
        centerer.addChild(entity);
        app.root.syncHierarchy();
        const stats = playCanvasStats(entity);
        const animationAssets = asset.resource.animations || [];
        const jointNodes = new Set();
        let morphTargets = 0;
        for (const instance of stats.meshInstances) {
          for (const bone of instance.skinInstance?.bones || []) jointNodes.add(bone);
          morphTargets += instance.morphInstance?.morph?.targets?.length || 0;
        }
        const animationCatalog = animationAssets.map((animationAsset, index) => {
          const track = animationAsset.resource;
          const paths = (track?.curves || []).flatMap((curve) => curve.paths || []);
          const pathText = paths.map((path) => (
            typeof path === 'string' ? path : JSON.stringify(path)
          ).toLowerCase());
          return {
            index,
            name: track?.name || animationAsset.name || `animation-${index}`,
            duration: track?.duration || 0,
            channels: paths.length,
            jointChannels: pathText.filter((path) => !path.includes('weight')).length,
            morphChannels: pathText.filter((path) => path.includes('weight')).length,
            joints: jointNodes.size,
            morphTargets,
          };
        });
        if (animationAssets.length) {
          entity.addComponent('anim', { activate: true, speed: 1 });
          const selectClip = (index) => {
            const animationAsset = animationAssets[index] || animationAssets[0];
            const track = animationAsset.resource;
            if (!track?.duration) return;
            const animationName = track.name || animationAsset.name || 'clip-0';
            const stateName = animationName.replaceAll('.', '_');
            entity.anim.removeStateGraph();
            entity.anim.assignAnimation(stateName, track, undefined, 1, true);
            animation = {
              layer: entity.anim.baseLayer,
              duration: track.duration,
              samples: 0,
              lastSample: 0,
            };
            setMetric('playcanvas', 'animation', `${animationName} · ${track.duration.toFixed(2)}s`);
            publishRuntime('playcanvas', {
              animationName,
              animationDuration: track.duration,
              animationChannels: animationCatalog[index]?.channels || 0,
              animationPlaying: animationController.playing,
              animationSamples: 0,
            });
          };
          configureAnimationControls(animationCatalog);
          animationController.engines.set('playcanvas', { select: selectClip, catalog: animationCatalog });
          selectClip(animationController.selectedIndex);
        }
        if (playCanvasProofMaterial) {
          const proofMaterial = new pc.StandardMaterial();
          proofMaterial.diffuse = new pc.Color(0.2, 0.75, 1);
          proofMaterial.emissive = new pc.Color(0.05, 0.18, 0.3);
          proofMaterial.useLighting = false;
          proofMaterial.update();
          for (const instance of stats.meshInstances) instance.material = proofMaterial;
        }
        const framing = framePlayCanvas(entity, centerer, camera, stats);
        app.root.syncHierarchy();
        const loadMs = performance.now() - started;
        setMetric('playcanvas', 'load', `${Math.round(loadMs)} ms`);
        setMetric('playcanvas', 'meshes', stats.meshes.toLocaleString());
        setMetric('playcanvas', 'triangles', stats.triangles.toLocaleString());
        setMetric('playcanvas', 'materials', `${stats.materials} / ${stats.textures} tex`);
        publish('playcanvas', 'ready', {
          ...stats,
          meshInstances: undefined,
          ...framing,
          loadMs,
          sourceUrl: playCanvasModelUrl,
          compatibilityTransform: state.config?.compatibilityTransform || null,
          animationCount: animationAssets.length,
          animationName: animationCatalog[animationController.selectedIndex]?.name || null,
          animationDuration: animationCatalog[animationController.selectedIndex]?.duration || 0,
          animationChannels: animationCatalog[animationController.selectedIndex]?.channels || 0,
          jointCount: (state.inspection?.skins || []).reduce((sum, skin) => sum + skin.joints, 0) || jointNodes.size,
          morphTargetCount: state.inspection?.morphTargets ?? morphTargets,
          animationPlaying: Boolean(animation && animationController.playing),
          animationSamples: 0,
        });
      } catch (error2) {
        const message = error2 instanceof Error ? error2.message : String(error2);
        $('#playcanvas-error').textContent = message;
        publish('playcanvas', 'error', { error: message });
      }
      resolve();
    });
  });
}

await loadReports();
const attributionJob = loadAttribution();
if (!onlyEngine) {
  await Promise.all([attributionJob, loadThree()]);
} else {
  await Promise.all([attributionJob, loadThree()]);
}
