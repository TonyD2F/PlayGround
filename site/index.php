<?php
require_once __DIR__ . '/lib/bootstrap.php';
$cfg = hf_config();
$period = hf_current_period($cfg['tz']);
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hellfetty.com — King County Safeway LP Map</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  :root { --green:#1a7f37; --ink:#111; --line:#d8d8d8; --bg:#fff; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; color:var(--ink); background:var(--bg); }
  header { padding:12px 16px; border-bottom:2px solid var(--ink); display:flex; gap:12px; align-items:baseline; flex-wrap:wrap; }
  header h1 { font-size:20px; margin:0; }
  header .period { font-size:14px; font-weight:600; }
  main { display:grid; grid-template-columns:1fr 340px; min-height:calc(100vh - 57px); }
  #map { min-height:420px; }
  aside { border-left:2px solid var(--ink); overflow-y:auto; max-height:calc(100vh - 57px); }
  .store { padding:10px 12px; border-bottom:1px solid var(--line); }
  .store.lp { background:#e9f7ee; border-left:6px solid var(--green); }
  .store h3 { margin:0 0 2px; font-size:15px; }
  .store .addr { font-size:13px; color:#222; }
  .tally { font-size:13px; margin:6px 0; font-variant-numeric:tabular-nums; }
  .badge { display:inline-block; font-size:12px; font-weight:700; color:#fff; background:var(--green); padding:1px 8px; border-radius:999px; margin-left:6px; }
  .row { display:flex; gap:8px; }
  button { flex:1; padding:8px; font-size:14px; font-weight:700; cursor:pointer; border:2px solid var(--ink); background:#fff; }
  button.yes:hover { background:var(--green); color:#fff; border-color:var(--green); }
  button.no:hover { background:var(--ink); color:#fff; }
  @media (max-width:800px){ main{grid-template-columns:1fr;} aside{border-left:0; max-height:none;} #map{height:60vh;} }
</style>
</head>
<body>
<header>
  <h1>Hellfetty.com</h1>
  <span>King County Safeway LP vote map</span>
  <span class="period" id="period">Period <?= htmlspecialchars($period['key'] . ' · ' . $period['label']) ?></span>
</header>
<main>
  <div id="map"></div>
  <aside id="list" aria-live="polite"></aside>
</main>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const cfg = { lat: <?= json_encode($cfg['map_lat']) ?>, lng: <?= json_encode($cfg['map_lng']) ?>, zoom: <?= json_encode($cfg['map_zoom']) ?> };
let pollMs = <?= json_encode($cfg['poll_ms']) ?>;
const map = L.map('map').setView([cfg.lat, cfg.lng], cfg.zoom);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
const markers = new Map();

async function load() {
  const r = await fetch('api/state.php', { cache: 'no-store' });
  const s = await r.json();
  document.getElementById('period').textContent = 'Period ' + s.period.key + ' · ' + s.period.label;
  pollMs = s.settings.poll_ms || pollMs;
  const list = document.getElementById('list');
  list.innerHTML = '';
  for (const st of s.stores) {
    if (!markers.has(st.id)) {
      const m = L.marker([st.lat, st.lng]).addTo(map);
      markers.set(st.id, m);
    }
    markers.get(st.id).bindPopup('<b>' + escapeHtml(st.name) + '</b><br>Yes ' + st.yes + ' / No ' + st.no + (st.has_lp ? '<br><b>LP reported</b>' : ''));
    markers.get(st.id).setOpacity(st.has_lp ? 1 : 0.75);

    const div = document.createElement('div');
    div.className = 'store' + (st.has_lp ? ' lp' : '');
    div.innerHTML = '<h3></h3><div class="addr"></div><div class="tally"></div><div class="row"><button class="yes">Yes — LP here</button><button class="no">No — clear</button></div>';
    div.querySelector('h3').textContent = st.name + (st.has_lp ? '  ● LP' : '');
    if (st.has_lp) { const b = document.createElement('span'); b.className='badge'; b.textContent='LP'; div.querySelector('h3').appendChild(b); }
    div.querySelector('.addr').textContent = st.address;
    div.querySelector('.tally').textContent = 'Yes ' + st.yes + ' · No ' + st.no + ' · LP reports ' + st.lp;
    div.querySelector('.yes').onclick = () => vote(st.id, 'yes');
    div.querySelector('.no').onclick = () => vote(st.id, 'no');
    list.appendChild(div);
  }
  schedule();
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function vote(id, choice) {
  const r = await fetch('api/vote.php', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ store_id:id, choice }) });
  if (r.status === 429) { alert('Slow down — 30 votes/minute max.'); return; }
  const j = await r.json();
  if (!j.ok && j.code === 'duplicate') { alert('Already voted this period at this store.'); return; }
  if (!j.ok) { alert('Vote rejected: ' + j.code); return; }
  load();
}
let t = null;
function schedule(){ clearTimeout(t); t = setTimeout(load, pollMs); }
load();
</script>
</body>
</html>
