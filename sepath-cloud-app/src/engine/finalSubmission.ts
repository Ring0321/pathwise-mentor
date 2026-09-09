import type { DataPlaneReport } from "./dataPlane";
import type { PitchDirectorReport } from "./pitchDirector";
import type { PrivacyGuardReport } from "./privacyGuard";
import type { SchoolProvisioningReport } from "./schoolProvisioning";
import type { SubmissionOpsReport } from "./submissionOps";

export type FinalSubmissionStatus = "ready" | "watch" | "manual" | "blocked";

export interface FinalUploadRoute {
  id: string;
  label: string;
  status: FinalSubmissionStatus;
  platformMode: string;
  primaryFile: string;
  supportingFiles: string[];
  uploadOrder: string[];
  verification: string;
  fallback: string;
}

export interface FinalNamedCopy {
  id: string;
  label: string;
  status: FinalSubmissionStatus;
  source: string;
  targetPattern: string;
  command: string;
  rule: string;
}

export interface FinalDayChecklistItem {
  id: string;
  label: string;
  minutes: string;
  status: FinalSubmissionStatus;
  action: string;
  evidence: string;
}

export interface FinalRehearsalAnchor {
  id: string;
  label: string;
  status: FinalSubmissionStatus;
  material: string;
  demoAnchor: string;
  judgeMessage: string;
  riskBoundary: string;
}

export interface FinalManualGate {
  id: string;
  label: string;
  status: FinalSubmissionStatus;
  owner: "team" | "organizer" | "teacher" | "ops";
  currentState: string;
  acceptCriteria: string;
}

export interface FinalForbiddenClaim {
  id: string;
  forbidden: string;
  safeAlternative: string;
  evidenceBoundary: string;
}

export interface FinalPackageSnapshot {
  id: string;
  label: string;
  status: FinalSubmissionStatus;
  value: string;
  evidence: string;
  judgeUse: string;
}

export interface FinalAwardSprintTask {
  id: string;
  label: string;
  status: FinalSubmissionStatus;
  owner: "team" | "organizer" | "teacher" | "ops";
  window: string;
  action: string;
  successSignal: string;
}

export interface FinalCommand {
  id: string;
  label: string;
  status: FinalSubmissionStatus;
  command: string;
  output: string;
  whenToRun: string;
}

export interface FinalSubmissionReport {
  score: number;
  stage: string;
  summary: string;
  readyCount: number;
  watchCount: number;
  manualCount: number;
  blockedCount: number;
  uploadRoutes: FinalUploadRoute[];
  namedCopies: FinalNamedCopy[];
  dayChecklist: FinalDayChecklistItem[];
  rehearsalAnchors: FinalRehearsalAnchor[];
  manualGates: FinalManualGate[];
  forbiddenClaims: FinalForbiddenClaim[];
  packageSnapshot: FinalPackageSnapshot[];
  awardSprint: FinalAwardSprintTask[];
  commands: FinalCommand[];
  handbookPath: string;
  packagePath: string;
  finalGateReportPath: string;
  manifest: string;
}

function countStatus<T extends { status: FinalSubmissionStatus }>(items: T[], status: FinalSubmissionStatus): number {
  return items.filter((item) => item.status === status).length;
}

function statusWeight(status: FinalSubmissionStatus): number {
  if (status === "ready") return 1;
  if (status === "watch") return 0.7;
  if (status === "manual") return 0.45;
  return 0;
}

