import { describe, expect, it } from "vitest";
import { demoEventTemplates, knowledgeSources, seedState } from "../data/seed";
import { repositorySignals } from "../data/repositorySamples";
import { buildAgentRuntimeReport } from "./agentRuntime";
import { buildApiContractReport } from "./apiContract";
import { buildBackendStatusReport } from "./backendStatus";
import { buildClaimEvidenceLedgerReport } from "./claimEvidenceLedger";
import { buildClosedLoopDemoReport } from "./closedLoopDemo";
import { buildCloudHandoffReport } from "./cloudHandoff";
import { buildCloudSloReport } from "./cloudSlo";
import { buildCohortOpsReport } from "./cohortOps";
import { buildCompetitionAlignmentReport } from "./competitionAlignment";
import { buildCourseAuthoringReport } from "./courseAuthoring";
import { buildCourseLaunchReport } from "./courseLaunch";
import { buildDataPlaneReport } from "./dataPlane";
import { diagnoseLearner } from "./diagnosis";
import { buildFinalDefenseReport } from "./finalDefense";
import { buildFinalSubmissionReport } from "./finalSubmission";
import { buildHostingSelftestReport } from "./hostingSelftest";
import { buildKnowledgeBoundaryReport } from "./knowledgeBoundary";
import { importLedgerPayload } from "./ledgerExchange";
import { buildLaunchReadinessReport } from "./launchReadiness";
import { buildModelOpsReport } from "./modelOps";
import { buildAwardReadinessReport } from "./awardReadiness";
import { runAllDemoSteps, runNextDemoStep } from "./demoOrchestrator";
import { buildCandidates, rankTasks } from "./safeVoi";
import { evaluatePublication } from "./reviewGate";
import { generateScaffold } from "./scaffold";
import { buildPathTwin } from "./pathTwin";
import { buildPilotEvidenceBinderReport } from "./pilotEvidenceBinder";
import { buildPilotReadinessReport } from "./pilotReadiness";
import { buildPitchDirectorReport } from "./pitchDirector";
import { buildPrivacyGuardReport } from "./privacyGuard";
import { buildResearchEvidenceReport } from "./researchEvidence";
import { buildResearchFusionReport } from "./researchFusion";
import { buildRealWorkOrderReport, defaultRealWorkOrderInput } from "./realWorkOrder";
import { buildReviewerDrillReport, buildReviewerGuideReport } from "./reviewerDrill";
import { buildRubricCalibrationReport } from "./rubricCalibration";
import { buildSchoolProvisioningReport } from "./schoolProvisioning";
import { buildStrategyLabReport } from "./strategyLab";
import {
  analyzeStudentDialoguePrompt,
  buildStudentDialogueReport,
  createStudentDialogueEvents,
} from "./studentDialogue";
import { buildSubmissionClosureReport } from "./submissionClosure";
import { buildSubmissionOpsReport } from "./submissionOps";
import { buildTeacherReport } from "./teacherReport";
import { buildTenantOpsReport } from "./tenantOps";
import { buildTrialTelemetryReport } from "./trialTelemetry";
import { mergeEvidenceEvents, normalizeRepositorySignals } from "./eventIngestion";
import {
  buildIntegrationSandboxReport,
  integrationWebhookSamples,
  runIntegrationWebhookDryRun,
} from "./integrationSandbox";
import { buildInterventionPlaybookReport } from "./interventionPlaybook";
import { buildInferenceGatewayReport } from "./inferenceGateway";
import { buildJudgeTrialReport } from "./judgeTrial";
import { buildJudgeVerificationReport } from "./judgeVerification";
import { buildLaunchLoopAcceptanceReport } from "./launchLoopAcceptance";
import { buildValueUpliftReport } from "./valueUplift";

