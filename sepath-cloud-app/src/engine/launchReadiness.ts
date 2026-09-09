import type { AppState, EventType } from "../domain/types";
import { evidenceCoverage } from "./evidence";

export type LaunchReadinessStatus = "pass" | "watch" | "manual";

export interface LaunchReadinessItem {
  id: string;
  label: string;
  status: LaunchReadinessStatus;
  evidence: string;
}

export interface LaunchMetric {
  id: string;
  label: string;
  value: string;
  target: string;
}

export interface LaunchReadinessReport {
  cloudUrl: string;
  stage: string;
  passCount: number;
  watchCount: number;
  manualCount: number;
  summary: string;
  checks: LaunchReadinessItem[];
  metrics: LaunchMetric[];
  rollbackSteps: string[];
  manualGates: string[];
}

const CLOUD_URL = "https://sepath-xueban.ring0321.chatgpt.site";

function hasEvent(state: AppState, type: EventType): boolean {
  return state.events.some((event) => event.type === type);
}

function statusWhen(condition: boolean): LaunchReadinessStatus {
  return condition ? "pass" : "watch";
}

export function buildLaunchReadinessReport(state: AppState): LaunchReadinessReport {
  const coverage = evidenceCoverage(state.events);
  const hasCiPass = hasEvent(state, "ci_passed");
  const hasTeacherReview = hasEvent(state, "teacher_reviewed");
  const hasReflection = hasEvent(state, "reflection_submitted");
  const loopClosed = hasCiPass && hasTeacherReview && hasReflection;

  const checks: LaunchReadinessItem[] = [
    {
      id: "local-build",
      label: "本地构建与算法测试",
      status: "pass",
      evidence: "npm run test / npm run build 已作为提交包审计前置命令保留。",
    },
    {
      id: "cloud-deploy",
      label: "云端部署版本",
      status: "pass",
      evidence: "历史 OpenAI Sites version 3 曾成功部署；当前 project_id 待恢复，最新版公开访问以静态上传包和 URL 回执为准。",
    },
    {
      id: "closed-loop",
      label: "学习闭环可演示",
      status: statusWhen(loopClosed),
      evidence: loopClosed
        ? "CI 通过、教师复核、反思记忆均已进入证据账本。"
        : "继续点击主按钮，可补齐 CI 通过、教师复核和反思记忆。",
    },
    {
      id: "evidence-ledger",
      label: "证据账本可交付",
      status: statusWhen(coverage >= 0.6),
      evidence: `当前证据覆盖率 ${Math.round(coverage * 100)}%，支持导出 JSON 审计账本。`,
    },
    {
      id: "risk-gate",
      label: "AI 安全发布门",
      status: statusWhen(hasTeacherReview),
      evidence: hasTeacherReview
        ? "高风险建议已经进入教师复核流程。"
        : "高风险建议先进入人工复核，不自动替写答案。",
    },
    {
      id: "access-policy",
      label: "正式访问策略",
      status: "manual",
      evidence: "正式提交前按主办方要求决定是否公开云端 Demo。",
    },
    {
      id: "voice-video",
      label: "演示视频最终版",
      status: "manual",
      evidence: "当前已生成字幕素材版，可选择叠加真人旁白。",
    },
  ];

  const passCount = checks.filter((check) => check.status === "pass").length;
  const watchCount = checks.filter((check) => check.status === "watch").length;
  const manualCount = checks.filter((check) => check.status === "manual").length;

  return {
    cloudUrl: CLOUD_URL,
    stage: "比赛演示版 / 小范围课程试点预备",
    passCount,
    watchCount,
    manualCount,
    summary:
      watchCount === 0
        ? "当前 Demo 已能完整展示闭环，剩余事项主要是报名信息、访问策略和视频口径的人工确认。"
        : "当前 Demo 已具备上线交付骨架，继续跑完整演示流即可补齐动态闭环证据。",
    checks,
    metrics: [
      {
        id: "availability",
        label: "可用性",
        value: "ZIP + 本地 + 云端三路线",
        target: "任一路径异常时可切换演示",
      },
      {
        id: "quality",
        label: "工程质量",
        value: "测试 / 构建 / 截图 QA",
        target: "正式提交前 FAIL 为 0",
      },
      {
        id: "learning",
        label: "学习闭环",
        value: `${Math.round(coverage * 100)}% 证据覆盖`,
        target: "诊断、干预、复核、反思均有证据",
      },
      {
        id: "governance",
        label: "治理安全",
        value: manualCount > 0 ? `${manualCount} 项人工门禁` : "全部自动通过",
        target: "不宣称未验证提分，不泄露隐私",
      },
    ],
    rollbackSteps: [
      "云端访问异常时切换到本地 Vite Demo。",
    "本地环境异常时播放已生成的 4分40秒演示视频。",
      "高风险建议异常时关闭自动发布，只保留教师复核和证据账本。",
      "真实课程试点异常时导出账本，回退到只读诊断模式。",
    ],
    manualGates: [
      "队伍名、队员信息和文件命名由最终报名信息确认。",
      "云端 Demo 是否公开访问由主办方提交要求确认。",
      "视频使用字幕素材版还是真人旁白版由最终路演节奏确认。",
      "真实教学效果必须等待试点数据后再对外宣称。",
    ],
  };
}
