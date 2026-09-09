# SE-Path Data Plane Draft

This folder contains SQL drafts for moving the current local prototype toward a real school pilot.

- `sql/001_init_sepath_schema.sql`: tenant, course, pseudonymous learner, evidence, decision, review, audit and migration tables.
- `sql/002_enable_rls.sql`: tenant-scoped row-level security policy drafts.
- `sql/003_evidence_indexes.sql`: evidence replay, trace and review indexes.

The competition package does not include a real production database URL, real student identity, or model provider key. A school pilot must set runtime secrets in the hosting platform, run migrations in staging first, and complete a restore drill before using real course data.
