-- SE-Path row-level security draft.
-- Production deployment should set sepath.tenant_id and role claims from trusted middleware.

alter table sepath_tenants enable row level security;
alter table sepath_courses enable row level security;
alter table sepath_learners enable row level security;
alter table sepath_evidence_events enable row level security;
alter table sepath_agent_decisions enable row level security;
alter table sepath_teacher_reviews enable row level security;
alter table sepath_audit_log enable row level security;

drop policy if exists tenant_read_self on sepath_tenants;
drop policy if exists course_tenant_scope on sepath_courses;
drop policy if exists learner_tenant_scope on sepath_learners;
drop policy if exists evidence_tenant_scope on sepath_evidence_events;
drop policy if exists decision_tenant_scope on sepath_agent_decisions;
drop policy if exists review_tenant_scope on sepath_teacher_reviews;
drop policy if exists audit_tenant_scope on sepath_audit_log;

create policy tenant_read_self on sepath_tenants
  for select
  using (tenant_id = current_setting('sepath.tenant_id', true));

create policy course_tenant_scope on sepath_courses
  for all
  using (tenant_id = current_setting('sepath.tenant_id', true))
  with check (tenant_id = current_setting('sepath.tenant_id', true));

create policy learner_tenant_scope on sepath_learners
  for all
  using (tenant_id = current_setting('sepath.tenant_id', true))
  with check (tenant_id = current_setting('sepath.tenant_id', true));

create policy evidence_tenant_scope on sepath_evidence_events
  for all
  using (tenant_id = current_setting('sepath.tenant_id', true))
  with check (tenant_id = current_setting('sepath.tenant_id', true));

create policy decision_tenant_scope on sepath_agent_decisions
  for all
  using (tenant_id = current_setting('sepath.tenant_id', true))
  with check (tenant_id = current_setting('sepath.tenant_id', true));

create policy review_tenant_scope on sepath_teacher_reviews
  for all
  using (tenant_id = current_setting('sepath.tenant_id', true))
  with check (tenant_id = current_setting('sepath.tenant_id', true));

create policy audit_tenant_scope on sepath_audit_log
  for select
  using (tenant_id = current_setting('sepath.tenant_id', true));

insert into sepath_schema_migrations(version)
values ('002_enable_rls')
on conflict (version) do nothing;
