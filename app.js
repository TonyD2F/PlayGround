/* ToolPilot — AI tools directory */
const CATEGORIES = [
  { id:"chat", name:"Chat & Assistants", emoji:"💬" },
  { id:"writing", name:"Writing & SEO", emoji:"✍️" },
  { id:"image", name:"Image & Art", emoji:"🎨" },
  { id:"video", name:"Video & Avatar", emoji:"🎬" },
  { id:"audio", name:"Voice & Audio", emoji:"🎙️" },
  { id:"code", name:"Code & Dev", emoji:"💻" },
  { id:"marketing", name:"Marketing & Ads", emoji:"📣" },
  { id:"productivity", name:"Productivity", emoji:"⚡" },
  { id:"business", name:"Business & Sales", emoji:"💼" },
  { id:"design", name:"Design & UI", emoji:"🖌️" },
  { id:"data", name:"Data & Research", emoji:"📊" },
  { id:"education", name:"Learning", emoji:"🎓" },
];

const SEED = [
  {id:"chatgpt",name:"ChatGPT",tagline:"The assistant that started it all — write, code, plan anything.",description:"OpenAI's conversational AI for writing, coding, brainstorming, data analysis and custom GPTs. The default baseline every other tool is compared against.",category:"chat",pricing:"Freemium",rating:4.9,votes:18432,url:"https://chat.openai.com",emoji:"🤖",grad:"linear-gradient(135deg,#10a37f,#0ea5e9)",tags:["chatbot","gpt-4","writing","coding"],featured:1,isNew:0,date:"2023-01-10"},
  {id:"midjourney",name:"Midjourney",tagline:"Stunning AI art from a Discord prompt.",description:"Text-to-image generator famous for cinematic, painterly, ultra-detailed visuals. V6 brings realistic hands, text rendering and style references.",category:"image",pricing:"Paid",rating:4.8,votes:15210,url:"https://midjourney.com",emoji:"⛵",grad:"linear-gradient(135deg,#6366f1,#a855f7)",tags:["art","illustration","discord"],featured:1,isNew:0,date:"2023-02-01"},
  {id:"runway",name:"Runway Gen-3",tagline:"Text-to-video studio for filmmakers.",description:"Generate and edit video from text, images or video. Inpainting, motion brush, green screen and 4K upscaling used by real film studios.",category:"video",pricing:"Freemium",rating:4.7,votes:9804,url:"https://runway.ml",emoji:"🎥",grad:"linear-gradient(135deg,#22d3ee,#6366f1)",tags:["video","editing","film"],featured:1,isNew:0,date:"2023-06-12"},
  {id:"elevenlabs",name:"ElevenLabs",tagline:"Most realistic AI voice cloning & TTS.",description:"Lifelike text-to-speech in 29 languages, instant voice cloning, dubbing and sound effects. The go-to for YouTube, podcasts and audiobooks.",category:"audio",pricing:"Freemium",rating:4.8,votes:12480,url:"https://elevenlabs.io",emoji:"🗣️",grad:"linear-gradient(135deg,#f472b6,#8b5cf6)",tags:["voice","tts","cloning","podcast"],featured:1,isNew:0,date:"2023-04-20"},
  {id:"cursor",name:"Cursor",tagline:"The AI-first code editor developers love.",description:"Fork of VS Code with codebase-wide chat, tab completion and agent mode that edits multiple files. Ships features 2x faster.",category:"code",pricing:"Freemium",rating:4.9,votes:13922,url:"https://cursor.sh",emoji:"⌨️",grad:"linear-gradient(135deg,#0ea5e9,#22c55e)",tags:["copilot","ide","agents"],featured:1,isNew:1,date:"2026-02-14"},
  {id:"notion-ai",name:"Notion AI",tagline:"Write, summarize & organize inside Notion.",description:"AI summaries, action items, translations and autofill databases right where your docs live. Best for teams already on Notion.",category:"productivity",pricing:"Paid",rating:4.6,votes:8730,url:"https://notion.so",emoji:"📝",grad:"linear-gradient(135deg,#e2e8f0,#64748b)",tags:["notes","wiki","summarizer"],featured:0,isNew:0,date:"2023-05-02"},
  {id:"jasper",name:"Jasper",tagline:"On-brand marketing copy in seconds.",description:"Marketing-focused writer with brand voice memory, 50+ templates, SEO mode and Surfer integration for blogs, ads and email.",category:"writing",pricing:"Paid",rating:4.5,votes:6214,url:"https://jasper.ai",emoji:"✨",grad:"linear-gradient(135deg,#f59e0b,#ef4444)",tags:["copywriting","blog","ads"],featured:0,isNew:0,date:"2023-01-22"},
  {id:"copy-ai",name:"Copy.ai",tagline:"Go-to-market workflows on autopilot.",description:"Prospecting, enrichment, outreach sequences and content repurposing powered by workflows, not just chat.",category:"marketing",pricing:"Free",rating:4.4,votes:5120,url:"https://copy.ai",emoji:"📋",grad:"linear-gradient(135deg,#8b5cf6,#ec4899)",tags:["sales","outreach","workflows"],featured:0,isNew:0,date:"2023-03-11"},
  {id:"synthesia",name:"Synthesia",tagline:"AI avatars that present your script.",description:"140+ avatars, 120 languages. Turn docs into training videos without cameras, actors or studios.",category:"video",pricing:"Paid",rating:4.6,votes:7430,url:"https://synthesia.io",emoji:"🧑‍💼",grad:"linear-gradient(135deg,#06b6d4,#3b82f6)",tags:["avatar","training","localization"],featured:0,isNew:0,date:"2023-02-18"},
  {id:"perplexity",name:"Perplexity",tagline:"Answer engine with live citations.",description:"Conversational search that reads the live web and cites sources. Pro adds GPT-4o, Claude and file analysis.",category:"data",pricing:"Freemium",rating:4.7,votes:11230,url:"https://perplexity.ai",emoji:"🔎",grad:"linear-gradient(135deg,#14b8a6,#3b82f6)",tags:["search","research","citations"],featured:1,isNew:0,date:"2023-07-01"},
  {id:"claude",name:"Claude",tagline:"Thoughtful long-context assistant by Anthropic.",description:"200K context, careful reasoning, artifacts for code/docs/design. Favorite of writers and analysts for nuanced work.",category:"chat",pricing:"Freemium",rating:4.8,votes:13150,url:"https://claude.ai",emoji:"🧠",grad:"linear-gradient(135deg,#f97316,#b45309)",tags:["assistant","analysis","long-context"],featured:1,isNew:0,date:"2023-08-10"},
  {id:"leonardo",name:"Leonardo AI",tagline:"Game assets & art with fine control.",description:"Models, canvas editor, texture generation and consistent characters. Free tier is generous for indie creators.",category:"image",pricing:"Freemium",rating:4.6,votes:6890,url:"https://leonardo.ai",emoji:"🦁",grad:"linear-gradient(135deg,#a855f7,#ec4899)",tags:["game","assets","art"],featured:0,isNew:0,date:"2023-09-05"},
  {id:"descript",name:"Descript",tagline:"Edit audio & video like a doc.",description:"Overdub voice cloning, filler-word removal, studio sound and screen recording. Podcasters' secret weapon.",category:"audio",pricing:"Freemium",rating:4.6,votes:5980,url:"https://descript.com",emoji:"🎧",grad:"linear-gradient(135deg,#0ea5e9,#6366f1)",tags:["podcast","editing","transcription"],featured:0,isNew:0,date:"2023-03-30"},
  {id:"github-copilot",name:"Muse",tagline:"Your AI pair programmer.",description:"Autocomplete and chat inside your IDE, trained on billions of lines. Huge time saver for boilerplate and tests.",category:"code",pricing:"Paid",rating:4.7,votes:10420,url:"https://github.com/features/copilot",emoji:"🐙",grad:"linear-gradient(135deg,#111827,#3b82f6)",tags:["autocomplete","ide","productivity"],featured:0,isNew:0,date:"2023-01-15"},
  {id:"canva-ai",name:"Canva Magic Studio",tagline:"Design anything with a prompt.",description:"Magic Write, Text-to-Image, Background remover and Beat Sync inside the world's easiest design tool.",category:"design",pricing:"Freemium",rating:4.5,votes:9340,url:"https://canva.com",emoji:"🪄",grad:"linear-gradient(135deg,#22d3ee,#a78bfa)",tags:["design","social","presentations"],featured:0,isNew:0,date:"2023-10-04"},
  {id:"pictory",name:"Pictory",tagline:"Blog post → faceless YouTube video.",description:"Auto script-to-video, captions, stock footage and voices. Built for creators pumping out shorts daily.",category:"video",pricing:"Paid",rating:4.4,votes:4210,url:"https://pictory.ai",emoji:"📹",grad:"linear-gradient(135deg,#f43f5e,#f59e0b)",tags:["youtube","shorts","captions"],featured:0,isNew:0,date:"2023-05-19"},
  {id:"surfer",name:"Surfer SEO",tagline:"Rank #1 with AI content optimization.",description:"Content score, NLP terms, internal linking and AI outline builder that reverse-engineers top-ranking pages.",category:"writing",pricing:"Paid",rating:4.5,votes:3870,url:"https://surferseo.com",emoji:"🏄",grad:"linear-gradient(135deg,#22c55e,#0ea5e9)",tags:["seo","blog","ranking"],featured:0,isNew:0,date:"2023-02-27"},
  {id:"hubspot-ai",name:"HubSpot Breeze",tagline:"AI CRM that sells while you sleep.",description:"Prospecting agent, content remix, predictive lead scoring and chatbots stitched into the HubSpot CRM.",category:"business",pricing:"Freemium",rating:4.4,votes:3560,url:"https://hubspot.com",emoji:"🧲",grad:"linear-gradient(135deg,#f97316,#ef4444)",tags:["crm","sales","email"],featured:0,isNew:1,date:"2026-01-20"},
  {id:"mem",name:"Mem",tagline:"Self-organizing notes with AI search.",description:"Capture fast, find instantly. Mem auto-tags and connects notes so you never organize again.",category:"productivity",pricing:"Freemium",rating:4.3,votes:2140,url:"https://mem.ai",emoji:"🧩",grad:"linear-gradient(135deg,#6366f1,#22d3ee)",tags:["notes","pkm","search"],featured:0,isNew:0,date:"2023-04-11"},
  {id:"duolingo-max",name:"Duolingo Max",tagline:"Learn languages with GPT-4 roleplay.",description:"Explain-my-answer and live roleplay conversations inside Duolingo lessons.",category:"education",pricing:"Paid",rating:4.5,votes:4890,url:"https://duolingo.com",emoji:"🦉",grad:"linear-gradient(135deg,#22c55e,#a3e635)",tags:["language","tutor"],featured:0,isNew:0,date:"2023-06-30"},
  {id:"tome",name:"Tome",tagline:"Storytelling slides from one sentence.",description:"Narrative decks with AI layouts, images and live embeds. Pitch decks in minutes.",category:"business",pricing:"Free",rating:4.3,votes:3120,url:"https://tome.app",emoji:"📖",grad:"linear-gradient(135deg,#ec4899,#8b5cf6)",tags:["slides","pitch","storytelling"],featured:0,isNew:0,date:"2023-03-08"},
  {id:"figma-ai",name:"Figma AI",tagline:"Design, rename & prototype with AI.",description:"First-draft UI, auto-rename layers, rewrite copy and make prototypes from prompts.",category:"design",pricing:"Freemium",rating:4.6,votes:7760,url:"https://figma.com",emoji:"🎛️",grad:"linear-gradient(135deg,#a855f7,#22d3ee)",tags:["ui","ux","prototype"],featured:0,isNew:1,date:"2026-03-02"},
  {id:"phind",name:"Phind",tagline:"Answer engine for developers.",description:"Code answers with live docs, repo context and VS Code extension. Like Perplexity but for code.",category:"code",pricing:"Free",rating:4.6,votes:5340,url:"https://phind.com",emoji:"🤿",grad:"linear-gradient(135deg,#0f172a,#22d3ee)",tags:["search","docs","debugging"],featured:0,isNew:0,date:"2023-08-22"},
  {id:"heygen",name:"HeyGen",tagline:"Spokesperson videos in 40 languages.",description:"URL-to-video, talking avatars and voice cloning for ads, onboarding and UGC at scale.",category:"video",pricing:"Freemium",rating:4.5,votes:6120,url:"https://heygen.com",emoji:"🎭",grad:"linear-gradient(135deg,#8b5cf6,#f59e0b)",tags:["avatar","ads","ugc"],featured:1,isNew:1,date:"2026-02-01"},
  {id:"gamma",name:"Gamma",tagline:"Docs, decks & sites that design themselves.",description:"Prompt → polished cards with images, charts and embeds you can publish as a site.",category:"productivity",pricing:"Freemium",rating:4.6,votes:6980,url:"https://gamma.app",emoji:"🃏",grad:"linear-gradient(135deg,#f472b6,#6366f1)",tags:["slides","docs","website"],featured:0,isNew:1,date:"2026-01-11"},
  {id:"writesonic",name:"Writesonic",tagline:"SEO articles & chatbots for brands.",description:"AI Article Writer 6.0, Botsonic chatbots and Photosonic images in one subscription.",category:"writing",pricing:"Free",rating:4.3,votes:4450,url:"https://writesonic.com",emoji:"⌨️",grad:"linear-gradient(135deg,#3b82f6,#8b5cf6)",tags:["blog","chatbot","seo"],featured:0,isNew:0,date:"2023-02-14"},
  {id:"beautiful-ai",name:"Beautiful.ai",tagline:"Investor-ready decks automatically.",description:"Smart templates that keep every slide on-brand while you type.",category:"business",pricing:"Paid",rating:4.2,votes:1890,url:"https://beautiful.ai",emoji:"💎",grad:"linear-gradient(135deg,#0ea5e9,#a855f7)",tags:["pitch","slides"],featured:0,isNew:0,date:"2023-05-25"},
  {id:"elicit",name:"Elicit",tagline:"Research papers, summarized in seconds.",description:"Find papers, extract claims, build literature reviews. Loved by PhDs and analysts.",category:"data",pricing:"Free",rating:4.6,votes:3980,url:"https://elicit.com",emoji:"📚",grad:"linear-gradient(135deg,#14b8a6,#84cc16)",tags:["papers","literature-review"],featured:0,isNew:0,date:"2023-07-19"},
];

