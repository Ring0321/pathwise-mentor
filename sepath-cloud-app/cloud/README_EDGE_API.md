# SE-Path Edge API Runtime

`edge-api-worker.mjs` is an operational reference implementation for the core SE-Path backend API. It proves that the product is not a static frontend-only mock: the main learning-loop endpoints can run behind an edge worker with HMAC access tokens, privacy gates, deterministic SafeVOI ranking, teacher review tickets and smoke-testable responses.

## Implemented Routes

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Runtime health and endpoint list. |
| `GET /api/auth/session` | Read current actor role, capabilities and agent / human review boundaries. |
| `GET /api/course/settings` | Read course, repository, CI provider and privacy-boundary settings. |
| `POST /api/course/settings` | Save teacher-managed course settings without client API URL or protected identity fields. |
| `POST /api/course/launch` | Initialize a teacher course pilot by saving settings, saving a pseudonymous roster and creating first-round candidate diagnosis work orders. |
| `GET /api/course/roster` | Read the pseudonymous class roster used for teacher batch diagnosis. |
| `POST /api/course/roster` | Save a teacher-managed pseudonymous roster without real identity fields. |
| `POST /api/evidence/events` | Validate and accept pseudonymous EvidenceEvent payloads. |
| `GET /api/evidence/events` | Read back stored pseudonymous EvidenceEvent records by tenant, course and learner hash. |
| `GET /api/workbench/teacher/today` | Read the teacher's current diagnosis queue, selected work order, evidence ledger and student-return state. |
| `GET /api/work-orders` | List course work orders for filtering and queue views. |
| `POST /api/work-order-batches` | Create diagnosis-stage candidate work orders from roster learners and a teacher inspection task. |
| `GET /api/work-orders/{id}` | Read one work order, its ledger and student-return state. |
| `POST /api/work-orders/{id}/review` | Write a teacher decision to the work order and evidence ledger. |
| `POST /api/work-orders/{id}/intervention-package` | Publish the teacher-approved executable task package with steps, evidence requirements and safety boundaries. |
| `POST /api/course/micro-task-package` | Publish a teacher-approved class micro-task package into every target work-order ledger. |
| `POST /api/course/micro-task-reminder` | Record teacher reminders for pending learners in one class micro-task trace. |
| `POST /api/course/teaching-improvement-plan` | Publish a teacher-confirmed next-round teaching improvement plan into target work-order ledgers. |
| `POST /api/course/teaching-improvement-execution` | Record the teacher's next-class execution receipt after the teaching improvement plan has been published. |
| `POST /api/course/teaching-improvement-followup-sample` | Record follow-up sampling criteria after the next-class execution receipt, without claiming causal impact. |
| `POST /api/course/teaching-improvement-followup-result` | Record collected follow-up observations after the sampling plan, without turning them into automatic learner evaluation. |
| `POST /api/course/resource-revision` | Record a teacher-confirmed course resource revision ticket derived from follow-up observation results. |
| `POST /api/course/resource-release` | Record a teacher-confirmed course resource release receipt after revised assets are published, with release checks and rollback boundaries. |
| `POST /api/course/resource-usage` | Record resource-usage signals after release: learner entry usage, new evidence return, teacher-review readiness and evidence coverage. |
| `POST /api/course/resource-usage-reminder` | Record teacher reminders for learners who have not returned evidence after a resource usage receipt has been written. |
| `POST /api/work-orders/{id}/student-return` | Record student evidence/reflection return after teacher confirmation and task-package publication. |
| `POST /api/work-orders/{id}/evidence-review` | Let the teacher review each returned evidence item as accepted, needs-evidence or rejected before final acceptance. |
| `POST /api/work-orders/{id}/closure` | Let the teacher accept and close a completed return loop, or return it for more evidence. |
| `GET /api/learners/{learnerHash}/diagnosis` | Read a pseudonymous learner diagnosis card. |
| `GET /api/learners/{learnerHash}/profile` | Read a longitudinal value-added learner profile. |
| `POST /api/interventions/rank` | Rank scaffold, mini lab and review actions with a SafeVOI-style score. |
| `POST /api/integrations/github/import` | Import a redacted PR/CI event from the teacher workbench. |
| `POST /api/integrations/github/batch-import` | Import a redacted batch of PR/CI events and create candidate diagnosis work orders. |
| `GET /api/integrations/github/status` | Read recent GitHub intake health, auth mode, delivery IDs and created work-order counts. |
| `POST /api/webhooks/github/ci` | Receive a signed redacted GitHub CI Webhook and create a diagnosis-stage work order. |
| `POST /api/review/tickets` | Create teacher release-gate tickets for high-risk actions. |
| `GET /api/review/tickets` | Read back teacher release-gate tickets for review queues. |
| `POST /api/ledgers/import` | Validate ledger import shape and duplicate event IDs. |
| `POST /api/exports/ledger` | Export the teacher evidence ledger for course audit, quality review and handoff packages. |
| `GET /api/privacy/audit` | Return role-scoped privacy gate, blocked actions and audit evidence. |

