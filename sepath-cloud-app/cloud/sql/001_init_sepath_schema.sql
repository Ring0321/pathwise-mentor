-- SE-Path data plane schema draft.
-- This file is a productionization artifact for review and staging trials.
-- It intentionally uses pseudonymous learner_hash and tenant-scoped keys.

create table if not exists sepath_tenants (
  tenant_id text primary key,
  name text not null,
  region text not null default 'cn-pilot',
  plan text not null default 'trial',
  slo_tier text not null default 'standard',
  created_at timestamptz not null default now()
);

create table if not exists sepath_courses (
  course_id text primary key,
  tenant_id text not null references sepath_tenants(tenant_id),
  rubric_version text not null,
  policy_version text not null,
  launch_manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists sepath_learners (
  learner_hash text primary key,
  tenant_id text not null references sepath_tenants(tenant_id),
  course_id text not null references sepath_courses(course_id),
  consent_valid boolean not null default false,
  baseline_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists sepath_evidence_events (
  event_id text primary key,
  tenant_id text not null references sepath_tenants(tenant_id),
  course_id text not null references sepath_courses(course_id),
  learner_hash text not null references sepath_learners(learner_hash),
  event_type text not null,
  trace_id text not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists sepath_agent_decisions (
  decision_id text primary key,
  tenant_id text not null references sepath_tenants(tenant_id),
  learner_hash text not null references sepath_learners(learner_hash),
  safevoi_version text not null,
  gate text not null,
  context_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists sepath_teacher_reviews (
  review_id text primary key,
  tenant_id text not null references sepath_tenants(tenant_id),
  teacher_id text not null,
  learner_hash text not null references sepath_learners(learner_hash),
  status text not null,
  anchor_delta numeric,
  created_at timestamptz not null default now()
);

create table if not exists sepath_audit_log (
  audit_id text primary key,
  tenant_id text not null references sepath_tenants(tenant_id),
  actor_role text not null,
  action text not null,
  resource text not null,
  result text not null,
  created_at timestamptz not null default now()
);

create table if not exists sepath_schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

insert into sepath_schema_migrations(version)
values ('001_init_sepath_schema')
on conflict (version) do nothing;
