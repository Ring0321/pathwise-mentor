import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Cloud,
  DatabaseZap,
  FileCheck2,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  MonitorPlay,
  Play,
  RotateCcw,
  SearchCheck,
  ServerCog,
  Settings2,
  Shield,
  UserCircle2,
  Users,
  X,
} from "lucide-react";
import { AwardReadinessPanel } from "./components/AwardReadinessPanel";
import { AgentRuntimePanel } from "./components/AgentRuntimePanel";
import { BackendStatusPanel } from "./components/BackendStatusPanel";
import { ApiContractPanel } from "./components/ApiContractPanel";
import { ClaimEvidenceLedgerPanel } from "./components/ClaimEvidenceLedgerPanel";
import { ClosedLoopDemoPanel } from "./components/ClosedLoopDemoPanel";
import { CloudHandoffPanel } from "./components/CloudHandoffPanel";
import { CloudSloPanel } from "./components/CloudSloPanel";
import { CohortOpsPanel } from "./components/CohortOpsPanel";
import { CompetitionAlignmentPanel } from "./components/CompetitionAlignmentPanel";
import { CompetencyPanel } from "./components/CompetencyPanel";
import { CourseAuthoringPanel } from "./components/CourseAuthoringPanel";
import { CourseLaunchPanel } from "./components/CourseLaunchPanel";
import { DataPlanePanel } from "./components/DataPlanePanel";
import { DecisionPanel } from "./components/DecisionPanel";
import { EvidenceCapturePanel, type ManualEvidenceInput } from "./components/EvidenceCapturePanel";
import { EvidenceTimeline } from "./components/EvidenceTimeline";
import { FinalDefensePanel } from "./components/FinalDefensePanel";
import { FinalSubmissionPanel } from "./components/FinalSubmissionPanel";
import { HostingSelftestPanel } from "./components/HostingSelftestPanel";
import { IntegrationSandboxPanel } from "./components/IntegrationSandboxPanel";
import { InterventionPlaybookPanel } from "./components/InterventionPlaybookPanel";
import { InferenceGatewayPanel } from "./components/InferenceGatewayPanel";
import { JudgeTrialPanel } from "./components/JudgeTrialPanel";
import { JudgeVerificationPanel } from "./components/JudgeVerificationPanel";
import { KnowledgeBoundaryPanel } from "./components/KnowledgeBoundaryPanel";
import { LaunchLoopAcceptancePanel } from "./components/LaunchLoopAcceptancePanel";
import { LaunchReadinessPanel } from "./components/LaunchReadinessPanel";
import { MetricCard } from "./components/MetricCard";
import { ModelOpsPanel } from "./components/ModelOpsPanel";
import { PathBoard } from "./components/PathBoard";
import { PilotEvidenceBinderPanel } from "./components/PilotEvidenceBinderPanel";
import { PilotReadinessPanel } from "./components/PilotReadinessPanel";
import { PitchDirectorPanel } from "./components/PitchDirectorPanel";
import { PrivacyGuardPanel } from "./components/PrivacyGuardPanel";
import { PublicUrlReceiptPanel } from "./components/PublicUrlReceiptPanel";
import { ResearchEvidencePanel } from "./components/ResearchEvidencePanel";
import { ResearchFusionPanel } from "./components/ResearchFusionPanel";
import { RealWorkOrderPanel } from "./components/RealWorkOrderPanel";
import { RepositoryImportPanel } from "./components/RepositoryImportPanel";
import { ReviewerDrillPanel } from "./components/ReviewerDrillPanel";
import { ReviewerGuideOverlay } from "./components/ReviewerGuideOverlay";
import { RubricCalibrationPanel } from "./components/RubricCalibrationPanel";
import { SchoolProvisioningPanel } from "./components/SchoolProvisioningPanel";
import { StrategyLabPanel } from "./components/StrategyLabPanel";
import { StudentDialoguePanel } from "./components/StudentDialoguePanel";
import { SubmissionClosurePanel } from "./components/SubmissionClosurePanel";
import { SubmissionOpsPanel } from "./components/SubmissionOpsPanel";
import { TeacherConsole } from "./components/TeacherConsole";
import { TeacherReportPanel } from "./components/TeacherReportPanel";
import { TenantOpsPanel } from "./components/TenantOpsPanel";
import { TracePanel } from "./components/TracePanel";
import { TrialTelemetryPanel } from "./components/TrialTelemetryPanel";
import { ValueUpliftPanel } from "./components/ValueUpliftPanel";
import { knowledgeSources } from "./data/seed";
import { buildApiContractReport } from "./engine/apiContract";
import { buildAgentRuntimeReport } from "./engine/agentRuntime";
import { buildAwardReadinessReport } from "./engine/awardReadiness";
import { buildBackendStatusReport } from "./engine/backendStatus";
import { buildClaimEvidenceLedgerReport } from "./engine/claimEvidenceLedger";
import { buildClosedLoopDemoReport } from "./engine/closedLoopDemo";
import { buildCloudHandoffReport } from "./engine/cloudHandoff";
import { buildCloudSloReport } from "./engine/cloudSlo";
import { buildCohortOpsReport } from "./engine/cohortOps";
import { buildCompetitionAlignmentReport } from "./engine/competitionAlignment";
import { buildCourseAuthoringReport } from "./engine/courseAuthoring";
import { buildCourseLaunchReport } from "./engine/courseLaunch";
import { buildDataPlaneReport } from "./engine/dataPlane";
import { buildFinalDefenseReport } from "./engine/finalDefense";
import { buildFinalSubmissionReport } from "./engine/finalSubmission";
import { buildHostingSelftestReport } from "./engine/hostingSelftest";
import { buildCandidates, rankTasks } from "./engine/safeVoi";
import { buildAwardSummary } from "./engine/summary";
import { buildKnowledgeBoundaryReport } from "./engine/knowledgeBoundary";
import { importLedgerPayload } from "./engine/ledgerExchange";
import { buildLaunchReadinessReport } from "./engine/launchReadiness";
import { buildModelOpsReport } from "./engine/modelOps";
import { buildPathTwin } from "./engine/pathTwin";
import { buildPilotEvidenceBinderReport } from "./engine/pilotEvidenceBinder";
import { buildPilotReadinessReport } from "./engine/pilotReadiness";
import { buildPitchDirectorReport } from "./engine/pitchDirector";
import { buildPrivacyGuardReport } from "./engine/privacyGuard";
import { buildResearchEvidenceReport } from "./engine/researchEvidence";
import { buildResearchFusionReport } from "./engine/researchFusion";
import {
  buildRealWorkOrderReport,
  defaultRealWorkOrderInput,
  type RealWorkOrderInput,
} from "./engine/realWorkOrder";
import { buildReviewerDrillReport, buildReviewerGuideReport } from "./engine/reviewerDrill";
import { buildRubricCalibrationReport } from "./engine/rubricCalibration";
import { buildSchoolProvisioningReport } from "./engine/schoolProvisioning";
import { buildStrategyLabReport } from "./engine/strategyLab";
import {
  buildStudentDialogueReport,
  createStudentDialogueEvents,
  type StudentDialogueTurn,
} from "./engine/studentDialogue";
import { buildSubmissionOpsReport } from "./engine/submissionOps";
import { buildTeacherReport } from "./engine/teacherReport";
import { buildTenantOpsReport } from "./engine/tenantOps";
import { buildTrialTelemetryReport } from "./engine/trialTelemetry";
import { buildTraces } from "./engine/traces";
import { diagnoseLearner } from "./engine/diagnosis";
import { evaluatePublication } from "./engine/reviewGate";
import { generateScaffold } from "./engine/scaffold";
import { loadState, resetState, runAllDemoSteps, runNextDemoStep, saveState } from "./engine/demoOrchestrator";
import { evidenceCoverage, scoreCompetencies } from "./engine/evidence";
import { mergeEvidenceEvents } from "./engine/eventIngestion";
import { buildIntegrationSandboxReport } from "./engine/integrationSandbox";
import { buildInterventionPlaybookReport } from "./engine/interventionPlaybook";
import { buildInferenceGatewayReport } from "./engine/inferenceGateway";
import { buildJudgeTrialReport } from "./engine/judgeTrial";
import { buildJudgeVerificationReport } from "./engine/judgeVerification";
import { buildLaunchLoopAcceptanceReport } from "./engine/launchLoopAcceptance";
import { buildValueUpliftReport } from "./engine/valueUplift";
import type { EvidenceEvent } from "./domain/types";

