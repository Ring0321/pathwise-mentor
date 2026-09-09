# SE-Path Teacher Console Design QA

## Visual Target

- Selected Product Design direction: `C:\Users\Ring\.codex\generated_images\019fe1fa-ae77-7342-a2ff-dbdaac843217\call_DVK7Wp3AeRUvIVB3Vhie7ONe.png`
- Style target: warm cream production workspace, soft glass panels, compact single-task diagnosis flow, left work-order inbox, dark Safe-VOI decision panel.

## Implementation Screenshots

- Desktop 1440 x 1024: `qa/screenshots/sepath-desktop-1440.png`
- Laptop 1024 x 900: `qa/screenshots/sepath-laptop-1024.png`
- Tablet 768 x 900: `qa/screenshots/sepath-tablet-768.png`
- Mobile 390 x 900: `qa/screenshots/sepath-mobile-390.png`
- Agent guide desktop 1440 x 1024: `qa/screenshots/sepath-agent-guide-1440.png`
- Course launch initialization desktop 1440 x 1024: `qa/screenshots/sepath-course-launch-1440.png`
- Course operations desktop 1440 x 1024: `qa/screenshots/sepath-course-ops-1440.png`
- Published task package desktop 1440 x 1024: `qa/screenshots/sepath-task-package-1440.png`
- Teacher acceptance desktop 1440 x 1024: `qa/screenshots/sepath-teacher-closure-1440.png`
- Returned evidence desktop 1440 x 1024: `qa/screenshots/sepath-return-evidence-1440.png`
- Value-added snapshot desktop 1440 x 1024: `qa/screenshots/sepath-value-added-snapshot-1440.png`
- Ledger audit drawer desktop 1440 x 1024: `qa/screenshots/sepath-ledger-audit-1440.png`
- Value-added snapshot mobile 390 x 900: `qa/screenshots/sepath-value-added-snapshot-390.png`
- Student return desktop 1440 x 1024: `qa/screenshots/student-portal-desktop-1440.png`
- Student return mobile 390 x 900: `qa/screenshots/student-portal-mobile-390.png`
- Student submitted mobile 390 x 900: `qa/screenshots/student-portal-after-submit-390.png`

## QA Findings

- Desktop layout now starts from a real teacher today inbox: priority-sorted work orders, teacher actions, evidence gaps, selected work-order summary and the downstream value-added diagnosis flow.
- The previous prototype frame and cluttered feature-wall pattern have been removed. The page now behaves as a full-screen teacher workbench.
- The top course context, student identity, trigger event, value-added gap, uncertainty, evidence coverage, and teacher decision are all visible without opening secondary pages.
- The default page no longer assumes the teacher has already chosen one case. It first answers "what should I process today" and then lets the teacher enter the selected diagnosis card.
- The work-order inbox supports search plus risk/stage filtering, so teachers can locate actual PR/CI learning events instead of clicking decorative sample cards.
- The course operations drawer supports pseudonymous roster maintenance and batch generation of low-evidence candidate diagnosis cards for weekly inspection or lab wrap-up.
- The course launch initialization drawer now lets a teacher create the first usable class pilot in one flow: course/repository settings, pseudonymous roster, first diagnosis task, safety boundary and generated candidate diagnosis cards.
- The teacher can now open course/repository settings, parse PR/CI evidence into an intake form, create a live diagnosis work order, and hand the confirmed task back to the student.
- Teacher review no longer opens a vague student return directly. A teacher-approved intervention task package must be published first; it contains objective, concrete steps, evidence-to-submit, rubric checkpoints, due hint and the safety boundary.
- The student return page is a separate direct-use entry: students confirm receipt, submit evidence, submit reflection, and those records persist into the teacher evidence ledger.
- After 3/3 return nodes, the student page explicitly says the work is waiting for teacher acceptance, so the product does not imply automatic platform evaluation.
- Student return now moves the work order to teacher acceptance instead of closing it automatically. The teacher can accept and close the order, or return it for more evidence while keeping the ledger trail.
- Return-for-evidence is now a real revision path: teacher return reason, revision number and remaining student tasks are visible in both teacher workbench and student return portal, and the second evidence/reflection return is written back before final acceptance.
- The evidence ledger drawer is now an audit workbench rather than a raw timeline: teachers can filter by evidence, teacher action, student return and system trace, search by keyword or trace ID, and inspect the formative conclusion boundary before export.
- The teacher console can now run in two modes: local offline mode for stable inspection and Edge API mode for real teacher queue, review, student-return and ledger-export integration.
- The course settings drawer now exposes the active storage mode, so quality reviewers can see whether the pilot is running on local fallback, memory Edge API or database-backed Edge API.
- The Edge API exposes production-shaped endpoints for actor capability checks, course/repository settings, teacher today queue, work-order detail, teacher review, student return, GitHub/CI import, GitHub Webhook intake, learner profile and ledger export.
- GitHub/CI import uses pseudonymous learner identifiers and redacted CI summaries. It does not accept real student names, raw logs, tokens, private emails or code diffs.
- The course settings drawer can now test the backend connection, sync course settings, and show the GitHub Actions Webhook URL used by the repository integration.
- Medium and small widths reflow into stacked sections. No observed text overlap or horizontal page overflow in captured 1024, 768, and 390 screenshots.
- The page keeps the required agent boundary visible: platform agents only give candidate recommendations; teacher confirmation is required; no complete answer or directly submittable code is shown.

