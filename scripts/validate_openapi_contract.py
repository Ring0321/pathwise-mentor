from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OPENAPI = ROOT / "sepath-cloud-app" / "cloud" / "openapi.sepath.json"
REPORT = ROOT / "sepath-cloud-app" / "qa" / "openapi-contract-validation.json"

REQUIRED_OPERATIONS = {
    ("/api/health", "get"): "readHealth",
    ("/api/auth/session", "get"): "readAuthSession",
    ("/api/course/settings", "get"): "readCourseSettings",
    ("/api/course/settings", "post"): "saveCourseSettings",
    ("/api/course/launch", "post"): "launchCoursePilot",
    ("/api/course/roster", "get"): "readCourseRoster",
    ("/api/course/roster", "post"): "saveCourseRoster",
    ("/api/evidence/events", "post"): "createEvidenceEvent",
    ("/api/evidence/events", "get"): "listEvidenceEvents",
    ("/api/workbench/teacher/today", "get"): "readTeacherWorkbenchToday",
    ("/api/work-orders", "get"): "listWorkOrders",
    ("/api/work-order-batches", "post"): "createWorkOrderBatch",
    ("/api/work-orders/{workOrderId}", "get"): "readWorkOrder",
    ("/api/work-orders/{workOrderId}/review", "post"): "reviewWorkOrder",
    ("/api/work-orders/{workOrderId}/intervention-package", "post"): "publishInterventionPackage",
    ("/api/course/micro-task-package", "post"): "publishCourseMicroTaskPackage",
    ("/api/course/micro-task-reminder", "post"): "remindCourseMicroTaskTargets",
    ("/api/course/teaching-improvement-plan", "post"): "publishCourseTeachingImprovementPlan",
    ("/api/course/teaching-improvement-execution", "post"): "recordCourseTeachingImprovementExecution",
    ("/api/course/teaching-improvement-followup-sample", "post"): "recordCourseTeachingImprovementFollowupSample",
    ("/api/course/teaching-improvement-followup-result", "post"): "recordCourseTeachingImprovementFollowupResult",
    ("/api/course/resource-revision", "post"): "recordCourseResourceRevision",
    ("/api/course/resource-release", "post"): "recordCourseResourceRelease",
    ("/api/course/resource-usage", "post"): "recordCourseResourceUsage",
    ("/api/course/resource-usage-reminder", "post"): "remindCourseResourceUsageTargets",
    ("/api/work-orders/{workOrderId}/student-return", "post"): "recordStudentReturn",
    ("/api/work-orders/{workOrderId}/closure", "post"): "closeWorkOrder",
    ("/api/learners/{learnerHash}/diagnosis", "get"): "readLearnerDiagnosis",
    ("/api/learners/{learnerHash}/profile", "get"): "readLearnerProfile",
    ("/api/interventions/rank", "post"): "rankInterventions",
    ("/api/integrations/github/import", "post"): "importGithubCiEvidence",
    ("/api/integrations/github/batch-import", "post"): "batchImportGithubCiEvidence",
    ("/api/integrations/github/status", "get"): "readGithubIntegrationStatus",
    ("/api/webhooks/github/ci", "post"): "receiveGithubCiWebhook",
    ("/api/review/tickets", "post"): "createReviewTicket",
    ("/api/review/tickets", "get"): "listReviewTickets",
    ("/api/ledgers/import", "post"): "importEvidenceLedger",
    ("/api/exports/ledger", "post"): "exportEvidenceLedger",
    ("/api/privacy/audit", "get"): "readPrivacyAudit",
    ("/api/ai/generate-scaffold", "post"): "generateScaffold",
    ("/api/agent/conversation", "get"): "readTeachingAgentConversation",
    ("/api/agent/conversation", "post"): "sendTeachingAgentMessage",
    ("/api/agent/conversation/draft", "post"): "prepareTeachingAgentDraft",
}