## Privacy Boundary

The worker rejects payloads containing protected fields such as `rawLog`, `rawDiff`, `studentRealName`, `email`, `phone`, `accessToken`, `apiKey` or `secret`. The current package can run with `memory-edge-store.v1` for local fallback or `database-edge-store.d1` when a D1/SQLite-compatible binding is supplied through `SEPATH_DB`. A production deployment should connect that binding to the school-approved database only after tenant, course and learner pseudonym checks pass.

## Storage Boundary

`cloud/sql/004_workbench_runtime_store.sql` creates the generic runtime table used by the database adapter. It stores tenant-scoped JSON records for work orders, evidence ledger entries, student returns, course settings, course rosters, review tickets and audit events. The API returns `storageMode` from health/session/settings routes so the frontend and smoke tests can distinguish local memory fallback from database-backed operation.

## GitHub Actions Intake

`GITHUB_ACTIONS_WEBHOOK.md` documents the course-repository setup for sending CI failure evidence into `/api/webhooks/github/ci`. A ready-to-adapt workflow sample is available at `cloud/examples/github-actions-sepath-ci-evidence.yml`. Production pilots should configure `SEPATH_GITHUB_WEBHOOK_SECRET` and send `x-hub-signature-256: sha256=<hex>` over the exact raw JSON body. The older `x-sepath-webhook-token` header remains as a compatibility fallback for existing local scripts. The teacher console exposes the webhook URL, signature boundary, latest GitHub intake health and a copyable minimal YAML snippet inside course settings.

## Authentication Boundary

When `SEPATH_AUTH_SECRET` is configured, the worker requires `Authorization: Bearer sepath.<payload>.<signature>`. The signature is an HMAC-SHA256 digest generated by `edge-api-auth.mjs`, and the payload can carry `role`, `learnerHash`, `reviewMode`, `iat`, `nbf` and `exp` claims. Missing tokens and forged signatures return `401 unauthorized` before any route handler runs.

For teacher console pilots, `POST /api/auth/teacher-login` exchanges the server-side `SEPATH_TEACHER_ACCESS_CODE` for a short-lived teacher Bearer token. The access code and HMAC secret stay in the server runtime; the browser stores only the current session token.

For local offline inspection without `SEPATH_AUTH_SECRET`, the worker keeps the older header-based compatibility mode so quality reviewers can inspect the route logic quickly. Production deployments should enable `SEPATH_AUTH_SECRET` or replace this helper with the school's SSO/API gateway token verifier.

## Agent Usage Boundary

The platform exposes five bounded agents through the teacher console: evidence intake, SafeVOI recommendation, learning scaffold, return operations and governance audit. Teachers enter from the console's "智能体" guide, from course settings, or from a diagnosis work order. Students enter only through a teacher-published return link, and quality reviewers enter through a read-only review link.

Agents read only pseudonymous evidence, redacted CI summaries, structured task packages, return progress and ledger traces. Their outputs are candidate diagnosis cards, missing-evidence prompts, next-step rankings, scaffold checklists, reminder suggestions and audit notes. They do not publish student-facing tasks, close work orders, grade students, rank students or generate directly submittable answers. Teacher confirmation is required before publication, return-for-evidence, final acceptance, value-added snapshot creation and ledger export.

## Role Boundary

The default role is `reviewer`, which is read-only. In token mode, role and learner scope come from verified token claims. Mutating course actions require `teacher`, `course_admin` or `system`; ledger import requires `system` or `course_admin`; student reads must include the student's own `learnerHash` scope. The smoke tests verify reviewer write denial, student wide-ledger denial, missing-token denial and forged-token denial.

## Student Return Link Boundary

Teacher workbench responses include a short-lived-style `returnToken` for each visible work order so the teacher can issue a scoped student return link after making a review decision and publishing an intervention task package. The token only opens that one work order and only after both `selectedDecision` and `interventionPackage` are present. Student and reviewer responses remove `returnToken`, and ledger exports strip it before building the evidence pack. Student return does not close a work order by itself: after the scaffold, structured evidence package and reflection nodes are complete, the work order waits for teacher-side evidence review and acceptance. The evidence package can include failure symptom, minimum failing case, repair/verification record, optional PR/CI link and a no-direct-answer integrity note; the worker summarizes these fields into the ledger while still accepting legacy text `content`.

Before final acceptance, the teacher must save `/api/work-orders/{id}/evidence-review` against the latest student evidence-return ledger entry. Each item is marked `accepted`, `needs_evidence` or `rejected`; acceptance through `/api/work-orders/{id}/closure` is blocked unless the latest evidence review exists and all reviewed items are accepted. If the teacher returns it for more evidence, the worker records the return revision, reason, time and reviewer, keeps scaffold receipt, resets evidence/reflection only, adds a pending evidence requirement, and lets the student submit a second evidence/reflection return before the teacher reviews the new evidence again. Once a teacher closes it, the same student link is blocked from further writes.

