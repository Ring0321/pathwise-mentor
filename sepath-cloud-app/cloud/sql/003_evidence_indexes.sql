-- SE-Path evidence and telemetry indexes.
-- Keep indexes tenant-scoped to support school-level isolation and fast replay.

create index if not exists idx_sepath_courses_tenant
  on sepath_courses(tenant_id);

create index if not exists idx_sepath_learners_tenant_course
  on sepath_learners(tenant_id, course_id);

create index if not exists idx_sepath_evidence_tenant_learner
  on sepath_evidence_events(tenant_id, learner_hash, created_at desc);

create index if not exists idx_sepath_evidence_trace
  on sepath_evidence_events(tenant_id, trace_id);

create index if not exists idx_sepath_decisions_learner
  on sepath_agent_decisions(tenant_id, learner_hash, created_at desc);

create index if not exists idx_sepath_reviews_learner
  on sepath_teacher_reviews(tenant_id, learner_hash, created_at desc);

create index if not exists idx_sepath_audit_tenant_created
  on sepath_audit_log(tenant_id, created_at desc);

insert into sepath_schema_migrations(version)
values ('003_evidence_indexes')
on conflict (version) do nothing;
