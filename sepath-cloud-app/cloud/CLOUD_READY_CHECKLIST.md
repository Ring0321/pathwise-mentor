# SE-Path Cloud Ready Checklist

## Runtime Target

- API runtime: Cloudflare Worker
- Data store: Cloudflare D1 binding `SEPATH_DB`
- Privacy mode: `SEPATH_PRIVACY_MODE=pseudonymous`
- Browser config: `VITE_SEPATH_API_BASE`; if the model gateway is split from the main API, also set `VITE_SEPATH_LLM_GATEWAY_BASE`

## Required Worker Variables

- `SEPATH_DEPLOY_ENV=production`
- `SEPATH_PRIVACY_MODE=pseudonymous`
- `SEPATH_ALLOWED_ORIGINS=https://your-frontend-domain`
- `LLM_BASE_URL=https://api.openai.com/v1`
- `LLM_MODEL=<model-name>`

## Required Worker Secrets

Set these with the hosting provider secret manager. Do not place real values in source code.
Use `npm run cloud:secrets:setup -- -CreateConfigFromExample` to set them through
Cloudflare Wrangler without saving secret values in the repository.

- `SEPATH_AUTH_SECRET`
- `SEPATH_TEACHER_ACCESS_CODE`
- `SEPATH_RETURN_SECRET`
- `SEPATH_TOKEN_ISSUER_SECRET`
- `SEPATH_GITHUB_WEBHOOK_SECRET`
- `LLM_API_KEY`

## D1 Migrations

Apply migrations in order:

1. `001_init_sepath_schema.sql`
2. `003_evidence_indexes.sql`
3. `004_workbench_runtime_store.sql`
4. `005_cloud_ready_records.sql`

`002_enable_rls.sql` documents a Postgres RLS model and is not applied to D1.

## Pre-Cloud Gate

1. `npm run cloud:openapi:validate`
2. `npm run cloud:smoke`
3. `npm run cloud:smoke:db`
4. `npm run cloud:smoke:llm`
5. `npm run build`

## Operational Boundary

- Teachers approve, return for evidence, or route to a meeting.
- Students can only submit their own return evidence through scoped short-lived tokens.
- Inspectors are read-only.
- The governed agent only creates scaffolded guidance, evidence-gap prompts and review summaries.
- No browser bundle may include real names, email, phone, tokens, raw CI logs, full diffs, webhook secrets or model keys.
