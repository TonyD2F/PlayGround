#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  Accessor,
  AnimationChannel,
  Document,
  NodeIO,
} from '@gltf-transform/core';
import {
  EXTMeshoptCompression,
  EXTTextureAVIF,
  EXTTextureWebP,
  KHRDracoMeshCompression,
  KHRMeshQuantization,
  KHRTextureBasisu,
} from '@gltf-transform/extensions';
import { draco, meshopt } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const DOT_KTX2_BASE64 = 'q0tUWCAyMLsNChoKAAAAAAEAAACAAAAAgAAAAAAAAAAAAAAAAQAAAAgAAAABAAAAEAEAACwAAAA8AQAAPAAAAHgBAAAAAAAAGAIAAAAAAABvBAAAAAAAAO8AAAAAAAAAAAAAAAAAAADkAwAAAAAAAIsAAAAAAAAAAAAAAAAAAACwAwAAAAAAADQAAAAAAAAAAAAAAAAAAACeAwAAAAAAABIAAAAAAAAAAAAAAAAAAACXAwAAAAAAAAcAAAAAAAAAAAAAAAAAAACUAwAAAAAAAAMAAAAAAAAAAAAAAAAAAACSAwAAAAAAAAIAAAAAAAAAAAAAAAAAAACQAwAAAAAAAAIAAAAAAAAAAAAAAAAAAAAsAAAAAAAAAAIAKACjAQIAAwMAAAAAAAAAAAAAAAA/AAAAAAAAAAAA/////zcAAABLVFh3cml0ZXIAUmFwaWRQaXBlbGluZSAzRCBQcm9jZXNzb3IgLyBsaWJrdHggdjQuMC4wfjUAAAkAVAAyAAAAyQAAAGkAAAAAAAAAAAAAAAAAAADvAAAAAAAAAAAAAAAAAAAAAAAAAIsAAAAAAAAAAAAAAAAAAAAAAAAANAAAAAAAAAAAAAAAAAAAAAAAAAASAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAABHAhAABAAAAENSBwAogCoAAAAAA5BqWgAATAQAAAAAAyIMBCEAEAAEAAEAIddtAa8tZGAemCEwDQRQA0Pd3lmbbbsiKJUFAWFGJGIcdhe4ROAIHQAw36BHA9gQIxCS9QB0CRIOqqqrq8fh5Q18kEg05DLrUw0iClDBCYoQIt134hUaGxoxdLfK+VhmTMiLRaGIhHnFChqSRMgziRaSzLp5/alkvrzWTZZgwjY2kwRJM1zSYsaNRilr3uRXrUs//mEU3iqvv6Jw391+Hfik0lkpuOK+2l8PVQPTEQNeLzby1feg7hqAP7oYwr98v+sl2NWXKQp2Uj/n09vcEAcEcAU0giAIA+gSLLbbwO6QOnkHshLGw8ALWskcIIaWkSRlvY2pHENIEQrxJemF/AhABAAAAQRA0eUYlEAtSWgegAMrbQN8G7wkRAv5UBBX8SWpHW20dcAF4KoAHDAAgCINkMTWi8gEBowGjAeP9B7U/37tX/AKX/5j4DF8QFy/HVxQfeTgWUQFjSjwsCBefmXNvfghePilE3P/t2Rz8PBe7W84OiXiqpNOkCFGrj1UjLrZmfC7cG83SwdIuJaX8p+z9EhPv3UYmTYi4R8jdjPj/bvFtgsTpjZUrYdnbXz7Wt88ZKDE89u/6Etv7vZ48f7LO7G8ngqWTH5DheGFguB0OpA5hOIwMbxkMt4FA2ipGriPDqW56xdJ+m1GbYGqtI0ltNL9R22/33LPN8Nj2ukOXNGnftLlTDgcRtyOBxHFmYJgkeLWfCCWlXDmTJo0og5bj9fABD9BuRQXba4GWY78Jiq/oV3iHVrkB/JJ0GwdscAccWzD/VG4CV5puwwKx4e6tGnjq659SBju0pX/O9DukDw449XHALYNnRR7HGWjVncKKbv+AP3hO7MfwDRycEirFbi7QOI+6gg6sdkGlmO4LNA6NDrygpWiBhhUUBTqwr0Kl2F4NNAZR3/ENdM0BO7RKA/hjHCstcAZ0nQVy01TawJ3hdbdHMDFZBfvzwawTowMeadrS3ul+RsQCLufFDN3SgEOSVl0UNiv4uSzewe59oOU4OCIUR9GrqGCaB1qO1Rp8QB8S';