const demoStepLabels = [
  "提交失败 PR",
  "学生请求完整代码",
  "推送脚手架提示",
  "学生修复并通过 CI",
  "教师复核放行",
  "生成反思记忆",
];

const sidebarGroups = [
  {
    title: "主流程",
    links: [
      { href: "#student", label: "工作台", icon: <LayoutDashboard size={18} /> },
      { href: "#closed-loop", label: "工单", icon: <FileCheck2 size={18} /> },
      { href: "#dialogue", label: "学生", icon: <Users size={18} /> },
      { href: "#teacher", label: "复核", icon: <SearchCheck size={18} /> },
      { href: "#value", label: "统计", icon: <Gauge size={18} /> },
      { href: "#ops-appendix", label: "设置", icon: <Settings2 size={18} /> },
    ],
  },
];

const demoScriptSteps = [
  {
    time: "00-08s",
    title: "定位：不是聊天框，是证据工单",
    body: "指出失败 PR、high 风险、证据覆盖和闭环阶段，强调系统先读 Git、CI、对话和 Rubric 再行动。",
  },
  {
    time: "08-24s",
    title: "演示：一键跑通六步闭环",
    body: "点击自动推进闭环，展示诊断、门禁、脚手架、验证、教师复核和反思记忆都写入证据链。",
  },
  {
    time: "24-34s",
    title: "边界：AI 给脚手架，教师管发布",
    body: "说明系统不替学生写完整答案，只给可回滚、可复核的下一步，高风险建议进入教师门禁。",
  },
  {
    time: "34-45s",
    title: "创新：路径数字学生 + SafeVOI",
    body: "把路径数字学生、SafeVOI 行动排序、Rubric 校准和学习增值评估连起来，证明不是普通答疑助手。",
  },
  {
    time: "45-54s",
    title: "上线：有 SLO、API 和导出账本",
    body: "用云交付、SLO、OpenAPI、PWA 兜底和证据账本说明它具备上线验收骨架。",
  },
  {
    time: "54-60s",
    title: "收口：已验证和待试点分清",
    body: "最后强调当前演示使用合成数据，真实提分必须等学校授权试点，可信度来自边界清楚。",
  },
];

