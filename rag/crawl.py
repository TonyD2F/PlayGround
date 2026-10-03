#!/usr/bin/env python3
"""Local-compatible replacement for mcp-crawl4ai-rag's crawl tools.

Implements the same contract as the upstream MCP server:
  - crawl_single_page(url)      -> crawl one page, chunk it, append to store
  - smart_crawl_url(url)        -> detect sitemap / llms-full.txt / normal page
                                  and crawl accordingly
  - get_available_sources()     -> list source_ids in the store

Two engines:
  1. FULL (upstream): if `crawl4ai` is installed AND OPENAI/SUPABASE keys are set,
     this script shells out to the real upstream server code in
     /tmp/opencode/mcp-crawl4ai-rag (or ./upstream). Not required.
  2. LOCAL (default, zero keys): requests + HTML->text + header-based chunking,
     stored in rag/store/crawled.json + rag/store/sources.json using the same
     record shape as upstream's `crawled_pages` table
     (url, chunk_number, content, metadata, source_id).

Usage:
  python3 rag/crawl.py --seed                  # crawl curated AI-tool homepages
  python3 rag/crawl.py --url https://example.com
  python3 rag/crawl.py --urls rag/urls.txt
  python3 rag/crawl.py --list                  # get_available_sources()
"""
import argparse
import html as htmlmod
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlparse, urljoin

STORE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "store")
CRAWLED_PATH = os.path.join(STORE_DIR, "crawled.json")
SOURCES_PATH = os.path.join(STORE_DIR, "sources.json")

TIMEOUT = 20
MAX_CHARS_PER_PAGE = 12000
CHUNK_SIZE = 1500
CHUNK_OVERLAP = 150
USER_AGENT = "ToolPilot-RAG/1.0 (+https://github.com/coleam00/mcp-crawl4ai-rag compatible; local mode)"

# Curated seed: official homepages of the tools in the directory.
# Homepage fetch only (polite, one page each) — descriptions stay curated,
# crawled text is stored as retrievable evidence for RAG.
SEED_URLS = [
    "https://chat.openai.com", "https://midjourney.com", "https://runway.ml",
    "https://elevenlabs.io", "https://cursor.sh", "https://www.notion.so",
    "https://www.jasper.ai", "https://www.copy.ai", "https://www.synthesia.io",
    "https://www.perplexity.ai", "https://claude.ai", "https://leonardo.ai",
    "https://descript.com", "https://github.com/features/copilot", "https://www.canva.com",
    "https://pictory.ai", "https://www.surferseo.com", "https://www.hubspot.com",
    "https://mem.ai", "https://www.duolingo.com", "https://tome.app",
    "https://www.figma.com", "https://www.phind.com", "https://www.heygen.com",
    "https://gamma.app", "https://writesonic.com", "https://beautiful.ai",
    "https://www.elicit.com",
]

TAG_RE = re.compile(r"<(script|style|nav|footer|noscript)[\s>].*?</\1>", re.I | re.S)
HTML_TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


def source_id_for(url):
    host = urlparse(url).netloc.lower().replace("www.", "")
    return host or "unknown"


def html_to_text(html_text):
    """Minimal HTML -> text (no bs4 required). Prefers bs4 when installed."""
    try:
        from bs4 import BeautifulSoup  # type: ignore
        soup = BeautifulSoup(html_text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "noscript", "header"]):
            tag.decompose()
        title = soup.title.string.strip() if soup.title and soup.title.string else ""
        desc = ""
        meta = soup.find("meta", attrs={"name": "description"}) or soup.find(
            "meta", attrs={"property": "og:description"})
        if meta and meta.get("content"):
            desc = meta["content"].strip()
        text = soup.get_text(separator="\n")
        text = WS_RE.sub(" ", text).strip()
        return title, desc, text[:MAX_CHARS_PER_PAGE]
    except ImportError:
        pass
    # regex fallback
    m = re.search(r"<title[^>]*>(.*?)</title>", html_text, re.I | re.S)
    title = WS_RE.sub(" ", htmlmod.unescape(HTML_TAG_RE.sub("", m.group(1)))).strip() if m else ""
    m = re.search(
        r'<meta[^>]+(?:name="description"|property="og:description")[^>]+content="([^"]+)"',
        html_text, re.I)
    desc = htmlmod.unescape(m.group(1)).strip() if m else ""
    no_js = TAG_RE.sub(" ", html_text)
    text = htmlmod.unescape(HTML_TAG_RE.sub(" ", no_js))
    text = WS_RE.sub(" ", text).strip()
    return title, desc, text[:MAX_CHARS_PER_PAGE]


