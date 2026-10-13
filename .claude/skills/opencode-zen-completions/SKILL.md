---
name: opencode-zen-completions
description: Use the OpenCode Zen OpenAI-compatible chat completions API when an implementation task needs an external model completion, including listing available models and selecting free models.
---

# OpenCode Zen completions

Use this skill when an implementation needs to send a prompt to the OpenCode Zen completions API. Keep the API call separate from product code unless the user explicitly asks to integrate it.

## Endpoints

- Models: `https://opencode.ai/zen/v1/models`
- Completions: `https://opencode.ai/zen/v1/chat/completions`

The API is OpenAI-compatible. For the public OpenCode CLI-compatible request, use `Authorization: Bearer public`, `Content-Type: application/json`, and the client headers shown below. Treat model availability as live data: query the models endpoint before selecting a model when the exact model matters.

## Model selection

```sh
curl -sS https://opencode.ai/zen/v1/models \
  | jq -r '.data[].id | select(endswith("-free"))'
```

Prefer a currently listed `*-free` model when the user requests free usage. Known examples include `deepseek-v4-flash-free`, `muse-spark-1.2-contributor-free`, `mimo-v2.5-free`, `hy3-free`, `ling-3.0-flash-fin-free`, `nemotron-3-ultra-free`, `nemotron-3.5-lightning-free`, and `laguna-s-2.1-free`, but this list can change.

## Completion request

```sh
curl -sS https://opencode.ai/zen/v1/chat/completions \
  -X POST \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer public' \
  -H 'User-Agent: opencode/1.15.9 ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.14' \
  -H 'X-Opencode-Client: cli' \
  -H 'X-Opencode-Project: global' \
  -d '{"model":"mimo-v2.5-free","messages":[{"role":"user","content":"<implementation prompt>"}],"stream":false}' \
  | jq
```

Use `stream: true` only when incremental output is useful. Check the HTTP status and API error object before consuming the completion. Non-streaming text is commonly at `.choices[0].message.content`; inspect the returned shape if the provider reports an error or a different format.