## Functional Verification

- `npm run typecheck`: passed.
- `npm run test:flow`: passed. Verified today task inbox rendering, course settings connection check, teacher decision, intervention task-package publication, scoped student return URL, student-side task package rendering, evidence/reflection submission, return-for-evidence revision, second student return, teacher acceptance closure, value-added snapshot creation, ledger audit search/filter, ledger export without live return tokens, PR/CI parsing, event intake, course roster save, course batch candidate diagnosis creation, course launch initialization, case switching, reset, and safety boundaries.
- `npm run test:api-flow`: passed. Started the local Edge API, connected the Vue teacher console to it, then verified today task inbox rendering, course settings connection check, teacher decision, intervention task-package publication, return-token student link, student return, return-for-evidence revision, second student return, teacher acceptance closure, value-added snapshot creation, ledger export token stripping, PR/CI intake, course roster save, course batch candidate diagnosis creation, course launch initialization and queue reload through the API-backed path.
- `npm run build`: passed. Vite reported chunk-size and third-party pure-comment warnings only; no build failure.
- `npm run cloud:smoke` in `sepath-cloud-app`: passed with 59 endpoint checks, including auth session, course settings read/write, course launch initialization, course roster read/write/privacy guard, course batch creation/duplicate skip/student denial, workbench queue, work-order read, teacher review, task-package publication, student return authorization, return-token guards, teacher closure blocking before full return, teacher return-for-evidence revision, second student evidence/reflection return, teacher closure success, value-added snapshot export, post-closure student-return blocking, post-closure teacher-review blocking, post-closure package-publish blocking, GitHub/CI import, GitHub Webhook import, learner profile and ledger export.
- `npm run cloud:smoke:db` in `sepath-cloud-app`: passed with the same 59 endpoint checks through the D1-compatible database storage adapter.
- `npm run cloud:smoke:http` in `sepath-cloud-app`: passed with the same 59 endpoint checks through the local HTTP adapter.
- `npm run cloud:openapi:validate` in `sepath-cloud-app`: passed with 31 required operations and 53 required schemas.
- `npm run capture:design`: passed. Regenerated teacher workbench screenshots at 1440, 1024, 768, and 390 widths, plus agent guide, course settings, course launch initialization, course operations, published task package, teacher acceptance, return-for-evidence revision, accepted value-added snapshot, ledger audit drawer and quality review screenshots.
- `node scripts/capture-student-return.mjs`: passed. Regenerated student return screenshots before and after submission.

## API Integration Scope

- Teacher queue: `GET /api/workbench/teacher/today`.
- Actor and course setup: `GET /api/auth/session`, `GET /api/course/settings`, `POST /api/course/settings`.
- Course launch and operations: `POST /api/course/launch`, `GET /api/course/roster`, `POST /api/course/roster`, `POST /api/work-order-batches`.
- Work-order lifecycle: `GET /api/work-orders`, `GET /api/work-orders/{workOrderId}`, `POST /api/work-orders/{workOrderId}/review`, `POST /api/work-orders/{workOrderId}/intervention-package`, `POST /api/work-orders/{workOrderId}/closure`.
- Student return: `POST /api/work-orders/{workOrderId}/student-return`; opens only after teacher review and task-package publication, then waits for teacher acceptance before closure.
- Course evidence intake: `POST /api/integrations/github/import`, `POST /api/webhooks/github/ci`.
- Longitudinal value-added profile: `GET /api/learners/{learnerHash}/profile`.
- Evidence export: `POST /api/exports/ledger`.
- Privacy/audit boundary remains enforced by protected-field scanning and role checks.

## Result

Final result: passed.

## Platform Agent Entry Update 2026-09-05

- Removed platform-facing delivery language that made the product feel like a temporary showcase. The visible teacher console now uses real operating terms: teacher workbench, student return portal, quality review and evidence ledger.
- Added a dedicated "智能体" entry in the top action bar and the left navigation. It opens "智能体协同与使用方式" so teachers can see how each agent is entered and used.
- The agent guide now documents four entry paths: teacher entry, evidence entry, student entry and quality review entry.
- The same guide documents the real operating loop: evidence intake, candidate diagnosis, next-step ranking, teacher-confirmed publication, student return and teacher evidence review.
- Five bounded agents are described with trigger, input, output and human confirmation point: evidence intake, SafeVOI recommendation, learning scaffold, return operations and governance audit.
- The student-facing and teacher-facing safety copy now uses "平台智能体/智能体" rather than generic "AI" wording, keeping the product language concrete and role-based.
- New screenshot captured: `qa/screenshots/sepath-agent-guide-1440.png`.
- Verification passed on 2026-09-05: typecheck, production build, local browser flow, API-backed browser flow and full design capture. The running local preview responded with HTTP 200 at `http://127.0.0.1:5195/?v=agent-entry-real-platform-20260905`.

## Pilot Intake Update 2026-08-30

- Added course settings pilot launch checklist: backend connection, database persistence, repository Webhook and privacy boundary.
- Added copyable GitHub Actions YAML in the teacher console so a course repository can send failed CI evidence into `/api/webhooks/github/ci`.
- Added reusable backend-side sample workflow: `sepath-cloud-app/cloud/examples/github-actions-sepath-ci-evidence.yml`.
- Added repository setup guide: `sepath-cloud-app/cloud/GITHUB_ACTIONS_WEBHOOK.md`.
- Updated `node scripts/capture-design.mjs` to also capture `qa/screenshots/sepath-course-settings-1440.png`.
- Verified the drawer screenshot: checklist, Webhook address, YAML snippet and course form are visually separated; no obvious overlap was observed at 1440 x 1024.