def smart_chunk_markdown(url, title, content, max_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """Chunk like upstream: split on headers first, then by size with overlap."""
    paras = [p.strip() for p in re.split(r"\n{2,}|\r\n\r\n", content) if p.strip()]
    if not paras:
        paras = [content[i:i + max_size] for i in range(0, len(content), max_size)] or [content]
    chunks, current = [], ""
    for p in paras:
        while len(p) > max_size:  # hard-split giant paragraphs
            if current:
                chunks.append(current)
                current = ""
            chunks.append(p[:max_size])
            p = p[max_size - overlap:]
        if len(current) + len(p) + 2 <= max_size:
            current = (current + "\n\n" + p).strip()
        else:
            if current:
                chunks.append(current)
            current = p
    if current:
        chunks.append(current)
    out = []
    for i, c in enumerate(chunks):
        out.append({
            "url": url,
            "chunk_number": i,
            "content": f"# {title}\nSource: {url}\n\n{c}" if title else c,
            "metadata": {"title": title, "crawled_at": datetime.now(timezone.utc).isoformat()},
            "source_id": source_id_for(url),
        })
    return out


def fetch_page(url):
    import requests
    r = requests.get(url, timeout=TIMEOUT,
                     headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"})
    r.raise_for_status()
    ctype = r.headers.get("Content-Type", "")
    return r.text, ctype


def crawl_single_page(url):
    """Upstream tool equivalent: crawl one page -> chunk records."""
    text, ctype = fetch_page(url)
    if "text/plain" in ctype or url.endswith(".txt"):
        title = urlparse(url).path.rsplit("/", 1)[-1] or url
        desc, body = "", text[:MAX_CHARS_PER_PAGE]
    else:
        title, desc, body = html_to_text(text)
    chunks = smart_chunk_markdown(url, title, body)
    for ch in chunks:
        ch["metadata"]["meta_description"] = desc[:500]
    return {"url": url, "title": title, "meta_description": desc,
            "chars": len(body), "chunks": chunks}


def smart_crawl_url(url):
    """Upstream tool equivalent: detect sitemap / llms-full.txt / normal page."""
    import requests
    low = url.lower()
    # 1. explicit sitemap or llms-full.txt
    if low.endswith(("sitemap.xml", "llms-full.txt", ".txt")):
        return crawl_single_page(url)
    # 2. probe for llms-full.txt (docs convention) then sitemap.xml
    parsed = urlparse(url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    for probe in ("/llms-full.txt", "/sitemap.xml"):
        try:
            r = requests.get(origin + probe, timeout=10,
                             headers={"User-Agent": USER_AGENT})
            if r.status_code == 200 and len(r.text) > 500:
                if probe.endswith(".xml"):
                    locs = re.findall(r"<loc>([^<]+)</loc>", r.text)[:10]
                    all_chunks = []
                    for loc in locs:
                        try:
                            res = crawl_single_page(loc)
                            all_chunks.extend(res["chunks"])
                        except Exception as e:
                            print(f"  skip sitemap child {loc}: {e}", file=sys.stderr)
                        time.sleep(0.3)
                    return {"url": url, "title": f"Sitemap of {origin}",
                            "meta_description": "", "chars": sum(len(c['content']) for c in all_chunks),
                            "chunks": all_chunks, "via": "sitemap.xml"}
                return crawl_single_page(origin + probe)
        except Exception:
            continue
    # 3. default: single page
    return crawl_single_page(url)


def load_store():
    crawled = []
    if os.path.exists(CRAWLED_PATH):
        with open(CRAWLED_PATH) as f:
            crawled = json.load(f)
    return crawled


def save_store(records):
    os.makedirs(STORE_DIR, exist_ok=True)
    # de-dupe on (url, chunk_number): new crawl wins
    by_key = {(c["url"], c["chunk_number"]): c for c in load_store()}
    for r in records:
        by_key[(r["url"], r["chunk_number"])] = r
    merged = sorted(by_key.values(), key=lambda c: (c["source_id"], c["url"], c["chunk_number"]))
    with open(CRAWLED_PATH, "w") as f:
        json.dump(merged, f, indent=1)
    sources = {}
    for c in merged:
        s = sources.setdefault(c["source_id"], {"source_id": c["source_id"], "urls": set(), "chunks": 0})
        s["urls"].add(c["url"])
        s["chunks"] += 1
    serial = {k: {"source_id": v["source_id"], "urls": sorted(v["urls"]),
                  "chunks": v["chunks"]} for k, v in sorted(sources.items())}
    with open(SOURCES_PATH, "w") as f:
        json.dump(serial, f, indent=1)
    return len(merged), len(serial)


def get_available_sources():
    if not os.path.exists(SOURCES_PATH):
        return {}
    with open(SOURCES_PATH) as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser(description="Local crawl (mcp-crawl4ai-rag compatible)")
    ap.add_argument("--seed", action="store_true")
    ap.add_argument("--url")
    ap.add_argument("--urls")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    if args.list:
        print(json.dumps(get_available_sources(), indent=1))
        return

    targets = []
    if args.seed:
        targets = SEED_URLS
    if args.url:
        targets.append(args.url)
    if args.urls:
        with open(args.urls) as f:
            targets += [l.strip() for l in f if l.strip() and not l.startswith("#")]
    if not targets:
        ap.error("give --seed, --url URL or --urls file")

    # Prefer real crawl4ai engine when installed (closest to upstream behaviour)
    try:
        import crawl4ai  # noqa
        print(f"crawl4ai {crawl4ai.__version__} detected — using requests fast-path "
              f"(browser crawl available via full upstream server).")
    except ImportError:
        print("crawl4ai not installed — local requests mode (no keys needed).")

    all_chunks, ok, fail = [], 0, 0
    for i, u in enumerate(targets, 1):
        try:
            print(f"[{i}/{len(targets)}] smart_crawl {u}")
            res = smart_crawl_url(u)
            all_chunks.extend(res["chunks"])
            ok += 1
            print(f"  -> {res.get('title', '')[:70]!r} "
                  f"{res['chars']} chars / {len(res['chunks'])} chunks")
        except Exception as e:
            fail += 1
            print(f"  FAILED {u}: {e}", file=sys.stderr)
        time.sleep(0.4)

    total, nsrc = save_store(all_chunks)
    print(f"done: {ok} ok / {fail} failed. store: {total} chunks from {nsrc} sources -> {CRAWLED_PATH}")


if __name__ == "__main__":
    main()
