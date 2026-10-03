/* ToolPilot Admin — command center */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const loadJSON = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? fb; } catch { return fb; } };
const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600); };
const copyText = async (txt, msg) => {
  try { await navigator.clipboard.writeText(txt); toast(msg || "📋 Copied"); }
  catch { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast(msg || "📋 Copied"); }
};
function activity(action, detail) {
  const log = loadJSON("tp_activity", []); log.unshift({ ts: Date.now(), action, detail: String(detail || "").slice(0, 140) });
  saveJSON("tp_activity", log.slice(0, 100));
}
const timeAgo = ts => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago"; return new Date(ts).toLocaleDateString();
};

/* ---------- dataset (canonical data.js + overlays) ---------- */
const DEFAULT_SETTINGS = {
  showAnnouncement: true, announcement: null, heroPill: null, heroTitle: null, heroSub: null,
  theme: "dark", featuredLimit: 8, itemsPerPage: 12, defaultSort: "popular", moderation: "auto",
  adminPass: "admin123",
  rag: { hybrid: true, rerank: true, contextual: false, agentic: false, chunk: 1500, topK: 5 }
};
const getSettings = () => Object.assign({}, DEFAULT_SETTINGS, loadJSON("tp_settings", {}), { rag: Object.assign({}, DEFAULT_SETTINGS.rag, (loadJSON("tp_settings", {}).rag || {})) });
const saveSettings = (s) => saveJSON("tp_settings", s);

const baseCats = () => (window.TP_DATA?.categories?.length ? window.TP_DATA.categories : []);
const getCats = () => { const f = loadJSON("tp_cats_full", null); return (Array.isArray(f) && f.length) ? f : baseCats().map(c => ({ ...c })); };
const baseTools = () => (window.TP_DATA?.tools?.length ? window.TP_DATA.tools : []);
const getOverrides = () => loadJSON("tp_tool_overrides", {});
const getDeletes = () => loadJSON("tp_deletes", []);
const getCustom = () => loadJSON("tp_custom", []);
const setCustom = (v) => saveJSON("tp_custom", v);
const effSeed = () => {
  const ov = getOverrides(), del = getDeletes();
  const order = loadJSON("tp_feat_order", []);
  const list = baseTools().filter(t => !del.includes(t.id)).map(t => Object.assign({ _origin: "seed" }, t, ov[t.id] || {}));
  if (order.length) list.sort((a, b) => (order.indexOf(a.id) === -1 ? 9999 : order.indexOf(a.id)) - (order.indexOf(b.id) === -1 ? 9999 : order.indexOf(b.id)));
  return list;
};
const allAdmin = () => [...getCustom().map(t => Object.assign({ _origin: "custom" }, t)), ...effSeed()];
const liveTools = () => { const m = getSettings().moderation; return allAdmin().filter(t => t._origin === "seed" || m === "auto" || t.status === "approved" || !t.status); };
const catName = id => (getCats().find(c => c.id === id) || { name: id }).name;
const fmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : "" + n;

function mutateSeed(id, patch) {
  const ov = getOverrides(); ov[id] = Object.assign({}, ov[id] || {}, patch);
  // drop keys that match canonical (keep overlay minimal)
  const canon = baseTools().find(t => t.id === id) || {};
  for (const k of Object.keys(ov[id])) if (JSON.stringify(ov[id][k]) === JSON.stringify(canon[k])) delete ov[id][k];
  if (!Object.keys(ov[id]).length) delete ov[id];
  saveJSON("tp_tool_overrides", ov);
}
function deleteTool(t) {
  if (t._origin === "custom") setCustom(getCustom().filter(x => x.id !== t.id));
  else { const d = getDeletes(); if (!d.includes(t.id)) d.push(t.id); saveJSON("tp_deletes", d); }
  activity("delete", t.name);
}
function restoreTool(id) { saveJSON("tp_deletes", getDeletes().filter(x => x !== id)); activity("restore", id); }

/* ---------- auth ---------- */
function authed() { return sessionStorage.getItem("tp_admin") === "1"; }
function tryLogin(e) {
  e.preventDefault();
  if ($("#loginPass").value === getSettings().adminPass) {
    sessionStorage.setItem("tp_admin", "1"); boot();
  } else $("#loginErr").hidden = false;
}