## Role Entry Update 2026-08-30

- Split the production route into three real-use entries: teacher workbench, student return portal and quality review console.
- Student return links now preserve the configured Edge API base URL, so a real pilot does not fall back to local offline state when students open the link.
- Teacher and quality-review entry links also preserve the current API base URL for consistent validation across local, Edge memory and database-backed modes.
- Added quality-review sandbox headers for API calls: the quality review mode is read-only and uses `x-sepath-review-mode: sandbox`.
- Added a quality review console screenshot: `qa/screenshots/sepath-reviewer-1440.png`.
- Verified quality review console behavior in `npm run test:flow`: metrics, closed-loop path and ledger preview render, while teacher decision actions and student submit actions are absent.
- Verified quality review console behavior again through `npm run test:api-flow`, using the local Edge API path.
- Regenerated screenshots with `npm run capture:design`, including 1440, 1024, 768, 390 teacher views, agent guide, course settings, course operations and quality review views.

## Course Operations Update 2026-08-30

- Added a production-style course operations drawer for teacher-managed pseudonymous roster maintenance and batch diagnosis creation.
- Added frontend API integration for `GET /api/course/roster`, `POST /api/course/roster` and `POST /api/work-order-batches`.
- Added local fallback behavior so the same flow works without a backend during offline inspection, while API mode persists through the Edge worker.
- Tightened learner identity handling: pure numeric student IDs are converted to `stu_hash_*`, and the backend rejects pure numeric, Chinese, email-like or protected identity fields as learner hashes.
- Added browser-flow verification for roster save and batch candidate diagnosis creation in both local and Edge API modes.
- Added backend smoke checks for roster default/read/write/readback, protected-field blocking, batch creation, duplicate-batch skipping and student batch-create denial.
- Added course operations screenshot: `qa/screenshots/sepath-course-ops-1440.png`.

## Intervention Task Package Update 2026-08-30

- Added a teacher-approved intervention task package between teacher review and student return. The student link now opens only after the package is published.
- The task package contains objective, safe boundary, concrete student steps, evidence-to-submit, rubric checkpoints, due hint, source evidence IDs and teacher note.
- Added frontend API integration for `POST /api/work-orders/{workOrderId}/intervention-package`, with a local offline fallback that uses the same lifecycle rules.
- Added backend privacy/RBAC gates: package publication requires a teacher/course-admin/system role and an existing teacher decision; student return is blocked until the package exists.
- Added ledger entry type `intervention_package`; exported evidence packs retain the task package while stripping live return tokens.
- Added browser-flow verification that the student portal renders the published task package and that exported ledgers include the rubric checkpoints.
- Added backend smoke checks for pre-review package blocking, pre-package student-return blocking and successful package publication.
- Added task package screenshot: `qa/screenshots/sepath-task-package-1440.png`.

## Teacher Acceptance Update 2026-08-30

- Student scaffold receipt, evidence submission and reflection now move the work order to `review` / teacher acceptance instead of closing it automatically.
- Added teacher final acceptance: the teacher can accept and close the work order, or return it for additional evidence while preserving the ledger trail.
- Added frontend API integration and offline fallback for `POST /api/work-orders/{workOrderId}/closure`.
- Added backend privacy/RBAC gates: closure requires a teacher/course-admin/system role; accepting closure is blocked until all three student-return nodes are complete.
- Added post-closure guard: old student return links cannot keep writing to a closed work order, and closed work orders cannot be reviewed or republished through the task-package route.
- Added ledger entry type `teacher_acceptance`, so the exported evidence pack shows the final human decision.
- Added teacher acceptance screenshot: `qa/screenshots/sepath-teacher-closure-1440.png`.

## Value-Added Snapshot Update 2026-08-30

- Added `valueAddedSnapshot` as the formal output of teacher-accepted closure.
- The snapshot records baseline level, expected level, observed level, uplift, remaining gap, evidence coverage, uncertainty, teacher note, evidence basis IDs, a formative claim and the forbidden-use boundary.
- Added the snapshot panel to the diagnosis card after closure, keeping the default workbench focused on the current diagnosis until the teacher accepts the returned evidence.
- Added snapshot assertions to local browser flow tests, Edge API flow tests and direct/database/HTTP smoke tests.
- Updated the Edge API OpenAPI contract with `ValueAddedSnapshot`, `LearningWorkOrder.valueAddedSnapshot`, `EvidenceLedgerEntry.valueAddedSnapshotId` and learner-profile snapshot aggregation.
- Added accepted snapshot screenshots for desktop and mobile: `qa/screenshots/sepath-value-added-snapshot-1440.png` and `qa/screenshots/sepath-value-added-snapshot-390.png`.

## Return-For-Evidence Revision Update 2026-08-30

