# Vendored third-party libraries (all permissive, all attributed)

Served locally so the game works offline and never breaks on CDN drift.
Upstream versions pinned; check here before upgrading.

| file | upstream | version | license | why |
|---|---|---|---|---|
| `tween.esm.js` | https://github.com/tweenjs/tween.js | 25.0.0 | MIT | hit-stop/slow-mo/FOV punches, announce pops |
| `nipplejs.js` | https://github.com/yoannmoinet/nipplejs | 0.10.1 | MIT | analog touch joystick (P1 movement) |
| `N8AO.js` | https://github.com/N8python/n8ao | 2.0.1 | ISC | temporal-stable SSAO pass for EffectComposer |
| `screen-shake.js` | https://github.com/sajmoni/screen-shake (JS port) | — | MIT (original) | Perlin trauma screen shake; ported to zero-dep JS, `update()` returns absolute offsets |

Game code that *uses* these libs lives in `index.html`.
Fighter models live in `../assets/fighters/` (CC0, see sidecars).
