# Innovation Notes

PathWise Mentor is not a generic learning dashboard. Its core contribution is a practical operating model for adaptive learning support in software engineering project-based courses: evidence comes first, AI stays inside a candidate-suggestion boundary, and teachers keep final responsibility for action.

## 1. Evidence-First Adaptive Learning

Most learning analytics tools begin with dashboards or scores. PathWise Mentor begins with evidence events:

- pull request failures
- CI logs
- student help requests
- rubric records
- teacher review notes
- student fixes and reflections
- classroom follow-up tasks

Each event can be tied to a trace id and a review status. This gives the system a stronger basis for diagnosis than static labels such as "weak student" or "low performer".

## 2. Safe-VOI Intervention Selection

The project uses a Safe-VOI style intervention idea: before giving help, ask what minimum safe action is useful enough.

Instead of jumping to a full answer, the system prefers:

- a narrower debugging checklist
- a missing-evidence request
- a scaffold prompt
- a small classroom micro-task
- a teacher review checkpoint
- a follow-up sampling plan

This keeps the learner doing the real learning work while still reducing teacher workload.

## 3. Human-Confirmed AI

The AI boundary is explicit. AI can draft candidate diagnosis and next-step suggestions, but it cannot directly decide:

- whether a student has passed
- whether evidence is accepted
- whether a risk judgment is final
- whether an intervention is published
- whether a learner should be ranked or penalized

The teacher workbench is therefore not an "AI replaces teacher" design. It is a teacher-confirmed workflow for operating at class scale.

## 4. Formative Value-Added Diagnosis

The value-added module is designed as formative feedback. It compares baseline, current evidence, expected progress, evidence coverage, and uncertainty.

The important distinction is that the value-added signal is used to improve teaching actions. It is not a final causal proof, a ranking score, a punishment mechanism, or an employment prediction model.

## 5. Closed-Loop Teaching Operations

The product is built around an end-to-end loop:

```text
Evidence intake
  -> candidate diagnosis
  -> teacher review
  -> safe scaffold or micro-task
  -> student return
  -> evidence review
  -> learning snapshot
  -> next teaching action
```

This loop is more useful for real teaching than a one-time report because it supports repeated action, review, and improvement.

## 6. Auditability and Competition Readiness

PathWise Mentor keeps a claim-evidence mindset:

- What evidence supports this suggestion?
- Who reviewed it?
- What is still missing?
- Which action was published?
- What happened after the student returned evidence?

That structure makes the system easier to defend in competitions, easier to evaluate in course pilots, and safer to extend toward research use.

## 7. Dual Implementation Track

The repository keeps two complementary implementations:

- Vue teacher console: focused, daily-use teaching workflow with Element Plus management-console interaction.
- React cloud prototype: broader deployment and infrastructure exploration, including Edge API, data plane, LLM gateway, OpenAPI, SLO, privacy, and launch-readiness panels.

This split is intentional for now. The next development stage should decide whether to merge the two tracks or keep them as separate product and infrastructure layers.

## Suggested English Positioning

Project name: **PathWise Mentor**

Tagline: **Evidence-grounded adaptive learning companion for project-based software engineering courses.**

Short description:

> PathWise Mentor helps teachers turn repository activity, CI failures, rubric evidence, and learner reflections into traceable, human-confirmed learning support actions.

## Next Innovation Milestones

- Real GitHub Classroom or GitHub webhook ingestion.
- Privacy-preserving learner identity and demo-data masking.
- Teacher-side intervention experiment logging.
- Rubric calibration across assignments and cohorts.
- Exportable learning evidence package for course quality review.
- Optional LLM gateway with strict teacher-confirmation and secret-management boundaries.
