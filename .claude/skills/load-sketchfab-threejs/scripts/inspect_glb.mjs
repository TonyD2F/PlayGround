#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { animationMetrics, readGlb } from './lib/glb.mjs';

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('-'));
const outputIndex = args.indexOf('--output');
const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
if (!input) {
  console.error('usage: inspect_glb.mjs /absolute/model.glb [--output report.json]');
  process.exit(2);
}

const asset = await readGlb(input);
const { gltf, binary } = asset;
const textureIndex = (info) => info?.index ?? null;
const materials = (gltf.materials || []).map((material, index) => {
  const pbr = material.pbrMetallicRoughness || {};
  const extensions = material.extensions || {};
  return {
    index,
    name: material.name || `material-${index}`,
    baseColorFactor: pbr.baseColorFactor || [1, 1, 1, 1],
    baseColorTexture: textureIndex(pbr.baseColorTexture),
    metallicFactor: pbr.metallicFactor ?? 1,
    roughnessFactor: pbr.roughnessFactor ?? 1,
    metallicRoughnessTexture: textureIndex(pbr.metallicRoughnessTexture),
    normalTexture: textureIndex(material.normalTexture),
    occlusionTexture: textureIndex(material.occlusionTexture),
    emissiveFactor: material.emissiveFactor || [0, 0, 0],
    emissiveTexture: textureIndex(material.emissiveTexture),
    alphaMode: material.alphaMode || 'OPAQUE',
    alphaCutoff: material.alphaCutoff ?? 0.5,
    doubleSided: Boolean(material.doubleSided),
    unlit: Boolean(extensions.KHR_materials_unlit),
    transmissionFactor: extensions.KHR_materials_transmission?.transmissionFactor ?? null,
    transmissionTexture: textureIndex(extensions.KHR_materials_transmission?.transmissionTexture),
    clearcoatFactor: extensions.KHR_materials_clearcoat?.clearcoatFactor ?? null,
    clearcoatTexture: textureIndex(extensions.KHR_materials_clearcoat?.clearcoatTexture),
    specularFactor: extensions.KHR_materials_specular?.specularFactor ?? null,
    specGlossDiffuseTexture: textureIndex(extensions.KHR_materials_pbrSpecularGlossiness?.diffuseTexture),
    extensions: Object.keys(extensions),
  };
});

const textureUsages = new Map();
for (const material of materials) {
  for (const [slot, value] of Object.entries(material)) {
    if (!slot.endsWith('Texture') || !Number.isInteger(value)) continue;
    const usages = textureUsages.get(value) || [];
    usages.push({ material: material.index, slot });
    textureUsages.set(value, usages);
  }
}
const textures = (gltf.textures || []).map((texture, index) => ({
  index,
  name: texture.name || `texture-${index}`,
  source: texture.extensions?.KHR_texture_basisu?.source
    ?? texture.extensions?.EXT_texture_webp?.source
    ?? texture.extensions?.EXT_texture_avif?.source
    ?? texture.source
    ?? null,
  sampler: texture.sampler ?? null,
  extensions: Object.keys(texture.extensions || {}),
  usages: textureUsages.get(index) || [],
}));

const morphTargets = (gltf.meshes || []).reduce((sum, mesh) => (
  sum + Math.max(0, ...(mesh.primitives || []).map((primitive) => primitive.targets?.length || 0))
), 0);
const report = {
  schemaVersion: 2,
  path: asset.path,
  bytes: asset.bytes.length,
  sha256: asset.sha256,
  title: gltf.asset?.extras?.title || null,
  author: gltf.asset?.extras?.author || null,
  generator: gltf.asset?.generator || null,
  extensionsUsed: gltf.extensionsUsed || [],
  extensionsRequired: gltf.extensionsRequired || [],
  scenes: gltf.scenes?.length || 0,
  nodes: gltf.nodes?.length || 0,
  meshes: gltf.meshes?.length || 0,
  morphTargets,
  skins: (gltf.skins || []).map((skin, index) => ({
    index,
    name: skin.name || `skin-${index}`,
    joints: skin.joints?.length || 0,
    skeleton: skin.skeleton ?? null,
  })),
  animations: animationMetrics(gltf),
  materials: materials.length,
  textures: textures.length,
  images: (gltf.images || []).map((image, index) => ({
    index,
    name: image.name || `image-${index}`,
    mimeType: image.mimeType || null,
    uri: image.uri || null,
    bytes: Number.isInteger(image.bufferView)
      ? gltf.bufferViews?.[image.bufferView]?.byteLength ?? null
      : null,
    embedded: Number.isInteger(image.bufferView),
  })),
  materialDetails: materials,
  textureDetails: textures,
  binaryBytes: binary.length,
};

const json = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, json);
  console.log(JSON.stringify({ output: outputPath, materials: materials.length, textures: textures.length }, null, 2));
} else {
  process.stdout.write(json);
}