const $ = s => document.querySelector(s);
const state = {
  q:"", category:"all", pricing:"all", sort:"popular",
  savedOnly:false, visible:12,
  votes: JSON.parse(localStorage.getItem("tp_votes")||"{}"),
  saved: JSON.parse(localStorage.getItem("tp_saved")||"[]"),
  custom: JSON.parse(localStorage.getItem("tp_custom")||"[]"),
};
const allTools = () => [...state.custom, ...SEED];
const catName = id => (CATEGORIES.find(c=>c.id===id)||{name:id}).name;
const fmt = n => n>=1000 ? (n/1000).toFixed(1).replace(/\.0$/,"")+"k" : ""+n;

function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove("show"),2600); }

/* ---------- render categories ---------- */
function renderCats(){
  const counts={}; allTools().forEach(t=>counts[t.category]=(counts[t.category]||0)+1);
  $("#catGrid").innerHTML = CATEGORIES.map(c=>`
    <button class="cat-card" data-cat="${c.id}">
      <span class="e">${c.emoji}</span><strong>${c.name}</strong><span>${counts[c.id]||0} tools →</span>
    </button>`).join("");
  const sel=$("#categorySelect");
  sel.innerHTML = `<option value="all">All categories</option>`+CATEGORIES.map(c=>`<option value="${c.id}">${c.emoji} ${c.name}</option>`).join("");
  $("#submitCat").innerHTML = CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
  $("#footCats").innerHTML = CATEGORIES.slice(0,5).map(c=>`<a href="#discover" data-cat="${c.id}">${c.emoji} ${c.name}</a>`).join("");
  $("#quickTags").innerHTML = ["AI video editor","coding assistant","voice cloning","logo maker","SEO writer","AI avatar"].map(q=>`<button data-q="${q}">${q}</button>`).join("");
}