REQUIRED_SCHEMAS = {
    "EvidenceEventCreateRequest",
    "EvidenceEventCreateResponse",
    "AuthSessionResponse",
    "CourseSettings",
    "CourseSettingsSaveRequest",
    "CourseSettingsResponse",
    "CourseLaunchChecklistItem",
    "CourseLaunchSettings",
    "CourseLaunchRequest",
    "CourseLaunchResponse",
    "CourseRosterLearner",
    "CourseRoster",
    "CourseRosterWriteRequest",
    "CourseRosterResponse",
    "CourseBatchTask",
    "WorkOrderBatchCreateRequest",
    "WorkOrderBatchCreateResponse",
    "TeacherWorkbenchSnapshot",
    "LearningWorkOrder",
    "ValueAddedSnapshot",
    "EvidenceLedgerEntry",
    "StudentReturnState",
    "InterventionTaskPackage",
    "WorkOrderListResponse",
    "WorkOrderDetailResponse",
    "WorkOrderReviewRequest",
    "WorkOrderClosureRequest",
    "InterventionPackageRequest",
    "CourseMicroTaskPackage",
    "CourseMicroTaskPackageRequest",
    "CourseMicroTaskPackageResponse",
    "CourseMicroTaskReminderRequest",
    "CourseMicroTaskReminderResponse",
    "CourseTeachingImprovementItem",
    "CourseTeachingImprovementPlan",
    "CourseTeachingImprovementPlanRequest",
    "CourseTeachingImprovementPlanResponse",
    "CourseTeachingImprovementExecutionReceipt",
    "CourseTeachingImprovementExecutionRequest",
    "CourseTeachingImprovementExecutionResponse",
    "CourseTeachingImprovementFollowupIndicator",
    "CourseTeachingImprovementFollowupSample",
    "CourseTeachingImprovementFollowupRequest",
    "CourseTeachingImprovementFollowupResponse",
    "CourseTeachingImprovementFollowupResultFinding",
    "CourseTeachingImprovementFollowupResult",
    "CourseTeachingImprovementFollowupResultRequest",
    "CourseTeachingImprovementFollowupResultResponse",
    "CourseResourceRevisionChange",
    "CourseResourceRevisionTicket",
    "CourseResourceRevisionRequest",
    "CourseResourceRevisionResponse",
    "CourseResourceReleaseCheck",
    "CourseResourceReleaseReceipt",
    "CourseResourceReleaseRequest",
    "CourseResourceReleaseResponse",
    "CourseResourceUsageSignal",
    "CourseResourceUsageReceipt",
    "CourseResourceUsageRequest",
    "CourseResourceUsageResponse",
    "CourseResourceUsageReminder",
    "CourseResourceUsageReminderRequest",
    "CourseResourceUsageReminderResponse",
    "StudentReturnRequest",
    "WorkOrderMutationResponse",
    "LearnerProfileResponse",
    "GithubImportRequest",
    "GithubBatchImportEvent",
    "GithubBatchImportRequest",
    "GithubBatchImportResponse",
    "GithubWebhookRequest",
    "GithubImportResponse",
    "GithubIntegrationEvent",
    "GithubIntegrationStatusResponse",
    "DiagnosisResponse",
    "InterventionRankRequest",
    "InterventionRankResponse",
    "ReviewTicketCreateRequest",
    "ReviewTicketResponse",
    "LedgerImportRequest",
    "LedgerExportRequest",
    "LedgerExportResponse",
    "PrivacyAuditResponse",
    "GenerateScaffoldRequest",
    "GenerateScaffoldResponse",
    "AgentEvidence",
    "AgentValueAddedContext",
    "AgentContext",
    "AgentOutcome",
    "AgentTurn",
    "AgentConversationResponse",
    "AgentMessageRequest",
    "AgentMessageResponse",
    "AgentDraftPrepareRequest",
    "AgentDraftPrepareResponse",
}

FORBIDDEN_PUBLIC_PATTERNS = {
    r"\bsk-[A-Za-z0-9_-]{16,}\b",
}

