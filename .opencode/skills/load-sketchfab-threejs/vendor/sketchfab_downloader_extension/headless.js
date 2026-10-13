const log = document.querySelector('#log');
const write = (line) => {
  log.textContent += `${line}\n`;
  document.body.dataset.lastProgress = line;
  fetch('/progress', { method: 'POST', body: line }).catch(() => {});
};

const model = new URLSearchParams(location.search).get('model');
try {
  globalThis.chrome = {
    runtime: { getURL: (path) => new URL(path, location.href).href },
    storage: { local: { get: async () => ({}), set: async () => {} } },
  };
  const { downloadModel } = await import('./lib/pipeline.js');
  const result = await downloadModel(model, write, {
    downloadTextures: true,
    packMode: 'glb',
    maxTextureEdge: 2048,
    devMode: true,
  });
  const saved = await fetch('/save', { method: 'POST', body: result.zip });
  if (!saved.ok) throw new Error(`save failed: HTTP ${saved.status}`);
  document.body.dataset.state = 'ready';
  document.body.dataset.result = JSON.stringify({
    zipName: result.zipName,
    hasGlb: result.hasGlb,
    fileCount: result.fileCount,
    zipBytes: result.zip.length,
  });
} catch (error) {
  write(error?.stack || String(error));
  document.body.dataset.state = 'error';
  document.body.dataset.error = error?.message || String(error);
  await fetch('/error', { method: 'POST', body: error?.stack || String(error) }).catch(() => {});
}