/* ---------- filtering ---------- */
function filtered(){
  let list=[...allTools()];
  if(state.savedOnly) list=list.filter(t=>state.saved.includes(t.id));
  if(state.category!=="all") list=list.filter(t=>t.category===state.category);
  if(state.pricing!=="all") list=list.filter(t=>t.pricing===state.pricing);
  if(state.q){ const q=state.q.toLowerCase();
    list=list.filter(t=>(t.name+" "+t.tagline+" "+t.description+" "+(t.tags||[]).join(" ")+" "+catName(t.category)).toLowerCase().includes(q)); }
  const bonus=t=>state.votes[t.id]?1:0;
  if(state.sort==="popular") list.sort((a,b)=>(b.votes+bonus(b))-(a.votes+bonus(a)));
  if(state.sort==="rating") list.sort((a,b)=>b.rating-a.rating);
  if(state.sort==="az") list.sort((a,b)=>a.name.localeCompare(b.name));
  if(state.sort==="newest") list.sort((a,b)=>new Date(b.date)-new Date(a.date));
  return list;
}

function cardHTML(t){
  const voted=!!state.votes[t.id], saved=state.saved.includes(t.id);
  const votes=t.votes+(voted?1:0);
  return `<article class="card" data-id="${t.id}">
    <div class="card-top"><div class="avatar" style="background:${t.grad}">${t.emoji}</div>
      <div><h3>${t.name} ${t.isNew?'<span class="badge b-new">NEW</span>':''}</h3>
      <small>${catName(t.category)} · <span class="stars">★ ${t.rating}</span></small></div></div>
    <p class="tagline">${t.tagline}</p>
    <div class="meta-row"><span class="badge b-${t.pricing.toLowerCase()}">${t.pricing}</span>
      ${(t.tags||[]).slice(0,2).map(x=>`<span class="badge b-cat">#${x}</span>`).join("")}</div>
    <div class="card-foot">
      <span><button class="vote ${voted?'voted':''}" data-vote="${t.id}">▲ ${fmt(votes)}</button>
      <button class="save ${saved?'saved':''}" data-save="${t.id}">${saved?'⭐':'🔖'}</button></span>
      <span class="visit">View tool →</span>
    </div></article>`;
}

function render(){
  const list=filtered();
  const show=list.slice(0,state.visible);
  $("#toolGrid").innerHTML=show.map(cardHTML).join("");
  $("#emptyState").hidden=list.length>0;
  $("#loadMore").style.display=list.length>state.visible?"":"none";
  $("#resultsMeta").textContent=`${list.length} tool${list.length!==1?"s":""} found`;
  $("#resultsTitle").textContent = state.savedOnly?"🔖 Your saved tools": state.category!=="all"?`${CATEGORIES.find(c=>c.id===state.category).emoji} ${catName(state.category)} tools` : "Discover all tools";
  $("#savedCount").textContent=state.saved.length;
  // chips
  const chips=[];
  if(state.q) chips.push({k:"q",l:`🔍 “${state.q}”`});
  if(state.category!=="all") chips.push({k:"category",l:`📂 ${catName(state.category)}`});
  if(state.pricing!=="all") chips.push({k:"pricing",l:`💰 ${state.pricing}`});
  if(state.savedOnly) chips.push({k:"savedOnly",l:`🔖 Saved only`});
  $("#activeChips").innerHTML=chips.map(c=>`<span class="chip">${c.l}<button data-chip="${c.k}">✕</button></span>`).join("");
}

function renderFeatured(){
  const feats=allTools().filter(t=>t.featured).slice(0,8);
  $("#featRow").innerHTML=feats.map(t=>`<div class="feat-card" data-id="${t.id}">
    <div class="feat-top"><div class="avatar" style="background:${t.grad}">${t.emoji}</div>
    <div><h3>${t.name}</h3><small style="color:var(--muted)">⭐ ${t.rating} · ${fmt(t.votes)} upvotes</small></div></div>
    <p class="tagline">${t.tagline}</p>
    <div class="feat-foot"><span class="badge b-${t.pricing.toLowerCase()}">${t.pricing}</span><span class="visit">Explore →</span></div>
  </div>`).join("");
}

/* ---------- modal ---------- */
function openTool(id){
  const t=allTools().find(x=>x.id===id); if(!t) return;
  const voted=!!state.votes[t.id], saved=state.saved.includes(t.id);
  $("#toolModalBody").innerHTML=`
    <div class="modal-hero"><div class="avatar" style="background:${t.grad}">${t.emoji}</div>
      <div><h2>${t.name}</h2><div style="color:var(--muted);font-size:14px">${catName(t.category)} · ⭐ ${t.rating} · ${fmt(t.votes+(voted?1:0))} upvotes</div></div></div>
    <div class="meta-row"><span class="badge b-${t.pricing.toLowerCase()}">${t.pricing}</span>
      <span class="badge b-cat">${catName(t.category)}</span>${t.isNew?'<span class="badge b-new">NEW</span>':""}
      ${(t.tags||[]).map(x=>`<span class="badge">#${x}</span>`).join("")}</div>
    <p style="line-height:1.7;color:var(--muted);margin:14px 0">${t.description}</p>
    <ul class="feat-list"><li>✅ Free trial / free tier available</li><li>✅ No credit card to start</li><li>✅ Rated ${t.rating}/5 by ToolPilot hunters</li></ul>
    <div class="modal-actions">
      <a class="btn btn-primary" href="${t.url}" target="_blank" rel="noopener">Visit ${t.name} ↗</a>
      <button class="vote ${voted?'voted':''}" data-vote="${t.id}">▲ ${fmt(t.votes+(voted?1:0))} Upvote</button>
      <button class="save ${saved?'saved':''}" data-save="${t.id}">${saved?'⭐ Saved':'🔖 Save'}</button>
    </div>`;
  $("#toolOverlay").hidden=false;
}

/* ---------- events ---------- */
function bind(){
  const grid=$("#toolGrid"), feat=$("#featRow");
  document.addEventListener("click",e=>{
    const v=e.target.closest("[data-vote]");
    if(v){ e.stopPropagation(); const id=v.dataset.vote;
      state.votes[id]?delete state.votes[id]:state.votes[id]=1;
      localStorage.setItem("tp_votes",JSON.stringify(state.votes)); render();
      if(!$("#toolOverlay").hidden) openTool(id); return; }
    const s=e.target.closest("[data-save]");
    if(s){ e.stopPropagation(); const id=s.dataset.save;
      state.saved=state.saved.includes(id)?state.saved.filter(x=>x!==id):[...state.saved,id];
      localStorage.setItem("tp_saved",JSON.stringify(state.saved)); render();
      if(!$("#toolOverlay").hidden) openTool(id);
      toast(state.saved.includes(id)?"⭐ Saved to your collection":"Removed from saved"); return; }
    const card=e.target.closest("[data-id]");
    if(card){ openTool(card.dataset.id); return; }
    const cat=e.target.closest("[data-cat]");
    if(cat){ state.category=cat.dataset.cat; state.visible=12; $("#categorySelect").value=state.category; render();
      document.querySelector("#discover").scrollIntoView({behavior:"smooth"}); return; }
    const q=e.target.closest("[data-q]");
    if(q){ state.q=q.dataset.q; $("#searchInput").value=state.q; state.visible=12; render();
      document.querySelector("#discover").scrollIntoView({behavior:"smooth"}); return; }
    const chip=e.target.closest("[data-chip]");
    if(chip){ const k=chip.dataset.chip;
      if(k==="q"){state.q="";$("#searchInput").value="";}
      if(k==="category"){state.category="all";$("#categorySelect").value="all";}
      if(k==="pricing"){state.pricing="all";document.querySelectorAll("#pricingPills .pill").forEach(p=>p.classList.toggle("active",p.dataset.pricing==="all"));}
      if(k==="savedOnly"){state.savedOnly=false;$("#savedToggle").style.borderColor="";}
      render(); return; }
    if(e.target.closest("[data-open-submit]")){ $("#submitOverlay").hidden=false; return; }
    if(e.target.closest("[data-close-submit]")||e.target.id==="submitOverlay"){ $("#submitOverlay").hidden=true; return; }
  });
  $("#toolClose").onclick=()=>$("#toolOverlay").hidden=true;
  $("#toolOverlay").addEventListener("click",e=>{ if(e.target.id==="toolOverlay") e.target.hidden=true; });
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ $("#toolOverlay").hidden=true; $("#submitOverlay").hidden=true; }});

  // search with suggestions
  const input=$("#searchInput"), sug=$("#searchSuggest");
  input.addEventListener("input",()=>{
    state.q=input.value.trim(); state.visible=12; render();
    const q=state.q.toLowerCase();
    if(q.length<2){ sug.classList.remove("open"); return; }
    const hits=allTools().filter(t=>(t.name+" "+t.tagline).toLowerCase().includes(q)).slice(0,5);
    sug.innerHTML=hits.map(t=>`<button data-sug="${t.id}">${t.emoji} <strong>${t.name}</strong> — ${t.tagline.slice(0,45)}…</button>`).join("")||`<button disabled>No matches — press Enter to search anyway</button>`;
    sug.classList.add("open");
  });
  sug.addEventListener("click",e=>{ const b=e.target.closest("[data-sug]"); if(b) openTool(b.dataset.sug); sug.classList.remove("open"); });
  document.addEventListener("click",e=>{ if(!e.target.closest(".search-big")) sug.classList.remove("open"); });
  input.addEventListener("keydown",e=>{ if(e.key==="Enter"){ sug.classList.remove("open"); document.querySelector("#discover").scrollIntoView({behavior:"smooth"}); }});
  $("#searchBtn").onclick=()=>document.querySelector("#discover").scrollIntoView({behavior:"smooth"});

  $("#pricingPills").addEventListener("click",e=>{ const p=e.target.closest(".pill"); if(!p)return;
    document.querySelectorAll("#pricingPills .pill").forEach(x=>x.classList.remove("active")); p.classList.add("active");
    state.pricing=p.dataset.pricing; state.visible=12; render(); });
  $("#categorySelect").onchange=e=>{ state.category=e.target.value; state.visible=12; render(); };
  $("#sortSelect").onchange=e=>{ state.sort=e.target.value; render(); };
  $("#loadMore").onclick=()=>{ state.visible+=9; render(); };
  $("#resetFilters").onclick=()=>{ state.q="";state.category="all";state.pricing="all";state.savedOnly=false;state.visible=12;
    $("#searchInput").value="";$("#categorySelect").value="all";
    document.querySelectorAll("#pricingPills .pill").forEach(p=>p.classList.toggle("active",p.dataset.pricing==="all")); render(); };
  const toggleSaved=()=>{ state.savedOnly=!state.savedOnly; $("#savedToggle").style.borderColor=state.savedOnly?"var(--gold)":""; render(); };
  $("#savedToggle").onclick=toggleSaved;
  $("#savedBtn").onclick=toggleSaved;
  $("#viewAllCats").onclick=()=>{ state.category="all"; $("#categorySelect").value="all"; render(); };
  $("#featPrev").onclick=()=>$("#featRow").scrollBy({left:-360,behavior:"smooth"});
  $("#featNext").onclick=()=>$("#featRow").scrollBy({left:360,behavior:"smooth"});
  $("#announceSubmit").onclick=e=>{ e.preventDefault(); $("#submitOverlay").hidden=false; };
  $("#hamburger").onclick=()=>$("#mobileNav").classList.toggle("open");
  $("#mobileNav").addEventListener("click",e=>{ if(e.target.closest("a")) $("#mobileNav").classList.remove("open"); });
  $("#themeBtn").onclick=e=>{ const h=document.documentElement; const light=h.dataset.theme==="light";
    if(light){delete h.dataset.theme;e.target.textContent="🌙";}else{h.dataset.theme="light";e.target.textContent="☀️";} };

  // submit
  $("#submitForm").addEventListener("submit",e=>{
    e.preventDefault(); const f=new FormData(e.target);
    const tool={ id:"u"+Date.now(), name:f.get("name").trim(), tagline:f.get("tagline").trim(),
      description:f.get("description").trim(), category:f.get("category"), pricing:f.get("pricing"),
      url:f.get("url").trim(), tags:(f.get("tags")||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean).slice(0,4),
      rating:5.0, votes:1, emoji:"🚀", grad:"linear-gradient(135deg,#7c5cff,#00e5ff)", featured:0, isNew:1, date:new Date().toISOString().slice(0,10) };
    state.custom.unshift(tool); localStorage.setItem("tp_custom",JSON.stringify(state.custom));
    $("#submitOverlay").hidden=true; e.target.reset();
    state.q="";$("#searchInput").value="";state.category="all";$("#categorySelect").value="all";state.visible=12; render();
    toast(`🎉 “${tool.name}” is live as a Community pick!`); openTool(tool.id);
  });

  $("#newsForm").addEventListener("submit",e=>{ e.preventDefault();
    toast("📬 You're in! First drop lands Friday."); $("#newsMsg").textContent="✓ Check your inbox to confirm — welcome aboard!"; e.target.reset(); });

  // animated counters
  const io=new IntersectionObserver(es=>es.forEach(x=>{ if(!x.isIntersecting)return; const el=x.target; io.unobserve(el);
    const end=+el.dataset.count, t0=performance.now();
    (function tick(t){ const p=Math.min(1,(t-t0)/1400), ease=1-Math.pow(1-p,3);
      el.textContent=end>=1000?(end*ease/1000).toFixed(1)+"k":Math.round(end*ease).toLocaleString();
      if(p<1)requestAnimationFrame(tick); else el.textContent=end>=1000?(end/1000).toFixed(1).replace(/\.0$/,"")+"k+":end; })(t0); }));
  document.querySelectorAll("[data-count]").forEach(el=>io.observe(el));
}

renderCats(); renderFeatured(); render(); bind();