FORBIDDEN_PUBLIC_STRINGS = {
    "OPENAI_API_KEY=",
    "LLM_API_KEY=",
    "password123",
    "真实姓名",
}


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def operation(spec: dict[str, Any], path: str, method: str) -> dict[str, Any]:
    return spec.get("paths", {}).get(path, {}).get(method, {})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", default=str(OPENAPI))
    parser.add_argument("--report", default=str(REPORT))
    args = parser.parse_args()

    spec_path = Path(args.spec)
    report_path = Path(args.report)
    spec = load_json(spec_path)
    rows: list[dict[str, Any]] = []

    rows.append(
        {
            "label": "OpenAPI version",
            "status": "PASS" if str(spec.get("openapi", "")).startswith("3.") else "FAIL",
            "evidence": spec.get("openapi", ""),
        }
    )
    rows.append(
        {
            "label": "API title",
            "status": "PASS" if spec.get("info", {}).get("title") == "SE-Path 学伴 API" else "FAIL",
            "evidence": spec.get("info", {}).get("title", ""),
        }
    )

    operation_ids: list[str] = []
    for (path, method), expected_id in REQUIRED_OPERATIONS.items():
      op = operation(spec, path, method)
      operation_ids.append(op.get("operationId", ""))
      rows.append(
          {
              "label": f"{method.upper()} {path}",
              "status": "PASS" if op.get("operationId") == expected_id else "FAIL",
              "evidence": op.get("operationId", "missing"),
          }
      )

    rows.append(
        {
            "label": "Unique operationId",
            "status": "PASS" if len(operation_ids) == len(set(operation_ids)) else "FAIL",
            "evidence": f"{len(set(operation_ids))}/{len(operation_ids)} unique",
        }
    )

    security_schemes = spec.get("components", {}).get("securitySchemes", {})
    rows.append(
        {
            "label": "SE-Path bearer auth",
            "status": "PASS"
            if security_schemes.get("SepathBearer", {}).get("bearerFormat") == "SEPATH-HMAC"
            else "FAIL",
            "evidence": json.dumps(security_schemes.get("SepathBearer", {}), ensure_ascii=False),
        }
    )

    schemas = spec.get("components", {}).get("schemas", {})
    missing_schemas = sorted(REQUIRED_SCHEMAS.difference(schemas))
    rows.append(
        {
            "label": "Required schemas",
            "status": "PASS" if not missing_schemas else "FAIL",
            "evidence": "all required schemas present" if not missing_schemas else ", ".join(missing_schemas),
        }
    )

    scaffold = schemas.get("GenerateScaffoldResponse", {})
    scaffold_required = set(scaffold.get("required", []))
    needed_response_fields = {"refusal", "checklist", "miniLab", "evidenceToSubmit", "citations", "teacherReviewRequired"}
    rows.append(
        {
            "label": "LLM response schema contract",
            "status": "PASS" if needed_response_fields.issubset(scaffold_required) else "FAIL",
            "evidence": ", ".join(sorted(scaffold_required)),
        }
    )

    agent_outcome = schemas.get("AgentOutcome", {})
    agent_outcome_required = set(agent_outcome.get("required", []))
    needed_agent_fields = {"mode", "answer", "citations", "teacherReviewRequired", "checklist", "evidenceToSubmit"}
    rows.append(
        {
            "label": "Teaching agent grounded response contract",
            "status": "PASS" if needed_agent_fields.issubset(agent_outcome_required) else "FAIL",
            "evidence": ", ".join(sorted(agent_outcome_required)),
        }
    )

    boundary = spec.get("x-sepath-boundaries", {})
    forbidden_fields = set(boundary.get("forbiddenRequestFields", []))
    rows.append(
        {
            "label": "Privacy boundary extension",
            "status": "PASS" if {"rawLog", "rawDiff", "studentRealName", "apiKey"}.issubset(forbidden_fields) else "FAIL",
            "evidence": ", ".join(sorted(forbidden_fields)),
        }
    )

    raw_text = spec_path.read_text(encoding="utf-8")
    secret_hits = sorted(token for token in FORBIDDEN_PUBLIC_STRINGS if token in raw_text)
    secret_hits.extend(sorted(pattern for pattern in FORBIDDEN_PUBLIC_PATTERNS if re.search(pattern, raw_text)))
    rows.append(
        {
            "label": "No public secrets",
            "status": "PASS" if not secret_hits else "FAIL",
            "evidence": "no secret-like literals" if not secret_hits else ", ".join(secret_hits),
        }
    )

    fail_count = sum(1 for row in rows if row["status"] != "PASS")
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "spec": str(spec_path.relative_to(ROOT)),
        "summary": {
            "PASS": sum(1 for row in rows if row["status"] == "PASS"),
            "FAIL": fail_count,
            "operations": len(REQUIRED_OPERATIONS),
            "schemas": len(REQUIRED_SCHEMAS),
        },
        "rows": rows,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))
    print(f"report: {report_path.relative_to(ROOT).as_posix()}")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
