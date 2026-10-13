import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function readGlb(filename) {
  const path = resolve(filename);
  const bytes = await readFile(path);
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error(`${path} is not a GLB file`);
  }
  if (bytes.readUInt32LE(4) !== 2) throw new Error(`${path} is not glTF 2.0`);
  if (bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error(`${path} header length does not match file size`);
  }

  const chunks = [];
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw new Error(`${path} has a truncated chunk header`);
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + length;
    if (end > bytes.length) throw new Error(`${path} has a truncated chunk`);
    chunks.push({ type, data: bytes.subarray(offset + 8, end) });
    offset = end;
  }
  if (!chunks.length || chunks[0].type !== 0x4e4f534a) {
    throw new Error(`${path} has no leading JSON chunk`);
  }
  const gltf = JSON.parse(chunks[0].data.toString('utf8').replace(/\0+$/u, '').trimEnd());
  const binary = chunks.find((chunk) => chunk.type === 0x004e4942)?.data || Buffer.alloc(0);
  return {
    path,
    bytes,
    gltf,
    chunks,
    binary,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

export function getBufferViewBytes(gltf, binary, bufferViewIndex) {
  const view = gltf.bufferViews?.[bufferViewIndex];
  if (!view) throw new Error(`bufferView ${bufferViewIndex} does not exist`);
  if ((view.buffer ?? 0) !== 0) throw new Error(`bufferView ${bufferViewIndex} uses an external buffer`);
  const start = view.byteOffset || 0;
  return binary.subarray(start, start + view.byteLength);
}

export function getEmbeddedImageBytes(gltf, binary, imageIndex) {
  const image = gltf.images?.[imageIndex];
  if (!image) throw new Error(`image ${imageIndex} does not exist`);
  if (!Number.isInteger(image.bufferView)) return null;
  return getBufferViewBytes(gltf, binary, image.bufferView);
}

export function isPowerOfTwo(value) {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

export function animationMetrics(gltf) {
  const jointNodes = new Set((gltf.skins || []).flatMap((skin) => skin.joints || []));
  return (gltf.animations || []).map((animation, index) => {
    const targets = (animation.channels || []).map((channel) => channel.target || {});
    return {
      index,
      name: animation.name || `animation-${index}`,
      channels: targets.length,
      jointChannels: targets.filter((target) => jointNodes.has(target.node)).length,
      morphChannels: targets.filter((target) => target.path === 'weights').length,
      targetNodes: new Set(targets.map((target) => target.node).filter(Number.isInteger)).size,
      missingTargets: targets.filter(
        (target) => !Number.isInteger(target.node) || !gltf.nodes?.[target.node],
      ).length,
    };
  });
}