/* ---------- tabs ---------- */
const TAB_META = {
  dashboard: ["Dashboard", "Everything at a glance."],
  tools: ["Tools", "Add, edit, feature & curate every listing."],
  submissions: ["Submissions", "Community queue & moderation history."],
  featured: ["Featured", "Control the homepage rail order."],
  categories: ["Categories", "Taxonomy of the directory."],
  rag: ["RAG & Crawler", "mcp-crawl4ai-rag index, queue & strategy."],
  appearance: ["Appearance", "Announcement, hero, theme & layout."],
  settings: ["Settings", "Moderation, security & danger zone."],
  data: ["Data & Logs", "Backup, restore, MCP snippet & audit trail."]
};
function goto(tab) {
  $$("#sideNav button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".tab").forEach(p => p.hidden = p.dataset.pane !== tab);
  $("#tabTitle").textContent = TAB_META[tab][0]; $("#tabSub").textContent = TAB_META[tab][1];
  $("#sideNav").parentElement.classList.remove("open");
  ({ dashboard: renderDash, tools: renderTools, submissions: renderSubs, featured: renderFeat, categories: renderCats, rag: renderRag, appearance: fillAppear, settings: fillGeneral, data: renderData })[tab]();
}

/* ---------- dashboard ---------- */
function renderDash() {
  const live = liveTools(), custom = getCustom();
  const votes = loadJSON("tp_votes", {}), saved = loadJSON("tp_saved", []);
  const pend = custom.filter(t => t.status === "pending").length;
  const totalVotes = live.reduce((a, t) => a + (t.votes || 0), 0) + Object.keys(votes).length;
  $("#navToolCount").textContent = live.length;
  $("#navPending").textContent = pend || "";
  const kpis = [
    ["🧰", live.length, "live tools", `${effSeed().length} curated + ${custom.filter(t => t.status !== "rejected").length} community`],
    ["🔥", live.filter(t => t.featured).length, "featured", `rail limit ${getSettings().featuredLimit}`],
    ["📥", pend, "pending review", getSettings().moderation === "manual" ? "manual mode" : "auto-publish ON"],
    ["▲", fmt(totalVotes), "total upvotes", `${Object.keys(votes).length} from this browser`],
    ["🔖", saved.length, "bookmarks", "this browser"],
    ["🕷️", RAG_STATS.chunks ? fmt(RAG_STATS.chunks) : "—", "RAG chunks", RAG_STATS.sources ? `${RAG_STATS.sources} sources indexed` : "run crawl.py --seed"]
  ];
  $("#kpis").innerHTML = kpis.map(k => `<div class="kpi"><div class="n">${k[0]} ${k[1]}</div><div class="l">${k[2]}</div><div class="d">${k[3]}</div></div>`).join("");
  const cats = getCats(), max = Math.max(1, ...cats.map(c => live.filter(t => t.category === c.id).length));
  $("#catBars").innerHTML = cats.map(c => {
    const n = live.filter(t => t.category === c.id).length;
    return `<div class="bar-row"><span class="t">${c.emoji} ${esc(c.name)}</span><div class="bar"><i style="width:${Math.round(n / max * 100)}%"></i></div><span class="v">${n}</span></div>`;
  }).join("");
  const prices = ["Free", "Freemium", "Paid"], pmax = Math.max(1, ...prices.map(p => live.filter(t => t.pricing === p).length));
  $("#priceBars").innerHTML = prices.map(p => {
    const n = live.filter(t => t.pricing === p).length;
    return `<div class="bar-row"><span class="t">${p}</span><div class="bar"><i style="width:${Math.round(n / pmax * 100)}%"></i></div><span class="v">${n}</span></div>`;
  }).join("");
  renderActivity($("#activityList"), 8);
}
function renderActivity(el, limit) {
  const log = loadJSON("tp_activity", []).slice(0, limit || 50);
  el.innerHTML = log.length ? log.map(a => `<div class="act"><time>${timeAgo(a.ts)}</time><span><b>${esc(a.action)}</b> — ${esc(a.detail)}</span></div>`).join("")
    : `<p class="muted">No activity yet. Add a tool or approve a submission to start the trail.</p>`;
}

/* ---------- tools table ---------- */
const toolUI = { q: "", cat: "all", price: "all", sort: "votes", page: 0, sel: new Set() };
const PAGE = 15;
function filteredAdmin() {
  let list = [...allAdmin()];
  if (toolUI.q) { const q = toolUI.q.toLowerCase(); list = list.filter(t => (t.name + " " + t.tagline + " " + t.description + " " + (t.tags || []).join(" ") + " " + t.url).toLowerCase().includes(q)); }
  if (toolUI.cat !== "all") list = list.filter(t => t.category === toolUI.cat);
  if (toolUI.price !== "all") list = list.filter(t => t.pricing === toolUI.price);
  if (toolUI.sort === "votes") list.sort((a, b) => b.votes - a.votes);
  if (toolUI.sort === "rating") list.sort((a, b) => b.rating - a.rating);
  if (toolUI.sort === "newest") list.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (toolUI.sort === "az") list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}
function renderTools() {
  const sel = $("#toolCatFilter");
  if (!sel.dataset.filled) { sel.innerHTML = `<option value="all">All categories</option>` + getCats().map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join(""); sel.dataset.filled = "1"; }
  const list = filteredAdmin(), pages = Math.max(1, Math.ceil(list.length / PAGE));
  toolUI.page = Math.min(toolUI.page, pages - 1);
  const rows = list.slice(toolUI.page * PAGE, toolUI.page * PAGE + PAGE);
  const saved = loadJSON("tp_saved", []);
  $(`#toolTable tbody`).innerHTML = rows.map(t => `<tr>
    <td><input type="checkbox" data-sel="${t.id}" ${toolUI.sel.has(t.id) ? "checked" : ""} /></td>
    <td><div class="t-tool"><div class="avatar" style="background:${t.grad}">${t.emoji}</div>
      <div>${esc(t.name)} ${t.status === "pending" ? '<span class="flag">⏳ pending</span>' : ""}${t.status === "rejected" ? '<span class="flag">🚫 rejected</span>' : ""}${t._origin === "custom" ? '<span class="flag">community</span>' : ""}<small>${esc((t.tagline || "").slice(0, 60))}</small></div></div></td>
    <td>${esc(catName(t.category))}</td><td>${t.pricing}</td><td>★ ${t.rating}</td><td>▲ ${fmt(t.votes)}</td>
    <td>${t.featured ? '<span class="flag">🔥 feat</span>' : ""}${t.isNew ? '<span class="flag">🆕 new</span>' : ""}</td>
    <td><div class="row-act">
      <button class="mini" data-edit="${t.id}" title="Edit">✏️</button>
      <button class="mini ${t.featured ? "on" : ""}" data-feat="${t.id}" title="Toggle featured">🔥</button>
      <button class="mini ${t.isNew ? "on" : ""}" data-new="${t.id}" title="Toggle NEW">🆕</button>
      ${t._origin === "seed" && getDeletes().includes(t.id) ? "" : `<button class="mini del" data-del="${t.id}" title="Delete">🗑</button>`}
    </div></td></tr>`).join("") || `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:26px">No tools match. <button class="mini" data-add-tool2>＋ Add one</button></td></tr>`;
  $("#toolPageInfo").textContent = `Page ${toolUI.page + 1}/${pages} · ${list.length} tools`;
  const n = toolUI.sel.size;
  $("#bulkBar").hidden = !n; $("#selCount").textContent = `${n} selected`;
  const pend = getCustom().filter(t => t.status === "pending").length;
  $("#navPending").textContent = pend || "";
}

/* ---------- submissions ---------- */
function subCard(t) {
  return `<div class="sub-card"><h4>${t.emoji} ${esc(t.name)}</h4>
    <div class="muted" style="font-size:12px">${esc(catName(t.category))} · ${t.pricing} · <a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.url)}</a></div>
    <p><b>${esc(t.tagline)}</b><br/>${esc(t.description)}</p>
    <div class="row-act">
      ${t.status === "pending" ? `<button class="mini on" data-approve="${t.id}">✅ Approve</button>` : ""}
      ${t.status !== "rejected" ? `<button class="mini del" data-reject="${t.id}">🚫 Reject</button>` : `<button class="mini" data-approve="${t.id}">↩ Re-approve</button>`}
      <button class="mini" data-edit="${t.id}">✏️ Edit</button>
      <button class="mini del" data-del="${t.id}">🗑 Delete</button>
    </div></div>`;
}
function renderSubs() {
  const custom = getCustom();
  const pend = custom.filter(t => t.status === "pending"), ok = custom.filter(t => t.status === "approved" || !t.status), no = custom.filter(t => t.status === "rejected");
  $("#pendCount").textContent = pend.length || "";
  $("#pendingList").innerHTML = pend.length ? pend.map(subCard).join("") : `<p class="muted">Queue is empty. ${getSettings().moderation === "auto" ? "Auto-publish is ON — submissions go live instantly." : "New submissions will appear here."}</p>`;
  $("#approvedList").innerHTML = ok.length ? ok.map(subCard).join("") : `<p class="muted">Nothing yet.</p>`;
  $("#rejectedList").innerHTML = no.length ? no.map(subCard).join("") : `<p class="muted">Nothing rejected. Kind admin. 🙂</p>`;
}

/* ---------- featured ---------- */
function renderFeat() {
  const live = liveTools(), s = getSettings();
  const feats = live.filter(t => t.featured);
  $("#featInfo").textContent = `· ${feats.length} starred · rail shows ${s.featuredLimit}`;
  $("#featList").innerHTML = feats.length ? feats.map((t, i) => `<div class="feat-row-a">
      <span class="muted">#${i + 1}</span><div class="avatar" style="background:${t.grad}">${t.emoji}</div>
      <div class="grow">${esc(t.name)}<small>${esc(catName(t.category))} · ▲ ${fmt(t.votes)}</small></div>
      <button class="mini" data-fup="${t.id}">↑</button><button class="mini" data-fdn="${t.id}">↓</button>
      <button class="mini on" data-feat="${t.id}">🔥</button></div>`).join("")
    : `<p class="muted">No featured tools. Star some below.</p>`;
  $("#featAll").innerHTML = live.map(t => `<div class="feat-row-a">
    <div class="avatar" style="background:${t.grad}">${t.emoji}</div>
    <div class="grow">${esc(t.name)}<small>${esc(catName(t.category))}</small></div>
    <button class="mini ${t.featured ? "on" : ""}" data-feat="${t.id}">${t.featured ? "🔥 starred" : "☆ star"}</button></div>`).join("");
}
function featMove(id, dir) {
  const order = loadJSON("tp_feat_order", []);
  const feats = liveTools().filter(t => t.featured).map(t => t.id);
  const full = [...order.filter(x => feats.includes(x)), ...feats.filter(x => !order.includes(x))];
  const i = full.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= full.length) return;
  [full[i], full[j]] = [full[j], full[i]];
  saveJSON("tp_feat_order", full); activity("reorder-featured", id); renderFeat();
}