function App() {
  const [state, setState] = useState(loadState);
  const [reviewerGuideActive, setReviewerGuideActive] = useState(false);
  const [reviewerGuideStep, setReviewerGuideStep] = useState(0);
  const [ledgerExportedAt, setLedgerExportedAt] = useState<string | null>(null);
  const [claimLedgerReviewedAt, setClaimLedgerReviewedAt] = useState<string | null>(null);
  const [submissionCheckedAt, setSubmissionCheckedAt] = useState<string | null>(null);
  const [demoScriptOpen, setDemoScriptOpen] = useState(false);
  const [realWorkOrderInput, setRealWorkOrderInput] = useState<RealWorkOrderInput>(defaultRealWorkOrderInput);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const scores = useMemo(() => scoreCompetencies(state.learner.baseline, state.events), [state]);
  const diagnosis = useMemo(() => diagnoseLearner(state.learner, state.events), [state]);
  const decisions = useMemo(
    () => rankTasks(buildCandidates(state.learner, diagnosis)),
    [diagnosis, state.learner],
  );
  const scaffold = useMemo(() => generateScaffold(diagnosis), [diagnosis]);
  const reviewTicket = useMemo(() => evaluatePublication(diagnosis), [diagnosis]);
  const knowledgeBoundary = useMemo(
    () => buildKnowledgeBoundaryReport(state, diagnosis, knowledgeSources),
    [diagnosis, state],
  );
  const studentDialogue = useMemo(
    () => buildStudentDialogueReport(state, diagnosis, knowledgeBoundary, scaffold, reviewTicket),
    [diagnosis, knowledgeBoundary, reviewTicket, scaffold, state],
  );
  const pathNodes = useMemo(() => buildPathTwin(state), [state]);
  const traces = useMemo(() => buildTraces(state), [state]);
  const awardReadiness = useMemo(
    () => buildAwardReadinessReport(state, knowledgeBoundary, reviewTicket, pathNodes),
    [knowledgeBoundary, pathNodes, reviewTicket, state],
  );
  const researchEvidence = useMemo(
    () => buildResearchEvidenceReport(state, decisions, knowledgeBoundary, reviewTicket),
    [decisions, knowledgeBoundary, reviewTicket, state],
  );
  const launchReadiness = useMemo(() => buildLaunchReadinessReport(state), [state]);
  const cohortOps = useMemo(() => buildCohortOpsReport(state), [state]);
  const strategyLab = useMemo(() => buildStrategyLabReport(state, decisions), [decisions, state]);
  const valueUplift = useMemo(
    () => buildValueUpliftReport(state, decisions, strategyLab, researchEvidence, cohortOps),
    [cohortOps, decisions, researchEvidence, state, strategyLab],
  );
  const pilotReadiness = useMemo(
    () => buildPilotReadinessReport(state, cohortOps, launchReadiness),
    [cohortOps, launchReadiness, state],
  );
  const privacyGuard = useMemo(() => buildPrivacyGuardReport(state, pilotReadiness), [pilotReadiness, state]);
  const apiContract = useMemo(
    () => buildApiContractReport(state, pilotReadiness, privacyGuard),
    [pilotReadiness, privacyGuard, state],
  );
  const integrationSandbox = useMemo(
    () => buildIntegrationSandboxReport(state, apiContract, privacyGuard),
    [apiContract, privacyGuard, state],
  );
  const modelOps = useMemo(
    () => buildModelOpsReport(state, researchEvidence, strategyLab, privacyGuard, apiContract),
    [apiContract, privacyGuard, researchEvidence, state, strategyLab],
  );
  const agentRuntime = useMemo(
    () =>
      buildAgentRuntimeReport(
        state,
        diagnosis,
        decisions,
        scaffold,
        reviewTicket,
        knowledgeBoundary,
        privacyGuard,
        apiContract,
        modelOps,
        valueUplift,
      ),
    [
      apiContract,
      decisions,
      diagnosis,
      knowledgeBoundary,
      modelOps,
      privacyGuard,
      reviewTicket,
      scaffold,
      state,
      valueUplift,
    ],
  );
  const inferenceGateway = useMemo(
    () =>
      buildInferenceGatewayReport(
        state,
        diagnosis,
        decisions,
        scaffold,
        knowledgeBoundary,
        privacyGuard,
        apiContract,
        agentRuntime,
        modelOps,
      ),
    [
      agentRuntime,
      apiContract,
      decisions,
      diagnosis,
      knowledgeBoundary,
      modelOps,
      privacyGuard,
      scaffold,
      state,
    ],
  );
  const courseAuthoring = useMemo(
    () => buildCourseAuthoringReport(state, knowledgeSources, pathNodes, privacyGuard, apiContract, modelOps),
    [apiContract, modelOps, pathNodes, privacyGuard, state],
  );
  const teacherReport = useMemo(
    () => buildTeacherReport(state, cohortOps, courseAuthoring, privacyGuard, apiContract, modelOps, researchEvidence),
    [apiContract, cohortOps, courseAuthoring, modelOps, privacyGuard, researchEvidence, state],
  );
  const interventionPlaybook = useMemo(
    () =>
      buildInterventionPlaybookReport(
        state,
        diagnosis,
        decisions,
        scaffold,
        reviewTicket,
        teacherReport,
        valueUplift,
        apiContract,
        privacyGuard,
        modelOps,
      ),
    [apiContract, decisions, diagnosis, modelOps, privacyGuard, reviewTicket, scaffold, state, teacherReport, valueUplift],
  );
  const closedLoopDemo = useMemo(
    () =>
      buildClosedLoopDemoReport({
        state,
        diagnosis,
        decisions,
        scaffold,
        reviewTicket,
        pathNodes,
        teacherReport,
        valueUplift,
      }),
    [decisions, diagnosis, pathNodes, reviewTicket, scaffold, state, teacherReport, valueUplift],
  );
  const trialTelemetry = useMemo(
    () =>
      buildTrialTelemetryReport(
        state,
        pilotReadiness,
        privacyGuard,
        apiContract,
        valueUplift,
        teacherReport,
        researchEvidence,
      ),
    [apiContract, pilotReadiness, privacyGuard, researchEvidence, state, teacherReport, valueUplift],
  );
  const rubricCalibration = useMemo(
    () => buildRubricCalibrationReport(state, courseAuthoring, teacherReport, modelOps, trialTelemetry),
    [courseAuthoring, modelOps, state, teacherReport, trialTelemetry],
  );
  const researchFusion = useMemo(
    () =>
      buildResearchFusionReport(
        state,
        courseAuthoring,
        strategyLab,
        researchEvidence,
        valueUplift,
        modelOps,
        rubricCalibration,
        trialTelemetry,
      ),
    [
      courseAuthoring,
      modelOps,
      researchEvidence,
      rubricCalibration,
      state,
      strategyLab,
      trialTelemetry,
      valueUplift,
    ],
  );
  const judgeTrial = useMemo(
    () =>
      buildJudgeTrialReport(
        state,
        launchReadiness,
        awardReadiness,
        pilotReadiness,
        privacyGuard,
        apiContract,
        valueUplift,
      ),
    [apiContract, awardReadiness, launchReadiness, pilotReadiness, privacyGuard, state, valueUplift],
  );
  const courseLaunch = useMemo(
    () =>
      buildCourseLaunchReport(
        state,
        courseAuthoring,
        pilotReadiness,
        privacyGuard,
        apiContract,
        integrationSandbox,
        teacherReport,
        judgeTrial,
        agentRuntime,
      ),
    [
      agentRuntime,
      apiContract,
      courseAuthoring,
      integrationSandbox,
      judgeTrial,
      pilotReadiness,
      privacyGuard,
      state,
      teacherReport,
    ],
  );
  const tenantOps = useMemo(
    () =>
      buildTenantOpsReport(
        state,
        launchReadiness,
        pilotReadiness,
        privacyGuard,
        apiContract,
        courseAuthoring,
        courseLaunch,
        trialTelemetry,
      ),
    [
      apiContract,
      courseAuthoring,
      courseLaunch,
      launchReadiness,
      pilotReadiness,
      privacyGuard,
      state,
      trialTelemetry,
    ],
  );
  const schoolProvisioning = useMemo(
    () =>
      buildSchoolProvisioningReport(
        state,
        privacyGuard,
        apiContract,
        tenantOps,
        courseLaunch,
        judgeTrial,
        inferenceGateway,
      ),
    [apiContract, courseLaunch, inferenceGateway, judgeTrial, privacyGuard, state, tenantOps],
  );
  const dataPlane = useMemo(
    () =>
      buildDataPlaneReport(
        state,
        privacyGuard,
        apiContract,
        tenantOps,
        schoolProvisioning,
        trialTelemetry,
        inferenceGateway,
      ),
    [apiContract, inferenceGateway, privacyGuard, schoolProvisioning, state, tenantOps, trialTelemetry],
  );
  const pilotEvidenceBinder = useMemo(
    () => buildPilotEvidenceBinderReport(trialTelemetry, privacyGuard, rubricCalibration, dataPlane),
    [dataPlane, privacyGuard, rubricCalibration, trialTelemetry],
  );
  const submissionOps = useMemo(
    () => buildSubmissionOpsReport(state, launchReadiness, judgeTrial, courseLaunch, awardReadiness, privacyGuard),
    [awardReadiness, courseLaunch, judgeTrial, launchReadiness, privacyGuard, state],
  );
  const pitchDirector = useMemo(
    () =>
      buildPitchDirectorReport(
        state,
        awardReadiness,
        valueUplift,
        agentRuntime,
        courseLaunch,
        teacherReport,
        judgeTrial,
        submissionOps,
      ),
    [agentRuntime, awardReadiness, courseLaunch, judgeTrial, state, submissionOps, teacherReport, valueUplift],
  );
  const finalSubmission = useMemo(
    () => buildFinalSubmissionReport(submissionOps, pitchDirector, dataPlane, schoolProvisioning, privacyGuard),
    [dataPlane, pitchDirector, privacyGuard, schoolProvisioning, submissionOps],
  );
  const cloudHandoff = useMemo(
    () =>
      buildCloudHandoffReport(
        launchReadiness,
        judgeTrial,
        tenantOps,
        dataPlane,
        finalSubmission,
        privacyGuard,
        submissionOps,
      ),
    [dataPlane, finalSubmission, judgeTrial, launchReadiness, privacyGuard, submissionOps, tenantOps],
  );
  const hostingSelftest = useMemo(
    () => buildHostingSelftestReport(cloudHandoff, finalSubmission),
    [cloudHandoff, finalSubmission],
  );
  const cloudSlo = useMemo(
    () => buildCloudSloReport(apiContract, inferenceGateway, dataPlane, cloudHandoff),
    [apiContract, cloudHandoff, dataPlane, inferenceGateway],
  );
  const backendStatus = useMemo(
    () =>
      buildBackendStatusReport(
        apiContract,
        inferenceGateway,
        dataPlane,
        schoolProvisioning,
        trialTelemetry,
        cloudHandoff,
        cloudSlo,
      ),
    [apiContract, cloudHandoff, cloudSlo, dataPlane, inferenceGateway, schoolProvisioning, trialTelemetry],
  );
  const judgeVerification = useMemo(
    () =>
      buildJudgeVerificationReport(
        cloudHandoff,
        finalSubmission,
        submissionOps,
        awardReadiness,
        valueUplift,
        cloudSlo,
        backendStatus,
        hostingSelftest,
      ),
    [awardReadiness, backendStatus, cloudHandoff, cloudSlo, finalSubmission, hostingSelftest, submissionOps, valueUplift],
  );
  const finalDefense = useMemo(
    () => buildFinalDefenseReport(pitchDirector, finalSubmission, judgeVerification, backendStatus),
    [backendStatus, finalSubmission, judgeVerification, pitchDirector],
  );
  const reviewerDrill = useMemo(
    () => buildReviewerDrillReport(judgeTrial, teacherReport, cloudHandoff, cloudSlo, judgeVerification, backendStatus),
    [backendStatus, cloudHandoff, cloudSlo, judgeTrial, judgeVerification, teacherReport],
  );
  const reviewerGuide = useMemo(() => buildReviewerGuideReport(reviewerDrill), [reviewerDrill]);
  const activeReviewerGuideSteps =
    reviewerGuide.quickSteps.length > 0 ? reviewerGuide.quickSteps : reviewerGuide.steps;
  const launchLoopAcceptance = useMemo(
    () =>
      buildLaunchLoopAcceptanceReport(
        judgeTrial,
        judgeVerification,
        finalSubmission,
        backendStatus,
        cloudSlo,
        reviewerDrill,
        finalDefense,
      ),
    [backendStatus, cloudSlo, finalDefense, finalSubmission, judgeTrial, judgeVerification, reviewerDrill],
  );
  const claimEvidenceLedger = useMemo(
    () =>
      buildClaimEvidenceLedgerReport(
        state,
        valueUplift,
        trialTelemetry,
        pilotEvidenceBinder,
        researchFusion,
        reviewerDrill,
        judgeVerification,
        launchLoopAcceptance,
      ),
    [
      judgeVerification,
      launchLoopAcceptance,
      pilotEvidenceBinder,
      researchFusion,
      reviewerDrill,
      state,
      trialTelemetry,
      valueUplift,
    ],
  );
  const competitionAlignment = useMemo(
    () =>
      buildCompetitionAlignmentReport(
        awardReadiness,
        claimEvidenceLedger,
        finalSubmission,
        hostingSelftest,
        judgeVerification,
      ),
    [awardReadiness, claimEvidenceLedger, finalSubmission, hostingSelftest, judgeVerification],
  );

  useEffect(() => {
    if (!reviewerGuideActive) return;
    const anchor = activeReviewerGuideSteps[reviewerGuideStep]?.productAnchor;
    const target = anchor ? document.querySelector(anchor) : null;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeReviewerGuideSteps, reviewerGuideActive, reviewerGuideStep]);

  const summary = useMemo(() => buildAwardSummary(state), [state]);
  const realWorkOrder = useMemo(() => buildRealWorkOrderReport(realWorkOrderInput), [realWorkOrderInput]);
  const coverage = evidenceCoverage(state.events);
  const completedNodes = pathNodes.filter((node) => node.status === "completed").length;

  const nextLabel = demoStepLabels[state.demoStep] ?? "闭环已完成";

  function addManualEvidence(input: ManualEvidenceInput) {
    const now = new Date();
    const event: EvidenceEvent = {
      id: `evt-manual-${now.getTime()}`,
      type: input.type,
      timestamp: now.toISOString(),
      actor:
        input.source === "teacher"
          ? "teacher"
          : input.source === "ci" || input.source === "git"
            ? "tool"
            : input.source === "chat" || input.source === "reflection"
              ? "student"
              : "system",
      source: input.source,
      title: input.title.trim() || "手动补充证据",
      detail: input.detail.trim() || "课程运营人员补充了一条学习证据。",
      competencyImpacts: { [input.competencyId]: input.delta },
      confidence: input.confidence,
      risk: input.risk,
      traceId: `trace-manual-${now.getTime()}`,
    };
    setState((current) => ({
      ...current,
      events: [...current.events, event],
    }));
  }

  function importRepositoryEvents(events: EvidenceEvent[]) {
    setState((current) => ({
      ...current,
      events: mergeEvidenceEvents(current.events, events),
    }));
  }

  function commitIntegrationEvents(events: EvidenceEvent[]) {
    setState((current) => ({
      ...current,
      events: mergeEvidenceEvents(current.events, events),
    }));
  }

  function updateRealWorkOrderInput(patch: Partial<RealWorkOrderInput>) {
    setRealWorkOrderInput((current) => ({
      ...current,
      ...patch,
    }));
  }

  function applyRealWorkOrderSample() {
    setRealWorkOrderInput(defaultRealWorkOrderInput);
  }

  function exportRealWorkOrder() {
    const exportedAt = new Date();
    const payload = {
      exportedAt: exportedAt.toISOString(),
      product: "SE-Path 学伴",
      artifact: "real-work-order",
      input: realWorkOrderInput,
      report: realWorkOrder,
      truthBoundary: "real pasted evidence can be processed locally; release remains under teacher gate",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sepath-real-work-order-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function exportLedger() {
    const exportedAt = new Date();
    const payload = {
      exportedAt: exportedAt.toISOString(),
      product: "SE-Path 学伴",
      summary,
      state,
      diagnosis,
      decisions,
      reviewTicket,
      knowledgeBoundary,
      studentDialogue,
      awardReadiness,
      strategyLab,
      valueUplift,
      pilotReadiness,
      privacyGuard,
      apiContract,
      integrationSandbox,
      agentRuntime,
      inferenceGateway,
      modelOps,
      courseAuthoring,
      teacherReport,
      interventionPlaybook,
      rubricCalibration,
      researchFusion,
      trialTelemetry,
      tenantOps,
      schoolProvisioning,
      dataPlane,
      pilotEvidenceBinder,
      judgeTrial,
      courseLaunch,
      submissionOps,
      pitchDirector,
      finalSubmission,
      cloudHandoff,
      cloudSlo,
      backendStatus,
      judgeVerification,
      finalDefense,
      reviewerDrill,
      reviewerGuide,
      launchLoopAcceptance,
      reviewerAcceptancePack: {
        runtime: "sepath-reviewer-acceptance-pack.v1",
        status: closedLoopDemo.status === "closed" ? "ready" : "draft",
        closedLoop: `${closedLoopDemo.completedSteps}/${closedLoopDemo.totalSteps}`,
        progress: closedLoopDemo.progress,
        eventCount: closedLoopDemo.eventCount,
        artifacts: [
          "closed-loop-demo-check.json",
          "sepath-evidence-ledger.json",
          "reviewer-guide-60s",
          "claim-evidence-ledger",
        ],
        submissionClosure: {
          claimLedgerReviewedAt,
          submissionCheckedAt,
          chainReady: Boolean(claimLedgerReviewedAt && submissionCheckedAt),
        },
        truthBoundary: "synthetic demo evidence; not a real course causal gain claim",
      },
      pathNodes,
      traces,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sepath-evidence-ledger-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setLedgerExportedAt(exportedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
  }

  function importLedger(raw: string) {
    const result = importLedgerPayload(raw, state);
    if (result.state) {
      setState(result.state);
    }
    return result.message;
  }

  function commitStudentDialogue(turn: StudentDialogueTurn) {
    setState((current) => ({
      ...current,
      events: mergeEvidenceEvents(current.events, createStudentDialogueEvents(turn)),
    }));
  }

  function startReviewerGuide() {
    setReviewerGuideStep(0);
    setReviewerGuideActive(true);
  }

  function stopReviewerGuide() {
    setReviewerGuideActive(false);
  }

  function nextReviewerGuideStep() {
    setReviewerGuideStep((current) => Math.min(current + 1, activeReviewerGuideSteps.length - 1));
  }

  function previousReviewerGuideStep() {
    setReviewerGuideStep((current) => Math.max(current - 1, 0));
  }

  function jumpReviewerGuideStep(index: number) {
    setReviewerGuideStep(Math.min(Math.max(index, 0), activeReviewerGuideSteps.length - 1));
  }

  function formatActionTime() {
    return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  function resetDemo() {
    setState(resetState());
    setLedgerExportedAt(null);
    setClaimLedgerReviewedAt(null);
    setSubmissionCheckedAt(null);
  }

  function reviewClaimLedgerForSubmission() {
    setClaimLedgerReviewedAt(formatActionTime());
  }

  function sealSubmissionClosure() {
    setSubmissionCheckedAt(formatActionTime());
  }

  function runReviewerGuideAction(stepId: string) {
    if (stepId === "quick-run-loop" || stepId === "run-loop") {
      setState((current) => runAllDemoSteps(current));
    }
  }

  return (
    <main className="app-shell yudao-shell">
      <aside className="admin-sidebar" aria-label="产品导航">
        <div className="brand admin-brand">
          <div className="brand-mark se-wordmark" aria-hidden="true">SE</div>
          <div>
            <strong>SE-Path 学伴</strong>
            <span>软件工程闭环学习运营台</span>
          </div>
        </div>
        <nav className="admin-nav" aria-label="核心模块">
          {sidebarGroups.map((group) => (
            <section className="admin-nav-group" key={group.title}>
              <p>{group.title}</p>
              {group.links.map((link, index) => (
                <a className={index === 0 ? "active" : ""} href={link.href} key={link.href}>
                  {link.icon}
                  <span>{link.label}</span>
                </a>
              ))}
            </section>
          ))}
        </nav>
        <div className="sidebar-health">
          <span>运行状态</span>
          <strong>{closedLoopDemo.status === "closed" ? "闭环已完成" : "等待推进"}</strong>
          <small>{closedLoopDemo.completedSteps}/{closedLoopDemo.totalSteps} 阶段写入证据</small>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="focus-topbar-context" aria-label="当前课程上下文">
            <span>软件工程 2301</span>
            <span>今日课堂</span>
          </div>
          <div className="topbar-actions">
            <span className="focus-date"><CalendarDays size={16} />2026-08-22</span>
            {ledgerExportedAt ? (
              <span className="focus-export-receipt"><CheckCircle2 size={15} />账本已导出 {ledgerExportedAt}</span>
            ) : null}
            <button className="focus-script-button" onClick={() => setDemoScriptOpen(true)} type="button">
              <Clock3 size={16} />
              60秒讲稿
            </button>
            <button className="focus-guide-button reviewer-guide-hero" onClick={startReviewerGuide} type="button">
              <MonitorPlay size={16} />
              评委导览
            </button>
            <button className="focus-avatar reviewer-guide-hero" onClick={startReviewerGuide} type="button" aria-label="打开流程导览">
              <UserCircle2 size={30} />
            </button>
          </div>
        </header>
      <ReviewerGuideOverlay
        active={reviewerGuideActive}
        currentIndex={reviewerGuideStep}
        guide={reviewerGuide}
        onJump={jumpReviewerGuideStep}
        onNext={nextReviewerGuideStep}
        onPrev={previousReviewerGuideStep}
        onStepAction={runReviewerGuideAction}
        onStop={stopReviewerGuide}
      />
      {demoScriptOpen ? (
        <aside className="demo-script-panel" data-demo-script-open="true" role="dialog" aria-modal="true" aria-labelledby="demo-script-title">
          <div className="demo-script-head">
            <span>LIVE TALK TRACK</span>
            <button className="icon-button" aria-label="关闭60秒讲稿" onClick={() => setDemoScriptOpen(false)} type="button">
              <X size={17} />
            </button>
          </div>
          <div className="demo-script-title">
            <small>评委视角 / 60 秒</small>
            <strong id="demo-script-title">从失败 PR 到可复核证据链</strong>
            <p>讲解时只围绕一个学生工单，避免散讲功能。每一段都对应页面上的一个可点击动作。</p>
          </div>
          <ol className="demo-script-steps">
            {demoScriptSteps.map((step) => (
              <li key={step.time}>
                <span>{step.time}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="demo-script-actions">
            <button
              className="ghost-button compact"
              onClick={() => {
                setDemoScriptOpen(false);
                startReviewerGuide();
              }}
              type="button"
            >
              <MonitorPlay size={16} />
              打开评委导览
            </button>
            <button
              className="primary-button compact"
              onClick={() => {
                setDemoScriptOpen(false);
                setState((current) => runNextDemoStep(current));
              }}
              type="button"
            >
              <Play size={16} />
              先推进一步
            </button>
          </div>
        </aside>
      ) : null}

      <div className="focus-demo-entry" id="student">
        <RealWorkOrderPanel
          input={realWorkOrderInput}
          report={realWorkOrder}
          onApplySample={applyRealWorkOrderSample}
          onChange={updateRealWorkOrderInput}
          onExport={exportRealWorkOrder}
        />
        <details className="legacy-demo-details">
          <summary>
            <span>合成闭环演示</span>
            <strong>展开比赛讲解链路与评委验收包</strong>
          </summary>
          <ClosedLoopDemoPanel
            claimLedgerReviewedAt={claimLedgerReviewedAt}
            ledgerExportedAt={ledgerExportedAt}
            report={closedLoopDemo}
            submissionCheckedAt={submissionCheckedAt}
            onExportLedger={exportLedger}
            onReviewClaimLedger={reviewClaimLedgerForSubmission}
            onRunAll={() => setState((current) => runAllDemoSteps(current))}
            onRunNext={() => setState((current) => runNextDemoStep(current))}
            onReset={resetDemo}
            onSealSubmission={sealSubmissionClosure}
          />
        </details>
      </div>

      <section className="hero cockpit-redesign yudao-workbench" id="legacy-student" aria-hidden="true">
        <div className="workbench-command-center">
          <aside className="workbench-queue" aria-label="班级待处理工单队列">
            <div className="queue-head">
              <span className="section-kicker">软件工程 2301 / 今日课堂</span>
              <h1>班级学习工单</h1>
              <p>系统先把真实学习事件汇总成待办，再进入诊断、干预和教师复核。</p>
            </div>
            <div className="queue-tabs" aria-label="工单筛选">
              <span className="active">待处理 3</span>
              <span>待复核 1</span>
              <span>已归档 8</span>
            </div>
            <button className="queue-item active" type="button">
              <span className="queue-priority high">高</span>
              <strong>{state.learner.name}</strong>
              <small>{state.task.title}</small>
              <b>{closedLoopDemo.progress}%</b>
            </button>
            <button className="queue-item" type="button">
              <span className="queue-priority medium">中</span>
              <strong>赵思源</strong>
              <small>单元测试覆盖缺口</small>
              <b>40%</b>
            </button>
            <button className="queue-item" type="button">
              <span className="queue-priority low">低</span>
              <strong>陈若安</strong>
              <small>提交说明与反思缺失</small>
              <b>70%</b>
            </button>
          </aside>

          <article className="workbench-ticket workbench-case-detail">
            <div className="case-header">
              <div>
                <span>当前工单</span>
                <strong>{state.learner.name} / {state.task.title}</strong>
                <p>从失败 PR 进入诊断，所有建议必须留下证据、门禁和回滚口径。</p>
              </div>
              <div className={`case-status ${diagnosis.risk}`}>
                <span>风险</span>
                <strong>{diagnosis.risk}</strong>
              </div>
            </div>

            <div className="case-meta-grid" aria-label="当前工单状态">
              <span><b>{Math.round(coverage * 100)}%</b><small>证据覆盖</small></span>
              <span><b>{closedLoopDemo.completedSteps}/{closedLoopDemo.totalSteps}</b><small>闭环阶段</small></span>
              <span><b>{state.events.length}</b><small>证据事件</small></span>
              <span><b>{completedNodes}/{pathNodes.length}</b><small>路径节点</small></span>
            </div>

            <div className="workbench-alert">
              <Shield size={18} />
              <div>
                <strong>{diagnosis.blocker}</strong>
                <p>{diagnosis.summary}</p>
              </div>
            </div>

            <div className="cockpit-command-bar" aria-label="闭环快捷操作">
              <button
                className="primary-button"
                onClick={() => setState((current) => runNextDemoStep(current))}
                disabled={state.demoStep >= demoStepLabels.length}
              >
                <Play size={18} />
                {nextLabel}
              </button>
              <button className="ghost-button" onClick={() => setState((current) => runAllDemoSteps(current))}>
                <ListChecks size={18} />
                自动推进闭环
              </button>
              <button className="ghost-button" onClick={exportLedger}>
                <FileCheck2 size={18} />
                导出证据账本
              </button>
              <button className="ghost-button" onClick={resetDemo}>
                <RotateCcw size={18} />
                重置
              </button>
            </div>
          </article>

          <aside className="workbench-decision-card workbench-coach">
            <div>
              <span>AI 处理建议</span>
              <strong>{decisions[0]?.label ?? "等待更多证据"}</strong>
              <p>只推进当前节点，不替学生写完整答案；高风险建议进入教师门禁。</p>
            </div>
            <dl className="action-facts">
              <div>
                <dt>诊断依据</dt>
                <dd>{diagnosis.blocker}</dd>
              </div>
              <div>
                <dt>下一步</dt>
                <dd>{closedLoopDemo.nextStep?.label ?? "闭环已完成，可提交复核"}</dd>
              </div>
              <div>
                <dt>发布门禁</dt>
                <dd>{reviewTicket.action === "human_review" ? "教师复核后发布" : "低风险自动放行"}</dd>
              </div>
            </dl>
            <div className="cockpit-mini-ledger" aria-label="证据概览">
              <span><b>SafeVOI</b>{decisions[0]?.label ?? "等待更多证据"}</span>
              <span><b>交付</b>Static + API Ready</span>
            </div>
          </aside>

        </div>
      </section>

      <section className="hero operator-hero legacy-overview" aria-hidden="true">
        <div className="hero-copy operator-brief">
          <span className="section-kicker">软件工程课程现场</span>
          <h1>把一次失败 PR 转成可执行的学习工单。</h1>
          <p>
            面向老师、助教和评委，系统不直接替学生写答案，而是识别失败原因、排序下一步行动、生成脚手架提示，
            再把修复、复核和反思沉淀成证据账本。
          </p>
          <div className="operator-status-row" aria-label="当前闭环状态">
            <span><b>{Math.round(diagnosis.confidence * 100)}%</b>诊断可信度</span>
            <span><b>{Math.round(coverage * 100)}%</b>证据覆盖</span>
            <span><b>{closedLoopDemo.completedSteps}/{closedLoopDemo.totalSteps}</b>闭环阶段</span>
          </div>
          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={() => setState((current) => runNextDemoStep(current))}
              disabled={state.demoStep >= demoStepLabels.length}
            >
              <Play size={18} />
              {nextLabel}
            </button>
            <button className="ghost-button" onClick={() => setState((current) => runAllDemoSteps(current))}>
              <ListChecks size={18} />
              自动推进闭环
            </button>
            <button className="ghost-button" onClick={resetDemo}>
              <RotateCcw size={18} />
              重置流程
            </button>
            <button className="ghost-button reviewer-guide-hero" onClick={startReviewerGuide} type="button">
              <MonitorPlay size={18} />
              一键流程导览
            </button>
          </div>
        </div>
        <aside className="hero-panel operator-card">
          <div className="student-card">
            <GraduationCap size={21} />
            <div>
              <span>当前学生</span>
              <strong>{state.learner.name}</strong>
              <p>{state.task.title}</p>
            </div>
          </div>
          <div className="work-order">
            <span>待处理风险</span>
            <strong>{diagnosis.blocker}</strong>
            <p>{diagnosis.summary}</p>
          </div>
          <div className="work-order muted">
            <span>系统建议</span>
            <strong>{closedLoopDemo.nextStep?.label ?? "闭环已完成，可导出证据账本"}</strong>
            <p>{closedLoopDemo.nextAction}</p>
          </div>
        </aside>
      </section>

      <section className="ops-snapshot legacy-overview" aria-label="课程运营快照">
        <article>
          <span>学生画像</span>
          <strong>{state.learner.name}</strong>
          <p>{state.task.description}</p>
        </article>
        <article>
          <span>推荐动作</span>
          <strong>{decisions[0]?.label ?? "等待更多证据"}</strong>
          <p>按 SafeVOI 兼顾学习收益、学生负担、安全边界和动作可逆性。</p>
        </article>
        <article>
          <span>复核出口</span>
          <strong>{reviewTicket.action === "human_review" ? "教师复核" : "自动放行"}</strong>
          <p>{summary}</p>
        </article>
      </section>

      <section className="metric-grid legacy-overview">
        <MetricCard
          label="已采集证据"
          value={`${state.events.length}`}
          note="来自 baseline / Git / CI / 对话 / 反思"
          icon={<DatabaseZap size={21} />}
        />
        <MetricCard
          label="证据覆盖率"
          value={`${Math.round(coverage * 100)}%`}
          note="覆盖不足时进入影子运行和人工复核"
          icon={<Shield size={21} />}
        />
        <MetricCard
          label="学习路径完成"
          value={`${completedNodes}/${pathNodes.length}`}
          note="根据代码行为与课程 Rubric 实时更新"
          icon={<ArrowRight size={21} />}
        />
        <MetricCard
          label="上线形态"
          value="Static + API Ready"
          note="支持 Vercel / Sites / Nginx 静态发布"
          icon={<Cloud size={21} />}
        />
      </section>

      <section className="evidence-review-workspace" id="evidence-review">
        <header className="workspace-section-header">
          <div>
            <span className="section-kicker">证据与复核工作区</span>
            <h2>先看证据，再放行干预。</h2>
            <p>这里承接上面的闭环办理台：能力变化、AI 建议、学习路径、事件账本、学生对话和教师复核各司其职。</p>
          </div>
          <nav className="workspace-jump-nav" aria-label="证据与复核快捷入口">
            <a href="#dialogue">学生对话</a>
            <a href="#repository">仓库接入</a>
            <a href="#teacher-report">教师周报</a>
            <a href="#teacher">复核与证据</a>
          </nav>
        </header>

        <section className="main-grid">
          <CompetencyPanel scores={scores} />
          <DecisionPanel diagnosis={diagnosis} decisions={decisions} scaffold={scaffold} />
          <PathBoard nodes={pathNodes} />
          <EvidenceTimeline events={state.events} />
        </section>

        <StudentDialoguePanel report={studentDialogue} onCommitTurn={commitStudentDialogue} />

        <InterventionPlaybookPanel report={interventionPlaybook} />

        <RepositoryImportPanel onImportEvents={importRepositoryEvents} />

        <TeacherReportPanel report={teacherReport} />

        <ValueUpliftPanel report={valueUplift} />

        <section className="ops-grid" id="teacher">
          <TeacherConsole ticket={reviewTicket} />
          <TracePanel traces={traces} />
          <EvidenceCapturePanel
            onAddEvidence={addManualEvidence}
            onExportLedger={exportLedger}
            onImportLedger={importLedger}
            summary={summary}
          />
        </section>
      </section>

      <details className="product-drawer" id="ops-appendix">
        <summary>
          <span>
            <strong>上线验收台</strong>
            <small>课程配置、数据治理、发布门禁、云端交付和上线验收都已接入，扩展能力默认收起。</small>
          </span>
          <b>展开全部模块</b>
        </summary>
        <div className="drawer-panel-grid">
          <CourseAuthoringPanel report={courseAuthoring} />
          <CohortOpsPanel report={cohortOps} />
          <RubricCalibrationPanel report={rubricCalibration} />
          <CourseLaunchPanel report={courseLaunch} />
          <TenantOpsPanel report={tenantOps} />
          <SchoolProvisioningPanel report={schoolProvisioning} />
          <DataPlanePanel report={dataPlane} />
          <StrategyLabPanel report={strategyLab} />
          <PilotReadinessPanel report={pilotReadiness} />
          <PrivacyGuardPanel report={privacyGuard} />
          <ApiContractPanel report={apiContract} />
          <IntegrationSandboxPanel
            report={integrationSandbox}
            state={state}
            apiContract={apiContract}
            privacyGate={privacyGuard.gate}
            onCommitEvents={commitIntegrationEvents}
          />
          <KnowledgeBoundaryPanel report={knowledgeBoundary} />
          <ResearchEvidencePanel report={researchEvidence} />
          <ResearchFusionPanel report={researchFusion} />
          <TrialTelemetryPanel report={trialTelemetry} />
          <PilotEvidenceBinderPanel report={pilotEvidenceBinder} />
          <ClaimEvidenceLedgerPanel report={claimEvidenceLedger} />
          <AgentRuntimePanel report={agentRuntime} />
          <InferenceGatewayPanel report={inferenceGateway} />
          <ModelOpsPanel report={modelOps} />
          <AwardReadinessPanel report={awardReadiness} />
          <CompetitionAlignmentPanel report={competitionAlignment} />
          <LaunchReadinessPanel report={launchReadiness} />
          <JudgeTrialPanel report={judgeTrial} />
          <ReviewerDrillPanel report={reviewerDrill} />
          <SubmissionOpsPanel report={submissionOps} />
          <PitchDirectorPanel report={pitchDirector} />
          <FinalDefensePanel report={finalDefense} />
          <FinalSubmissionPanel report={finalSubmission} />
          <CloudHandoffPanel report={cloudHandoff} />
          <HostingSelftestPanel report={hostingSelftest} />
          <PublicUrlReceiptPanel hostingSelftest={hostingSelftest} finalSubmission={finalSubmission} />
          <SubmissionClosurePanel hostingSelftest={hostingSelftest} finalSubmission={finalSubmission} />
          <CloudSloPanel report={cloudSlo} />
          <BackendStatusPanel report={backendStatus} />
          <JudgeVerificationPanel report={judgeVerification} />
          <LaunchLoopAcceptancePanel report={launchLoopAcceptance} />
        </div>
      </details>
      </div>
    </main>
  );
}

export default App;