- Added revision metadata to student return state: `revision`, `returnedAt`, `returnReason` and `returnRequestedBy`.
- Teacher return-for-evidence now keeps scaffold receipt, resets only evidence/reflection, writes the return reason to the ledger and adds a visible pending evidence requirement.
- Teacher workbench and student return portal both show the current return reason, active return round and remaining return tasks.
- Ledger export now includes `studentReturnRevision` and `studentReturnReason`, while final `valueAddedSnapshot` is still created only after teacher acceptance.
- Added return-state screenshot: `qa/screenshots/sepath-return-evidence-1440.png`.

## Ledger Audit Workbench Update 2026-08-30

- Reworked the ledger drawer into a teacher-facing audit workbench with status summary, evidence coverage, role/type filters, keyword search and filtered counts.
- Ledger entries now display source, actor, stage transition, evidence coverage, trace ID and value-added snapshot ID when available, so a quality reviewer can follow the whole chain without reading exported JSON.
- Added browser-flow verification for student-return search and teacher-action filtering inside the ledger drawer.
- Added ledger audit screenshot: `qa/screenshots/sepath-ledger-audit-1440.png`.

## Editable Task Package Draft Update 2026-08-30

- Added a teacher-confirmed draft editor before the student task package is published.
- Teachers can edit the package title, objective, student execution steps, evidence-to-submit list, rubric checkpoints, due hint and safety boundary.
- The frontend validates that the draft has at least three executable steps, three evidence items, three rubric checkpoints and an explicit no-direct-answer boundary before publication.
- The published task package is marked as a teacher-confirmed version in the teacher panel and student return portal.
- The Edge API now accepts `packageDraft` on `POST /api/work-orders/{workOrderId}/intervention-package`, validates its shape, reapplies the safety boundary and persists the edited package to the work order.
- The evidence ledger marks edited packages as teacher edited before publication, so quality reviewers can distinguish agent suggestions from teacher-confirmed student-facing work.
- Added draft screenshot: `qa/screenshots/sepath-package-draft-1440.png`.
- Verified through `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`.

## Course Ops Dashboard Update 2026-08-30

- Reworked the course operations drawer from a roster/batch form into a teacher-facing weekly operations dashboard.
- Added weekly course pulse metrics: open work orders, high-risk cases, average evidence coverage and teacher action load.
- Added a priority queue that ranks teacher work by risk, evidence coverage, lifecycle stage, missing evidence and value-added gap; it is explicitly for teacher workflow triage, not student ranking.
- Added focus distribution for common weak dimensions, showing work-order count, average value-added gap, evidence coverage and high-uncertainty count.
- Added evidence gap matrix that consolidates repeated missing evidence into classroom actions such as failing-case evidence, checklist completion or reflection templates.
- The existing pseudonymous roster maintenance and batch diagnosis creation remain below the dashboard, keeping setup separate from daily triage.
- Added browser-flow assertions that the operations dashboard, priority queue, focus distribution and evidence gap matrix render before batch creation tests.
- Regenerated `qa/screenshots/sepath-course-ops-1440.png`; no horizontal overflow was reported by the capture script.

## Course Weekly Report Export Update 2026-08-30

- Added a course weekly operations report export from the course operations drawer.
- The report combines class work orders, high-risk triage, evidence coverage, teacher review state, evidence gaps, focus insights, closed value-added snapshots and next-week teaching actions.
- Teachers can download a readable Markdown report or export a machine-readable JSON data package.
- The JSON package uses `exportType: course_weekly_operations_report` and strips live student-return tokens from exported work-order data.
- The report boundary states that it is for formative diagnosis, course resource scheduling and teaching review only; it is not a student ranking, punishment or automatic evaluation artifact.
- Added automated download assertions for both `.md` and `.json` exports in local and Edge API flow tests.
- Isolated browser test download directories by app/CDP port so local and API flows can run without cross-run file collisions.
- Regenerated `qa/screenshots/sepath-course-ops-1440.png`; the report actions remain in the dashboard header without crowding the main teacher diagnosis page.

## Course Micro Task Publish Ledger Update 2026-08-30

- Added `POST /api/course/micro-task-package` so a teacher-confirmed class micro-task can be published into every target work-order ledger.
- Added local offline fallback for the same publication flow, keeping the YuDao teacher console usable when the Edge API is not configured.
- Added ledger entry type `course_micro_task`, source `课程运营`, deterministic trace ID `course-micro-task-{packageId}` and a detail string that preserves objective, affected count, rubric checkpoints and safety boundary.
- The course operations drawer now shows `已发布入账` after publication, disables duplicate publishing and captures that state in `qa/screenshots/sepath-course-micro-task-1440.png`.
- Added frontend flow assertions for publication state and ledger writeback, plus Edge API smoke checks for student publish denial and teacher publish success.
- Updated the OpenAPI contract and Edge API README so this route is part of the formal backend surface, not a page-only action.

## Course Micro Task Package Update 2026-08-30

- Added a course-level classroom micro-task package generated from the highest-priority shared evidence gap in open work orders.
- The package includes source gap, affected work-order count, focus dimension, objective, student steps, evidence-to-submit items, teacher rubric checkpoints, due hint and a no-direct-answer safety boundary.
- Teachers can download the package as Markdown from the course operations drawer and use it as a ready-to-issue classroom task.
- The package keeps the formative boundary explicit: it supports evidence collection and review, not ranking, punishment, automatic grading or complete-answer generation.
- Added automated assertions that the micro-task section renders and that the exported Markdown includes executable steps and the safety boundary.
- Added visual capture: `qa/screenshots/sepath-course-micro-task-1440.png`.

