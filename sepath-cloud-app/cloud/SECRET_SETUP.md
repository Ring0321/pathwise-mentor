# SE-Path Secret Setup

This project must receive model and platform secrets from the server runtime, not
from source code or the browser bundle.

## Safe Rule

- Do not paste real provider keys into `.env`, Vue files, TypeScript files,
  documentation examples, screenshots, issue text, or export packages.
- If a key has appeared in chat, logs, screenshots, or a shared document, revoke
  it in the provider console and create a new key before cloud setup.
- Frontend builds may only receive `VITE_SEPATH_API_BASE` and, if the model
  gateway is split, `VITE_SEPATH_LLM_GATEWAY_BASE`.
- `LLM_API_KEY` only lives in Cloudflare Worker secrets.

## Cloudflare Worker Setup

1. Copy the example config and fill non-secret runtime values:

```powershell
Copy-Item .\cloud\wrangler.sepath.example.toml .\cloud\wrangler.sepath.toml
```

Update these fields in `cloud/wrangler.sepath.toml`:

- `SEPATH_ALLOWED_ORIGINS`
- `LLM_BASE_URL`
- `LLM_MODEL`
- D1 `database_id`

2. Set secrets from PowerShell:

```powershell
npm run cloud:secrets:setup -- -CreateConfigFromExample
```

The script prompts for a fresh `LLM_API_KEY`, asks for a teacher-console access
code, and generates platform HMAC secrets for:

- `SEPATH_AUTH_SECRET`
- `SEPATH_TEACHER_ACCESS_CODE`
- `SEPATH_RETURN_SECRET`
- `SEPATH_TOKEN_ISSUER_SECRET`
- `SEPATH_GITHUB_WEBHOOK_SECRET`

Use this narrower command when rotating only the model key:

```powershell
npm run cloud:secrets:setup -- -OnlyLlmKey
```

3. Validate before deployment:

```powershell
npm run cloud:smoke:llm
npm run cloud:openapi:validate
npm run cloud:smoke
npm run cloud:smoke:db
npm run build
```

## Runtime Boundary

The governed agent receives only pseudonymous work-order context and evidence
IDs. It returns scaffolded guidance, evidence-gap prompts, and teacher-review
summaries. It must not auto-publish, close work orders, grade students, or
produce complete submit-ready answers.