export function buildFinalSubmissionReport(
  submissionOps: SubmissionOpsReport,
  pitchDirector: PitchDirectorReport,
  dataPlane: DataPlaneReport,
  schoolProvisioning: SchoolProvisioningReport,
  privacyGuard: PrivacyGuardReport,
): FinalSubmissionReport {
  const packageReady = submissionOps.artifacts.find((item) => item.id === "stage-zip")?.status === "ready";
  const videoReady = pitchDirector.durationSeconds >= 180 && pitchDirector.durationSeconds <= 300;
  const dataPlaneReady = dataPlane.score >= 75 && dataPlane.blockedCount === 0;
  const accountReady = schoolProvisioning.score >= 80 && schoolProvisioning.blockedCount === 0;
  const privacyReady = privacyGuard.gate === "pass";
  const releaseReady = submissionOps.blockedCount === 0 && packageReady && privacyReady;
  const currentPackageSha = "以 submission manifest 的 package_sha256 为准";
  const currentPackageBytes = "以 submission manifest 的 package_size_bytes 为准，且 <100MB";
  const currentPackageFiles = "以 submission manifest 的 file_count 为准";
  const currentPlanPdf = "SE-Path学伴_产品设计与原型验证方案_v0.2.pdf";

  const uploadRoutes: FinalUploadRoute[] = [
    {
      id: "single-zip",
      label: "单文件上传路线",
      status: releaseReady ? "ready" : "blocked",
      platformMode: "平台只允许上传一个文件",
      primaryFile: "submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09.zip",
      supportingFiles: ["submission manifest", "09_提交前终审报告.md", "40_最终提交上传作战手册.md"],
      uploadOrder: ["运行 release_gate", "确认 ZIP 小于 100MB", "如需正式命名则生成副本", "上传 ZIP", "下载回显或截图保存"],
      verification: "manifest 中 zip_integrity=pass、secret_scan_hits=[]、size_under_100mb=true。",
      fallback: "如果平台拒绝 ZIP，切换到多栏上传路线。",
    },
    {
      id: "split-fields",
      label: "多栏上传路线",
      status: releaseReady && videoReady ? "ready" : "watch",
      platformMode: "平台拆分项目计划书、视频、源码或补充材料",
      primaryFile: "项目计划书 PDF + MP4 + PPTX + 阶段 ZIP",
      supportingFiles: ["10_比赛平台填写文案.md", "04_答辩PPT结构.md", "README_提交材料总览.md"],
      uploadOrder: ["项目计划书 PDF", "4分40秒演示视频", "21页答辩PPT", "源码与补充材料 ZIP", "平台项目说明"],
      verification: "每个栏位上传后打开平台回显文件名，避免只看到本地浏览器缓存。",
      fallback: "若视频栏失败，提交 ZIP 内 MP4 并在项目说明中写明视频路径。",
    },
    {
      id: "demo-access",
      label: "演示访问兜底路线",
      status: accountReady ? "ready" : "manual",
      platformMode: "评委需要试用或现场路演",
      primaryFile: "公开静态包 / 本地 Demo / owner-only Sites / MP4",
      supportingFiles: ["START_DEMO.md", "28_评委试用与交付控制台说明.md", "38_学校初始化与演示账号中心说明.md"],
      uploadOrder: ["先给视频", "再给公开静态包", "需要复查时运行本地 Demo", "云端访问按主办方要求开关"],
      verification: "演示账号不包含真实密码，评委角色只读，学生角色无法获得完整可提交答案。",
      fallback: "云端不可访问时使用 MP4、截图 manifest 和本地启动说明兜底。",
    },
  ];

  const namedCopies: FinalNamedCopy[] = [
    {
      id: "final-package",
      label: "完整提交包副本",
      status: "manual",
      source: "submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09.zip",
      targetPattern: "队伍名+SE-Path学伴_完整提交包.zip",
      command: "rtk python scripts/prepare_final_named_submission.py --team-name \"队伍名\" --work-name \"SE-Path学伴\" --write",
      rule: "只复制到 submission/final_named/，不覆盖原始阶段包。",
    },
    {
      id: "plan-pdf",
      label: "项目计划书副本",
      status: "manual",
      source: "参赛提交材料包/SE-Path学伴_产品设计与原型验证方案_v0.2.pdf",
      targetPattern: "队伍名+SE-Path学伴_项目计划书.pdf",
      command: "同正式命名脚本一并生成",
      rule: "满足官方“队伍名+作品名”的命名要求。",
    },
    {
      id: "defense-ppt",
      label: "答辩 PPT 副本",
      status: "manual",
      source: "参赛提交材料包/SE-Path学伴_答辩PPT_v0.2.pptx",
      targetPattern: "队伍名+SE-Path学伴_答辩PPT.pptx",
      command: "同正式命名脚本一并生成",
      rule: "正式使用 21 页 v0.2，不上传旧 v0.1。",
    },
    {
      id: "demo-video",
      label: "演示视频副本",
      status: videoReady ? "ready" : "watch",
      source: "参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4",
      targetPattern: "队伍名+SE-Path学伴_演示视频.mp4",
      command: "同正式命名脚本一并生成",
      rule: "当前视频 280 秒，符合 3-5 分钟要求。",
    },
  ];

  const dayChecklist: FinalDayChecklistItem[] = [
    {
      id: "gate-report",
      label: "确认最终门禁报告",
      minutes: "3 分钟",
      status: releaseReady ? "ready" : "blocked",
      action: "打开 outputs/SE-Path学伴_最终发布门禁报告_机器生成.json。",
      evidence: "release_gate=PASS，command_failures=0，FAIL=0。",
    },
    {
      id: "video-spot-check",
      label: "视频三段抽查",
      minutes: "5 分钟",
      status: videoReady ? "ready" : "watch",
      action: "播放开头、中段、结尾，确认画面、字幕、无黑屏。",
      evidence: `${pitchDirector.durationSeconds} 秒，目标文件 ${pitchDirector.finalVideoPath}。`,
    },
    {
      id: "slides-anchor-check",
      label: "PPT 关键页抽查",
      minutes: "4 分钟",
      status: "ready",
      action: "打开第 1、4、9、14、16、20 页。",
      evidence: "覆盖定位、证据对象、SafeVOI、数据平面、交付证据和一等奖完整性。",
    },
    {
      id: "named-copy",
      label: "正式命名副本",
      minutes: "4 分钟",
      status: "manual",
      action: "队伍名确定后运行 prepare_final_named_submission.py。",
      evidence: "输出到 submission/final_named/，原始包保持不变。",
    },
    {
      id: "platform-echo",
      label: "上传回显留证",
      minutes: "4 分钟",
      status: "manual",
      action: "上传后下载或截图平台回显文件名和大小。",
      evidence: "避免浏览器选择文件成功但平台未保存。",
    },
  ];

  const rehearsalAnchors: FinalRehearsalAnchor[] = [
    {
      id: "closed-loop",
      label: "失败 PR 到反思记忆",
      status: "ready",
      material: "4分40秒视频 + Demo 学生闭环",
      demoAnchor: "#student",
      judgeMessage: "不是普通问答，而是能把 PR/CI/复核/反思串成证据链。",
      riskBoundary: "不展示真实学生数据。",
    },
    {
      id: "evidence-native",
      label: "证据原生对象",
      status: "ready",
      material: "PPT 第 4 页",
      demoAnchor: "#award",
      judgeMessage: "EvidenceEvent、DiagnosisCard、ReviewTicket 是原创断点。",
      riskBoundary: "不说模型自动证明自己正确。",
    },
    {
      id: "safevoi",
      label: "SafeVOI 可解释策略",
      status: "ready",
      material: "PPT 第 9 页 + 策略实验室",
      demoAnchor: "#strategy",
      judgeMessage: "下一步行动排序同时考虑学习收益、信息收益、风险、窗口期和负担。",
      riskBoundary: "不把当前离线仿真说成真实因果提分。",
    },
    {
      id: "data-plane",
      label: "生产数据平面",
      status: dataPlaneReady ? "ready" : "watch",
      material: "PPT 第 14 页 + 39 号材料 + cloud/sql",
      demoAnchor: "#data-plane",
      judgeMessage: "系统具备从 Demo 走向 Postgres/Supabase、RLS、备份和探针的上线骨架。",
      riskBoundary: "当前 SQL 是可执行草案，真实学校接入需授权后进行。",
    },
    {
      id: "manual-boundary",
      label: "人工门禁与真实性",
      status: "ready",
      material: "05 真实性声明 + 40 上传手册",
      demoAnchor: "#submission",
      judgeMessage: "机器能验证的给证据，队伍名、访问策略、真人旁白和真实效果保留人工门禁。",
      riskBoundary: "不编造报名信息、学校接入或真实提分。",
    },
  ];

  const manualGates: FinalManualGate[] = [
    {
      id: "team-profile",
      label: "队伍名与成员信息",
      status: "manual",
      owner: "team",
      currentState: "材料保持待填写，不由系统编造。",
      acceptCriteria: "与报名平台完全一致后再生成正式命名副本。",
    },
    {
      id: "access-policy",
      label: "云端访问策略",
      status: "manual",
      owner: "organizer",
      currentState: "历史 Sites project_id 待恢复；公开静态上传包和视频可兜底，最终 URL 以回执验收为准。",
      acceptCriteria: "按主办方要求决定公开链接、演示账号或仅提交视频/源码。",
    },
    {
      id: "voiceover-final",
      label: "真人旁白终版",
      status: "manual",
      owner: "team",
      currentState: "字幕素材版已经可提交，真人版可作为增强。",
      acceptCriteria: "真人版无口误、无夸大、音量正常，再替换。",
    },
    {
      id: "real-effect-claim",
      label: "真实课程效果声明",
      status: "manual",
      owner: "teacher",
      currentState: "当前证明闭环和试点设计，不证明真实长期提分。",
      acceptCriteria: "只说可试点、可验证、合成样本与工程闭环。",
    },
  ];

  const forbiddenClaims: FinalForbiddenClaim[] = [
    {
      id: "real-school-live",
      forbidden: "已经在真实学校长期上线。",
      safeAlternative: "当前具备可上云工程骨架和课程试点 SOP。",
      evidenceBoundary: "以学校授权、影子运行和教师确认试点作为后续证据。",
    },
    {
      id: "real-score-uplift",
      forbidden: "已经证明真实成绩提升。",
      safeAlternative: "当前展示学习增值估计、离线仿真和真实试点指标设计。",
      evidenceBoundary: "真实因果效果必须等课程试点后再声明。",
    },
    {
      id: "teacher-replacement",
      forbidden: "系统可以完全替代教师评分。",
      safeAlternative: "系统给诊断建议和复核队列，教师发布门兜底。",
      evidenceBoundary: "高风险建议进入 teacher review，不自动放行。",
    },
    {
      id: "open-source-copy",
      forbidden: "直接复制某开源项目形成产品。",
      safeAlternative: "开源项目作为设计参考，原创断点是 EvidenceEvent、PathTwin、SafeVOI 和数据平面。",
      evidenceBoundary: "提交包不包含未授权外部源码、模型或真实学生数据。",
    },
  ];

  const packageSnapshot: FinalPackageSnapshot[] = [
    {
      id: "zip-sha",
      label: "阶段提交包 SHA256",
      status: releaseReady ? "ready" : "blocked",
      value: currentPackageSha,
      evidence: "submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json",
      judgeUse: "评委或团队以 manifest 记录的 SHA 确认上传前后 ZIP 是否同一份，避免源码自引用导致 SHA 失效。",
    },
    {
      id: "zip-size",
      label: "ZIP 大小",
      status: releaseReady ? "ready" : "blocked",
      value: currentPackageBytes,
      evidence: "size_under_100mb=true",
      judgeUse: "证明符合官方 100MB 内提交约束。",
    },
    {
      id: "zip-files",
      label: "ZIP 文件数",
      status: releaseReady ? "ready" : "blocked",
      value: currentPackageFiles,
      evidence: "zip_integrity=pass; secret_scan_hits=[]",
      judgeUse: "证明完整材料、源码和可运行包已进入同一提交件。",
    },
    {
      id: "plan-pdf-v02",
      label: "项目计划书 PDF",
      status: "ready",
      value: `${currentPlanPdf} / 184 pages`,
      evidence: "09_提交前终审报告：PDF 文件头 PASS，80+ 页 PASS。",
      judgeUse: "确认评委看到的是包含研究贡献图谱和真实试点证据归档的新版方案。",
    },
    {
      id: "manual-gates",
      label: "保留人工门禁",
      status: "manual",
      value: "5 manual gates",
      evidence: "队伍名、队员、访问策略、真人旁白、真实效果声明。",
      judgeUse: "说明系统不会编造事实，可信边界清楚。",
    },
  ];

  const awardSprint: FinalAwardSprintTask[] = [
    {
      id: "official-profile",
      label: "正式画像落盘",
      status: "manual",
      owner: "team",
      window: "提交前 30 分钟",
      action: "把 54 号模板复制为 submission/final_submission_profile.json，填入真实队伍名、成员和确认项。",
      successSignal: "prepare_final_named_submission.py --profile --dry-run 无 validation errors。",
    },
    {
      id: "cloud-access-policy",
      label: "评委访问策略确认",
      status: "manual",
      owner: "organizer",
      window: "提交前 1 天",
      action: "按主办方要求决定 owner-only Sites、公开静态包、演示账号或视频兜底的组合。",
      successSignal: "平台说明文字不把私有链接写成匿名公开地址。",
    },
    {
      id: "defense-rehearsal",
      label: "一等奖答辩压测",
      status: "ready",
      owner: "team",
      window: "入围后 24 小时内",
      action: "按 #final-defense 追问卡演练 8 个尖锐问题，所有回答跳转到产品锚点和材料路径。",
      successSignal: "90 秒定位、5 分钟演示和 8 张追问卡均不超时、不夸大。",
    },
    {
      id: "teacher-shadow-pilot",
      label: "真实课程影子试点准备",
      status: "manual",
      owner: "teacher",
      window: "入围后 1-2 周",
      action: "按 58 号材料补学校授权、教师签收、学生知情和匿名分析快照。",
      successSignal: "只从 L0/L1 走向 L2，不提前宣称真实长期提分。",
    },
    {
      id: "deployment-hardening",
      label: "上云交付加固",
      status: dataPlaneReady && accountReady ? "ready" : "watch",
      owner: "ops",
      window: "决赛前",
      action: "复跑 Edge API、LLM Gateway、Cloud SLO、PWA 离线和 reviewer drill，保留最新 manifest。",
      successSignal: "release gate PASS，SLO/Worker/HTTP smoke 均 FAIL=0。",
    },
  ];

  const commands: FinalCommand[] = [
    {
      id: "release-gate",
      label: "最终发布门禁",
      status: releaseReady ? "ready" : "blocked",
      command: "rtk python scripts/release_gate.py",
      output: "outputs/SE-Path学伴_最终发布门禁报告_机器生成.json",
      whenToRun: "提交前最后一次运行。",
    },
    {
      id: "named-dry-run",
      label: "正式命名预演",
      status: "ready",
      command: "rtk python scripts/prepare_final_named_submission.py --team-name \"队伍名\" --work-name \"SE-Path学伴\" --dry-run",
      output: "打印将生成的 ZIP/PDF/PPT/MP4/手册副本路径。",
      whenToRun: "队伍名确定前先预演。",
    },
    {
      id: "named-write",
      label: "正式命名生成",
      status: "manual",
      command: "rtk python scripts/prepare_final_named_submission.py --team-name \"队伍名\" --work-name \"SE-Path学伴\" --write",
      output: "submission/final_named/",
      whenToRun: "队伍名、作品名最终确认后运行。",
    },
  ];

  const allStatuses = [
    ...uploadRoutes,
    ...namedCopies,
    ...dayChecklist,
    ...rehearsalAnchors,
    ...manualGates,
    ...packageSnapshot,
    ...awardSprint,
    ...commands,
  ];
  const readyCount = countStatus(allStatuses, "ready");
  const watchCount = countStatus(allStatuses, "watch");
  const manualCount = countStatus(allStatuses, "manual");
  const blockedCount = countStatus(allStatuses, "blocked");
  const score = Math.round((allStatuses.reduce((sum, item) => sum + statusWeight(item.status), 0) / allStatuses.length) * 100);

  return {
    score,
    stage: blockedCount > 0 ? "最终上传阻断" : "最终上传候选 / 人工信息待确认",
    summary:
      blockedCount > 0
        ? "当前仍有发布阻断项，先处理敏感信息、ZIP 或视频状态。"
        : "单 ZIP、多栏上传、正式命名、路演打开顺序和禁止夸大口径已经收口到产品内；剩余项均为队伍必须人工确认的信息。",
    readyCount,
    watchCount,
    manualCount,
    blockedCount,
    uploadRoutes,
    namedCopies,
    dayChecklist,
    rehearsalAnchors,
    manualGates,
    forbiddenClaims,
    packageSnapshot,
    awardSprint,
    commands,
    handbookPath: "参赛提交材料包/40_最终提交上传作战手册.md",
    packagePath: "submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09.zip",
    finalGateReportPath: "outputs/SE-Path学伴_最终发布门禁报告_机器生成.json",
    manifest: JSON.stringify(
      {
        id: "sepath-final-submission.v1",
        uploadHandbook: "40_最终提交上传作战手册.md",
        namedCopyScript: "scripts/prepare_final_named_submission.py",
        dataPlaneReady,
        accountReady,
        privacyGate: privacyGuard.gate,
        packageReady,
        packageSha256: currentPackageSha,
        packageBytes: currentPackageBytes,
        packageFiles: currentPackageFiles,
        projectPlanPdf: currentPlanPdf,
        awardSprintIds: awardSprint.map((item) => item.id),
        noRealScoreClaim: true,
      },
      null,
      2,
    ),
  };
}