const outputIndex = process.argv.indexOf('--output');
const output = resolve(outputIndex >= 0 ? process.argv[outputIndex + 1] : './fixtures');
await mkdir(output, { recursive: true });

async function writeMorphAnimationFixture() {
  const document = new Document();
  const buffer = document.createBuffer('fixture-buffer');
  const positions = document.createAccessor('positions')
    .setType(Accessor.Type.VEC3)
    .setArray(new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]))
    .setBuffer(buffer);
  const indices = document.createAccessor('indices')
    .setType(Accessor.Type.SCALAR)
    .setArray(new Uint16Array([0, 1, 2]))
    .setBuffer(buffer);
  const morphPositions = document.createAccessor('morph-positions')
    .setType(Accessor.Type.VEC3)
    .setArray(new Float32Array([0, 0, 0, 0, 0, 0, 0, 1.5, 0]))
    .setBuffer(buffer);
  const target = document.createPrimitiveTarget('Tall')
    .setAttribute('POSITION', morphPositions);
  const material = document.createMaterial('Fixture Blue')
    .setBaseColorFactor([0.1, 0.55, 1, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.7)
    .setDoubleSided(true);
  const primitive = document.createPrimitive('triangle')
    .setAttribute('POSITION', positions)
    .setIndices(indices)
    .setMaterial(material)
    .addTarget(target);
  const mesh = document.createMesh('Morph Triangle')
    .addPrimitive(primitive)
    .setWeights([0]);
  const node = document.createNode('Morph Triangle').setMesh(mesh);
  document.createScene('Fixture Scene').addChild(node);

  const morphInput = document.createAccessor('morph-times')
    .setType(Accessor.Type.SCALAR)
    .setArray(new Float32Array([0, 1, 2]))
    .setBuffer(buffer);
  const morphOutput = document.createAccessor('morph-values')
    .setType(Accessor.Type.SCALAR)
    .setArray(new Float32Array([0, 1, 0]))
    .setBuffer(buffer);
  const morphSampler = document.createAnimationSampler()
    .setInput(morphInput)
    .setOutput(morphOutput);
  const morphChannel = document.createAnimationChannel()
    .setTargetNode(node)
    .setTargetPath(AnimationChannel.TargetPath.WEIGHTS)
    .setSampler(morphSampler);
  document.createAnimation('Morph Pulse')
    .addSampler(morphSampler)
    .addChannel(morphChannel);

  const slideInput = document.createAccessor('slide-times')
    .setType(Accessor.Type.SCALAR)
    .setArray(new Float32Array([0, 1.5, 3]))
    .setBuffer(buffer);
  const slideOutput = document.createAccessor('slide-values')
    .setType(Accessor.Type.VEC3)
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 0]))
    .setBuffer(buffer);
  const slideSampler = document.createAnimationSampler()
    .setInput(slideInput)
    .setOutput(slideOutput);
  const slideChannel = document.createAnimationChannel()
    .setTargetNode(node)
    .setTargetPath(AnimationChannel.TargetPath.TRANSLATION)
    .setSampler(slideSampler);
  document.createAnimation('Side Slide')
    .addSampler(slideSampler)
    .addChannel(slideChannel);

  const path = resolve(output, 'morph-animation.glb');
  await new NodeIO().write(path, document);
  const fileStats = await stat(path);
  await writeFile(`${path}.attribution.json`, `${JSON.stringify({
    uid: 'synthetic-morph-animation',
    name: 'Synthetic Morph Animation Fixture',
    author: 'load-sketchfab-threejs fixture generator',
    license: 'CC0-1.0',
    modelUrl: null,
    thumbnailUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect width="100%25" height="100%25" fill="%23101828"/%3E%3Cpath d="M180 290L460 290L320 70Z" fill="%231a8cff"/%3E%3Ctext x="320" y="335" text-anchor="middle" fill="white" font-family="sans-serif" font-size="24"%3ESynthetic morph fixture%3C/text%3E%3C/svg%3E',
    glbBytes: fileStats.size,
  }, null, 2)}\n`);
  return path;
}

