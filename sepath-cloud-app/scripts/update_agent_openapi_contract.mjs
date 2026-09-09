import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const specPath = resolve("cloud/openapi.sepath.json");
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const json = (schemaRef, description = "JSON response") => ({
  description,
  content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaRef}` } } },
});

const authErrors = {
  401: { $ref: "#/components/responses/Unauthorized" },
  403: { $ref: "#/components/responses/Forbidden" },
};

spec.paths["/api/agent/conversation"] = {
  get: {
    operationId: "readTeachingAgentConversation",
    summary: "Read the teacher assistant conversation and server-built evidence context.",
    description:
      "Returns the latest scoped conversation. The server, not the browser, assembles pseudonymous work-order evidence for grounding.",
    parameters: [
      { $ref: "#/components/parameters/TenantId" },
      { $ref: "#/components/parameters/CourseId" },
      {
        name: "workOrderId",
        in: "query",
        required: false,
        schema: { type: "string", maxLength: 120 },
        description: "When omitted, the assistant works at course scope and must not invent learner-level diagnosis.",
      },
    ],
    responses: {
      200: json("AgentConversationResponse", "Conversation history and the current evidence context"),
      ...authErrors,
      404: { $ref: "#/components/responses/BadRequest" },
    },
  },
  post: {
    operationId: "sendTeachingAgentMessage",
    summary: "Send a teacher question to the governed course assistant.",
    description:
      "The request contains only a teacher question and idempotency key. Evidence, student returns and prior review records are read by the backend.",
    requestBody: {
      required: true,
      content: { "application/json": { schema: { $ref: "#/components/schemas/AgentMessageRequest" } } },
    },
    responses: {
      201: json("AgentMessageResponse", "New assistant turn"),
      200: json("AgentMessageResponse", "Idempotent replay of a saved assistant turn"),
      400: { $ref: "#/components/responses/BadRequest" },
      ...authErrors,
      409: { $ref: "#/components/responses/BadRequest" },
      413: { $ref: "#/components/responses/BadRequest" },
      422: { $ref: "#/components/responses/PrivacyBlocked" },
      429: { $ref: "#/components/responses/BadRequest" },
      503: { $ref: "#/components/responses/NotReady" },
    },
  },
};

spec.paths["/api/agent/conversation/draft"] = {
  post: {
    operationId: "prepareTeachingAgentDraft",
    summary: "Convert a grounded assistant turn into a teacher-editable task draft.",
    description:
      "Prepares a draft only. It never publishes a student task, closes a work order, changes scores or writes a final evaluation.",
    requestBody: {
      required: true,
      content: { "application/json": { schema: { $ref: "#/components/schemas/AgentDraftPrepareRequest" } } },
    },
    responses: {
      200: json("AgentDraftPrepareResponse", "Teacher-editable draft prepared from the selected assistant turn"),
      400: { $ref: "#/components/responses/BadRequest" },
      ...authErrors,
      404: { $ref: "#/components/responses/BadRequest" },
      409: { $ref: "#/components/responses/BadRequest" },
      503: { $ref: "#/components/responses/NotReady" },
    },
  },
};

Object.assign(spec.components.schemas, {
  AgentEvidence: {
    type: "object",
    required: ["id", "title", "source", "status", "detail"],
    properties: {
      id: { type: "string", maxLength: 120 },
      title: { type: "string", maxLength: 120 },
      source: { type: "string", maxLength: 120 },
      status: { type: "string", maxLength: 24 },
      detail: { type: "string", maxLength: 650 },
    },
    additionalProperties: false,
  },
  AgentValueAddedContext: {
    type: "object",
    required: ["label", "current", "expected", "delta", "uncertainty"],
    properties: {
      label: { type: "string", maxLength: 120 },
      current: { type: ["integer", "null"], minimum: 0, maximum: 100 },
      expected: { type: ["integer", "null"], minimum: 0, maximum: 100 },
      delta: { type: ["integer", "null"], minimum: -100, maximum: 100 },
      uncertainty: { type: "string", enum: ["low", "medium", "high"] },
      interpretation: {
        type: "string",
        description: "Formative interpretation only; it is not a causal uplift claim or ranking signal.",
      },
    },
    additionalProperties: true,
  },
  AgentContext: {
    type: "object",
    required: ["kind", "courseName", "evidence", "missingEvidence", "boundary"],
    properties: {
      kind: { type: "string", enum: ["course", "work_order"] },
      courseName: { type: "string", maxLength: 120 },
      workOrderId: { type: "string", maxLength: 120 },
      status: { type: "string", maxLength: 40 },
      updatedAt: { type: "string" },
      trigger: { type: "string", maxLength: 180 },
      diagnosis: { type: "string", maxLength: 600 },
      evidenceCoverage: { type: ["integer", "null"], minimum: 0, maximum: 100 },
      valueAdded: { $ref: "#/components/schemas/AgentValueAddedContext" },
      evidence: { type: "array", items: { $ref: "#/components/schemas/AgentEvidence" } },
      missingEvidence: { type: "array", items: { $ref: "#/components/schemas/AgentEvidence" } },
      sampledOrders: { type: "integer", minimum: 0 },
      pendingOrders: { type: "integer", minimum: 0 },
      queueTruncated: { type: "boolean" },
      nextAction: { type: "string", maxLength: 420 },
      actionReason: { type: "string", maxLength: 420 },
      teacherDecision: { type: "string", maxLength: 40 },
      taskPublished: { type: "boolean" },
      boundary: { type: "string" },
    },
    additionalProperties: true,
  },
  AgentOutcome: {
    type: "object",
    required: [
      "mode",
      "fallback",
      "teacherReviewRequired",
      "answer",
      "questions",
      "checklist",
      "evidenceToSubmit",
      "citations",
    ],
    properties: {
      mode: { type: "string", enum: ["model", "rules", "guarded"] },
      fallback: { type: "boolean" },
      reason: { type: "string" },
      teacherReviewRequired: { type: "boolean", const: true },
      answer: { type: "string", maxLength: 1500 },
      questions: { type: "array", maxItems: 3, items: { type: "string", maxLength: 360 } },
      checklist: { type: "array", maxItems: 5, items: { type: "string", maxLength: 360 } },
      evidenceToSubmit: { type: "array", maxItems: 4, items: { type: "string", maxLength: 360 } },
      citations: {
        type: "array",
        items: { type: "string" },
        description: "Only collected evidence ids from AgentContext.evidence may be cited.",
      },
      guardrailHits: { type: "array", items: { type: "string" } },
    },
    additionalProperties: true,
  },
  AgentTurn: {
    type: "object",
    required: ["id", "message", "contextVersion", "evidence", "missingEvidence", "outcome", "createdAt"],
    properties: {
      id: { type: "string" },
      tenantId: { $ref: "#/components/schemas/TenantId" },
      courseId: { $ref: "#/components/schemas/CourseId" },
      workOrderId: { type: "string" },
      learnerHash: { $ref: "#/components/schemas/LearnerHash" },
      actorRole: { type: "string" },
      message: { type: "string", maxLength: 2000 },
      messageHash: { type: "string" },
      idempotencyKey: { type: "string" },
      contextVersion: { type: "string" },
      evidence: { type: "array", items: { $ref: "#/components/schemas/AgentEvidence" } },
      missingEvidence: { type: "array", items: { $ref: "#/components/schemas/AgentEvidence" } },
      outcome: { $ref: "#/components/schemas/AgentOutcome" },
      draftPreparedAt: { type: "string" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
    additionalProperties: true,
  },
  AgentConversationResponse: {
    type: "object",
    required: ["runtime", "context", "contextVersion", "turns", "historyWindow"],
    properties: {
      runtime: { const: "sepath-teaching-agent.v1" },
      context: { $ref: "#/components/schemas/AgentContext" },
      contextVersion: { type: "string" },
      turns: { type: "array", maxItems: 40, items: { $ref: "#/components/schemas/AgentTurn" } },
      historyWindow: { type: "integer", const: 40 },
    },
    additionalProperties: true,
  },
  AgentMessageRequest: {
    type: "object",
    required: ["tenantId", "courseId", "message", "idempotencyKey"],
    properties: {
      tenantId: { $ref: "#/components/schemas/TenantId" },
      courseId: { $ref: "#/components/schemas/CourseId" },
      workOrderId: { type: "string", maxLength: 120 },
      message: { type: "string", minLength: 1, maxLength: 2000 },
      idempotencyKey: {
        type: "string",
        minLength: 12,
        maxLength: 100,
        pattern: "^[a-zA-Z0-9_-]{12,100}$",
      },
    },
    additionalProperties: false,
  },
  AgentMessageResponse: {
    type: "object",
    required: ["runtime", "turn", "context"],
    properties: {
      runtime: { const: "sepath-teaching-agent.v1" },
      turn: { $ref: "#/components/schemas/AgentTurn" },
      context: { $ref: "#/components/schemas/AgentContext" },
      deduped: { type: "boolean" },
    },
    additionalProperties: true,
  },
  AgentDraftPrepareRequest: {
    type: "object",
    required: ["tenantId", "courseId", "workOrderId", "turnId"],
    properties: {
      tenantId: { $ref: "#/components/schemas/TenantId" },
      courseId: { $ref: "#/components/schemas/CourseId" },
      workOrderId: { type: "string", maxLength: 120 },
      turnId: { type: "string", maxLength: 100 },
    },
    additionalProperties: false,
  },
  AgentDraftPrepareResponse: {
    type: "object",
    required: ["runtime", "draft", "turnId", "draftPreparedAt", "published"],
    properties: {
      runtime: { const: "sepath-teaching-agent.v1" },
      draft: { $ref: "#/components/schemas/InterventionPackageDraft" },
      turnId: { type: "string" },
      draftPreparedAt: { type: "string" },
      published: { type: "boolean", const: false },
    },
    additionalProperties: true,
  },
});

writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