## GitHub CI Batch Import Update 2026-08-30

- Added `POST /api/integrations/github/batch-import` so teachers can paste multiple redacted learnerHash / PR URL / CI URL / branch / failure-summary rows and create candidate diagnosis work orders in one operation.
- Added the batch import panel to the course operations drawer. It previews valid and invalid rows, writes each accepted case into the work-order queue, and records an `intake` ledger entry for every created diagnosis sheet.
- The local offline path and the Edge API path both preserve pseudonymous identifiers such as `learner-0321`; real names, emails, tokens and raw logs remain outside the browser payload.
- Batch-imported work orders participate in the existing course priority queue, evidence gap matrix and classroom micro-task package generation, so the action changes the actual teacher workflow instead of only adding display data.
- Added smoke coverage for teacher batch import and privacy-blocked batch import across stateless, database and HTTP Edge API modes.
- Added browser-flow assertions for batch import, ledger linkage and risk level, plus visual capture `qa/screenshots/sepath-github-batch-import-1440.png`.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`.

## Signed GitHub Webhook Update 2026-08-30

- Upgraded `/api/webhooks/github/ci` from a token-only compatibility ingress to a production-style signed webhook ingress.
- The Edge API now verifies `x-hub-signature-256: sha256=<hex>` against `SEPATH_GITHUB_WEBHOOK_SECRET` before parsing the JSON payload and before creating any diagnosis work order.
- The legacy `x-sepath-webhook-token` path remains available as a compatibility fallback for existing local scripts, but the teacher-facing course setup now recommends GitHub HMAC signing.
- Webhook responses expose `authMode`, `deliveryId` and `githubEvent` for audit and troubleshooting.
- The course settings drawer now includes a visible signature boundary card: the backend and repository both hold `SEPATH_GITHUB_WEBHOOK_SECRET`; the browser never stores the secret.
- Updated the GitHub Actions YAML snippet and `cloud/examples/github-actions-sepath-ci-evidence.yml` to create a payload file, sign the exact raw body with OpenSSL and send `x-hub-signature-256`.
- Updated OpenAPI headers and Edge API README so the signed webhook behavior is part of the formal contract.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`. The smoke suites now cover 56 scenarios including signed webhook success, bad-signature denial and legacy-token compatibility.

## GitHub Integration Health Update 2026-08-30

- Added `GET /api/integrations/github/status` so teachers can verify whether the course repository is configured, whether events have been received, which auth mode was used and how many diagnosis work orders were created.
- Single GitHub import, batch import and signed Webhook import now write a normalized integration event with provider, source, status, auth mode, delivery ID, repository, work-order IDs and created/skipped counts.
- The course settings drawer now includes a compact GitHub integration health panel with refresh, latest import, auth mode and current work-order count; it is deliberately kept out of the main diagnosis page.
- The launch checklist now marks signature verification as complete only after a real `github-signature` intake has been observed, rather than merely after an API address is configured.
- Updated OpenAPI schemas, the Edge API README and browser capture checks so the status panel is part of the formal pilot-onboarding flow.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`. The smoke suites now cover 59 scenarios including GitHub integration status readback and course launch initialization.

## Course Launch Initialization Update 2026-08-30

- Added a production-style course launch drawer that turns course setup into one real workflow: course and repository settings, pseudonymous roster, first-round diagnosis rule, safety boundary and generated candidate work orders.
- Added `POST /api/course/launch` so the backend can save settings, persist the launch roster and create first diagnosis work orders in one teacher-authorized transaction.
- Added local fallback for the same launch workflow, so offline inspection still creates real work orders, ledger entries and roster state without a backend.
- Added readiness checks for course/repository, pseudonymous roster, first task and agent safety boundary before the teacher can generate first-round diagnosis cards.
- Added browser-flow assertions for launch readiness, work-order creation, candidate diagnosis marking, intake ledger writeback, roster persistence and selected new work order.
- Added visual capture: `qa/screenshots/sepath-course-launch-1440.png`.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`. The direct and database smoke suites now cover 59 scenarios, including teacher course launch success and student course launch denial.

## Today Inbox Home Update 2026-08-30

- Reworked the default teacher home from a single-case diagnosis page into a today task inbox.
- The first screen now shows priority-sorted open work orders with student pseudonym/name label, trigger event, current lifecycle stage, evidence coverage, missing evidence count, student-return progress and the next teacher action.
- Added a current-selection side panel so teachers can see why a case is selected before entering the detailed diagnosis card.
- Kept the detailed value-added diagnosis, Safe-VOI recommendation, teacher review, student return and ledger export sections below the inbox, preserving the full closed loop.
- Added browser-flow assertion that the page starts with the today task inbox and its priority logic, so future changes cannot silently regress to a static one-case prototype.
- Regenerated `qa/screenshots/sepath-desktop-1440.png`, `qa/screenshots/sepath-laptop-1024.png`, `qa/screenshots/sepath-tablet-768.png` and `qa/screenshots/sepath-mobile-390.png`; no horizontal overflow was reported.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run build` and `npm run capture:design`.

## Today Inbox Batch Handling Update 2026-08-30

- Added multi-select handling to the today task inbox so teachers can act on a set of related diagnosis sheets, not only one current case.
- The batch bar summarizes selected count, shared evidence gap, required evidence count and focus dimension before publication.
- Batch publication now reuses the formal course micro-task publishing path and writes `course_micro_task` ledger entries to every teacher-selected work order.
- The selected target set is teacher-controlled: the shared evidence gap is used as the task topic, but it no longer shrinks the publication target list.
- The action preserves the Safe-VOI boundary: it issues checklists, minimum failing cases and reflection scaffolds, not complete answers or automatic student evaluation.
- Added browser-flow assertions for selecting two inbox rows, enabling batch publication, writing ledger entries and clearing the selected state after publication.
- Repaired the mobile inbox header so the launch button and batch controls stack cleanly at 390px width.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run build` and `npm run capture:design`.

