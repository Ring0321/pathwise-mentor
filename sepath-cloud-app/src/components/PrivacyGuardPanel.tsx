import { EyeOff, LockKeyhole, ShieldCheck, UserRoundCog } from "lucide-react";
import type { PrivacyGuardReport, PrivacyStatus } from "../engine/privacyGuard";

interface PrivacyGuardPanelProps {
  report: PrivacyGuardReport;
}

const statusLabel: Record<PrivacyStatus, string> = {
  pass: "通过",
  watch: "待确认",
  block: "拦截",
};

export function PrivacyGuardPanel({ report }: PrivacyGuardPanelProps) {
  return (
    <section className="panel privacy-panel" id="privacy">
      <div className="panel-heading">
        <h2>权限与隐私治理中心</h2>
        <span>把角色最小权限、数据分级、敏感字段扫描和审计留痕做成产品内发布门</span>
      </div>

      <div className="privacy-hero">
        <div>
          <ShieldCheck size={22} />
          <strong>{statusLabel[report.gate]}</strong>
          <p>{report.summary}</p>
        </div>
        <div>
          <span>治理得分</span>
          <b>{report.score}</b>
        </div>
        <div>
          <span>疑似敏感字段</span>
          <b>{report.piiFindings}</b>
        </div>
      </div>

      <div className="privacy-grid">
        <article>
          <div className="ops-heading">
            <UserRoundCog size={18} />
            <strong>角色最小权限</strong>
          </div>
          <div className="role-matrix">
            {report.roleMatrix.map((role) => (
              <div key={role.role}>
                <strong>{role.label}</strong>
                <p>{role.canView.join(" / ")}</p>
                <span>{role.canExport ? "可导出脱敏账本" : "不可导出账本"}</span>
                <small>{role.restrictions.join("；")}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <LockKeyhole size={18} />
            <strong>数据分级与留存</strong>
          </div>
          <div className="data-class-list">
            {report.dataClasses.map((item) => (
              <div className={item.status} key={item.id}>
                <span>{statusLabel[item.status]}</span>
                <strong>{item.label}</strong>
                <p>{item.storageMode}</p>
                <small>{item.retention} | {item.evidence}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="privacy-grid lower">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>审计事件</strong>
          </div>
          <div className="privacy-audit-list">
            {report.auditEvents.map((event) => (
              <div className={event.status} key={event.id}>
                <span>{statusLabel[event.status]}</span>
                <strong>{event.label}</strong>
                <p>{event.evidence}</p>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <EyeOff size={18} />
            <strong>拦截规则与受保护字段</strong>
          </div>
          <div className="privacy-tags">
            {report.protectedFields.map((field) => (
              <code key={field}>{field}</code>
            ))}
          </div>
          <div className="blocked-list">
            {report.blockedRequests.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <ol className="privacy-rule-list">
            {report.publishRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );
}