When the teacher accepts a completed return loop, the worker also writes a `valueAddedSnapshot` into the work order and ledger export. The snapshot records baseline level, expected level, observed level after teacher acceptance, uplift, remaining gap, evidence coverage, uncertainty, teacher note, evidence basis IDs and a formative-use boundary. It is evidence for teaching review and resource routing only; it is not a ranking, punishment, employment prediction or any other high-risk automatic decision.

## Course Launch Boundary

`POST /api/course/launch` is the first real-use pilot entry. It accepts only teacher/course-admin/system actors, saves course settings, saves the pseudonymous roster, creates first-round diagnosis candidates and returns an updated teacher workbench snapshot. The route is intentionally bounded: it does not accept real student names, emails, tokens or raw logs; it does not publish student-facing tasks; and each generated diagnosis remains a candidate until the teacher reviews it.

## Smoke Test

```bash
cd sepath-cloud-app
npm run cloud:smoke
npm run cloud:smoke:db
npm run cloud:smoke:http
```

The first smoke script imports the worker directly and calls every implemented route using synthetic data. The database smoke script runs the same route coverage through a D1-compatible storage adapter. The HTTP script starts a local HTTP adapter for the same worker, sends real HTTP requests to it, and then shuts the server down. They write:

```text
qa/edge-api-smoke-report.json
qa/edge-api-db-smoke-report.json
qa/edge-api-http-smoke-report.json
```

All three reports are included in the release bundle and checked by the release gate.

The current direct smoke suite covers 81 scenarios in memory, database and HTTP modes: health, auth session, course settings read/write/readback, course launch initialization, student course-launch denial, course roster default/read/write/readback/privacy blocking, course batch candidate work-order creation, duplicate-batch skipping, student batch-create denial, teacher workbench queue, work-order detail, teacher review, intervention task-package publication, student course micro-task publish denial, teacher course micro-task publication into target ledgers, student course micro-task reminder denial, teacher course micro-task reminder ledger writeback, student course teaching-improvement publish denial, teacher course teaching-improvement ledger writeback, student course teaching-improvement execution denial, teacher course teaching-improvement execution receipt writeback, student course teaching-improvement followup denial, teacher course teaching-improvement followup sampling writeback, student course teaching-improvement followup result denial, teacher course teaching-improvement followup result writeback, student course resource revision denial, teacher course resource revision ledger writeback, student course resource release denial, teacher course resource release ledger writeback, student course resource usage denial, teacher course resource usage ledger writeback, student course resource usage reminder denial, teacher course resource usage reminder ledger writeback, student return authorization, teacher-issued return-token flow, structured student evidence ledger summarization, student denial of teacher evidence review, teacher evidence review ledger writeback, teacher closure blocking before full return, teacher return-for-evidence revision, second student evidence/reflection return, teacher closure blocking without latest evidence review, second teacher evidence review, teacher closure success, value-added snapshot export, post-closure student-return blocking, post-closure teacher-review blocking, post-closure package-publish blocking, GitHub/CI import, GitHub/CI batch import, GitHub/CI batch privacy blocking, GitHub Webhook signature import, GitHub Webhook bad-signature denial, GitHub Webhook legacy-token compatibility, GitHub integration status readback, learner profile, ledger export with token stripping, evidence write/read, protected-field blocking, diagnosis, intervention ranking, review ticket write/read, ledger import, privacy audit, reviewer write denial, student wide-ledger denial, missing-token denial and bad-signature denial.

For manual inspection you can start the HTTP adapter:

```bash
npm run cloud:serve
```

## Operational Claim

Safe claim: the current package includes a runnable edge API reference with HMAC access-token checks, signed GitHub Webhook intake, GitHub intake health readback, privacy scans, RBAC denial checks, course/repository settings, one-step teacher course-launch initialization, pseudonymous course roster management, batch candidate diagnosis work-order creation, GitHub PR/CI single and batch intake, teacher work-order review, teacher-approved intervention task-package publication, class micro-task publication into target work-order ledgers, teacher reminders for pending class micro-task returns, teacher-confirmed next-round teaching improvement publication into diagnosis ledgers, teacher-recorded next-class execution receipts for published teaching improvements, follow-up sampling criteria, follow-up observation result writeback, teacher-confirmed course resource revision tickets, course resource release receipts, course resource usage receipts and resource-usage reminders for non-returning targets that avoid causal overclaiming, structured student return, teacher evidence review against the latest return, teacher return-for-evidence revision with second student return, teacher final acceptance gated by accepted evidence review, teacher-accepted value-added snapshot generation, ledger export, deterministic intervention ranking, evidence/review-ticket write-readback, memory and D1-style database storage adapters, and automated direct/database/HTTP smoke tests.

Do not claim: this worker has already been connected to a real school tenant, real production database, real student roster or production SLA.