## Batch Micro Task Student Receipt Update 2026-08-30

- Course micro-task publication now creates a student-visible task package for target work orders that do not already have one.
- The target work order moves into the teacher-confirmed return-evidence path, opens a scoped student return URL and initializes return progress.
- Student portal now renders the batch classroom micro-task as a normal task package, preserving objective, steps, evidence requirements and the no-direct-answer safety boundary.
- The top today-inbox focus card shows a student entry state and return progress once a task package is open.
- Edge API and local fallback now share the same behavior through `applyCourseMicroTaskPublication` / `buildCourseMicroTaskStudentPackage`.
- Added browser-flow assertions for teacher batch publish, student task package receipt, student scaffold confirmation and teacher 1/3 return progress.
- Added Edge API smoke assertions that course micro-task publishing creates the intervention package, selected decision and initialized student return state.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`.

## Batch Micro Task Tracking Board Update 2026-08-30

- Added a teacher-facing tracking board for the currently selected course micro-task trace.
- The board summarizes target count, student receipt count, teacher-review-ready count and average evidence coverage for the same published batch.
- Each target learner row shows return progress, current lifecycle stage, evidence coverage and the next teacher action.
- Teachers can jump from the batch board back into a learner diagnosis sheet or open that learner's scoped student return page.
- The board is hidden for single-case work so the home page remains focused and does not become a feature wall.
- Added browser-flow assertions for batch tracking summary, 1/3 receipt readback and switching review context to another target learner.
- Added visual capture: `qa/screenshots/sepath-batch-tracking-1440.png`.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run build` and `npm run capture:design`; the first capture attempt hit a transient browser navigation error and the rerun passed.

## Batch Micro Task Reminder Ledger Update 2026-08-30

- Added a teacher-only reminder action to the batch tracking board for learners who have not completed the 3-step return loop.
- Reminder actions write `teacher_reminder` ledger entries to each pending learner diagnosis sheet and preserve the original course micro-task trace.
- The reminder text keeps the safety boundary explicit: it asks for reviewable evidence, not directly submittable full answers or automatic evaluation.
- Added `POST /api/course/micro-task-reminder` to the Edge API, including RBAC denial for students and smoke coverage for teacher writeback.
- Updated the OpenAPI contract and Edge API README so the reminder workflow is part of the formal backend surface.
- Added browser-flow assertions for reminder ledger writeback from the teacher batch tracking board.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`; smoke coverage is now 61 checks.

## Structured Student Evidence Return Update 2026-08-30

- Replaced the student portal's free-text evidence box with a structured evidence package: failure symptom, minimum failing case, repair/verification record and optional PR/CI link.
- Added a student safety confirmation before evidence submission; the submit button stays locked until scaffold receipt, all required evidence fields and the no-direct-answer confirmation are complete.
- Student evidence is summarized into ledger-ready text so teachers can review what failed, how it was reproduced and what evidence supports the repair.
- The Edge API now accepts an optional `artifact` object on `POST /api/work-orders/{id}/student-return` while preserving legacy `content` compatibility.
- Updated OpenAPI, browser-flow tests and student-portal capture scripts for the structured evidence path.
- The change keeps platform agents and automation inside the formative boundary: the system collects and routes evidence, but the teacher still makes the final review decision.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build`, `npm run capture:design` and `node scripts/capture-student-return.mjs`.

## Teacher Evidence Review Gate Update 2026-08-30

- Added a teacher-side evidence review gate between student return and final acceptance.
- The teacher workbench now parses the latest student evidence-return ledger entry into reviewable items and lets the teacher mark each item as accepted, needs-evidence or rejected.
- Final acceptance stays disabled until the latest student evidence entry has a saved teacher review and every reviewed item is accepted.
- The Edge API mirrors the same rule: `/api/work-orders/{id}/closure` rejects final acceptance when the latest evidence return has no all-accepted teacher review.
- The review itself is written to the evidence ledger as `teacher_evidence_review`, preserving the reviewed student ledger id in `traceId`.
- The responsive fix returns the Safe-VOI card and evidence-review module to a clean single-column layout under 1120px, preventing the mobile vertical-title issue.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`. The smoke suites now cover 65 checks.

## Course Evidence Review Rollup Update 2026-08-30

- Added a course-level teacher evidence review rollup inside the course operations drawer.
- The rollup separates returned student evidence into pending review, ready for acceptance, needs more evidence and deposited value-added snapshots.
- The course priority score now raises cases that are waiting for teacher evidence review, and keeps blocked evidence review cases out of automatic value-added conclusions.
- The focus distribution now shows review-state counts by value-added dimension, so teachers can decide whether to review individual cases or arrange a class-level micro-task.
- Course weekly reports now export the same evidence-review gate metrics and next-week action item, preserving the formative boundary: student return does not become a conclusion until teacher evidence review is accepted.
- Added browser-flow and screenshot assertions for `course-review-gate-board`.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run build` and `npm run capture:design`; preview health check returned HTTP 200 at `http://127.0.0.1:5192/?v=course-review-gate-20260830`.

