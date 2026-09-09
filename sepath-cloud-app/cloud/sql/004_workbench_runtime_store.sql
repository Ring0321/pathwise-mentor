-- SE-Path workbench runtime store.
-- SQLite/D1-compatible table for pilot deployments of the teacher workbench.
-- It stores only tenant-scoped, pseudonymous JSON records; raw logs, tokens,
-- private emails, real student identifiers and raw diffs remain forbidden.

create table if not exists sepath_edge_records (
  record_key text primary key,
  record_type text not null,
  tenant_id text,
  course_id text,
  learner_hash text,
  resource_id text,
  record_json text not null,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_sepath_edge_records_scope
  on sepath_edge_records(record_type, tenant_id, course_id, updated_at desc);

create index if not exists idx_sepath_edge_records_learner
  on sepath_edge_records(record_type, tenant_id, course_id, learner_hash, updated_at desc);

create index if not exists idx_sepath_edge_records_resource
  on sepath_edge_records(record_type, tenant_id, course_id, resource_id, updated_at desc);

