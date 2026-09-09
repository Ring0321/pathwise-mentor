function matchScope(record, scope) {
  if (scope.tenantId && record.tenantId !== scope.tenantId) return false;
  if (scope.courseId && record.courseId !== scope.courseId) return false;
  if (scope.learnerHash && record.learnerHash !== scope.learnerHash) return false;
  return true;
}

function newestFirst(left, right) {
  return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
}

function newestWorkOrderFirst(left, right) {
  return String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""));
}

function scopedRecordKey(recordType, scope = {}, id = "") {
  return [recordType, scope.tenantId || "default", scope.courseId || "default", id || "default"].join(":");
}

function deserializeRecord(row) {
  if (!row?.record_json) return null;
  try {
    return JSON.parse(row.record_json);
  } catch {
    return null;
  }
}

async function d1All(statement) {
  const result = await statement.all();
  if (Array.isArray(result)) return result;
  return result?.results || [];
}

async function d1First(statement) {
  if (typeof statement.first === "function") return await statement.first();
  const rows = await d1All(statement);
  return rows[0] || null;
}

function isD1LikeDatabase(db) {
  return db && typeof db.prepare === "function";
}

function recordMeta(record = {}) {
  const status = record.status || record.qualityGate || record.result || record.gate || "";
  return {
    idempotencyKey: record.idempotencyKey || record.idempotency_key || "",
    status: String(status || "").slice(0, 80),
    actorRole: String(record.actorRole || record.actor?.role || record.role || "").slice(0, 80),
    source: String(record.source || record.provider || record.action || record.type || "").slice(0, 120),
    expiresAt: String(record.expiresAt || "").slice(0, 80),
  };
}

