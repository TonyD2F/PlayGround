# AGENTS.md — Automatic Skill Routing

> This repo vendors skills for frontend design, engineering discipline, and
> Superpowers methodology. Follow this file on **every** turn — skills override
> default behavior unless the user explicitly opts out.

## 0. Skill check (mandatory, before ANY response or action)

- If there is even a 1% chance a skill applies, **invoke it first** — before
  clarifying questions, exploration, or file reads.
- Skill locations (identical copies, harness picks its own):
  - `.agents/skills/` — primary (opencode skill tool, Codex, general)
  - `.opencode/skills/` — OpenCode native
  - `.github/skills/` — GitHub Copilot CLI / VS Code
  - `.claude/skills/` — Claude Code
- Announce `Using [skill] to [purpose]` then follow the skill exactly.

## 1. Superpowers — process first (`obra/superpowers`)

Source: https://github.com/obra/superpowers — 15 skills vendored.

- Start every conversation with `using-superpowers`.
- `Let's build X` → `brainstorming` first, then implementation skills.
- `Fix this bug` → `systematic-debugging` first, then domain skills.
- After approved design: `using-git-worktrees` → `writing-plans` →
  `subagent-driven-development` (or `executing-plans`) with
  `test-driven-development` + `requesting-code-review`, finish with
  `finishing-a-development-branch`.
- Never skip skill workflows to be "helpful". Red-flag thoughts
  ("simple question", "need context first", "I'll just do one thing") mean STOP
  and check skills.
- OpenCode plugin also registered in `opencode.json`:
  `superpowers@git+https://github.com/obra/superpowers.git`.
  Verify with: `Tell me about your superpowers`.

## 2. Frontend design (`pbakaus/impeccable` + complements)

Primary: https://github.com/pbakaus/impeccable — installed via
`npx impeccable install --providers=opencode,codex,github,claude`.

- **Any UI work** (new page, component, redesign, polish, audit, critique,
  layout, typeset, colorize, animate, delight, harden, onboard, adapt,
  optimize): use `impeccable` skill.
- Flow: `/impeccable init` once per project (writes `PRODUCT.md` / `DESIGN.md`),
  then `/impeccable craft|shape|audit|critique|polish|...`.
- Detector: `npx impeccable detect <path|url>` (59 rules). Hooks auto-run on UI
  edits in `.agents`, `.github`, `.claude`, `.codex`.
- Complements (also vendored, use alongside impeccable):
  - `frontend-design` (anthropics/skills) — distinctive visual direction,
    anti-default aesthetics.
  - `brand-guidelines`, `theme-factory`, `canvas-design`,
    `web-artifacts-builder`, `webapp-testing` (anthropics).
  - `web-design-guidelines`, `react-best-practices`, `composition-patterns`,
    `react-view-transitions` (vercel-labs/agent-skills).
- Update: `npx impeccable update`. Refresh via `skills-lock.json` +
  `npx skills update`.

## 3. Engineering discipline (`mattpocock/skills`)

Source: https://github.com/mattpocock/skills — 38 skills vendored.
Router: `ask-matt` (ask which skill fits).

- `grill-me` / `grill-with-docs` — align before building; `grill-with-docs`
  also sharpens `GLOSSARY.md` + ADRs.
- `tdd`, `diagnosing-bugs`, `code-review`, `research`, `prototype`,
  `domain-modeling`, `codebase-design`, `improve-codebase-architecture`,
  `to-spec`, `to-tickets`, `implement`, `implement-spec`, `wayfinder`,
  `triage`, `retro`, `pr`, `wizard`, `handoff`, `teach`, etc.
- Run `/setup-matt-pocock-skills` once per repo (already done — see below).

### Agent skills

#### Issue tracker

GitHub Issues via `gh` CLI. See `docs/agents/issue-tracker.md`.

#### Triage labels

Default five roles (`needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

#### Domain docs

Single-context (`GLOSSARY.md` + `docs/adr/`). See `docs/agents/domain.md`.

## 4. Process lifecycle (from `Agents.md`)

- Run long-lived servers and watchers in a persistent session such as tmux.
- Do not background them in bounded commands without explicit detachment and cleanup.
- After a timeout, inspect the process and endpoint before retrying or claiming failure.

## 5. Linux browser and WebGPU capture

- Use the preinstalled `playwright-cli` executable from Actions or SSH.
- Use its headed Chromium, persistent Xvfb display, and SwiftShader configuration.
- Run `playwright-cli open http://localhost:3002` for the Pascal development server.
- Load a saved scene. Wait for actual geometry and the active WebGPU renderer.
- Run `playwright-cli screenshot --filename=screenshots/linux.png` after creating the output directory.
- Inspect the image. Reject loading screens, empty grids, and blank canvases.
- Report SwiftShader as CPU software rendering. Do not claim GPU hardware acceleration.
- Inspect `$HOME/.local/share/omgithub-playwright/linux.json` for launch settings.
- Use `playwright-cli --help` for commands and named sessions. Pass configuration only to `open`.