async function writeTextureFixture(format) {
  const document = new Document();
  const buffer = document.createBuffer('texture-fixture-buffer');
  const positions = document.createAccessor('positions')
    .setType(Accessor.Type.VEC3)
    .setArray(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]))
    .setBuffer(buffer);
  const texcoords = document.createAccessor('texcoords')
    .setType(Accessor.Type.VEC2)
    .setArray(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]))
    .setBuffer(buffer);
  const indices = document.createAccessor('indices')
    .setType(Accessor.Type.SCALAR)
    .setArray(new Uint16Array([0, 1, 2, 0, 2, 3]))
    .setBuffer(buffer);

  const raw = Buffer.alloc(64 * 64 * 4);
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      const offset = (y * 64 + x) * 4;
      const bright = ((x >> 3) + (y >> 3)) % 2 === 0;
      raw[offset] = bright ? 35 : 235;
      raw[offset + 1] = bright ? 185 : 80;
      raw[offset + 2] = bright ? 255 : 165;
      raw[offset + 3] = 255;
    }
  }

  let image;
  let mimeType;
  let Extension;
  if (format === 'ktx2') {
    image = Buffer.from(DOT_KTX2_BASE64, 'base64');
    mimeType = 'image/ktx2';
    Extension = KHRTextureBasisu;
  } else if (format === 'webp') {
    image = await sharp(raw, { raw: { width: 64, height: 64, channels: 4 } }).webp({ quality: 90 }).toBuffer();
    mimeType = 'image/webp';
    Extension = EXTTextureWebP;
  } else {
    image = await sharp(raw, { raw: { width: 64, height: 64, channels: 4 } }).avif({ quality: 70 }).toBuffer();
    mimeType = 'image/avif';
    Extension = EXTTextureAVIF;
  }
  document.createExtension(Extension).setRequired(true);
  const texture = document.createTexture(`${format}-checker`)
    .setImage(image)
    .setMimeType(mimeType);
  const material = document.createMaterial(`${format}-material`)
    .setBaseColorTexture(texture)
    .setMetallicFactor(0)
    .setRoughnessFactor(0.8)
    .setDoubleSided(true);
  const primitive = document.createPrimitive('textured-quad')
    .setAttribute('POSITION', positions)
    .setAttribute('TEXCOORD_0', texcoords)
    .setIndices(indices)
    .setMaterial(material);
  const mesh = document.createMesh(`${format}-quad`).addPrimitive(primitive);
  document.createScene('Texture Fixture Scene').addChild(document.createNode(`${format}-quad`).setMesh(mesh));

  const path = resolve(output, `texture-${format}.glb`);
  await new NodeIO().registerExtensions([Extension]).write(path, document);
  await writeFile(`${path}.attribution.json`, `${JSON.stringify({
    uid: `synthetic-texture-${format}`,
    name: `Synthetic ${format.toUpperCase()} Texture Fixture`,
    author: format === 'ktx2' ? 'Khronos glTF Sample Assets and fixture generator' : 'load-sketchfab-threejs fixture generator',
    license: format === 'ktx2' ? 'CC-BY-4.0' : 'CC0-1.0',
    modelUrl: format === 'ktx2' ? 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept' : null,
    thumbnailUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect width="100%25" height="100%25" fill="%23101828"/%3E%3Crect x="180" y="40" width="280" height="280" fill="%231aa9ff"/%3E%3Ctext x="320" y="335" text-anchor="middle" fill="white" font-family="sans-serif" font-size="24"%3ECompressed texture fixture%3C/text%3E%3C/svg%3E',
    glbBytes: (await stat(path)).size,
  }, null, 2)}\n`);
  return path;
}

async function writeCompressedFixtures(sourcePath) {
  const baseIO = new NodeIO();
  const dracoDocument = await baseIO.read(sourcePath);
  const dracoIO = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({ 'draco3d.encoder': await draco3d.createEncoderModule() });
  await dracoDocument.transform(draco({ method: 'sequential' }));
  const dracoPath = resolve(output, 'morph-animation-draco.glb');
  await dracoIO.write(dracoPath, dracoDocument);

  await MeshoptEncoder.ready;
  const meshoptDocument = await baseIO.read(sourcePath);
  const meshoptIO = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  await meshoptDocument.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const meshoptPath = resolve(output, 'morph-animation-meshopt.glb');
  await meshoptIO.write(meshoptPath, meshoptDocument);

  for (const [path, suffix] of [[dracoPath, 'Draco'], [meshoptPath, 'Meshopt']]) {
    const sourceAttribution = JSON.parse(await readFile(`${sourcePath}.attribution.json`, 'utf8'));
    sourceAttribution.uid = `${sourceAttribution.uid}-${suffix.toLowerCase()}`;
    sourceAttribution.name = `${sourceAttribution.name} (${suffix})`;
    sourceAttribution.glbBytes = (await stat(path)).size;
    await writeFile(`${path}.attribution.json`, `${JSON.stringify(sourceAttribution, null, 2)}\n`);
  }
  return [dracoPath, meshoptPath];
}

const corePath = await writeMorphAnimationFixture();
const texturePaths = await Promise.all(['ktx2', 'webp', 'avif'].map(writeTextureFixture));
const paths = [corePath, ...await writeCompressedFixtures(corePath), ...texturePaths];
console.log(JSON.stringify({ output, fixtures: paths }, null, 2));
