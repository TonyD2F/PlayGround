# MCP Full Bridge — Agent Connect (WordPress plugin)

`wordpress-mcp/` in this repo is a complete, installable WordPress plugin.

## Install (2 min)

1. Zip it: `zip -r wordpress-mcp.zip wordpress-mcp`
2. In WP Admin → Plugins → Add New → Upload → activate.
3. Settings → MCP Bridge → **Generate full-access key** (starts `mcp_live_…`, shown once).
4. Endpoint: `https://YOURSITE/wp-json/mcp/v1`

## Connect any agent

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "wordpress": {
      "type": "http",
      "url": "https://YOURSITE/wp-json/mcp/v1",
      "headers": { "Authorization": "Bearer mcp_live_..." }
    }
  }
}
```

### Cursor / Windsurf

Add MCP server → HTTP → URL + header `Authorization: Bearer KEY`.

### Python (no MCP SDK needed)

```python
import requests
BASE = "https://YOURSITE/wp-json/mcp/v1"
H = {"Authorization": "Bearer mcp_live_...", "Content-Type": "application/json"}

# list tools
print(requests.post(BASE, headers=H, json={"jsonrpc":"2.0","id":1,"method":"tools/list"}).json().keys())

# call a tool (MCP style)
r = requests.post(BASE, headers=H, json={
  "jsonrpc":"2.0","id":2,"method":"tools/call",
  "params":{"name":"posts_create","arguments":{"title":"Hello agent","content":"<p>It works.</p>","status":"draft"}}
})
print(r.json())

# ...or simple style
r = requests.post(BASE+"/call", headers=H, json={"tool":"site_info","arguments":{}})
print(r.json())
```

### cURL

```bash
curl -X POST https://YOURSITE/wp-json/mcp/v1 \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer mcp_live_..." \
 -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## What the agent can do (full abilities)

posts/pages list/get/create/update/delete · media list/upload/update/delete ·
users CRUD · comments moderate · categories/tags · options/settings ·
plugins activate/deactivate + themes (toggleable) · cache flush · health_check ·
sql_query_readonly (SELECT/SHOW) + optional writes · eval_php (default OFF) ·
resources: `site://info`, `posts://recent`, `users://me` · prompts: `write_post`, `site_audit`.

## Security model (important)

- The plugin **does not** allow keyless full access — that would be a remote-takeover backdoor.
- Every request needs `Authorization: Bearer KEY` (or `X-MCP-Key`), over HTTPS.
- Key owner must be + remain administrator; capabilities re-checked per tool.
- Dangerous tools gated: SQL writes + PHP eval default OFF, require explicit opt-in.
- Rate-limited per key (default 120/min), full call log in Settings → MCP Bridge.
- Emergency off: add `define('MCP_DISABLE', true);` to `wp-config.php`.
