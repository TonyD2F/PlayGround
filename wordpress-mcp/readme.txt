=== MCP Full Bridge — Agent Connect ===
Contributors: mcpbridge
Tags: mcp, ai, agent, claude, rest api
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Lets any MCP-compatible AI agent connect with FULL site abilities via a secure API key.

== Description ==

Model Context Protocol (MCP) server for WordPress over Streamable HTTP.

* One endpoint: `/wp-json/mcp/v1` (JSON-RPC 2.0: `initialize`, `tools/list`, `tools/call`, `resources/list`, `prompts/list`, `ping`)
* Simple fallback: `POST /wp-json/mcp/v1/call` with `{"tool":"posts_list","arguments":{}}`
* Bearer-key auth: `Authorization: Bearer mcp_live_...` or `X-MCP-Key: ...`
* Full abilities: posts, pages, media upload, users, comments, categories/tags, options, plugins/themes, cache flush, health, SQL (read-only by default), gated PHP eval
* Admin UI under Settings > MCP Bridge: create/revoke keys, rate limit, safety switches, call log
* Every request enforces WordPress capabilities; key owner must stay admin

SECURITY: keys grant full admin power. Use HTTPS only, one key per agent, revoke when done. For emergencies add `define('MCP_DISABLE', true);` to wp-config.php.

== Installation ==

1. Upload `wordpress-mcp` to `/wp-content/plugins/` and Activate.
2. Go to Settings > MCP Bridge > Generate full-access key (copy once).
3. Point your agent at `https://YOURSITE/wp-json/mcp/v1` with header `Authorization: Bearer KEY`.
4. Test: `tools/list`, then `tools/call` e.g. `site_info`.

== Frequently Asked Questions ==

= Which agents work? =
Any MCP client with Streamable HTTP support: Claude Desktop, Cursor, Windsurf, MCP Inspector, custom Python/JS scripts. Dumb HTTP agents can use `/call`.

= Is it really full permissions? =
Yes — the key acts as the selected admin user, with per-tool capability checks. Dangerous tools (SQL write, PHP eval) stay off unless you enable them.

= Can I allow access without a key? =
No, by design. Unauthenticated full access would get your site hacked within minutes. Always use a key + HTTPS.