describe("SE-Path closed-loop engine", () => {
  it("diagnoses a CI failure as a testing blocker", () => {
    const state = { ...seedState, events: [...seedState.events, demoEventTemplates[0]] };
    const diagnosis = diagnoseLearner(state.learner, state.events);

    expect(diagnosis.blocker).toContain("测试");
    expect(diagnosis.reasonCodes).toContain("CI_FAILURE_AS_LEARNING_EVIDENCE");
    expect(diagnosis.confidence).toBeGreaterThan(0.6);
  });

  it("blocks unsafe high-stakes or paid low-information actions", () => {
    const decisions = rankTasks([
      {
        taskId: "safe",
        label: "检查清单",
        expectedGrowth: 7,
        informationGain: 8,
        transferability: 8,
        windowRescue: 7,
        burden: 2,
        risk: 1,
        estimatedHours: 0.5,
        monetaryCost: 0,
        consentValid: true,
        rulesValid: true,
        reversible: true,
        highStakes: false,
        paidService: false,
      },
      {
        taskId: "unsafe",
        label: "直接替写",
        expectedGrowth: 9,
        informationGain: 3,
        transferability: 4,
        windowRescue: 8,
        burden: 8,
        risk: 8,
        estimatedHours: 1,
        monetaryCost: 100,
        consentValid: true,
        rulesValid: true,
        reversible: false,
        highStakes: true,
        paidService: true,
      },
    ]);

    expect(decisions[0].taskId).toBe("safe");
    expect(decisions.find((item) => item.taskId === "unsafe")?.gate).toBe("BLOCK");
  });

  it("refuses direct answer requests and generates scaffolded help", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, demoEventTemplates[0], demoEventTemplates[1]],
    };
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const scaffold = generateScaffold(diagnosis);

    expect(scaffold.refusesDirectAnswer).toBe(true);
    expect(scaffold.body).toContain("不能直接给完整");
  });

  it("routes high-risk suggestions to teacher review", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, demoEventTemplates[0], demoEventTemplates[1]],
    };
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const ticket = evaluatePublication(diagnosis);

    expect(ticket.action).toBe("human_review");
    expect(ticket.requiredActions.join(" ")).toContain("教师复核");
  });

  it("advances the demo event stream one step at a time", () => {
    const next = runNextDemoStep(seedState);

    expect(next.demoStep).toBe(1);
    expect(next.events).toHaveLength(seedState.events.length + 1);
    expect(next.events.at(-1)?.type).toBe("ci_failed");
  });

  it("runs the full closed-loop demo without duplicating evidence", () => {
    const complete = runAllDemoSteps(seedState);
    const repeated = runAllDemoSteps(complete);

    expect(complete.demoStep).toBe(demoEventTemplates.length);
    expect(complete.events).toHaveLength(seedState.events.length + demoEventTemplates.length);
    expect(complete.events.slice(-demoEventTemplates.length).map((event) => event.id)).toEqual(
      demoEventTemplates.map((event) => event.id),
    );
    expect(repeated.events).toHaveLength(complete.events.length);
  });

  it("summarizes the product-visible closed-loop demo state", () => {
    const state = runAllDemoSteps(seedState);
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const decisions = rankTasks(buildCandidates(state.learner, diagnosis));
    const scaffold = generateScaffold(diagnosis);
    const reviewTicket = evaluatePublication(diagnosis);
    const pathNodes = buildPathTwin(state);
    const report = buildClosedLoopDemoReport({
      state,
      diagnosis,
      decisions,
      scaffold,
      reviewTicket,
      pathNodes,
      teacherReport: { score: 88 } as never,
      valueUplift: { valueScore: 82 } as never,
    });

    expect(report.runtime).toBe("sepath-closed-loop-demo.v1");
    expect(report.status).toBe("closed");
    expect(report.progress).toBe(100);
    expect(report.steps.every((step) => step.status === "done")).toBe(true);
    expect(report.checks.filter((check) => check.status === "ready").length).toBeGreaterThanOrEqual(5);
    expect(report.exportReady).toBe(true);
  });

  it("turns pasted software-engineering evidence into a guarded real work order", () => {
    const report = buildRealWorkOrderReport(defaultRealWorkOrderInput);

    expect(report.runtime).toBe("sepath-real-work-order.v1");
    expect(report.risk).toBe("high");
    expect(report.pathPlan).toHaveLength(5);
    expect(report.scaffold).toHaveLength(3);
    expect(report.teacherGate.action).toBe("human_review");
    expect(report.metrics.blockedDirectAnswer).toBe(true);
    expect(report.evidence.length).toBeGreaterThanOrEqual(4);
    expect(report.detectedSignals).toContain("替写请求门禁");
    expect(report.detectedSignals).toContain("边界与异常路径");
  });

  it("uses rubric and policy sources to constrain high-risk AI help", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, demoEventTemplates[0], demoEventTemplates[1]],
    };
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const report = buildKnowledgeBoundaryReport(state, diagnosis, knowledgeSources);

    expect(report.teacherReviewRequired).toBe(true);
    expect(report.ruleHits).toContain("DIRECT_ANSWER_POLICY_GATE");
    expect(report.matchedSources.map((source) => source.kind)).toContain("policy");
    expect(report.blockedResponse).toContain("完整 service 层代码");
  });

  it("maps implemented product evidence to competition scoring dimensions", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates],
      demoStep: demoEventTemplates.length,
    };
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const knowledgeBoundary = buildKnowledgeBoundaryReport(state, diagnosis, knowledgeSources);
    const ticket = evaluatePublication(diagnosis);
    const pathNodes = buildPathTwin(state);
    const report = buildAwardReadinessReport(state, knowledgeBoundary, ticket, pathNodes);

    expect(report.maxScore).toBe(100);
    expect(report.totalScore).toBeGreaterThanOrEqual(90);
    expect(report.criteria.map((criterion) => criterion.label)).toContain("智能体架构设计");
    expect(report.strongestDifferentiator).toContain("Issue");
  });

  it("summarizes launch readiness without pretending manual gates are automated", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates],
      demoStep: demoEventTemplates.length,
    };
    const report = buildLaunchReadinessReport(state);

    expect(report.cloudUrl).toContain("sepath-xueban");
    expect(report.passCount).toBeGreaterThanOrEqual(5);
    expect(report.manualCount).toBe(2);
    expect(report.rollbackSteps.join(" ")).toContain("本地 Vite Demo");
    expect(report.manualGates.join(" ")).toContain("真实教学效果");
  });

  it("builds a research evidence report with ablations and truthful trial boundaries", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates],
      demoStep: demoEventTemplates.length,
    };
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const decisions = rankTasks(buildCandidates(state.learner, diagnosis));
    const knowledgeBoundary = buildKnowledgeBoundaryReport(state, diagnosis, knowledgeSources);
    const ticket = evaluatePublication(diagnosis);
    const report = buildResearchEvidenceReport(state, decisions, knowledgeBoundary, ticket);

    expect(report.readinessScore).toBeGreaterThanOrEqual(80);
    expect(report.ablations.map((item) => item.id)).toContain("chat-only");
    expect(report.ablations.map((item) => item.status)).toContain("needs_trial");
    expect(report.safeguards.join(" ")).toContain("不冒充真实课程效果");
  });

  it("normalizes repository signals into deduplicated learning evidence", () => {
    const result = normalizeRepositorySignals(repositorySignals);
    const merged = mergeEvidenceEvents(seedState.events, result.events);
    const repeated = mergeEvidenceEvents(merged, result.events);

    expect(result.events.map((event) => event.type)).toContain("pr_opened");
    expect(result.events.map((event) => event.type)).toContain("ci_failed");
    expect(result.events.map((event) => event.type)).toContain("ci_passed");
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
    expect(merged.length).toBe(seedState.events.length + result.events.length);
    expect(repeated.length).toBe(merged.length);
  });

  it("builds a class-level GrowthOps queue from learner evidence", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...normalizeRepositorySignals(repositorySignals).events],
    };
    const report = buildCohortOpsReport(state);

    expect(report.learnerCount).toBeGreaterThanOrEqual(4);
    expect(report.highRiskCount).toBeGreaterThanOrEqual(1);
    expect(report.actions.map((action) => action.owner)).toContain("teacher");
    expect(report.feishuSyncPreview.join(" ")).toContain("P0");
  });

  it("compares strategies and proves the SafeVOI loop beats chat-only help", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates],
      demoStep: demoEventTemplates.length,
    };
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const decisions = rankTasks(buildCandidates(state.learner, diagnosis));
    const report = buildStrategyLabReport(state, decisions);

    expect(report.winnerId).toBe("sepath-safevoi");
    expect(report.winnerMargin).toBeGreaterThan(0);
    expect(report.policyResults.find((item) => item.id === "sepath-safevoi")?.blockedUnsafeActions).toBeGreaterThan(0);
    expect(report.scenarioResults.some((item) => item.policyId === "chat-only" && !item.riskHandled)).toBe(true);
    expect(report.auditTrail.join(" ")).toContain("EvidenceEvent");
  });

  it("builds a course pilot workspace with privacy gates and integration routes", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates, ...normalizeRepositorySignals(repositorySignals).events],
      demoStep: demoEventTemplates.length,
    };
    const cohortOps = buildCohortOpsReport(state);
    const launchReadiness = buildLaunchReadinessReport(state);
    const report = buildPilotReadinessReport(state, cohortOps, launchReadiness);

    expect(report.readinessScore).toBeGreaterThanOrEqual(70);
    expect(report.mode).toContain("课程");
    expect(report.checklist.map((item) => item.id)).toContain("consent");
    expect(report.integrations.map((item) => item.id)).toContain("git-ci");
    expect(report.dataControls.join(" ")).toContain("数据");
    expect(report.rolloutStages).toHaveLength(4);
  });

  it("imports exported evidence ledgers with validation and deduplication", () => {
    const importedEvent = {
      ...demoEventTemplates[0],
      id: "evt-imported-ci-pass",
      type: "ci_passed",
      title: "外部账本：CI 已通过",
      detail: "从另一台电脑导入的修复证据。",
      competencyImpacts: { testing: 8 },
      risk: "low",
    };
    const payload = JSON.stringify({
      product: "SE-Path 学伴",
      state: {
        events: [seedState.events[0], importedEvent, { type: "unknown" }],
      },
    });

    const result = importLedgerPayload(payload, seedState);
    const repeated = importLedgerPayload(payload, result.state ?? seedState);
    const invalid = importLedgerPayload("{bad-json", seedState);

    expect(result.status).toBe("merged");
    expect(result.importedEvents).toBe(1);
    expect(result.invalidEvents).toBe(1);
    expect(result.state?.events.map((event) => event.id)).toContain("evt-imported-ci-pass");
    expect(repeated.status).toBe("duplicate");
    expect(invalid.status).toBe("rejected");
  });

  it("builds a role-based privacy guard with PII scanning and access blocks", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates, ...normalizeRepositorySignals(repositorySignals).events],
      demoStep: demoEventTemplates.length,
    };
    const cohortOps = buildCohortOpsReport(state);
    const launchReadiness = buildLaunchReadinessReport(state);
    const pilotReadiness = buildPilotReadinessReport(state, cohortOps, launchReadiness);
    const report = buildPrivacyGuardReport(state, pilotReadiness);

    expect(report.gate).toBe("pass");
    expect(report.piiFindings).toBe(0);
    expect(report.roleMatrix.map((role) => role.role)).toContain("competition_reviewer");
    expect(report.blockedRequests.join(" ")).toContain("真实学生账本");
    expect(report.dataClasses.map((item) => item.id)).toContain("repository-evidence");
    expect(report.auditEvents.every((event) => event.status !== "block")).toBe(true);
  });

  it("builds cloud API contracts for real course and repository onboarding", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates, ...normalizeRepositorySignals(repositorySignals).events],
      demoStep: demoEventTemplates.length,
    };
    const cohortOps = buildCohortOpsReport(state);
    const launchReadiness = buildLaunchReadinessReport(state);
    const pilotReadiness = buildPilotReadinessReport(state, cohortOps, launchReadiness);
    const privacyGuard = buildPrivacyGuardReport(state, pilotReadiness);
    const report = buildApiContractReport(state, pilotReadiness, privacyGuard);

    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).toContain(
      "POST /api/evidence/events",
    );
    expect(report.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).toContain(
      "GET /api/evidence/events",
    );
    expect(report.endpoints.map((endpoint) => endpoint.id)).toContain("privacy-audit");
    expect(report.endpoints.map((endpoint) => endpoint.id)).toContain("review-ticket-readback");
    expect(report.endpoints.map((endpoint) => endpoint.id)).toContain("ai-generate-scaffold");
    expect(report.openApiSpecPath).toContain("openapi.sepath.json");
    expect(report.openApiValidationReportPath).toContain("openapi-contract-validation.json");
    expect(report.openApiValidationCommand).toContain("validate_openapi_contract.py");
    expect(report.openApiManifest).toContain("sepath-openapi-contract.v1");
    expect(report.openApiOperationCount).toBe(10);
    expect(report.webhooks.map((webhook) => webhook.id)).toContain("git-pr");
    expect(report.webhooks.flatMap((webhook) => webhook.protectedFields)).toContain("accessToken");
    expect(report.provisioning.map((step) => step.id)).toContain("tenant");
    expect(report.environmentVariables).toContain("GIT_WEBHOOK_SECRET");
    expect(report.environmentVariables).toContain("LLM_API_KEY");
    expect(report.samplePayload).toContain("idempotencyKey");
    expect(report.dataResidencyRules.join(" ")).toContain("tenantId");
  });

  it("builds a model governance center that connects algorithms, experiments, and release gates", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates, ...normalizeRepositorySignals(repositorySignals).events],
      demoStep: demoEventTemplates.length,
    };
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const decisions = rankTasks(buildCandidates(state.learner, diagnosis));
    const knowledgeBoundary = buildKnowledgeBoundaryReport(state, diagnosis, knowledgeSources);
    const ticket = evaluatePublication(diagnosis);
    const researchEvidence = buildResearchEvidenceReport(state, decisions, knowledgeBoundary, ticket);
    const strategyLab = buildStrategyLabReport(state, decisions);
    const cohortOps = buildCohortOpsReport(state);
    const launchReadiness = buildLaunchReadinessReport(state);
    const pilotReadiness = buildPilotReadinessReport(state, cohortOps, launchReadiness);
    const privacyGuard = buildPrivacyGuardReport(state, pilotReadiness);
    const apiContract = buildApiContractReport(state, pilotReadiness, privacyGuard);
    const report = buildModelOpsReport(state, researchEvidence, strategyLab, privacyGuard, apiContract);

    expect(report.score).toBeGreaterThanOrEqual(75);
    expect(report.champion).toContain("SafeVOI");
    expect(report.registry.map((item) => item.id)).toContain("safevoi");
    expect(report.registry.map((item) => item.id)).toContain("api-contract");
    expect(report.protocols.map((item) => item.id)).toContain("teacher-confirmed-ab");
    expect(report.releaseGates.map((item) => item.id)).toContain("privacy");
    expect(report.monitors.map((item) => item.id)).toContain("api-contract-drift");
    expect(report.featureContracts.map((item) => item.id)).toContain("ci-signal");
    expect(report.offlineEval.join(" ")).toContain("策略冠军");
  });

  it("builds a configurable course studio with rubrics, policy gates, and assignment templates", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates, ...normalizeRepositorySignals(repositorySignals).events],
      demoStep: demoEventTemplates.length,
    };
    const pathNodes = buildPathTwin(state);
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const decisions = rankTasks(buildCandidates(state.learner, diagnosis));
    const knowledgeBoundary = buildKnowledgeBoundaryReport(state, diagnosis, knowledgeSources);
    const ticket = evaluatePublication(diagnosis);
    const researchEvidence = buildResearchEvidenceReport(state, decisions, knowledgeBoundary, ticket);
    const strategyLab = buildStrategyLabReport(state, decisions);
    const cohortOps = buildCohortOpsReport(state);
    const launchReadiness = buildLaunchReadinessReport(state);
    const pilotReadiness = buildPilotReadinessReport(state, cohortOps, launchReadiness);
    const privacyGuard = buildPrivacyGuardReport(state, pilotReadiness);
    const apiContract = buildApiContractReport(state, pilotReadiness, privacyGuard);
    const modelOps = buildModelOpsReport(state, researchEvidence, strategyLab, privacyGuard, apiContract);
    const report = buildCourseAuthoringReport(state, knowledgeSources, pathNodes, privacyGuard, apiContract, modelOps);

    expect(report.score).toBeGreaterThanOrEqual(75);
    expect(report.courseVersion).toContain("sepath-course-design");
    expect(report.rubrics.map((item) => item.competencyId)).toContain("testing");
    expect(report.assignments.map((item) => item.id)).toContain("ci-recovery-lab");
    expect(report.aiPolicies.map((item) => item.id)).toContain("DIRECT_ANSWER_POLICY_GATE");
    expect(report.publishChecklist.map((item) => item.id)).toContain("teacher-reviewers");
    expect(report.learningDesignPatterns.join(" ")).toContain("Learning Design as Code");
    expect(report.exportManifest).toContain("policyVersion");
  });

  it("builds a downloadable teacher weekly report from evidence, rubric, and governance signals", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates, ...normalizeRepositorySignals(repositorySignals).events],
      demoStep: demoEventTemplates.length,
    };
    const pathNodes = buildPathTwin(state);
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const decisions = rankTasks(buildCandidates(state.learner, diagnosis));
    const knowledgeBoundary = buildKnowledgeBoundaryReport(state, diagnosis, knowledgeSources);
    const ticket = evaluatePublication(diagnosis);
    const researchEvidence = buildResearchEvidenceReport(state, decisions, knowledgeBoundary, ticket);
    const strategyLab = buildStrategyLabReport(state, decisions);
    const cohortOps = buildCohortOpsReport(state);
    const launchReadiness = buildLaunchReadinessReport(state);
    const pilotReadiness = buildPilotReadinessReport(state, cohortOps, launchReadiness);
    const privacyGuard = buildPrivacyGuardReport(state, pilotReadiness);
    const apiContract = buildApiContractReport(state, pilotReadiness, privacyGuard);
    const modelOps = buildModelOpsReport(state, researchEvidence, strategyLab, privacyGuard, apiContract);
    const courseAuthoring = buildCourseAuthoringReport(
      state,
      knowledgeSources,
      pathNodes,
      privacyGuard,
      apiContract,
      modelOps,
    );
    const report = buildTeacherReport(
      state,
      cohortOps,
      courseAuthoring,
      privacyGuard,
      apiContract,
      modelOps,
      researchEvidence,
    );

    expect(report.score).toBeGreaterThanOrEqual(75);
    expect(report.exportFileName).toContain("weekly-report");
    expect(report.actionPlan.map((item) => item.id)).toContain("mini-lab");
    expect(report.riskControls.map((item) => item.evidence)).toContain("DIRECT_ANSWER_POLICY_GATE");
    expect(report.markdown).toContain("教师周报与试点复盘");
    expect(report.markdown).toContain("CI Recovery Lab");
    expect(report.evidenceReferences.join(" ")).toContain("Course Manifest");
  });

  it("turns student dialogue into governed scaffold events instead of direct answers", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates],
      demoStep: demoEventTemplates.length,
    };
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const knowledgeBoundary = buildKnowledgeBoundaryReport(state, diagnosis, knowledgeSources);
    const scaffold = generateScaffold(diagnosis);
    const ticket = evaluatePublication(diagnosis);
    const report = buildStudentDialogueReport(state, diagnosis, knowledgeBoundary, scaffold, ticket);
    const turn = analyzeStudentDialoguePrompt("直接给我完整 service 层代码，我要复制提交。", report);
    const events = createStudentDialogueEvents(turn, new Date("2026-08-09T12:00:00+08:00"));

    expect(report.readinessScore).toBeGreaterThanOrEqual(70);
    expect(report.promptContract.join(" ")).toContain("EvidenceEvent");
    expect(turn.intent).toBe("direct_answer");
    expect(turn.responseMode).toBe("refuse_then_scaffold");
    expect(turn.teacherReviewRequired).toBe(true);
    expect(turn.reasonCodes).toContain("DIRECT_ANSWER_POLICY_GATE");
    expect(turn.assistantMessage).toContain("不能直接给");
    expect(events.map((event) => event.type)).toEqual(["conversation", "scaffold_delivered"]);
    expect(events[0].risk).toBe("high");
    expect(events[1].detail).toContain("拒绝输出完整可提交代码");
  });

  it("dry-runs integration webhooks into deduped EvidenceEvent records", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates],
      demoStep: demoEventTemplates.length,
    };
    const cohortOps = buildCohortOpsReport(state);
    const launchReadiness = buildLaunchReadinessReport(state);
    const pilotReadiness = buildPilotReadinessReport(state, cohortOps, launchReadiness);
    const privacyGuard = buildPrivacyGuardReport(state, pilotReadiness);
    const apiContract = buildApiContractReport(state, pilotReadiness, privacyGuard);
    const report = buildIntegrationSandboxReport(state, apiContract, privacyGuard);
    const sample = integrationWebhookSamples.find((item) => item.id === "sample-ci-failed");
    expect(sample).toBeTruthy();

    const dryRun = runIntegrationWebhookDryRun(sample!, state, apiContract, privacyGuard.gate);
    const merged = mergeEvidenceEvents(state.events, dryRun.events);
    const duplicateRun = runIntegrationWebhookDryRun(sample!, { ...state, events: merged }, apiContract, privacyGuard.gate);

    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.sourceCoverage.map((item) => item.label)).toEqual(["Git", "CI", "LMS", "飞书"]);
    expect(dryRun.qualityGate).toBe("pass");
    expect(dryRun.events).toHaveLength(1);
    expect(dryRun.events[0].type).toBe("ci_failed");
    expect(dryRun.events[0].source).toBe("ci");
    expect(dryRun.sanitizedPayload).not.toContain("runnerSecret");
    expect(duplicateRun.qualityGate).toBe("watch");
    expect(duplicateRun.summary).toContain("影子写入");
  });

  it("quantifies learning value uplift with truthful claim boundaries", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates, ...normalizeRepositorySignals(repositorySignals).events],
      demoStep: demoEventTemplates.length,
    };
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const decisions = rankTasks(buildCandidates(state.learner, diagnosis));
    const knowledgeBoundary = buildKnowledgeBoundaryReport(state, diagnosis, knowledgeSources);
    const ticket = evaluatePublication(diagnosis);
    const researchEvidence = buildResearchEvidenceReport(state, decisions, knowledgeBoundary, ticket);
    const strategyLab = buildStrategyLabReport(state, decisions);
    const cohortOps = buildCohortOpsReport(state);
    const report = buildValueUpliftReport(state, decisions, strategyLab, researchEvidence, cohortOps);

    expect(report.valueScore).toBeGreaterThanOrEqual(75);
    expect(report.estimatedUpliftPoints).toBeGreaterThan(0);
    expect(report.metrics.map((metric) => metric.id)).toContain("safevoi-uplift");
    expect(report.dimensions.map((dimension) => dimension.id)).toContain("testing");
    expect(report.experimentCells.find((cell) => cell.id === "sepath-safevoi")?.expectedGain).toBeGreaterThan(
      report.experimentCells.find((cell) => cell.id === "chat-only")?.expectedGain ?? 0,
    );
    expect(report.claims.find((claim) => claim.id === "real-score-claim")?.allowed).toBe(false);
    expect(report.telemetryContract).toContain("safevoi_version");
    expect(report.exportManifest).toContain("sepath-uplift.v1");
  });

  it("builds a judge trial control center without faking public cloud access", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates, ...normalizeRepositorySignals(repositorySignals).events],
      demoStep: demoEventTemplates.length,
    };
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const decisions = rankTasks(buildCandidates(state.learner, diagnosis));
    const knowledgeBoundary = buildKnowledgeBoundaryReport(state, diagnosis, knowledgeSources);
    const ticket = evaluatePublication(diagnosis);
    const pathNodes = buildPathTwin(state);
    const launchReadiness = buildLaunchReadinessReport(state);
    const cohortOps = buildCohortOpsReport(state);
    const pilotReadiness = buildPilotReadinessReport(state, cohortOps, launchReadiness);
    const privacyGuard = buildPrivacyGuardReport(state, pilotReadiness);
    const apiContract = buildApiContractReport(state, pilotReadiness, privacyGuard);
    const researchEvidence = buildResearchEvidenceReport(state, decisions, knowledgeBoundary, ticket);
    const strategyLab = buildStrategyLabReport(state, decisions);
    const valueUplift = buildValueUpliftReport(state, decisions, strategyLab, researchEvidence, cohortOps);
    const awardReadiness = buildAwardReadinessReport(state, knowledgeBoundary, ticket, pathNodes);
    const report = buildJudgeTrialReport(
      state,
      launchReadiness,
      awardReadiness,
      pilotReadiness,
      privacyGuard,
      apiContract,
      valueUplift,
    );

    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.routes.map((route) => route.id)).toContain("public-static-package");
    expect(report.routes.map((route) => route.id)).toContain("pwa-offline-resilience");
    expect(report.routes.find((route) => route.id === "pwa-offline-resilience")?.proofArtifacts).toContain("sw.js");
    expect(report.routes.find((route) => route.id === "owner-only-sites")?.status).toBe("manual");
    expect(report.routes.find((route) => route.id === "owner-only-sites")?.riskControl).toContain("不把私有 URL");
    expect(report.checklist.map((item) => item.id)).toContain("access-policy");
    expect(report.manualCount).toBeGreaterThan(0);
    expect(report.trialTasks.map((task) => task.id)).toContain("one-click-loop");
    expect(report.trialTasks.find((task) => task.id === "algorithm-audit")?.successSignal).toContain("增值分");
    expect(report.proofMatrix.map((item) => item.id)).toContain("adaptive-strategy");
    expect(report.proofMatrix.find((item) => item.id === "architecture")?.demoLine).toContain("Agent 运行时");
    expect(report.submissionStatement).toContain("不提前夸大");
  });

  it("builds a governed AI agent runtime with no-key fallback and RAG boundaries", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates, ...normalizeRepositorySignals(repositorySignals).events],
      demoStep: demoEventTemplates.length,
    };
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const decisions = rankTasks(buildCandidates(state.learner, diagnosis));
    const scaffold = generateScaffold(diagnosis);
    const ticket = evaluatePublication(diagnosis);
    const knowledgeBoundary = buildKnowledgeBoundaryReport(state, diagnosis, knowledgeSources);
    const launchReadiness = buildLaunchReadinessReport(state);
    const cohortOps = buildCohortOpsReport(state);
    const pilotReadiness = buildPilotReadinessReport(state, cohortOps, launchReadiness);
    const privacyGuard = buildPrivacyGuardReport(state, pilotReadiness);
    const apiContract = buildApiContractReport(state, pilotReadiness, privacyGuard);
    const researchEvidence = buildResearchEvidenceReport(state, decisions, knowledgeBoundary, ticket);
    const strategyLab = buildStrategyLabReport(state, decisions);
    const modelOps = buildModelOpsReport(state, researchEvidence, strategyLab, privacyGuard, apiContract);
    const valueUplift = buildValueUpliftReport(state, decisions, strategyLab, researchEvidence, cohortOps);
    const report = buildAgentRuntimeReport(
      state,
      diagnosis,
      decisions,
      scaffold,
      ticket,
      knowledgeBoundary,
      privacyGuard,
      apiContract,
      modelOps,
      valueUplift,
    );
    const inference = buildInferenceGatewayReport(
      state,
      diagnosis,
      decisions,
      scaffold,
      knowledgeBoundary,
      privacyGuard,
      apiContract,
      report,
      modelOps,
    );

    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.routes.find((route) => route.id === "deterministic-policy")?.status).toBe("ready");
    expect(report.routes.find((route) => route.id === "llm-expression")?.fallback).toContain("没有 API Key");
    expect(report.promptContracts.find((contract) => contract.id === "scaffold-answer")?.refusalRule).toContain(
      "不得输出",
    );
    expect(report.qualityGates.find((gate) => gate.id === "privacy")?.status).toBe("ready");
    expect(report.deploymentManifest).toContain("noKeyFallback");
    expect(report.fallbackPlan.join(" ")).toContain("无 Key");
    expect(inference.score).toBeGreaterThanOrEqual(80);
    expect(inference.providers.map((provider) => provider.id)).toContain("edge-gateway");
    expect(inference.providers.map((provider) => provider.id)).toContain("deterministic-fallback");
    expect(inference.guardrails.map((guardrail) => guardrail.id)).toContain("direct-answer-gate");
    expect(inference.requestContract).toContain("/api/ai/generate-scaffold");
    expect(inference.responsePreview).toContain("deterministic-fallback");
    expect(inference.workerContract).toContain("llm-gateway-worker.ts");
    expect(inference.inferenceManifest).toContain("sepath-inference-gateway.v1");
    expect(inference.openSourceReferences.map((item) => item.id)).toContain("llamaindex");
  });

  it("builds a first-week course launch wizard from product readiness evidence", () => {
    const state = {
      ...seedState,
      events: [...seedState.events, ...demoEventTemplates, ...normalizeRepositorySignals(repositorySignals).events],
      demoStep: demoEventTemplates.length,
    };
    const diagnosis = diagnoseLearner(state.learner, state.events);
    const decisions = rankTasks(buildCandidates(state.learner, diagnosis));
    const scaffold = generateScaffold(diagnosis);
    const ticket = evaluatePublication(diagnosis);
    const knowledgeBoundary = buildKnowledgeBoundaryReport(state, diagnosis, knowledgeSources);
    const pathNodes = buildPathTwin(state);
    const launchReadiness = buildLaunchReadinessReport(state);
    const cohortOps = buildCohortOpsReport(state);
    const pilotReadiness = buildPilotReadinessReport(state, cohortOps, launchReadiness);
    const privacyGuard = buildPrivacyGuardReport(state, pilotReadiness);
    const apiContract = buildApiContractReport(state, pilotReadiness, privacyGuard);
    const integrationSandbox = buildIntegrationSandboxReport(state, apiContract, privacyGuard);
    const researchEvidence = buildResearchEvidenceReport(state, decisions, knowledgeBoundary, ticket);
    const strategyLab = buildStrategyLabReport(state, decisions);
    const modelOps = buildModelOpsReport(state, researchEvidence, strategyLab, privacyGuard, apiContract);
    const valueUplift = buildValueUpliftReport(state, decisions, strategyLab, researchEvidence, cohortOps);
    const agentRuntime = buildAgentRuntimeReport(
      state,
      diagnosis,
      decisions,
      scaffold,
      ticket,
      knowledgeBoundary,
      privacyGuard,
      apiContract,
      modelOps,
      valueUplift,
    );
    const inferenceGateway = buildInferenceGatewayReport(
      state,
      diagnosis,
      decisions,
      scaffold,
      knowledgeBoundary,
      privacyGuard,
      apiContract,
      agentRuntime,
      modelOps,
    );
    const courseAuthoring = buildCourseAuthoringReport(
      state,
      knowledgeSources,
      pathNodes,
      privacyGuard,
      apiContract,
      modelOps,
    );
    const teacherReport = buildTeacherReport(
      state,
      cohortOps,
      courseAuthoring,
      privacyGuard,
      apiContract,
      modelOps,
      researchEvidence,
    );
    const interventionPlaybook = buildInterventionPlaybookReport(
      state,
      diagnosis,
      decisions,
      scaffold,
      ticket,
      teacherReport,
      valueUplift,
      apiContract,
      privacyGuard,
      modelOps,
    );

    expect(interventionPlaybook.score).toBeGreaterThanOrEqual(75);
    expect(interventionPlaybook.packages.map((item) => item.id)).toContain("student-scaffold-card");
    expect(interventionPlaybook.packages.map((item) => item.id)).toContain("paid-action-blocker");
    expect(interventionPlaybook.queue.map((item) => item.id)).toContain("approve-risk-ticket");
    expect(interventionPlaybook.channels.map((item) => item.path)).toContain("/api/interventions/rank");
    expect(interventionPlaybook.guardrails.map((item) => item.id)).toContain("no-direct-answer");
    expect(interventionPlaybook.releaseManifest).toContain("sepath-intervention-playbook.v1");
    expect(interventionPlaybook.teacherScript.join(" ")).toContain("完整答案");
    const awardReadiness = buildAwardReadinessReport(state, knowledgeBoundary, ticket, pathNodes);
    const judgeTrial = buildJudgeTrialReport(
      state,
      launchReadiness,
      awardReadiness,
      pilotReadiness,
      privacyGuard,
      apiContract,
      valueUplift,
    );
    const report = buildCourseLaunchReport(
      state,
      courseAuthoring,
      pilotReadiness,
      privacyGuard,
      apiContract,
      integrationSandbox,
      teacherReport,
      judgeTrial,
      agentRuntime,
    );

    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.launchSteps.map((step) => step.id)).toContain("first-class");
    expect(report.connectors.map((connector) => connector.id)).toContain("agent-runtime");
    expect(report.starterKit.map((item) => item.id)).toContain("course-manifest");
    expect(report.riskRegister.find((risk) => risk.id === "model-key")?.mitigation).toContain("确定性策略");
    expect(report.classroomManifest).toContain("sepath-course-launch.v1");
    expect(report.exportChecklist.join(" ")).toContain("第一周只做影子诊断");

    const submission = buildSubmissionOpsReport(
      state,
      launchReadiness,
      judgeTrial,
      report,
      awardReadiness,
      privacyGuard,
    );

    expect(submission.score).toBeGreaterThanOrEqual(70);
    expect(submission.requirements.map((item) => item.id)).toEqual([
      "project-plan",
      "source-demo",
      "demo-video",
      "zip-limit",
      "learning-agent",
    ]);
    expect(submission.artifacts.map((item) => item.id)).toContain("stage-zip");
    expect(submission.manualFields.map((item) => item.id)).toContain("team-profile");
    expect(submission.finalGateCommand).toBe("python scripts/release_gate.py");
    expect(submission.releaseBoundary).toContain("submission manifest");

    const pitch = buildPitchDirectorReport(
      state,
      awardReadiness,
      valueUplift,
      agentRuntime,
      report,
      teacherReport,
      judgeTrial,
      submission,
    );

    expect(pitch.score).toBeGreaterThanOrEqual(80);
    expect(pitch.durationSeconds).toBeGreaterThanOrEqual(180);
    expect(pitch.durationSeconds).toBeLessThanOrEqual(300);
    expect(pitch.segments.map((segment) => segment.id)).toContain("submission-close");
    expect(pitch.segments.map((segment) => segment.id)).toContain("runtime-governance");
    expect(pitch.voiceoverChecklist.map((item) => item.id)).toContain("human-voiceover");
    expect(pitch.shotCoverage.map((item) => item.id)).toContain("commercial-value");
    expect(pitch.riskControls.map((item) => item.guardrail).join(" ")).toContain("不宣称");
    expect(pitch.recordingManifest).toContain("sepath-pitch-director.v1");

    const telemetry = buildTrialTelemetryReport(
      state,
      pilotReadiness,
      privacyGuard,
      apiContract,
      valueUplift,
      teacherReport,
      researchEvidence,
    );

    expect(telemetry.score).toBeGreaterThanOrEqual(75);
    expect(telemetry.dataContract).toContain("learnerHash");
    expect(telemetry.streams.map((stream) => stream.id)).toContain("git-ci-events");
    expect(telemetry.streams.map((stream) => stream.id)).toContain("teacher-review");
    expect(telemetry.experimentArms.map((arm) => arm.id)).toContain("teacher-confirmed-sepath");
    expect(telemetry.validationPlan.map((step) => step.id)).toContain("teacher-confirmed-ab");
    expect(telemetry.outcomeMeasures.map((measure) => measure.id)).toContain("blocked-resolution-time");
    expect(telemetry.analysisDataset.map((dataset) => dataset.id)).toContain("trial-outcomes");
    expect(telemetry.analysisChecks.map((check) => check.id)).toContain("no-pii-export");
    expect(telemetry.analysisChecks.map((check) => check.id)).toContain("claim-tier-mapping");
    expect(telemetry.effectDecisionRules.map((rule) => rule.id)).toContain("controlled-effect");
    expect(telemetry.claimGates.find((gate) => gate.id === "real-score-claim")?.forbiddenClaim).toContain(
      "真实学校数据",
    );
    expect(telemetry.telemetryManifest).toContain("sepath-trial-telemetry.v1");
    expect(telemetry.telemetryManifest).toContain("trial-outcomes.csv");
    expect(telemetry.telemetryManifest).toContain("claim-tier-mapping");

    const calibration = buildRubricCalibrationReport(state, courseAuthoring, teacherReport, modelOps, telemetry);

    expect(calibration.score).toBeGreaterThanOrEqual(75);
    expect(calibration.anchorSamples.map((sample) => sample.id)).toContain("anchor-testing");
    expect(calibration.agreementChecks.map((check) => check.id)).toContain("teacher-ai-agreement");
    expect(calibration.releaseGates.map((gate) => gate.id)).toContain("teacher-anchor-gate");
    expect(calibration.driftChecks.map((check) => check.id)).toContain("agreement-drift");
    expect(calibration.exportPack.map((item) => item.id)).toContain("calibration-manifest");
    expect(calibration.calibrationManifest).toContain("sepath-rubric-calibration.v1");
    expect(calibration.calibrationManifest).toContain("teacherAnchor");

    const fusion = buildResearchFusionReport(
      state,
      courseAuthoring,
      strategyLab,
      researchEvidence,
      valueUplift,
      modelOps,
      calibration,
      telemetry,
    );

    expect(fusion.score).toBeGreaterThanOrEqual(80);
    expect(fusion.openSourceReferences.map((item) => item.id)).toContain("openedx");
    expect(fusion.openSourceReferences.map((item) => item.id)).toContain("langgraph");
    expect(fusion.algorithmContributions.map((item) => item.id)).toContain("safevoi");
    expect(fusion.algorithmContributions.map((item) => item.id)).toContain("rubric-calibration");
    expect(fusion.researchHypotheses.map((item) => item.id)).toContain("h2-calibration");
    expect(fusion.validationStages.map((item) => item.id)).toContain("teacher-confirmed-ab");
    expect(fusion.ideaMigration.map((item) => item.id)).toContain("path-value-engine");
    expect(fusion.ideaMigration.map((item) => item.id)).toContain("trial-evidence-ladder");
    expect(fusion.contributionGraph.map((item) => item.id)).toContain("telemetry-to-claims");
    expect(fusion.contributionEvidencePack.map((item) => item.id)).toContain("real-pilot-boundary");
    expect(fusion.fusionManifest).toContain("sepath-research-fusion.v1");
    expect(fusion.fusionManifest).toContain("contributionGraphIds");
    expect(fusion.fusionManifest).toContain("contributionEvidenceIds");
    expect(fusion.fusionManifest).toContain("Open-source projects are used as design references only");

    expect(inferenceGateway.score).toBeGreaterThanOrEqual(80);
    expect(inferenceGateway.gatewayUrl).toBe("/api/ai/generate-scaffold");
    expect(inferenceGateway.providers.find((provider) => provider.id === "edge-gateway")?.guardrail).toContain(
      "前端永不暴露密钥",
    );
    expect(inferenceGateway.guardrails.find((guardrail) => guardrail.id === "privacy-minimization")?.status).toBe(
      "ready",
    );
    expect(inferenceGateway.trace.map((step) => step.id)).toContain("fallback");
    expect(inferenceGateway.trace.map((step) => step.id)).toContain("llm-smoke");
    expect(inferenceGateway.trace.map((step) => step.id)).toContain("llm-http-smoke");
    expect(inferenceGateway.workerContract).toContain("llm-gateway-worker.mjs");
    expect(inferenceGateway.workerContract).toContain("cloud:smoke:llm");
    expect(inferenceGateway.workerContract).toContain("cloud:smoke:llm:http");
    expect(inferenceGateway.inferenceManifest).toContain("sepath-inference-gateway.v1");
    expect(inferenceGateway.inferenceManifest).toContain("llm-gateway-smoke-report.json");
    expect(inferenceGateway.inferenceManifest).toContain("llm-gateway-http-smoke-report.json");

    const tenantOps = buildTenantOpsReport(
      state,
      launchReadiness,
      pilotReadiness,
      privacyGuard,
      apiContract,
      courseAuthoring,
      report,
      telemetry,
    );

    expect(tenantOps.score).toBeGreaterThanOrEqual(80);
    expect(tenantOps.cloudMode).toContain("multi-tenant");
    expect(tenantOps.workspaces.map((workspace) => workspace.id)).toContain("school-tenant");
    expect(tenantOps.workspaces.find((workspace) => workspace.id === "school-tenant")?.isolationCheck).toContain(
      "learnerHash",
    );
    expect(tenantOps.roleScopes.map((scope) => scope.id)).toContain("competition-reviewer");
    expect(tenantOps.provisioning.map((step) => step.id)).toContain("tenant-bootstrap");
    expect(tenantOps.provisioning.map((step) => step.id)).toContain("rbac-policy");
    expect(tenantOps.costGuardrails.map((guardrail) => guardrail.id)).toContain("seat-quota");
    expect(tenantOps.slos.map((slo) => slo.id)).toContain("rollback-rto");
    expect(tenantOps.exportPack.map((item) => item.id)).toContain("tenant-manifest");
    expect(tenantOps.goLiveChecklist.join(" ")).toContain("TenantOps.tenantManifest");
    expect(tenantOps.tenantManifest).toContain("sepath-tenant-ops.v1");
    expect(tenantOps.tenantManifest).toContain("tenantId");
    expect(tenantOps.tenantManifest).toContain("learnerHash");

    const schoolProvisioning = buildSchoolProvisioningReport(
      state,
      privacyGuard,
      apiContract,
      tenantOps,
      report,
      judgeTrial,
      inferenceGateway,
    );

    expect(schoolProvisioning.score).toBeGreaterThanOrEqual(80);
    expect(schoolProvisioning.identityProviders.map((provider) => provider.id)).toContain("school-oidc");
    expect(schoolProvisioning.identityProviders.map((provider) => provider.id)).toContain("reviewer-access");
    expect(schoolProvisioning.demoAccounts.map((account) => account.id)).toContain("teacher-demo");
    expect(schoolProvisioning.demoAccounts.find((account) => account.id === "student-demo")?.deniedActions).toContain(
      "获得可直接提交完整答案",
    );
    expect(schoolProvisioning.gates.map((gate) => gate.id)).toContain("no-password-in-package");
    expect(schoolProvisioning.gates.map((gate) => gate.id)).toContain("model-secret-gate");
    expect(schoolProvisioning.playbooks.map((playbook) => playbook.id)).toContain("reviewer-five-minute");
    expect(schoolProvisioning.exportPack.map((item) => item.id)).toContain("judge-demo-seed");
    expect(schoolProvisioning.demoSeedManifestPath).toContain("JUDGE_DEMO_SEED_MANIFEST.json");
    expect(schoolProvisioning.demoSeedMaterialPath).toContain("47_评委试用账号与种子数据包.md");
    expect(schoolProvisioning.demoSeedCommand).toContain("generate_judge_demo_seed_pack.py");
    expect(schoolProvisioning.demoSeedRuntime).toBe("sepath-judge-demo-seed.v1");
    expect(schoolProvisioning.accountManifest).toContain("sepath-school-provisioning.v1");
    expect(schoolProvisioning.accountManifest).toContain("sepath-judge-demo-seed.v1");
    expect(schoolProvisioning.accountManifest).toContain("noRealPasswordsInPackage");

    const dataPlane = buildDataPlaneReport(
      state,
      privacyGuard,
      apiContract,
      tenantOps,
      schoolProvisioning,
      telemetry,
      inferenceGateway,
    );

    expect(dataPlane.score).toBeGreaterThanOrEqual(75);
    expect(dataPlane.tables.map((table) => table.name)).toContain("sepath_evidence_events");
    expect(dataPlane.tables.find((table) => table.id === "learners")?.piiPolicy).toContain("learnerHash");
    expect(dataPlane.migrations.map((migration) => migration.id)).toContain("rls-enable");
    expect(dataPlane.policies.map((policy) => policy.id)).toContain("tenant-rls");
    expect(dataPlane.policies.map((policy) => policy.id)).toContain("reviewer-readonly");
    expect(dataPlane.backups.map((backup) => backup.id)).toContain("daily-snapshot");
    expect(dataPlane.probes.map((probe) => probe.id)).toContain("write-dry-run");
    expect(dataPlane.env.find((item) => item.key === "OPENAI_API_KEY")?.exposedToBrowser).toBe(false);
    expect(dataPlane.ddlPreview).toContain("create table sepath_evidence_events");
    expect(dataPlane.dataPlaneManifest).toContain("sepath-data-plane.v1");
    expect(dataPlane.dataPlaneManifest).toContain("no real student PII in demo package");

    const pilotBinder = buildPilotEvidenceBinderReport(telemetry, privacyGuard, calibration, dataPlane);

    expect(pilotBinder.runtime).toBe("sepath-pilot-evidence-binder.v1");
    expect(pilotBinder.score).toBeGreaterThanOrEqual(70);
    expect(pilotBinder.consentPack.map((item) => item.id)).toContain("school-authorization");
    expect(pilotBinder.evidenceFreeze.map((item) => item.id)).toContain("telemetry-manifest-freeze");
    expect(pilotBinder.analysisGates.map((item) => item.id)).toContain("claim-tiering");
    expect(pilotBinder.claimTiers.map((tier) => tier.id)).toContain("tier-3-controlled-effect");
    expect(pilotBinder.exportPack.map((item) => item.id)).toContain("binder-machine-json");
    expect(pilotBinder.binderManifest).toContain("sepath-pilot-evidence-binder.v1");
    expect(pilotBinder.binderManifest).toContain("noRealScoreClaimBeforeControlledPilot");

    const finalSubmission = buildFinalSubmissionReport(
      submission,
      pitch,
      dataPlane,
      schoolProvisioning,
      privacyGuard,
    );

    expect(finalSubmission.score).toBeGreaterThanOrEqual(75);
    expect(finalSubmission.uploadRoutes.map((route) => route.id)).toContain("single-zip");
    expect(finalSubmission.uploadRoutes.map((route) => route.id)).toContain("split-fields");
    expect(finalSubmission.namedCopies.map((copy) => copy.id)).toContain("final-package");
    expect(finalSubmission.namedCopies.map((copy) => copy.id)).toContain("plan-pdf");
    expect(finalSubmission.dayChecklist.map((item) => item.id)).toContain("named-copy");
    expect(finalSubmission.rehearsalAnchors.map((anchor) => anchor.id)).toContain("data-plane");
    expect(finalSubmission.manualGates.map((gate) => gate.id)).toContain("team-profile");
    expect(finalSubmission.manualGates.map((gate) => gate.id)).toContain("access-policy");
    expect(finalSubmission.forbiddenClaims.map((claim) => claim.forbidden).join(" ")).toContain("真实成绩提升");
    expect(finalSubmission.packageSnapshot.map((item) => item.id)).toContain("zip-sha");
    expect(finalSubmission.packageSnapshot.find((item) => item.id === "zip-sha")?.value).toContain("package_sha256");
    expect(finalSubmission.packageSnapshot.find((item) => item.id === "plan-pdf-v02")?.value).toContain("v0.2.pdf");
    expect(finalSubmission.awardSprint.map((task) => task.id)).toContain("official-profile");
    expect(finalSubmission.awardSprint.map((task) => task.id)).toContain("teacher-shadow-pilot");
    expect(finalSubmission.commands.map((command) => command.command).join(" ")).toContain(
      "prepare_final_named_submission.py",
    );
    expect(finalSubmission.manifest).toContain("sepath-final-submission.v1");
    expect(finalSubmission.manifest).toContain("40_最终提交上传作战手册.md");
    expect(finalSubmission.manifest).toContain("packageSha256");
    expect(finalSubmission.manifest).toContain("awardSprintIds");

    const cloudHandoff = buildCloudHandoffReport(
      launchReadiness,
      judgeTrial,
      tenantOps,
      dataPlane,
      finalSubmission,
      privacyGuard,
      submission,
    );
    const cloudSlo = buildCloudSloReport(apiContract, inferenceGateway, dataPlane, cloudHandoff);
    const backendStatus = buildBackendStatusReport(
      apiContract,
      inferenceGateway,
      dataPlane,
      schoolProvisioning,
      telemetry,
      cloudHandoff,
      cloudSlo,
    );
    const hostingSelftest = buildHostingSelftestReport(cloudHandoff, finalSubmission);

    expect(cloudHandoff.score).toBeGreaterThanOrEqual(80);
    expect(cloudHandoff.targets.map((target) => target.id)).toContain("public-static-trial");
    expect(cloudHandoff.targets.map((target) => target.id)).toContain("pwa-offline-trial");
    expect(cloudHandoff.targets.map((target) => target.id)).toContain("cloud-slo-capacity");
    expect(cloudHandoff.targets.map((target) => target.id)).toContain("owner-only-sites");
    expect(cloudHandoff.targets.map((target) => target.id)).toContain("edge-api-runtime");
    expect(cloudHandoff.probes.map((probe) => probe.id)).toContain("anonymous-access-policy");
    expect(cloudHandoff.probes.map((probe) => probe.id)).toContain("pwa-offline");
    expect(cloudHandoff.probes.map((probe) => probe.id)).toContain("cloud-slo-load");
    expect(cloudHandoff.probes.map((probe) => probe.id)).toContain("edge-api-smoke");
    expect(cloudHandoff.probes.map((probe) => probe.id)).toContain("edge-api-http-smoke");
    expect(cloudHandoff.fallbackLanes.map((lane) => lane.id)).toContain("cloud-to-static");
    expect(cloudHandoff.fallbackLanes.map((lane) => lane.id)).toContain("network-to-pwa-cache");
    expect(cloudHandoff.manualGates.map((gate) => gate.id)).toContain("public-url-policy");
    expect(cloudHandoff.runbook.map((step) => step.id)).toContain("choose-access");
    expect(cloudHandoff.manifest).toContain("sepath-cloud-handoff.v1");
    expect(cloudHandoff.manifest).toContain("edgeApiSmokeTested");
    expect(cloudHandoff.manifest).toContain("edgeApiHttpSmokeTested");
    expect(cloudHandoff.manifest).toContain("edgeApiRbacTested");
    expect(cloudHandoff.manifest).toContain("edgeApiAuthTokenTested");
    expect(cloudHandoff.manifest).toContain("pwaOfflineTrial");
    expect(cloudHandoff.manifest).toContain("cloudSloTested");
    expect(cloudHandoff.manifest).toContain("publicUrlRequiresManualPolicy");
    expect(cloudSlo.score).toBeGreaterThanOrEqual(85);
    expect(cloudSlo.reportPath).toContain("cloud-slo-load-report.json");
    expect(cloudSlo.scenarios.map((scenario) => scenario.id)).toContain("llm-fallback-budget");
    expect(cloudSlo.fallbacks.map((fallback) => fallback.id)).toContain("network-offline");
    expect(cloudSlo.manifest).toContain("sepath-cloud-slo.v1");
    expect(backendStatus.runtime).toBe("sepath-backend-status-center.v1");
    expect(backendStatus.score).toBeGreaterThanOrEqual(75);
    expect(backendStatus.lanes.map((lane) => lane.id)).toContain("edge-api");
    expect(backendStatus.lanes.map((lane) => lane.id)).toContain("llm-gateway");
    expect(backendStatus.lanes.map((lane) => lane.id)).toContain("postgres-rls");
    expect(backendStatus.checks.map((check) => check.id)).toContain("edge-smoke");
    expect(backendStatus.dataFlow.map((step) => step.id)).toContain("edge-to-db");
    expect(backendStatus.manifest).toContain("databaseRequiresAuthorization");
    expect(hostingSelftest.runtime).toBe("sepath-hosting-selftest-center.v1");
    expect(hostingSelftest.score).toBeGreaterThanOrEqual(85);
    expect(hostingSelftest.providers.map((provider) => provider.id)).toContain("netlify-drop");
    expect(hostingSelftest.providers.map((provider) => provider.id)).toContain("cloudflare-pages");
    expect(hostingSelftest.providers.map((provider) => provider.id)).toContain("openai-sites-recovery");
    expect(hostingSelftest.artifactChecks.map((check) => check.id)).toContain("health-release");
    expect(hostingSelftest.artifactChecks.map((check) => check.id)).toContain("sites-preflight");
    expect(hostingSelftest.runbook.map((step) => step.id)).toContain("final-receipt");
    expect(hostingSelftest.manifest).toContain("#hosting-selftest");
    expect(hostingSelftest.manifest).toContain("project_not_found_requires_recovery_or_static_public_url");

    const closurePending = buildSubmissionClosureReport("", hostingSelftest, finalSubmission);
    const closureReady = buildSubmissionClosureReport("https://demo.sepath.example", hostingSelftest, finalSubmission);

    expect(closurePending.runtime).toBe("sepath-submission-closure-console.v1");
    expect(closurePending.gates.find((gate) => gate.id === "final-public-url-receipt")?.status).toBe("manual");
    expect(closurePending.gates.find((gate) => gate.id === "team-profile")?.status).toBe("manual");
    expect(closurePending.manifest).toContain("material71");
    expect(closureReady.gates.find((gate) => gate.id === "final-public-url-receipt")?.status).toBe("ready");
    expect(closureReady.commands.map((command) => command.command).join(" ")).toContain(
      "finalize_submission_after_public_url.py",
    );

    const judgeVerification = buildJudgeVerificationReport(
      cloudHandoff,
      finalSubmission,
      submission,
      awardReadiness,
      valueUplift,
      cloudSlo,
      backendStatus,
      hostingSelftest,
    );
    const finalDefense = buildFinalDefenseReport(pitch, finalSubmission, judgeVerification, backendStatus);
    const reviewerDrill = buildReviewerDrillReport(
      judgeTrial,
      teacherReport,
      cloudHandoff,
      cloudSlo,
      judgeVerification,
      backendStatus,
    );
    const reviewerGuide = buildReviewerGuideReport(reviewerDrill);
    const launchLoop = buildLaunchLoopAcceptanceReport(
      judgeTrial,
      judgeVerification,
      finalSubmission,
      backendStatus,
      cloudSlo,
      reviewerDrill,
      finalDefense,
    );

    expect(judgeVerification.score).toBeGreaterThanOrEqual(80);
    expect(judgeVerification.proofs.map((proof) => proof.id)).toContain("edge-direct");
    expect(judgeVerification.proofs.map((proof) => proof.id)).toContain("edge-http");
    expect(judgeVerification.proofs.map((proof) => proof.id)).toContain("llm-gateway");
    expect(judgeVerification.proofs.map((proof) => proof.id)).toContain("llm-gateway-http");
    expect(judgeVerification.proofs.map((proof) => proof.id)).toContain("cloud-slo");
    expect(judgeVerification.proofs.map((proof) => proof.id)).toContain("backend-status");
    expect(judgeVerification.proofs.map((proof) => proof.id)).toContain("hosting-selftest");
    const auditProof = judgeVerification.proofs.find((proof) => proof.id === "audit");
    expect(auditProof?.evidence).toContain("0 FAIL");
    expect(auditProof?.evidence).not.toContain("94 PASS");
    expect(judgeVerification.verificationPackPath).toContain("46_");
    expect(judgeVerification.verificationPackPath).toContain(".md");
    expect(judgeVerification.manifest).toContain("sepath-judge-verification.v1");
    expect(judgeVerification.manifest).toContain("edge-direct");
    expect(finalDefense.runtime).toBe("sepath-final-defense-command-center.v1");
    expect(finalDefense.score).toBeGreaterThanOrEqual(80);
    expect(finalDefense.challengeCards.map((card) => card.id)).toContain("why-not-chatbot");
    expect(finalDefense.challengeCards.map((card) => card.id)).toContain("backend-boundary");
    expect(finalDefense.evidenceRoutes.map((route) => route.productAnchor)).toContain("#final-defense");
    expect(finalDefense.forbiddenLines.map((line) => line.id)).toContain("real-student-data");
    expect(finalDefense.manifest).toContain("sepath-final-defense-command-center.v1");
    expect(reviewerDrill.runtime).toBe("sepath-reviewer-drill.v1");
    expect(reviewerDrill.score).toBeGreaterThanOrEqual(85);
    expect(reviewerDrill.durationSeconds).toBe(300);
    expect(reviewerDrill.steps.map((step) => step.id)).toContain("inspect-teacher-gate");
    expect(reviewerDrill.steps.map((step) => step.id)).toContain("inspect-cloud");
    expect(reviewerDrill.steps.map((step) => step.id)).toContain("inspect-submission-closure");
    expect(reviewerDrill.steps.map((step) => step.id)).toContain("inspect-backend-status");
    expect(reviewerDrill.steps.map((step) => step.id)).toContain("inspect-claim-ledger");
    expect(reviewerDrill.checkpoints.map((checkpoint) => checkpoint.id)).toContain("reviewer-drill");
    expect(reviewerDrill.manifest).toContain("reviewer-drill-panel.png");
    expect(reviewerGuide.runtime).toBe("sepath-reviewer-guide.v1");
    expect(reviewerGuide.totalSteps).toBe(reviewerDrill.steps.length);
    expect(reviewerGuide.totalSeconds).toBe(300);
    expect(reviewerGuide.quickTotalSeconds).toBe(60);
    expect(reviewerGuide.quickSteps).toHaveLength(6);
    expect(reviewerGuide.firstAnchor).toBe("#student");
    expect(reviewerGuide.quickSteps.map((step) => step.sourceStepId)).toEqual([
      "open-trial",
      "run-loop",
      "inspect-teacher-gate",
      "inspect-algorithm",
      "inspect-cloud",
      "answer-boundary",
    ]);
    expect(reviewerGuide.steps.map((step) => step.productAnchor)).toContain("#cloud-slo");
    expect(reviewerGuide.steps.map((step) => step.productAnchor)).toContain("#backend-status");
    expect(reviewerGuide.steps.map((step) => step.productAnchor)).toContain("#claim-ledger");
    expect(reviewerGuide.steps.map((step) => step.productAnchor)).toContain("#launch-loop");
    expect(reviewerGuide.actions.map((action) => action.id)).toEqual(["start", "step-through", "close"]);
    expect(reviewerGuide.manifest).toContain("autoScrollAnchors");
    expect(launchLoop.runtime).toBe("sepath-launch-loop-acceptance.v1");
    expect(launchLoop.score).toBeGreaterThanOrEqual(90);
    expect(launchLoop.stages.map((stage) => stage.id)).toContain("event-ledger");
    expect(launchLoop.stages.map((stage) => stage.productAnchor)).toContain("#backend-status");
    expect(launchLoop.gates).toHaveLength(5);
    expect(launchLoop.metrics.find((metric) => metric.id === "release-evidence")?.value).toContain("0 FAIL");
    expect(launchLoop.manifest).toContain("56_上线级闭环验收剧本");

    const claimLedger = buildClaimEvidenceLedgerReport(
      state,
      valueUplift,
      telemetry,
      pilotBinder,
      fusion,
      reviewerDrill,
      judgeVerification,
      launchLoop,
    );

    expect(claimLedger.runtime).toBe("sepath-claim-evidence-ledger.v1");
    expect(claimLedger.productAnchor).toBe("#claim-ledger");
    expect(claimLedger.score).toBeGreaterThanOrEqual(80);
    expect(claimLedger.claims.length).toBeGreaterThanOrEqual(9);
    expect(claimLedger.claimTiers.map((tier) => tier.id)).toEqual(["L0", "L1", "L2", "L3"]);
    expect(claimLedger.claims.find((claim) => claim.id === "real-pilot-boundary")?.tier).toBe("L1");
    expect(claimLedger.forbiddenClaims.map((claim) => claim.id)).toContain("no-causal-uplift");
    expect(claimLedger.truthBoundary).toContain("does not upgrade L0/L1");
    expect(claimLedger.manifest).toContain("product_visible_claim_to_evidence_traceability");
    expect(claimLedger.claims.flatMap((claim) => claim.evidencePaths.map((item) => item.path))).toContain(
      "sepath-cloud-app/src/engine/claimEvidenceLedger.ts",
    );

    const competitionAlignment = buildCompetitionAlignmentReport(
      awardReadiness,
      claimLedger,
      finalSubmission,
      hostingSelftest,
      judgeVerification,
    );

    expect(competitionAlignment.runtime).toBe("sepath-competition-alignment-center.v1");
    expect(competitionAlignment.score).toBeGreaterThanOrEqual(90);
    expect(competitionAlignment.coreCapabilities.map((item) => item.requirement)).toEqual([
      "学情诊断",
      "路径规划",
      "实时干预",
      "记忆与反思",
    ]);
    expect(competitionAlignment.preliminaryScores.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
    expect(competitionAlignment.finalScores.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
    expect(competitionAlignment.submissionRequirements.map((item) => item.id)).toContain("public-delivery");
    expect(competitionAlignment.manifest).toContain("#competition-alignment");
    expect(competitionAlignment.materialPath).toContain("69_赛题要求逐项对齐矩阵");
  });
});
