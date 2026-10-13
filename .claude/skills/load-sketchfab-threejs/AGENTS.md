# Repository guidance

This directory contains the published `load-sketchfab-threejs` skill. Keep changes scoped to this skill and preserve the existing attribution, download, extraction, normalization, and browser-verification workflows.

## Validation

- Run `git diff --check` before committing.
- Run the relevant scripts from this directory; serve browser viewers over HTTP rather than `file://`.
- Do not commit `node_modules`, generated fixtures, downloaded models, credentials, API tokens, cookies, or session material.

## Changes and commits

- Review the staged diff and ensure unrelated repository changes are not included.
- Commit each update with a clear, concise message.
- Update `wiki/public-extraction.md` when public extraction behavior or repeatable verification commands change.

## Wiki index

- [Public extraction](wiki/public-extraction.md) — one-command browser-native extraction, correction rules, and verification commands.