export function createDatabaseEdgeStore(db) {
  let schemaPromise;

  async function ensureSchema() {
    if (!schemaPromise) {
      schemaPromise = (async () => {
        await db
          .prepare(
            `create table if not exists sepath_edge_records (
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
            )`,
          )
          .run();
        await ensureColumn("idempotency_key", "idempotency_key text");
        await ensureColumn("status", "status text");
        await ensureColumn("actor_role", "actor_role text");
        await ensureColumn("source", "source text");
        await ensureColumn("expires_at", "expires_at text");
        await db.prepare(`create index if not exists idx_sepath_edge_records_scope on sepath_edge_records(record_type, tenant_id, course_id, updated_at desc)`).run();
        await db.prepare(`create index if not exists idx_sepath_edge_records_learner on sepath_edge_records(record_type, tenant_id, course_id, learner_hash, updated_at desc)`).run();
        await db.prepare(`create index if not exists idx_sepath_edge_records_resource on sepath_edge_records(record_type, tenant_id, course_id, resource_id, updated_at desc)`).run();
        await db.prepare(`create index if not exists idx_sepath_edge_records_status on sepath_edge_records(record_type, tenant_id, course_id, status, updated_at desc)`).run();
        await db.prepare(`create index if not exists idx_sepath_edge_records_actor on sepath_edge_records(record_type, tenant_id, course_id, actor_role, updated_at desc)`).run();
        await db.prepare(`create index if not exists idx_sepath_edge_records_idempotency on sepath_edge_records(record_type, tenant_id, course_id, idempotency_key)`).run();
      })();
    }
    return schemaPromise;
  }

  async function ensureColumn(name, ddl) {
    try {
      const columns = await d1All(db.prepare(`pragma table_info(sepath_edge_records)`));
      if (columns.some((column) => column.name === name)) return;
      await db.prepare(`alter table sepath_edge_records add column ${ddl}`).run();
    } catch {
      // Older local D1 shims may not support PRAGMA; fresh create-table deployments already include the columns.
    }
  }

  async function getRecord(recordType, scope = {}, id = "") {
    await ensureSchema();
    const row = await d1First(
      db
        .prepare(`select record_json from sepath_edge_records where record_key = ? limit 1`)
        .bind(scopedRecordKey(recordType, scope, id)),
    );
    return deserializeRecord(row);
  }

  async function putRecord(recordType, scope = {}, id = "", record = {}, resourceId = "") {
    await ensureSchema();
    const now = new Date().toISOString();
    const createdAt = record.createdAt || record.updatedAt || now;
    const updatedAt = record.updatedAt || createdAt || now;
    const meta = recordMeta(record);
    await db
      .prepare(
        `insert into sepath_edge_records (
          record_key, record_type, tenant_id, course_id, learner_hash, resource_id,
          idempotency_key, status, actor_role, source, expires_at,
          record_json, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(record_key) do update set
          learner_hash = excluded.learner_hash,
          resource_id = excluded.resource_id,
          idempotency_key = excluded.idempotency_key,
          status = excluded.status,
          actor_role = excluded.actor_role,
          source = excluded.source,
          expires_at = excluded.expires_at,
          record_json = excluded.record_json,
          updated_at = excluded.updated_at`,
      )
      .bind(
        scopedRecordKey(recordType, scope, id),
        recordType,
        scope.tenantId || record.tenantId || null,
        scope.courseId || record.courseId || null,
        scope.learnerHash || record.learnerHash || null,
        resourceId || null,
        meta.idempotencyKey || null,
        meta.status || null,
        meta.actorRole || null,
        meta.source || null,
        meta.expiresAt || null,
        JSON.stringify(record),
        createdAt,
        updatedAt,
      )
      .run();
    return record;
  }

  async function listRecords(recordType, scope = {}) {
    await ensureSchema();
    const clauses = ["record_type = ?"];
    const params = [recordType];
    if (scope.tenantId) {
      clauses.push("tenant_id = ?");
      params.push(scope.tenantId);
    }
    if (scope.courseId) {
      clauses.push("course_id = ?");
      params.push(scope.courseId);
    }
    if (scope.learnerHash) {
      clauses.push("learner_hash = ?");
      params.push(scope.learnerHash);
    }
    if (scope.resourceId) {
      clauses.push("resource_id = ?");
      params.push(scope.resourceId);
    }
    if (scope.status) {
      clauses.push("status = ?");
      params.push(scope.status);
    }
    if (scope.actorRole) {
      clauses.push("actor_role = ?");
      params.push(scope.actorRole);
    }
    if (scope.source) {
      clauses.push("source = ?");
      params.push(scope.source);
    }
    params.push(Number(scope.limit || 100));
    const rows = await d1All(
      db
        .prepare(
          `select record_json from sepath_edge_records
          where ${clauses.join(" and ")}
          order by updated_at desc
          limit ?`,
        )
        .bind(...params),
    );
    return rows.map(deserializeRecord).filter(Boolean);
  }

  async function writeAudit(event) {
    const auditEvent = {
      ...event,
      id: event.id || `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: event.createdAt || new Date().toISOString(),
    };
    await putRecord("audit_event", auditEvent, auditEvent.id, auditEvent, auditEvent.action || "");
    return auditEvent;
  }

  return {
    mode: "database-edge-store.d1",

    async putEvidence(record) {
      const scope = { tenantId: record.tenantId, courseId: record.courseId, learnerHash: record.learnerHash };
      const existing = await getRecord("evidence", scope, record.eventId);
      if (existing) return { record: existing, deduped: true };
      await putRecord("evidence", scope, record.eventId, record, record.traceId || record.eventType || "");
      await writeAudit({
        id: `audit-${record.eventId}`,
        tenantId: record.tenantId,
        courseId: record.courseId,
        learnerHash: record.learnerHash,
        action: "evidence.put",
        result: "stored",
        createdAt: record.createdAt,
      });
      return { record, deduped: false };
    },

    async listEvidence(scope = {}) {
      return (await listRecords("evidence", scope)).sort(newestFirst).slice(0, Number(scope.limit || 50));
    },

    async putReviewTicket(ticket) {
      const scope = { tenantId: ticket.tenantId, courseId: ticket.courseId, learnerHash: ticket.learnerHash };
      const existing = await getRecord("review_ticket", scope, ticket.ticketId);
      if (existing) return { ticket: existing, deduped: true };
      await putRecord("review_ticket", scope, ticket.ticketId, ticket, ticket.status || "");
      await writeAudit({
        id: `audit-${ticket.ticketId}`,
        tenantId: ticket.tenantId,
        courseId: ticket.courseId,
        learnerHash: ticket.learnerHash,
        action: "review_ticket.put",
        result: "stored",
        createdAt: ticket.createdAt,
      });
      return { ticket, deduped: false };
    },

    async listReviewTickets(scope = {}) {
      return (await listRecords("review_ticket", scope))
        .filter((ticket) => !scope.status || ticket.status === scope.status)
        .sort(newestFirst)
        .slice(0, Number(scope.limit || 50));
    },

    async listAuditEvents(scope = {}) {
      return (await listRecords("audit_event", scope)).sort(newestFirst).slice(0, Number(scope.limit || 50));
    },

    async putAuditEvent(event) {
      return writeAudit(event);
    },

    async putAgentCall(call) {
      const scope = { tenantId: call.tenantId, courseId: call.courseId, learnerHash: call.learnerHash || "" };
      await putRecord("agent_call", scope, call.callId, call, call.traceId || call.intent || "");
      await writeAudit({
        id: `audit-agent-${call.callId}`,
        tenantId: call.tenantId,
        courseId: call.courseId,
        learnerHash: call.learnerHash || "",
        actorRole: call.actorRole || "",
        action: "agent.call.put",
        result: call.status || call.mode || "stored",
        createdAt: call.createdAt || new Date().toISOString(),
      });
      return call;
    },

    async listAgentCalls(scope = {}) {
      return (await listRecords("agent_call", scope)).sort(newestFirst).slice(0, Number(scope.limit || 50));
    },

    async getAgentTurn(id, scope = {}) {
      return getRecord("agent_turn", scope, id);
    },

    async putAgentTurn(turn) {
      return putRecord("agent_turn", turn, turn.id, turn, turn.workOrderId || "course");
    },

    async listAgentTurns(scope = {}) {
      return (await listRecords("agent_turn", { ...scope, resourceId: scope.workOrderId || "course", limit: 40 }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    },

    async ensureWorkbench(seed = {}) {
      const orders = Array.isArray(seed.workOrders) ? seed.workOrders : [];
      const ledger = seed.ledger || {};
      const studentReturn = seed.studentReturn || {};
      for (const order of orders) {
        const scope = { tenantId: order.tenantId, courseId: order.courseId, learnerHash: order.learnerHash };
        if (!(await getRecord("work_order", scope, order.id))) {
          await putRecord("work_order", scope, order.id, order, order.status || "");
        }
        const courseScope = { tenantId: order.tenantId, courseId: order.courseId };
        const existingLedger = await listRecords("work_order_ledger", { ...courseScope, resourceId: order.id, limit: 1 });
        if (existingLedger.length === 0) {
          for (const entry of ledger[order.id] || []) {
            await putRecord("work_order_ledger", courseScope, `${order.id}:${entry.id}`, entry, order.id);
          }
        }
        if (!(await getRecord("student_return", courseScope, order.id))) {
          await putRecord(
            "student_return",
            courseScope,
            order.id,
            studentReturn[order.id] || {
              scaffoldReceived: false,
              evidenceSubmitted: false,
              reflectionSubmitted: false,
            },
            order.id,
          );
        }
      }
    },

    async listWorkOrders(scope = {}) {
      return (await listRecords("work_order", scope)).sort(newestWorkOrderFirst).slice(0, Number(scope.limit || 100));
    },

    async getWorkOrder(id, scope = {}) {
      const order = await getRecord("work_order", scope, id);
      return order && matchScope(order, scope) ? order : null;
    },

    async putWorkOrder(order) {
      const scope = { tenantId: order.tenantId, courseId: order.courseId, learnerHash: order.learnerHash };
      await putRecord("work_order", scope, order.id, order, order.status || "");
      await writeAudit({
        id: `audit-${order.id}-${Date.now()}`,
        tenantId: order.tenantId,
        courseId: order.courseId,
        learnerHash: order.learnerHash,
        action: "work_order.put",
        result: order.status || "updated",
        createdAt: new Date().toISOString(),
      });
      return order;
    },

    async listWorkOrderLedger(orderId, scope = {}) {
      const order = await this.getWorkOrder(orderId, scope);
      if (!order) return [];
      return (await listRecords("work_order_ledger", { ...scope, learnerHash: "", resourceId: orderId }))
        .sort(newestFirst)
        .slice(0, Number(scope.limit || 100));
    },

    async putWorkOrderLedgerEntry(orderId, entry, scope = {}) {
      const order = await this.getWorkOrder(orderId, scope);
      if (!order) return null;
      const courseScope = { tenantId: order.tenantId, courseId: order.courseId };
      await putRecord("work_order_ledger", courseScope, `${orderId}:${entry.id}`, entry, orderId);
      await writeAudit({
        id: `audit-${entry.id}`,
        tenantId: order.tenantId,
        courseId: order.courseId,
        learnerHash: order.learnerHash,
        action: "work_order.ledger.put",
        result: entry.type || "stored",
        createdAt: entry.createdAt || new Date().toISOString(),
      });
      return entry;
    },

    async getStudentReturn(orderId, scope = {}) {
      const order = await this.getWorkOrder(orderId, scope);
      if (!order) return null;
      return (
        (await getRecord("student_return", { tenantId: order.tenantId, courseId: order.courseId }, orderId)) || {
          scaffoldReceived: false,
          evidenceSubmitted: false,
          reflectionSubmitted: false,
        }
      );
    },

    async putStudentReturn(orderId, state, scope = {}) {
      const order = await this.getWorkOrder(orderId, scope);
      if (!order) return null;
      const courseScope = { tenantId: order.tenantId, courseId: order.courseId };
      await putRecord("student_return", courseScope, orderId, state, orderId);
      await writeAudit({
        id: `audit-return-${orderId}-${Date.now()}`,
        tenantId: order.tenantId,
        courseId: order.courseId,
        learnerHash: order.learnerHash,
        action: "work_order.student_return.put",
        result: Object.keys(state)
          .filter((key) => state[key])
          .join(","),
        createdAt: new Date().toISOString(),
      });
      return state;
    },

    async getCourseSettings(scope = {}, defaults = {}) {
      return (await getRecord("course_settings", scope, "settings")) || defaults;
    },

    async putCourseSettings(scope = {}, settings = {}) {
      const record = {
        ...settings,
        tenantId: scope.tenantId || settings.tenantId,
        courseId: scope.courseId || settings.courseId,
        updatedAt: new Date().toISOString(),
      };
      await putRecord("course_settings", scope, "settings", record, `${record.tenantId}:${record.courseId}`);
      await writeAudit({
        id: `audit-course-settings-${Date.now()}`,
        tenantId: record.tenantId,
        courseId: record.courseId,
        action: "course_settings.put",
        result: "stored",
        createdAt: record.updatedAt,
      });
      return record;
    },

    async getCourseRoster(scope = {}, defaults = {}) {
      return (await getRecord("course_roster", scope, "roster")) || defaults;
    },

    async putCourseRoster(scope = {}, roster = {}) {
      const record = {
        ...roster,
        tenantId: scope.tenantId || roster.tenantId,
        courseId: scope.courseId || roster.courseId,
        updatedAt: new Date().toISOString(),
      };
      await putRecord("course_roster", scope, "roster", record, `${record.tenantId}:${record.courseId}`);
      await writeAudit({
        id: `audit-course-roster-${Date.now()}`,
        tenantId: record.tenantId,
        courseId: record.courseId,
        action: "course_roster.put",
        result: `${Array.isArray(record.learners) ? record.learners.length : 0}`,
        createdAt: record.updatedAt,
      });
      return record;
    },

    async putIntegrationEvent(event) {
      const scope = { tenantId: event.tenantId, courseId: event.courseId };
      await putRecord(
        "integration_event",
        scope,
        event.id,
        event,
        event.provider || event.source || "integration",
      );
      await writeAudit({
        id: `audit-integration-${event.id}`,
        tenantId: event.tenantId,
        courseId: event.courseId,
        learnerHash: event.learnerHash || "",
        action: "integration.event.put",
        result: event.status || "stored",
        createdAt: event.createdAt || new Date().toISOString(),
      });
      return event;
    },

    async listIntegrationEvents(scope = {}) {
      return (await listRecords("integration_event", scope))
        .sort(newestFirst)
        .slice(0, Number(scope.limit || 20));
    },
  };
}

export function createMemoryEdgeStore(options = {}) {
  const initialState = options.initialState || {};
  const onChange = typeof options.onChange === "function" ? options.onChange : null;
  const evidenceById = new Map(Object.entries(initialState.evidenceById || {}));
  const reviewTicketsById = new Map(Object.entries(initialState.reviewTicketsById || {}));
  const workOrdersById = new Map(Object.entries(initialState.workOrdersById || {}));
  const ledgerByWorkOrderId = new Map(Object.entries(initialState.ledgerByWorkOrderId || {}));
  const studentReturnByWorkOrderId = new Map(Object.entries(initialState.studentReturnByWorkOrderId || {}));
  const courseSettingsByScope = new Map(Object.entries(initialState.courseSettingsByScope || {}));
  const courseRosterByScope = new Map(Object.entries(initialState.courseRosterByScope || {}));
  const integrationEventsById = new Map(Object.entries(initialState.integrationEventsById || {}));
  const agentCallsById = new Map(Object.entries(initialState.agentCallsById || {}));
  const agentTurnsById = new Map(Object.entries(initialState.agentTurnsById || {}));
  const auditEvents = Array.isArray(initialState.auditEvents) ? [...initialState.auditEvents] : [];

  function scopeKey(scope = {}) {
    return `${scope.tenantId || "default"}:${scope.courseId || "default"}`;
  }

  function dumpState() {
    return {
      evidenceById: Object.fromEntries(evidenceById),
      reviewTicketsById: Object.fromEntries(reviewTicketsById),
      workOrdersById: Object.fromEntries(workOrdersById),
      ledgerByWorkOrderId: Object.fromEntries(ledgerByWorkOrderId),
      studentReturnByWorkOrderId: Object.fromEntries(studentReturnByWorkOrderId),
      courseSettingsByScope: Object.fromEntries(courseSettingsByScope),
      courseRosterByScope: Object.fromEntries(courseRosterByScope),
      integrationEventsById: Object.fromEntries(integrationEventsById),
      agentCallsById: Object.fromEntries(agentCallsById),
      agentTurnsById: Object.fromEntries(agentTurnsById),
      auditEvents,
    };
  }

  async function flush() {
    if (onChange) await onChange(dumpState());
  }

  return {
    mode: options.mode || "memory-edge-store.v1",

    async putEvidence(record) {
      const existing = evidenceById.get(record.eventId);
      if (existing) return { record: existing, deduped: true };
      evidenceById.set(record.eventId, record);
      auditEvents.push({
        id: `audit-${record.eventId}`,
        tenantId: record.tenantId,
        courseId: record.courseId,
        learnerHash: record.learnerHash,
        action: "evidence.put",
        result: "stored",
        createdAt: record.createdAt,
      });
      await flush();
      return { record, deduped: false };
    },

    async listEvidence(scope = {}) {
      return Array.from(evidenceById.values())
        .filter((record) => matchScope(record, scope))
        .sort(newestFirst)
        .slice(0, Number(scope.limit || 50));
    },

    async putReviewTicket(ticket) {
      const existing = reviewTicketsById.get(ticket.ticketId);
      if (existing) return { ticket: existing, deduped: true };
      reviewTicketsById.set(ticket.ticketId, ticket);
      auditEvents.push({
        id: `audit-${ticket.ticketId}`,
        tenantId: ticket.tenantId,
        courseId: ticket.courseId,
        learnerHash: ticket.learnerHash,
        action: "review_ticket.put",
        result: "stored",
        createdAt: ticket.createdAt,
      });
      await flush();
      return { ticket, deduped: false };
    },

    async listReviewTickets(scope = {}) {
      return Array.from(reviewTicketsById.values())
        .filter((ticket) => matchScope(ticket, scope))
        .filter((ticket) => !scope.status || ticket.status === scope.status)
        .sort(newestFirst)
        .slice(0, Number(scope.limit || 50));
    },

    async listAuditEvents(scope = {}) {
      return auditEvents
        .filter((event) => matchScope(event, scope))
        .sort(newestFirst)
        .slice(0, Number(scope.limit || 50));
    },

    async putAuditEvent(event) {
      const auditEvent = {
        ...event,
        id: event.id || `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: event.createdAt || new Date().toISOString(),
      };
      auditEvents.push(auditEvent);
      await flush();
      return auditEvent;
    },

    async putAgentCall(call) {
      agentCallsById.set(call.callId, call);
      auditEvents.push({
        id: `audit-agent-${call.callId}`,
        tenantId: call.tenantId,
        courseId: call.courseId,
        learnerHash: call.learnerHash || "",
        actorRole: call.actorRole || "",
        action: "agent.call.put",
        result: call.status || call.mode || "stored",
        createdAt: call.createdAt || new Date().toISOString(),
      });
      await flush();
      return call;
    },

    async listAgentCalls(scope = {}) {
      return Array.from(agentCallsById.values())
        .filter((call) => matchScope(call, scope))
        .sort(newestFirst)
        .slice(0, Number(scope.limit || 50));
    },

    async getAgentTurn(id, scope = {}) {
      const turn = agentTurnsById.get(scopedRecordKey("agent_turn", scope, id));
      return turn && matchScope(turn, scope) ? turn : null;
    },

    async putAgentTurn(turn) {
      agentTurnsById.set(scopedRecordKey("agent_turn", turn, turn.id), turn);
      await flush();
      return turn;
    },

    async listAgentTurns(scope = {}) {
      return Array.from(agentTurnsById.values())
        .filter((turn) => matchScope(turn, scope) && turn.workOrderId === (scope.workOrderId || ""))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
        .slice(-40);
    },

    async ensureWorkbench(seed = {}) {
      const orders = Array.isArray(seed.workOrders) ? seed.workOrders : [];
      const ledger = seed.ledger || {};
      const studentReturn = seed.studentReturn || {};
      for (const order of orders) {
        if (!workOrdersById.has(order.id)) {
          workOrdersById.set(order.id, order);
        }
        if (!ledgerByWorkOrderId.has(order.id)) {
          ledgerByWorkOrderId.set(order.id, ledger[order.id] || []);
        }
        if (!studentReturnByWorkOrderId.has(order.id)) {
          studentReturnByWorkOrderId.set(
            order.id,
            studentReturn[order.id] || {
              scaffoldReceived: false,
              evidenceSubmitted: false,
              reflectionSubmitted: false,
            },
          );
        }
      }
      await flush();
    },

    async listWorkOrders(scope = {}) {
      return Array.from(workOrdersById.values())
        .filter((order) => matchScope(order, scope))
        .sort(newestWorkOrderFirst)
        .slice(0, Number(scope.limit || 100));
    },

    async getWorkOrder(id, scope = {}) {
      const order = workOrdersById.get(id);
      if (!order || !matchScope(order, scope)) return null;
      return order;
    },

    async putWorkOrder(order) {
      workOrdersById.set(order.id, order);
      auditEvents.push({
        id: `audit-${order.id}-${Date.now()}`,
        tenantId: order.tenantId,
        courseId: order.courseId,
        learnerHash: order.learnerHash,
        action: "work_order.put",
        result: order.status || "updated",
        createdAt: new Date().toISOString(),
      });
      await flush();
      return order;
    },

    async listWorkOrderLedger(orderId, scope = {}) {
      const order = workOrdersById.get(orderId);
      if (!order || !matchScope(order, scope)) return [];
      return ledgerByWorkOrderId.get(orderId) || [];
    },

    async putWorkOrderLedgerEntry(orderId, entry, scope = {}) {
      const order = workOrdersById.get(orderId);
      if (!order || !matchScope(order, scope)) return null;
      const existing = ledgerByWorkOrderId.get(orderId) || [];
      ledgerByWorkOrderId.set(orderId, [entry, ...existing]);
      auditEvents.push({
        id: `audit-${entry.id}`,
        tenantId: order.tenantId,
        courseId: order.courseId,
        learnerHash: order.learnerHash,
        action: "work_order.ledger.put",
        result: entry.type || "stored",
        createdAt: entry.createdAt || new Date().toISOString(),
      });
      await flush();
      return entry;
    },

    async getStudentReturn(orderId, scope = {}) {
      const order = workOrdersById.get(orderId);
      if (!order || !matchScope(order, scope)) return null;
      return (
        studentReturnByWorkOrderId.get(orderId) || {
          scaffoldReceived: false,
          evidenceSubmitted: false,
          reflectionSubmitted: false,
        }
      );
    },

    async putStudentReturn(orderId, state, scope = {}) {
      const order = workOrdersById.get(orderId);
      if (!order || !matchScope(order, scope)) return null;
      studentReturnByWorkOrderId.set(orderId, state);
      auditEvents.push({
        id: `audit-return-${orderId}-${Date.now()}`,
        tenantId: order.tenantId,
        courseId: order.courseId,
        learnerHash: order.learnerHash,
        action: "work_order.student_return.put",
        result: Object.keys(state)
          .filter((key) => state[key])
          .join(","),
        createdAt: new Date().toISOString(),
      });
      await flush();
      return state;
    },

    async getCourseSettings(scope = {}, defaults = {}) {
      return courseSettingsByScope.get(scopeKey(scope)) || defaults;
    },

    async putCourseSettings(scope = {}, settings = {}) {
      const record = {
        ...settings,
        tenantId: scope.tenantId || settings.tenantId,
        courseId: scope.courseId || settings.courseId,
        updatedAt: new Date().toISOString(),
      };
      courseSettingsByScope.set(scopeKey(scope), record);
      auditEvents.push({
        id: `audit-course-settings-${Date.now()}`,
        tenantId: record.tenantId,
        courseId: record.courseId,
        action: "course_settings.put",
        result: "stored",
        createdAt: record.updatedAt,
      });
      await flush();
      return record;
    },

    async getCourseRoster(scope = {}, defaults = {}) {
      return courseRosterByScope.get(scopeKey(scope)) || defaults;
    },

    async putCourseRoster(scope = {}, roster = {}) {
      const record = {
        ...roster,
        tenantId: scope.tenantId || roster.tenantId,
        courseId: scope.courseId || roster.courseId,
        updatedAt: new Date().toISOString(),
      };
      courseRosterByScope.set(scopeKey(scope), record);
      auditEvents.push({
        id: `audit-course-roster-${Date.now()}`,
        tenantId: record.tenantId,
        courseId: record.courseId,
        action: "course_roster.put",
        result: `${Array.isArray(record.learners) ? record.learners.length : 0}`,
        createdAt: record.updatedAt,
      });
      await flush();
      return record;
    },

    async putIntegrationEvent(event) {
      integrationEventsById.set(event.id, event);
      auditEvents.push({
        id: `audit-integration-${event.id}`,
        tenantId: event.tenantId,
        courseId: event.courseId,
        learnerHash: event.learnerHash || "",
        action: "integration.event.put",
        result: event.status || "stored",
        createdAt: event.createdAt || new Date().toISOString(),
      });
      await flush();
      return event;
    },

    async listIntegrationEvents(scope = {}) {
      return Array.from(integrationEventsById.values())
        .filter((event) => matchScope(event, scope))
        .sort(newestFirst)
        .slice(0, Number(scope.limit || 20));
    },
  };
}

const databaseStoreCache = new WeakMap();

export function getEdgeStore(env) {
  if (env?.SEPATH_STORE) return env.SEPATH_STORE;
  if (isD1LikeDatabase(env?.SEPATH_DB)) {
    if (!databaseStoreCache.has(env.SEPATH_DB)) {
      databaseStoreCache.set(env.SEPATH_DB, createDatabaseEdgeStore(env.SEPATH_DB));
    }
    return databaseStoreCache.get(env.SEPATH_DB);
  }
  return null;
}
