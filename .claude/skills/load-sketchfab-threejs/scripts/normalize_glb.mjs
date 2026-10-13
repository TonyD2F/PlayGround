#!/usr/bin/env node

import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('-'));
const outputIndex = args.indexOf('--output');
const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
if (!input || !output) {
  console.error('usage: normalize_glb.mjs input.glb --output output.glb');
  process.exit(2);
}

const inputPath = resolve(input);
const outputPath = resolve(output);
const bytes = await readFile(inputPath);
if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2) {
  throw new Error(`${inputPath} is not a glTF 2.0 binary`);
}

const chunks = [];
for (let offset = 12; offset < bytes.length;) {
  const length = bytes.readUInt32LE(offset);
  const type = bytes.readUInt32LE(offset + 4);
  chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });
  offset += 8 + length;
}
if (!chunks.length || chunks[0].type !== 0x4e4f534a) {
  throw new Error(`${inputPath} has no leading JSON chunk`);
}

const gltf = JSON.parse(chunks[0].data.toString('utf8').replace(/\0+$/u, '').trimEnd());
let converted = 0;
let repairedUnlit = 0;
for (const material of gltf.materials || []) {
  const extension = material.extensions?.KHR_materials_pbrSpecularGlossiness;
  if (!extension) continue;
  if (extension.specularGlossinessTexture) {
    throw new Error(
      `${material.name || 'material'} uses a specular-glossiness texture; bake it with Blender before conversion`,
    );
  }
  const specular = extension.specularFactor || [1, 1, 1];
  if (Math.max(...specular) > 0.08) {
    throw new Error(
      `${material.name || 'material'} has non-dielectric specular values; use a full material converter`,
    );
  }
  const pbr = material.pbrMetallicRoughness || {};
  pbr.baseColorFactor = extension.diffuseFactor || [1, 1, 1, 1];
  if (extension.diffuseTexture) pbr.baseColorTexture = extension.diffuseTexture;
  pbr.metallicFactor = 0;
  pbr.roughnessFactor = 1 - (extension.glossinessFactor ?? 1);
  material.pbrMetallicRoughness = pbr;
  delete material.extensions.KHR_materials_pbrSpecularGlossiness;
  if (!Object.keys(material.extensions).length) delete material.extensions;
  converted += 1;
}

for (const material of gltf.materials || []) {
  if (!material.extensions?.KHR_materials_unlit) continue;
  const pbr = material.pbrMetallicRoughness || {};
  const baseColor = pbr.baseColorFactor || [1, 1, 1, 1];
  const emissive = material.emissiveFactor || [0, 0, 0];
  const baseIsBlack = baseColor.slice(0, 3).every((value) => value === 0);
  const emissiveHasColor = emissive.some((value) => value > 0);
  if (baseIsBlack && !pbr.baseColorTexture && emissiveHasColor) {
    pbr.baseColorFactor = [emissive[0], emissive[1], emissive[2], baseColor[3] ?? 1];
    material.pbrMetallicRoughness = pbr;
    delete material.emissiveFactor;
    repairedUnlit += 1;
  }
}

if (!converted && !repairedUnlit) {
  throw new Error('No supported material normalization was needed');
}

const extensionName = 'KHR_materials_pbrSpecularGlossiness';
for (const field of ['extensionsUsed', 'extensionsRequired']) {
  if (gltf[field]) {
    gltf[field] = gltf[field].filter((name) => name !== extensionName);
    if (!gltf[field].length) delete gltf[field];
  }
}

const json = Buffer.from(JSON.stringify(gltf));
const jsonPadding = (4 - (json.length % 4)) % 4;
chunks[0] = { type: 0x4e4f534a, data: Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]) };
const totalLength = 12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
const result = Buffer.alloc(totalLength);
result.write('glTF', 0, 'ascii');
result.writeUInt32LE(2, 4);
result.writeUInt32LE(totalLength, 8);
let writeOffset = 12;
for (const chunk of chunks) {
  result.writeUInt32LE(chunk.data.length, writeOffset);
  result.writeUInt32LE(chunk.type, writeOffset + 4);
  chunk.data.copy(result, writeOffset + 8);
  writeOffset += 8 + chunk.data.length;
}
await writeFile(outputPath, result);

const attributionInput = `${inputPath}.attribution.json`;
const attributionOutput = `${outputPath}.attribution.json`;
try {
  await copyFile(attributionInput, attributionOutput);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

if (converted) console.log(`Converted ${converted} simple specular-glossiness material(s)`);
if (repairedUnlit) console.log(`Repaired ${repairedUnlit} unlit emissive-color material(s)`);
console.log(`Wrote ${outputPath}`);
