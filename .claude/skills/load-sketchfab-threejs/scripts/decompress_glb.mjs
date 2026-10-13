#!/usr/bin/env node

import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder } from 'meshoptimizer';

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('-'));
const outputIndex = args.indexOf('--output');
const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
if (!input || !output) {
  console.error('usage: decompress_glb.mjs input.glb --output output.glb');
  process.exit(2);
}

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
const document = await io.read(resolve(input));
for (const extension of document.getRoot().listExtensionsUsed()) {
  if (extension.extensionName === 'EXT_meshopt_compression') extension.dispose();
}
const outputPath = resolve(output);
await io.write(outputPath, document);
try {
  await copyFile(`${resolve(input)}.attribution.json`, `${outputPath}.attribution.json`);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
console.log(JSON.stringify({ input: resolve(input), output: outputPath, decompressed: true }, null, 2));