## Learner Longitudinal Profile Update 2026-08-30

- Added a teacher-facing learner profile drawer that opens from the current student profile card and the left navigation.
- The profile aggregates the selected learner's diagnosis sheets, value-added dimensions, evidence channels, review gates, timeline and accepted value-added snapshots.
- The profile keeps the product boundary explicit: it is for formative diagnosis, resource recommendation and teacher reflection, not ranking, punishment, employment prediction or automatic high-risk decisions.
- The current workbench profile card now has a clear "打开成长档案" action, turning the previous summary card into an actionable teacher workflow entry.
- Browser-flow tests now assert `learner-profile-summary`, `learner-profile-focuses`, `learner-profile-evidence`, `learner-profile-timeline` and the formative boundary text.
- Added visual capture: `qa/screenshots/sepath-learner-profile-1440.png`.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run build` and `npm run capture:design`; preview health check returned HTTP 200 at `http://127.0.0.1:5195/?v=learner-profile-20260830`.

## Course Intervention Effect Review Update 2026-08-30

- Added a course-level intervention effect review panel inside the course operations drawer.
- The panel rolls up only published `course_micro_task` ledger traces, so it does not show effect data until the teacher has actually published a classroom micro-task.
- Each intervention batch now shows target count, student return count, accepted teacher-review count, deposited value-added snapshots and average evidence coverage.
- Teachers can jump from an intervention batch back to the highest-priority learner diagnosis sheet, keeping review work tied to the same evidence chain.
- Added Markdown and JSON exports for the course intervention review, including the formative boundary that the review is not for ranking, punishment, employment prediction or automatic final evaluation.
- Added browser-flow assertions for the intervention review panel, post-publication rollup and both export formats.
- Added visual capture: `qa/screenshots/sepath-intervention-review-1440.png`.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run build` and `npm run capture:design`; preview health check returned HTTP 200 at `http://127.0.0.1:5195/?v=intervention-review-20260830`.

## Course Teaching Improvement Plan Update 2026-08-30

- Added a next-round teaching improvement plan below the course intervention review panel.
- The plan converts intervention review rows and repeated evidence gaps into teacher-confirmable course actions: evidence station, targeted return reminder, teacher sampling review and next-lab resource updates.
- Publishing the plan writes `teaching_improvement` ledger entries to the related diagnosis sheets, so the course-level reflection returns to the learner-level evidence chain.
- The module keeps the formative boundary visible: the plan is for course improvement and resource routing, not ranking, punishment, employment prediction or automatic evaluation.
- Added Markdown export for the teaching improvement plan and Edge API route `POST /api/course/teaching-improvement-plan`.
- Added browser-flow assertions for rendering, export and ledger writeback; added Edge API smoke assertions for student denial and teacher publication.
- Added visual capture: `qa/screenshots/sepath-teaching-improvement-1440.png`.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`; preview health check returned HTTP 200 at `http://127.0.0.1:5195/?v=teaching-improvement-20260830`.

## Course Teaching Improvement Execution Receipt Update 2026-08-31

- Added a next-class execution receipt under the teaching improvement plan.
- The receipt appears after the teacher has a publishable improvement plan and becomes recordable only after that plan is written to target diagnosis-sheet ledgers.
- Recording the receipt writes `teaching_improvement_execution` ledger entries with classroom source, execution evidence, trace id and the no-automatic-evaluation boundary.
- Added Markdown export for the execution receipt so a teacher can keep a human-readable proof of what was changed in the next lab.
- Added Edge API route `POST /api/course/teaching-improvement-execution`, with RBAC denial for students and a server check that the matching teaching improvement plan has already been published.
- Added browser-flow assertions for receipt rendering, export, record action and ledger writeback; added Edge API smoke assertions for student denial and teacher record writeback.
- Added visual capture: `qa/screenshots/sepath-teaching-execution-1440.png`.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`; direct/database/HTTP smoke coverage is now 69 checks.

## Course Teaching Improvement Followup Sampling Update 2026-08-31

- Added a next-round follow-up sampling card after the teaching improvement execution receipt.
- The card appears only after the execution receipt has been recorded, preventing the operations drawer from becoming a feature wall before the teacher reaches this step.
- The sampling plan tracks evidence return, CI/test evidence coverage and teacher review load as observation criteria, not causal proof.
- Recording the sample writes `teaching_improvement_followup` ledger entries with `source: "效果采样"` and the no-automatic-evaluation/non-ranking boundary.
- Added Markdown export for the sampling plan and Edge API route `POST /api/course/teaching-improvement-followup-sample`.
- Added browser-flow assertions for render, export and ledger writeback; added Edge API smoke assertions for student denial and teacher record writeback.
- Added visual capture: `qa/screenshots/sepath-teaching-followup-1440.png`.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`; direct/database/HTTP smoke coverage is now 71 checks and OpenAPI validation reports 43 required checks with 0 failures.

## Course Teaching Improvement Followup Result Update 2026-08-31

