-- SE-Path cloud-ready runtime record metadata.
-- This migration keeps the D1 runtime store flexible while adding the indexed
-- fields needed for pilot operation, audit lookup and rollback checks.

create table if not exists sepath_edge_records (
  record_key text primary key,
  record_type text not null,
  tenant_id text,
  course_id text,
  learner_hash text,
  resource_id text,
  idempotency_key text,
  status text,
  actor_role text,
  source text,
  expires_at text,
  record_json text not null,
  created_at text not null,
  updated_at text not null
);

-- D1/SQLite does not support enum types, so record_type is constrained by the
-- application contract. Supported values:
-- course_settings, course_roster, work_order, work_order_ledger,
-- student_return, teacher_evidence_review, value_added_snapshot,
-- integration_event, agent_call, audit_event.

create index if not exists idx_sepath_edge_records_status
  on sepath_edge_records(record_type, tenant_id, course_id, status, updated_at desc);

create index if not exists idx_sepath_edge_records_actor
  on sepath_edge_records(record_type, tenant_id, course_id, actor_role, updated_at desc);

create index if not exists idx_sepath_edge_records_source
  on sepath_edge_records(record_type, tenant_id, course_id, source, updated_at desc);

create index if not exists idx_sepath_edge_records_expiry
  on sepath_edge_records(record_type, expires_at);

create index if not exists idx_sepath_edge_records_idempotency
  on sepath_edge_records(record_type, tenant_id, course_id, idempotency_key);
