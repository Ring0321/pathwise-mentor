import type { AppState } from "../domain/types";
import type { PilotReadinessReport } from "./pilotReadiness";

export type PrivacyStatus = "pass" | "watch" | "block";
export type WorkspaceRole = "student" | "teacher" | "course_admin" | "competition_reviewer";

export interface RolePermission {
  role: WorkspaceRole;
  label: string;
  canView: string[];
  canExport: boolean;
  canApproveIntervention: boolean;
  restrictions: string[];
}

export interface DataClassRule {
  id: string;
  label: string;
  status: PrivacyStatus;
  storageMode: string;
  retention: string;
  evidence: string;
}

export interface PrivacyAuditEvent {
  id: string;
  label: string;
  status: PrivacyStatus;
  evidence: string;
}

export interface PrivacyGuardReport {
  score: number;
  gate: PrivacyStatus;
  summary: string;
  piiFindings: number;
  protectedFields: string[];
  roleMatrix: RolePermission[];
  dataClasses: DataClassRule[];
  auditEvents: PrivacyAuditEvent[];
  blockedRequests: string[];
  publishRules: string[];
}

function countPossiblePii(state: AppState): number {
  const text = [
    state.learner.id,
    state.learner.name,
    state.learner.role,
    state.learner.goal,
    state.task.title,
    state.task.description,
    ...state.events.flatMap((event) => [event.title, event.detail]),
  ].join("\n");
  const emailHits = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.length ?? 0;
  const phoneHits = text.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}\b/g)?.length ?? 0;
  const secretHits = text.match(/(?:api[_-]?key|secret|token|AKIA|sk-[A-Za-z0-9_-]{12,})/gi)?.length ?? 0;
  return emailHits + phoneHits + secretHits;
}

function statusFor(condition: boolean): PrivacyStatus {
  return condition ? "pass" : "watch";
}

export function buildPrivacyGuardReport(state: AppState, pilotReadiness: PilotReadinessReport): PrivacyGuardReport {
  const piiFindings = countPossiblePii(state);
  const hasTeacherReview = state.events.some((event) => event.type === "teacher_reviewed");
  const hasImportExport = pilotReadiness.integrations.some((item) => item.id === "storage");
  const consentReady = state.learner.consentValid;
  const gate: PrivacyStatus = piiFindings > 0 ? "block" : consentReady ? "pass" : "watch";
  const score = Math.max(
    0,
    Math.min(
      100,
      78 + (consentReady ? 8 : 0) + (hasTeacherReview ? 5 : 0) + (hasImportExport ? 5 : 0) - piiFindings * 18,
    ),
  );

  return {
    score,
    gate,
    summary:
      gate === "pass"
        ? "当前演示工作空间满足最小化采集、脱敏展示、教师发布门和账本导入导出边界，可用于公开试用和课程影子运行。"
        : gate === "watch"
          ? "当前可继续演示，但真实课程试点前必须补齐授权、访问策略和删除通道。"
          : "检测到疑似敏感字段，必须先脱敏并重新审计后才能发布。",
    piiFindings,
    protectedFields: [
      "student_real_name",
      "phone",
      "email",
      "repository_secret",
      "raw_source_code",
      "private_teacher_comment",
    ],
    roleMatrix: [
      {
        role: "student",
        label: "学生",
        canView: ["本人路径", "本人证据摘要", "脚手架提示", "反思任务"],
        canExport: false,
        canApproveIntervention: false,
        restrictions: ["不可查看同伴风险分层", "不可导出班级账本"],
      },
      {
        role: "teacher",
        label: "任课教师",
        canView: ["班级风险队列", "学生证据摘要", "教师复核工单", "导出脱敏账本"],
        canExport: true,
        canApproveIntervention: true,
        restrictions: ["默认不显示手机号/邮箱", "高风险建议必须留痕"],
      },
      {
        role: "course_admin",
        label: "课程负责人",
        canView: ["聚合指标", "授权状态", "审计日志", "回滚记录"],
        canExport: true,
        canApproveIntervention: false,
        restrictions: ["不可替代教师审批具体学习干预", "只能处理租户内数据"],
      },
      {
        role: "competition_reviewer",
        label: "比赛评委",
        canView: ["合成演示数据", "公开试用包", "审计报告", "材料索引"],
        canExport: false,
        canApproveIntervention: false,
        restrictions: ["只读访问", "不接触真实学生数据"],
      },
    ],
    dataClasses: [
      {
        id: "synthetic-demo",
        label: "合成演示数据",
        status: "pass",
        storageMode: "前端 localStorage / 静态包",
        retention: "可随时重置",
        evidence: "当前提交包只包含合成学生和模拟 PR/CI 事件。",
      },
      {
        id: "pseudonymous-events",
        label: "脱敏 EvidenceEvent",
        status: statusFor(consentReady),
        storageMode: "课程租户隔离",
        retention: "默认 180 天",
        evidence: consentReady ? "演示学生 consentValid=true。" : "真实试点前必须补齐授权。",
      },
      {
        id: "repository-evidence",
        label: "仓库过程证据",
        status: piiFindings === 0 ? "pass" : "block",
        storageMode: "只保存 PR/CI/Review 摘要",
        retention: "随课程周期归档",
        evidence: piiFindings === 0 ? "未发现邮箱、手机号或密钥模式。" : `发现 ${piiFindings} 个疑似敏感字段。`,
      },
      {
        id: "teacher-review",
        label: "教师复核记录",
        status: statusFor(hasTeacherReview),
        storageMode: "审计日志 + 复核工单",
        retention: "按学校试点协议",
        evidence: hasTeacherReview ? "教师复核已写入证据链。" : "高风险建议仍需教师确认。",
      },
    ],
    auditEvents: [
      {
        id: "privacy-scan",
        label: "敏感字段扫描",
        status: piiFindings === 0 ? "pass" : "block",
        evidence: piiFindings === 0 ? "邮箱、手机号、密钥模式均未命中。" : `命中 ${piiFindings} 个疑似敏感字段。`,
      },
      {
        id: "consent-check",
        label: "授权状态检查",
        status: statusFor(consentReady),
        evidence: consentReady ? "当前学习者授权标记有效。" : "真实试点前需要补齐授权记录。",
      },
      {
        id: "export-boundary",
        label: "导入导出边界",
        status: hasImportExport ? "pass" : "watch",
        evidence: "账本导入只合并 EvidenceEvent，不覆盖课程和身份配置。",
      },
      {
        id: "human-gate",
        label: "教师发布门",
        status: statusFor(hasTeacherReview),
        evidence: hasTeacherReview ? "高风险建议已进入人工复核闭环。" : "演示时继续点击教师复核可补齐。",
      },
    ],
    blockedRequests: [
      "评委匿名访问真实学生账本",
      "学生导出班级风险清单",
      "模型输出完整可提交代码",
      "导入账本覆盖当前课程租户配置",
      "未经授权接入真实仓库密钥",
    ],
    publishRules: [
      "公开试用只使用合成数据。",
      "真实试点只保存脱敏 EvidenceEvent 摘要。",
      "学生撤回授权后停止新采集，并删除可识别个人事件。",
      "高风险建议默认进入教师发布门。",
      "导出账本前执行敏感字段扫描和人工确认。",
    ],
  };
}