/* ---------- categories ---------- */
function renderCats() {
  const cats = getCats(), live = liveTools();
  $("#catList").innerHTML = cats.map(c => {
    const n = live.filter(t => t.category === c.id).length;
    return `<div class="feat-row-a"><div style="font-size:22px">${c.emoji}</div>
      <div class="grow">${esc(c.name)}<small>${c.id} · ${n} tools</small></div>
      <button class="mini" data-catedit="${c.id}">✏️</button>
      <button class="mini del" data-catdel="${c.id}">🗑</button></div>`;
  }).join("");
}

/* ---------- RAG ---------- */
let RAG_STATS = { chunks: 0, sources: 0 };
async function loadRagStats() {
  try {
    const r = await fetch("rag/store/sources.json", { cache: "no-store" });
    if (!r.ok) throw 0;
    const s = await r.json(), keys = Object.keys(s);
    RAG_STATS = { chunks: keys.reduce((a, k) => a + (s[k].chunks || 0), 0), sources: keys.length, map: s };
  } catch { RAG_STATS = { chunks: 0, sources: 0 }; }
  const env = (RAG_STATS.chunks && RAG_STATS.sources) ? "🟢 Local RAG · %N% chunks live" : "🟡 RAG store empty · run crawl.py --seed";
  $("#envBadge").textContent = env.replace("%N%", fmt(RAG_STATS.chunks || 0));
}
function renderRag() {
  const s = getSettings();
  $("#ragKpis").innerHTML = [
    ["📚", RAG_STATS.chunks ? fmt(RAG_STATS.chunks) : "0", "chunks indexed", "rag/store/crawled.json"],
    ["🌐", RAG_STATS.sources || "0", "sources", "get_available_sources()"],
    ["⚙️", (s.rag.hybrid ? "H" : "") + (s.rag.rerank ? "R" : "") || "off", "strategy", `hybrid=${s.rag.hybrid} rerank=${s.rag.rerank}`],
    ["🎯", "Top-" + s.rag.topK, "retrieval depth", `chunk ${s.rag.chunk} chars`]
  ].map(k => `<div class="kpi"><div class="n">${k[0]} ${k[1]}</div><div class="l">${k[2]}</div><div class="d">${k[3]}</div></div>`).join("");
  const f = $("#ragForm");
  f.hybrid.checked = !!s.rag.hybrid; f.rerank.checked = !!s.rag.rerank;
  f.contextual.checked = !!s.rag.contextual; f.agentic.checked = !!s.rag.agentic;
  f.chunk.value = s.rag.chunk; f.topK.value = s.rag.topK;
  renderQueue(); renderSources();
}
function renderQueue() {
  const q = loadJSON("tp_crawl_queue", []);
  $("#queueList").innerHTML = (q.length ? q.map((u, i) => `<div class="q-row"><span class="grow">🕷️ ${esc(u)}</span><button class="mini del" data-qdel="${i}">✕</button></div>`).join("") : `<p class="muted">Queue empty. Crawl runs on your machine via <code>rag/crawl.py</code> — queued URLs are the handoff list.</p>`)
    + (q.length ? `<button class="btn btn-ghost" id="copyQueue">Copy queue as --urls file</button>` : "");
  const b = $("#copyQueue");
  if (b) b.onclick = () => copyText(q.join("\n"), "📋 Queue copied — save as rag/urls.txt");
}
function renderSources() {
  const m = RAG_STATS.map || {};
  $("#sourceList").innerHTML = Object.keys(m).length ? Object.values(m).map(s => `<div class="q-row"><span class="grow">🌐 <b>${esc(s.source_id)}</b> — ${s.chunks} chunks · ${s.urls.length} URLs</span></div>`).join("")
    : `<p class="muted">No chunks indexed yet. Run <code>rag/.venv/bin/python rag/crawl.py --seed</code> to fill the store.</p>`;
}
function tfidfSearch(q, corpus, k) {
  const toks = q.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
  if (!toks.length) return [];
  return corpus.map(t => {
    const hay = (t.name + " " + t.tagline + " " + t.description + " " + (t.tags || []).join(" ") + " " + catName(t.category)).toLowerCase();
    let score = 0; for (const w of toks) { const n = hay.split(w).length - 1; if (n) score += n * (t.name.toLowerCase().includes(w) ? 3 : 1); }
    return { t, score: score + (t.featured ? 0.5 : 0) };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}

/* ---------- appearance / general ---------- */
function fillAppear() {
  const s = getSettings(), f = $("#appearForm");
  f.showAnnouncement.checked = s.showAnnouncement !== false;
  f.announcement.value = s.announcement || "";
  f.heroPill.value = s.heroPill || ""; f.heroTitle.value = s.heroTitle || ""; f.heroSub.value = s.heroSub || "";
  f.theme.value = s.theme || "dark"; f.defaultSort.value = s.defaultSort || "popular";
  f.featuredLimit.value = s.featuredLimit || 8; f.itemsPerPage.value = s.itemsPerPage || 12;
}
function fillGeneral() { const s = getSettings(); $("#generalForm").moderation.value = s.moderation; }

/* ---------- data ---------- */
function renderData() {
  renderActivity($("#activityFull"), 50);
  $("#mcpPreview").textContent = JSON.stringify({ mcpServers: { "crawl4ai-rag": { transport: "sse", url: "http://localhost:8051/sse" } } }, null, 2);
}
function download(name, obj) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([typeof obj === "string" ? obj : JSON.stringify(obj, null, 1)], { type: "application/json" }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function fullBackup() {
  return {
    app: "toolpilot-admin", version: 1, exportedAt: new Date().toISOString(),
    custom: getCustom(), overrides: getOverrides(), deletes: getDeletes(), featOrder: loadJSON("tp_feat_order", []),
    catsFull: loadJSON("tp_cats_full", null), settings: getSettings(),
    votes: loadJSON("tp_votes", {}), saved: loadJSON("tp_saved", []),
    queue: loadJSON("tp_crawl_queue", []), activity: loadJSON("tp_activity", [])
  };
}

/* ---------- editor ---------- */
let editingId = null, editingGrad = null;
function openEditor(t) {
  editingId = t?.id || null; editingGrad = t?.grad || null;
  $("#edTitle").textContent = t ? `Edit — ${t.name}` : "New tool";
  const f = $("#edForm");
  f.id.value = t?.id || "";
  f.name.value = t?.name || ""; f.url.value = t?.url || "";
  f.tagline.value = t?.tagline || ""; f.description.value = t?.description || "";
  $("#edCat").innerHTML = getCats().map(c => `<option value="${c.id}" ${t?.category === c.id ? "selected" : ""}>${c.emoji} ${c.name}</option>`).join("");
  f.pricing.value = t?.pricing || "Freemium";
  f.rating.value = t?.rating ?? 4.5; f.votes.value = t?.votes ?? 0;
  f.emoji.value = t?.emoji || "🚀"; f.date.value = t?.date || new Date().toISOString().slice(0, 10);
  f.tags.value = (t?.tags || []).join(", ");
  f.featured.checked = !!t?.featured; f.isNew.checked = !!t?.isNew;
  $("#edOverlay").hidden = false;
}
function saveEditor(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const data = {
    name: f.get("name").trim(), url: f.get("url").trim(), tagline: f.get("tagline").trim(),
    description: f.get("description").trim(), category: f.get("category"), pricing: f.get("pricing"),
    rating: Math.max(0, Math.min(5, parseFloat(f.get("rating")) || 0)), votes: Math.max(0, parseInt(f.get("votes")) || 0),
    emoji: f.get("emoji") || "🚀", grad: editingGrad || "linear-gradient(135deg,#7c5cff,#00e5ff)",
    date: f.get("date") || new Date().toISOString().slice(0, 10),
    tags: String(f.get("tags") || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 6),
    featured: f.get("featured") ? 1 : 0, isNew: f.get("isNew") ? 1 : 0
  };
  if (!editingId) {
    const c = getCustom(); const tool = Object.assign({ id: "u" + Date.now(), status: "approved" }, data);
    c.unshift(tool); setCustom(c); activity("create", tool.name); toast(`🎉 “${tool.name}” published`);
  } else {
    const c = getCustom(), i = c.findIndex(x => x.id === editingId);
    if (i > -1) { c[i] = Object.assign({}, c[i], data); setCustom(c); }
    else { mutateSeed(editingId, data); }
    activity("edit", data.name); toast("✅ Saved");
  }
  $("#edOverlay").hidden = true; refresh();
}
function refresh() {
  const tab = $("#sideNav button.active").dataset.tab;
  goto(tab);
}

/* ---------- events ---------- */
function bind() {
  $("#loginForm").addEventListener("submit", tryLogin);
  $("#lockBtn").onclick = () => { sessionStorage.removeItem("tp_admin"); location.reload(); };
  $("#sideNav").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) goto(b.dataset.tab); });
  $("#sideToggle").onclick = () => $(".side").classList.toggle("open");
  document.addEventListener("click", e => {
    if (e.target.closest("[data-add-tool]") || e.target.closest("[data-add-tool2]")) openEditor(null);
    if (e.target.closest("[data-goto]")) goto(e.target.closest("[data-goto]").dataset.goto);
    const cp = e.target.closest("[data-copy]"); if (cp) copyText(cp.dataset.copy);
  });
  $("#copyMcp").onclick = () => copyText($("#mcpPreview").textContent, "📋 MCP snippet copied");

  // tools toolbar
  $("#toolSearch").addEventListener("input", e => { toolUI.q = e.target.value.trim(); toolUI.page = 0; renderTools(); });
  $("#toolCatFilter").onchange = e => { toolUI.cat = e.target.value; toolUI.page = 0; renderTools(); };
  $("#toolPriceFilter").onchange = e => { toolUI.price = e.target.value; toolUI.page = 0; renderTools(); };
  $("#toolSort").onchange = e => { toolUI.sort = e.target.value; toolUI.page = 0; renderTools(); };
  $("#toolPrev").onclick = () => { toolUI.page = Math.max(0, toolUI.page - 1); renderTools(); };
  $("#toolNext").onclick = () => { toolUI.page++; renderTools(); };
  $("#selAll").onchange = e => {
    const list = filteredAdmin().slice(toolUI.page * PAGE, toolUI.page * PAGE + PAGE);
    if (e.target.checked) list.forEach(t => toolUI.sel.add(t.id)); else list.forEach(t => toolUI.sel.delete(t.id));
    renderTools();
  };

  // delegated row actions
  document.addEventListener("click", e => {
    const sel = e.target.closest("[data-sel]");
    if (sel) { sel.checked ? toolUI.sel.add(sel.dataset.sel) : toolUI.sel.delete(sel.dataset.sel); renderTools(); return; }
    const ed = e.target.closest("[data-edit]"); if (ed) { openEditor(allAdmin().find(t => t.id === ed.dataset.edit)); return; }
    const fe = e.target.closest("[data-feat]");
    if (fe) {
      const id = fe.dataset.feat, cur = allAdmin().find(t => t.id === id);
      const c = getCustom(), i = c.findIndex(x => x.id === id);
      const nv = cur.featured ? 0 : 1;
      if (i > -1) { c[i].featured = nv; setCustom(c); } else mutateSeed(id, { featured: nv });
      if (nv) { const o = loadJSON("tp_feat_order", []); if (!o.includes(id)) { o.push(id); saveJSON("tp_feat_order", o); } }
      activity(nv ? "feature" : "unfeature", cur.name); refresh(); return;
    }
    const nw = e.target.closest("[data-new]");
    if (nw) {
      const id = nw.dataset.new, cur = allAdmin().find(t => t.id === id), nv = cur.isNew ? 0 : 1;
      const c = getCustom(), i = c.findIndex(x => x.id === id);
      if (i > -1) { c[i].isNew = nv; setCustom(c); } else mutateSeed(id, { isNew: nv });
      activity("toggle-new", cur.name); refresh(); return;
    }
    const del = e.target.closest("[data-del]");
    if (del) {
      const t = allAdmin().find(x => x.id === del.dataset.del);
      if (!confirm(`Delete “${t.name}”?${t._origin === "seed" ? " (curated tool — hidden, restorable)" : ""}`)) return;
      deleteTool(t); toolUI.sel.delete(t.id); toast("🗑 Deleted"); refresh(); return;
    }
    const ap = e.target.closest("[data-approve]");
    if (ap) {
      const c = getCustom(), t = c.find(x => x.id === ap.dataset.approve);
      t.status = "approved"; setCustom(c); activity("approve", t.name); toast(`✅ “${t.name}” is live`); refresh(); return;
    }
    const rj = e.target.closest("[data-reject]");
    if (rj) {
      const c = getCustom(), t = c.find(x => x.id === rj.dataset.reject);
      t.status = "rejected"; setCustom(c); activity("reject", t.name); toast(`🚫 “${t.name}” rejected`); refresh(); return;
    }
    const fu = e.target.closest("[data-fup]"); if (fu) { featMove(fu.dataset.fup, -1); return; }
    const fd = e.target.closest("[data-fdn]"); if (fd) { featMove(fd.dataset.fdn, 1); return; }
    const ce = e.target.closest("[data-catedit]");
    if (ce) {
      const c = getCats().find(x => x.id === ce.dataset.catedit);
      const name = prompt("Category name:", c.name); if (name === null) return;
      const emoji = prompt("Emoji:", c.emoji) || c.emoji;
      saveJSON("tp_cats_full", getCats().map(x => x.id === c.id ? { ...x, name: name.trim() || x.name, emoji } : x));
      activity("edit-category", c.id); renderCats(); return;
    }
    const cd = e.target.closest("[data-catdel]");
    if (cd) {
      const id = cd.dataset.catdel, n = liveTools().filter(t => t.category === id).length;
      if (n) { toast(`❌ ${n} tools still use this category — move them first`); return; }
      if (!confirm("Delete this category?")) return;
      saveJSON("tp_cats_full", getCats().filter(x => x.id !== id)); activity("delete-category", id); renderCats(); return;
    }
    const qd = e.target.closest("[data-qdel]");
    if (qd) { const q = loadJSON("tp_crawl_queue", []); q.splice(+qd.dataset.qdel, 1); saveJSON("tp_crawl_queue", q); renderQueue(); return; }
    const bk = e.target.closest("[data-bulk]");
    if (bk) {
      const ids = [...toolUI.sel]; if (!ids.length) return;
      const c = getCustom();
      const apply = (id, patch) => { const i = c.findIndex(x => x.id === id); if (i > -1) Object.assign(c[i], patch); else mutateSeed(id, patch); };
      if (bk.dataset.bulk === "delete") {
        if (!confirm(`Delete ${ids.length} tools?`)) return;
        ids.forEach(id => { const t = allAdmin().find(x => x.id === id); if (t) deleteTool(t); });
        toolUI.sel.clear(); toast("🗑 Bulk delete done");
      } else if (bk.dataset.bulk === "export") {
        download("tools-selection.json", allAdmin().filter(t => toolUI.sel.has(t.id))); toast("⬇ Exported selection");
      } else {
        const patch = bk.dataset.bulk === "feature" ? { featured: 1 } : bk.dataset.bulk === "unfeature" ? { featured: 0 } : { isNew: 1 };
        ids.forEach(id => apply(id, patch)); activity("bulk-" + bk.dataset.bulk, ids.length + " tools"); toast("✅ Bulk update done");
      }
      setCustom(c); refresh(); return;
    }
  });

  // editor
  $("#edClose").onclick = () => $("#edOverlay").hidden = true;
  $("#edOverlay").addEventListener("click", e => { if (e.target.id === "edOverlay") e.target.hidden = true; });
  $("#edForm").addEventListener("submit", saveEditor);
  document.addEventListener("keydown", e => { if (e.key === "Escape") $("#edOverlay").hidden = true; });

  // categories
  $("#catForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#catName").value.trim(); if (!name) return;
    const id = ($("#catId").value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    const cats = getCats();
    if (cats.some(c => c.id === id)) { toast("❌ ID already exists"); return; }
    cats.push({ id, name, emoji: $("#catEmoji").value.trim() || "📦" });
    saveJSON("tp_cats_full", cats); activity("add-category", id); e.target.reset(); renderCats(); toast("📂 Category added");
  });
  $("#catReset").onclick = () => { localStorage.removeItem("tp_cats_full"); activity("reset-categories", "defaults"); renderCats(); toast("↩ Categories reset"); };

  // RAG
  $("#queueForm").addEventListener("submit", e => {
    e.preventDefault();
    const u = $("#queueUrl").value.trim(); if (!u) return;
    const q = loadJSON("tp_crawl_queue", []); if (!q.includes(u)) q.push(u);
    saveJSON("tp_crawl_queue", q); activity("queue-crawl", u); e.target.reset(); renderQueue(); toast("🕷️ Queued for crawling");
  });
  $("#ragForm").addEventListener("submit", e => {
    e.preventDefault(); const f = e.target, s = getSettings();
    s.rag = { hybrid: f.hybrid.checked, rerank: f.rerank.checked, contextual: f.contextual.checked, agentic: f.agentic.checked, chunk: +f.chunk.value || 1500, topK: +f.topK.value || 5 };
    saveSettings(s); activity("rag-settings", JSON.stringify(s.rag)); toast("⚙️ RAG settings saved"); renderRag();
  });
  $("#ragTestForm").addEventListener("submit", e => {
    e.preventDefault();
    const q = $("#ragTestQ").value.trim(), k = getSettings().rag.topK || 5;
    const hits = tfidfSearch(q, liveTools(), k);
    $("#ragTestOut").innerHTML = hits.length ? hits.map((h, i) => `<div class="q-row"><span class="grow">#${i + 1} <b>${esc(h.t.name)}</b> — ${esc(h.t.tagline)} <small class="muted">(score ${h.score})</small></span></div>`).join("")
      : `<p class="muted">No matches — the index has nothing on that yet.</p>`;
  });

  // appearance
  $("#appearForm").addEventListener("submit", e => {
    e.preventDefault(); const f = e.target, s = getSettings();
    const orNull = v => (v && v.trim() ? v : null);
    Object.assign(s, {
      showAnnouncement: f.showAnnouncement.checked, announcement: orNull(f.announcement.value),
      heroPill: orNull(f.heroPill.value), heroTitle: orNull(f.heroTitle.value), heroSub: orNull(f.heroSub.value),
      theme: f.theme.value, defaultSort: f.defaultSort.value,
      featuredLimit: +f.featuredLimit.value || 8, itemsPerPage: +f.itemsPerPage.value || 12
    });
    saveSettings(s); activity("appearance", "saved"); toast("🎨 Appearance saved — check the live site");
  });

  // general + danger
  $("#generalForm").addEventListener("submit", e => {
    e.preventDefault(); const f = e.target, s = getSettings();
    s.moderation = f.moderation.value;
    if (f.adminPass.value.trim()) s.adminPass = f.adminPass.value.trim();
    saveSettings(s); activity("settings", "moderation=" + s.moderation); f.adminPass.value = "";
    toast("⚙️ Settings saved"); refresh();
  });
  $("#resetVotes").onclick = () => { if (confirm("Reset all browser votes?")) { localStorage.removeItem("tp_votes"); activity("reset-votes", "ok"); toast("↩ Votes reset"); } };
  $("#clearSaved").onclick = () => { if (confirm("Clear all bookmarks?")) { localStorage.removeItem("tp_saved"); activity("clear-saved", "ok"); toast("↩ Bookmarks cleared"); } };
  $("#wipeOverlays").onclick = () => { if (confirm("Discard ALL admin edits to curated tools?")) { ["tp_tool_overrides", "tp_deletes", "tp_feat_order"].forEach(k => localStorage.removeItem(k)); activity("wipe-overlays", "ok"); toast("↩ Edits discarded"); refresh(); } };
  $("#factoryReset").onclick = () => {
    if (!confirm("FACTORY RESET: wipe tools, settings, votes, everything?")) return;
    ["tp_custom", "tp_tool_overrides", "tp_deletes", "tp_feat_order", "tp_cats_full", "tp_settings", "tp_votes", "tp_saved", "tp_crawl_queue", "tp_activity"].forEach(k => localStorage.removeItem(k));
    toast("🏭 Fresh start"); setTimeout(() => location.reload(), 800);
  };

  // data
  $("#exportAll").onclick = () => { download("toolpilot-backup.json", fullBackup()); toast("⬇ Backup downloaded"); };
  $("#exportTools").onclick = () => { download("toolpilot-tools.json", liveTools()); toast("⬇ Tools exported"); };
  $("#importFile").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const b = JSON.parse(r.result);
        if (b.settings) saveJSON("tp_settings", b.settings);
        if (b.custom) setCustom(b.custom);
        if (b.overrides) saveJSON("tp_tool_overrides", b.overrides);
        if (b.deletes) saveJSON("tp_deletes", b.deletes);
        if (b.featOrder) saveJSON("tp_feat_order", b.featOrder);
        if (b.catsFull) saveJSON("tp_cats_full", b.catsFull);
        if (b.votes) saveJSON("tp_votes", b.votes);
        if (b.saved) saveJSON("tp_saved", b.saved);
        if (b.queue) saveJSON("tp_crawl_queue", b.queue);
        activity("import", f.name); toast("⬆ Backup imported"); refresh();
      } catch { toast("❌ Invalid backup file"); }
    };
    r.readAsText(f); e.target.value = "";
  };
  $("#clearLog").onclick = () => { saveJSON("tp_activity", []); renderData(); };
}

/* ---------- boot ---------- */
async function boot() {
  $("#loginWrap").hidden = true; $("#adminApp").hidden = false;
  bind(); await loadRagStats(); goto("dashboard");
}
if (authed()) boot();
else $("#loginForm").addEventListener("submit", tryLogin);
