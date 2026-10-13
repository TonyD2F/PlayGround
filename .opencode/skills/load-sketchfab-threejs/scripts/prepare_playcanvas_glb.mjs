#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('-'));
const outputIndex = args.indexOf('--output');
const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
const manifestIndex = args.indexOf('--manifest');
const manifest = manifestIndex >= 0 ? args[manifestIndex + 1] : null;
if (!input || !output) {
  console.error('usage: prepare_playcanvas_glb.mjs input.glb --output output.glb [--manifest manifest.json]');
  process.exit(2);
}

const inputPath = resolve(input);
const outputPath = resolve(output);
const inputBytes = await readFile(inputPath);
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
const document = await io.read(inputPath);
const transformations = [];

for (const extension of document.getRoot().listExtensionsUsed()) {
  if (extension.extensionName === 'EXT_meshopt_compression') {
    extension.dispose();
    transformations.push({
      operation: 'decompress',
      extension: 'EXT_meshopt_compression',
      reason: 'PlayCanvas 2.21 has no Meshopt decoder',
    });
  }
}

let convertedAvif = 0;
for (const texture of document.getRoot().listTextures()) {
  if (texture.getMimeType() !== 'image/avif') continue;
  texture
    .setImage(await sharp(texture.getImage()).png().toBuffer())
    .setMimeType('image/png');
  convertedAvif += 1;
}
if (convertedAvif) {
  for (const extension of document.getRoot().listExtensionsUsed()) {
    if (extension.extensionName === 'EXT_texture_avif') extension.dispose();
  }
  transformations.push({
    operation: 'texture-convert',
    from: 'image/avif',
    to: 'image/png',
    textures: convertedAvif,
    reason: 'PlayCanvas 2.21 container parser does not support EXT_texture_avif',
  });
}

if (!transformations.length) throw new Error('No PlayCanvas compatibility transformation was needed');
await io.write(outputPath, document);
const outputBytes = await readFile(outputPath);
const report = {
  schemaVersion: 1,
  input: {
    path: inputPath,
    bytes: inputBytes.length,
    sha256: createHash('sha256').update(inputBytes).digest('hex'),
  },
  output: {
    path: outputPath,
    bytes: outputBytes.length,
    sha256: createHash('sha256').update(outputBytes).digest('hex'),
  },
  transformations,
  tools: {
    gltfTransform: '4.4.2',
    sharp: sharp.versions.sharp,
  },
};
await writeFile(resolve(manifest || `${outputPath}.transform.json`), `${JSON.stringify(report, null, 2)}\n`);
try {
  await copyFile(`${inputPath}.attribution.json`, `${outputPath}.attribution.json`);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
console.log(JSON.stringify(report, null, 2));
