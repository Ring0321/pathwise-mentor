# PathWise Mentor

Evidence-grounded adaptive learning companion for software engineering project-based courses.

PathWise Mentor is an open-source teaching workbench for project-based software engineering courses. It helps teachers turn GitHub issues, pull requests, CI failures, learner reflections, rubric evidence, and classroom follow-up records into traceable learning support actions.

The project started as `SE-Path 学伴`, a competition prototype for adaptive learning path decision-making and human-in-the-loop learning support. This repository packages the maintainable source code, documentation, deployment examples, and verification notes so another developer can continue building it.

## What It Solves

In project-based software engineering courses, teachers often face three practical problems:

- Evidence is scattered across repositories, CI logs, student messages, classroom tasks, and reflection forms.
- Learning support is either too generic or too heavy to operate repeatedly for a whole class.
- AI assistance can easily cross the line from support into automatic scoring, answer substitution, or unsupported risk judgment.

PathWise Mentor keeps the system intentionally grounded: AI can propose candidate diagnosis and next-step scaffolds, but teachers remain responsible for review, release, evaluation, and intervention decisions.

## Core Idea

The system builds an adaptive learning support loop:

1. Evidence intake: import PR/CI failures, help requests, rubric evidence, and student reflections.
2. Evidence ledger: record each event with source, actor, timestamp, trace id, and claim boundary.
3. Candidate diagnosis: identify learning blockers, missing evidence, risk signals, and rubric gaps.
4. Safe intervention planning: generate checklists, scaffolds, micro-tasks, and review prompts rather than full answers.
5. Teacher confirmation: require human review before publishing actions or accepting evidence.
6. Student return flow: collect fixes, reflections, and evidence supplements.
7. Value-added snapshot: update formative progress signals for the learner and cohort.

## Innovation Highlights

- Evidence-first learning support: every diagnosis and action is tied back to observable learning evidence instead of vague learner labels.
- Human-confirmed AI workflow: AI provides candidate suggestions, while teachers confirm publication, evaluation, and risk decisions.
- Safe-VOI intervention logic: the system prefers the smallest useful next step, such as a scaffold, test checklist, or evidence request, instead of giving students final answers.
- Formative value-added diagnosis: progress is treated as growth evidence for teaching improvement, not as ranking, punishment, or employment prediction.
- Course-level operations view: teachers can handle one learner, one work order, or a whole cohort from the same workbench.
- Traceable evidence ledger: important actions can be exported and audited, making the workflow suitable for teaching review, competition defense, and future research validation.
- Dual-track architecture: the Vue teacher console focuses on the daily teaching workflow, while the React cloud prototype explores deployment, Edge API, data-plane, and LLM gateway integration.

More detail is in [docs/INNOVATION.md](docs/INNOVATION.md).

## Repository Structure

```text
.
├── sepath-yudao-teacher-console/   # Main Vue 3 + Element Plus teacher workbench
├── sepath-cloud-app/               # React/Vite cloud and public-trial prototype
├── scripts/                        # Root support scripts used by docs and validation flows
├── docs/                           # Product design, competition materials, and handoff notes
├── HANDOFF_MANIFEST_SHA256.json    # File-level handoff manifest
├── LICENSE                         # MIT License
└── README.md
```

## Main App: Teacher Console

`sepath-yudao-teacher-console/` is the recommended starting point for continued product development.

It includes:

- Teacher work-order inbox
- Evidence ledger drawer
- Student return and evidence review flow
- Rubric and competency configuration
- Course operation dashboard
- Micro-task publishing and follow-up loop
- Local mock data and API-flow scripts

Run it locally:

```bash
cd sepath-yudao-teacher-console
npm ci
npm run dev
```

Validate it:

```bash
npm run typecheck
npm run build
```

Optional browser-flow scripts:

```bash
npm run test:flow
npm run test:api-flow
```

## Cloud Prototype

`sepath-cloud-app/` is a broader React/Vite prototype for online trial, deployment, API, and evidence infrastructure.

It includes:

- Frontend panels for pilot readiness, public URL receipt, launch loop, model governance, privacy guard, and evidence tracing
- Deterministic TypeScript engines under `src/engine/`
- Edge API and data-plane examples under `cloud/`
- SQL schema examples and OpenAPI contract
- Tencent CVM deployment examples under `deploy/tencent/`
- Smoke tests and screenshot utilities under `scripts/`

Run it locally:

```bash
cd sepath-cloud-app
npm ci
npm run dev
```

Validate it:

```bash
npm test
npm run build
```

## Current Verification Status

Verified during the handoff and open-source preparation on 2026-09-09:

- `sepath-yudao-teacher-console`: `npm ci` passed; `npm run build` passed. Vite reported a large chunk warning, but the build completed.
- `sepath-cloud-app`: `npm ci` passed; `npm test` passed 28 tests; `npm run build` passed. Vite reported a large chunk warning, but the build completed.
- `sepath-yudao-teacher-console` currently has a known browser-flow mismatch: `npm run test:api-flow` fails at `Course settings drawer must expose the active storage mode.` The original source directory fails at the same assertion, so this is a pre-existing test/UI alignment issue rather than a handoff packaging issue.

## Development Boundaries

PathWise Mentor is designed for formative learning support. Please keep these boundaries intact when extending the project:

- Do not let AI publish learning actions without teacher confirmation.
- Do not use value-added diagnosis for student ranking, punishment, employment prediction, or other high-stakes automatic decisions.
- Do not claim real school production data unless the deployment, authorization, and data provenance are actually verified.
- Do not commit real secrets. Use `.env.example`, `.env.cloud.example`, `deploy/**/*.env.example`, and `cloud/wrangler.sepath.example.toml` as configuration templates.
- Preserve evidence source, actor, timestamp, trace id, and review status when adding new workflows.

## Good First Tasks

- Fix the known `test:api-flow` assertion by aligning the course settings drawer and current storage-mode UI.
- Split large frontend chunks with route-level or panel-level dynamic imports.
- Consolidate duplicated concepts between the Vue teacher console and React cloud prototype.
- Add a lightweight backend adapter for real GitHub webhook events.
- Replace mock learners with a privacy-preserving demo data loader.
- Add CI for both subprojects.

## License

MIT License. See [LICENSE](LICENSE).
