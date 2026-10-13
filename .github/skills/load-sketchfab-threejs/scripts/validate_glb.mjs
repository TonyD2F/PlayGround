#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { supportedExtensions, validateBytes, version } from 'gltf-validator';
import {
  animationMetrics,
  getEmbeddedImageBytes,
  isPowerOfTwo,
  readGlb,
} from './lib/glb.mjs';

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('-'));
const outputIndex = args.indexOf('--output');
const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
const maxTextureIndex = args.indexOf('--max-texture');
const maxTexture = maxTextureIndex >= 0 ? Number(args[maxTextureIndex + 1]) : 2048;
if (!input) {
  console.error('usage: validate_glb.mjs input.glb [--output report.json] [--max-texture 2048]');
  process.exit(2);
}

const asset = await readGlb(input);
const validator = await validateBytes(new Uint8Array(asset.bytes), {
  uri: asset.path,
  format: 'glb',
  maxIssues: 0,
  writeTimestamp: false,
});

const archivedExtensions = new Set([
  'KHR_materials_pbrSpecularGlossiness',
  'KHR_techniques_webgl',
]);
const supported = new Set(supportedExtensions());
const used = asset.gltf.extensionsUsed || [];
const required = asset.gltf.extensionsRequired || [];
const images = [];
for (let index = 0; index < (asset.gltf.images || []).length; index += 1) {
  const image = asset.gltf.images[index];
  const data = getEmbeddedImageBytes(asset.gltf, asset.binary, index);
  let metadata = {};
  let error = null;
  if (data) {
    if (image.mimeType === 'image/ktx2' && data.length >= 28) {
      metadata = {
        format: 'ktx2',
        width: data.readUInt32LE(20),
        height: data.readUInt32LE(24),
        channels: null,
        hasAlpha: null,
      };
    } else {
      try {
        metadata = await sharp(data).metadata();
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      }
    }
  }
  const width = metadata.width || null;
  const height = metadata.height || null;
  images.push({
    index,
    name: image.name || `image-${index}`,
    mimeType: image.mimeType || metadata.format || null,
    bytes: data?.length || null,
    width,
    height,
    channels: metadata.channels || null,
    hasAlpha: metadata.hasAlpha ?? null,
    powerOfTwo: width && height ? isPowerOfTwo(width) && isPowerOfTwo(height) : null,
    oversized: width && height ? width > maxTexture || height > maxTexture : null,
    error,
  });
}

const summary = {
  errors: validator.issues?.numErrors || 0,
  warnings: validator.issues?.numWarnings || 0,
  infos: validator.issues?.numInfos || 0,
  hints: validator.issues?.numHints || 0,
};
const report = {
  schemaVersion: 1,
  asset: { path: asset.path, bytes: asset.bytes.length, sha256: asset.sha256 },
  validator: { name: 'Khronos glTF Validator', version: version(), summary },
  valid: summary.errors === 0,
  extensions: {
    used,
    required,
    unsupported: used.filter((name) => !supported.has(name)),
    archived: used.filter((name) => archivedExtensions.has(name)),
  },
  animations: animationMetrics(asset.gltf),
  textures: {
    maxDimension: maxTexture,
    images,
    oversized: images.filter((image) => image.oversized).map((image) => image.index),
    nonPowerOfTwo: images.filter((image) => image.powerOfTwo === false).map((image) => image.index),
    broken: images.filter((image) => image.error).map((image) => image.index),
  },
  issues: validator.issues?.messages || [],
  validatorReport: validator,
};

const outputPath = resolve(output || `${asset.path}.validation.json`);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: outputPath, valid: report.valid, ...summary }, null, 2));
if (!report.valid) process.exitCode = 1;