- Added a follow-up observation result card after the follow-up sampling plan has been recorded.
- The result card collects evidence-return completion, CI/test evidence coverage and teacher review load as observed signals, not causal proof.
- Recording the result writes `teaching_improvement_followup_result` ledger entries with `source: "结果回收"` and the no-automatic-evaluation/non-ranking boundary.
- Added Markdown export for the result receipt and Edge API route `POST /api/course/teaching-improvement-followup-result`.
- Added browser-flow assertions for render, export and ledger writeback; added Edge API smoke assertions for student denial and teacher result writeback.
- Added visual capture: `qa/screenshots/sepath-teaching-followup-result-1440.png`.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`; direct/database/HTTP smoke coverage is now 73 checks and OpenAPI validation reports 44 required checks with 0 failures.

## Course Resource Revision Ticket Update 2026-08-31

- Added a course resource revision ticket that appears only after follow-up observation results have been recorded.
- The ticket converts observed evidence gaps into teacher-confirmed resource changes: minimum failing case library, PR evidence template and Rubric checkpoint sync.
- Recording the ticket writes `course_resource_revision` ledger entries with `source: "资源改版"` and keeps the no-causal-proof, no-automatic-evaluation, no-ranking and no-direct-answer boundary.
- Added Markdown export for the resource revision ticket and Edge API route `POST /api/course/resource-revision`.
- Added browser-flow assertions for render, export and ledger writeback; added Edge API smoke assertions for student denial and teacher resource-revision writeback.
- Added visual capture: `qa/screenshots/sepath-course-resource-revision-1440.png`.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`; direct/database/HTTP smoke coverage is now 75 checks and OpenAPI validation reports 45 required checks with 0 failures.

## Course Resource Release Receipt Update 2026-08-31

- Added a course resource release receipt that appears only after the course resource revision ticket has been recorded.
- The receipt records release channel, release scope, published assets, delivery checks and rollback plan before the resource update is treated as delivered.
- Recording the receipt writes `course_resource_release` ledger entries with `source: "资源发布"` and keeps the no-causal-proof, no-automatic-evaluation, no-ranking and no-direct-answer boundary.
- Added Markdown export for the release receipt and Edge API route `POST /api/course/resource-release`.
- Added browser-flow assertions for render, export and ledger writeback; added Edge API smoke assertions for student denial and teacher resource-release writeback.
- Added visual capture: `qa/screenshots/sepath-course-resource-release-1440.png`.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`; direct/database/HTTP smoke coverage is now 77 checks and OpenAPI validation reports 46 required checks with 0 failures.

## Course Resource Usage Receipt Update 2026-08-31

- Added a course resource usage receipt that appears only after the course resource release receipt has been recorded.
- The receipt records learner entry usage, new evidence return, teacher-review readiness and median evidence coverage as operational signals.
- Recording the receipt writes `course_resource_usage` ledger entries with `source: "使用回流"` and keeps the no-causal-proof, no-automatic-evaluation, no-ranking and no-punishment boundary.
- Added Markdown export for the usage receipt and Edge API route `POST /api/course/resource-usage`.
- Added browser-flow assertions for render, export and ledger writeback; added Edge API smoke assertions for student denial and teacher resource-usage writeback.
- Added visual capture: `qa/screenshots/sepath-course-resource-usage-1440.png`.
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`; direct/database/HTTP smoke coverage is now 79 checks and OpenAPI validation reports 47 required checks with 0 failures.

## Course Resource Usage Reminder Update 2026-09-04

- Added a teacher reminder action after the course resource usage receipt has been recorded.
- The reminder is available only when target diagnosis sheets have already received the `course_resource_usage` ledger trace and still have incomplete student return evidence.
- Recording the reminder writes `teacher_reminder` ledger entries with `source: "教师催办"` and keeps the no-direct-answer and no-automatic-evaluation boundary.
- Added Edge API route `POST /api/course/resource-usage-reminder`, with RBAC denial for students and a server check that usage receipt evidence exists before reminder writeback.
- Added browser-flow assertions for the reminder button, ledger trace and safety-boundary text; added Edge API smoke assertions for student denial and teacher reminder writeback.
- Updated visual capture: `qa/screenshots/sepath-course-resource-usage-1440.png`, showing the usage receipt after "已催办未回流".
- Verified through `npm run typecheck`, `npm run test:flow`, `npm run test:api-flow`, `npm run cloud:smoke`, `npm run cloud:smoke:db`, `npm run cloud:smoke:http`, `npm run cloud:openapi:validate`, `npm run build` and `npm run capture:design`; direct/database/HTTP smoke coverage is now 81 checks and OpenAPI validation reports 48 required checks with 0 failures.

## Value Engine Visibility Update 2026-09-05

- Added a first-screen `增值引擎` strip so the product difference is visible before entering configuration or operations drawers.
- The strip summarizes three concrete capabilities: evidence-chain diagnosis, value-added diagnosis and agent-assisted closed loop with teacher confirmation.
- Added a `增值引擎：平台核心能力` drawer with the six-step operating path from learning-event intake to course resource improvement.
- Added contrast cards explaining why the platform is not an ordinary course backend, chat assistant, grading system or reminder tool.
- Added a context card inside course settings clarifying that the drawer is only for access configuration, with a direct route back to the value engine.
- Added browser-flow assertions for the value-engine strip, six-step drawer, contrast cards, teacher-confirmation boundary and course-settings context.
- Added visual capture: `qa/screenshots/sepath-value-engine-1440.png`.
