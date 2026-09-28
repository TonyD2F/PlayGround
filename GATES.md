# Gates: Cosmic Clash 3D — playability acceptance (unlazy leaf)

OWNS: tools/verify-*.mjs, GATES.md

Scope: the game boots, parses, ships its assets, and lands melee hits.

- [x] G1: game module parses with zero syntax errors
  CHECK: node tools/verify-syntax.mjs
  EXPECT: syntax verification passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=252607ea602f54995de8cd56be7b2b690ef99498994a0ac5bb02930c3da90110; exit=0; EXPECT=matched; output-sha256=a5a55eed822e9930a6afcdb5337fb109bb0d54a92c67bb1cc3ff41b1bf993f00; output-bytes=27; shell=/bin/sh; cwd=/home/runner/work/PlayGround/PlayGround; path=70900e2366de/18 entries

- [x] G2: vendored libs and fighter assets present with license sidecars
  CHECK: node tools/verify-assets.mjs
  EXPECT: asset verification passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=474bcd1776c17db1428a5cb335ef83421fd51029e0befa1ebf6a35e28b0504c9; exit=0; EXPECT=matched; output-sha256=adf8f9d9898a2205aeb6475a139b38e1de93d703283ef0b81b29af17d1cf0e28; output-bytes=26; shell=/bin/sh; cwd=/home/runner/work/PlayGround/PlayGround; path=70900e2366de/18 entries

- [x] G3: procedural forge outputs are fresh
  CHECK: node tools/forge-assets.mjs --check
  EXPECT: all forged assets present
  EVIDENCE: automatic-evidence=v1; definition-sha256=84453d2ee85b11ef381d175ac869555253ed195fdfef8ee5f295a00cf38accff; exit=0; EXPECT=matched; output-sha256=5d48ba2f2fb1bc8e83e489465bbb96b6b831a745335908c8cae6e8b1e64927f4; output-bytes=26; shell=/bin/sh; cwd=/home/runner/work/PlayGround/PlayGround; path=70900e2366de/18 entries

- [ ] G4: P1 punch damages the training dummy (manual: NO command can click through a live fight yet)
  EVIDENCE: pending — OPEN BUG 2026-09-28: held 'j' point-blank dealt 0 damage while 'l' blast worked; punch clip visibly played. Suspect doMelee/pendingHit path, not input.

- [ ] G5: title → fight runs with zero console errors (manual: needs eye on screenshot + log)
  EVIDENCE: pending — last clean run 2026-09-28 (35 fps, bloom+N8AO) predates super-meter/combo/RoomEnvironment edits; re-verify after G4 fix.
