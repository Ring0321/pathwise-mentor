import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  DatabaseZap,
  Download,
  GraduationCap,
  PlugZap,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import type { TenantOpsReport, TenantOpsStatus } from "../engine/tenantOps";

interface TenantOpsPanelProps {
  report: TenantOpsReport;
}

const statusLabels: Record<TenantOpsStatus, string> = {
  ready: "就绪",
  configured: "已配置",
  manual: "人工确认",
  blocked: "阻断",
};

const ownerLabels: Record<string, string> = {
  school_admin: "学校管理员",
  course_admin: "课程管理员",
  teacher: "教师",
  ops: "运维",
  security: "安全",
  researcher: "研究",
};

function StatusIcon({ status }: { status: TenantOpsStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "configured") return <Activity size={17} />;
  if (status === "manual") return <ClipboardCheck size={17} />;
  return <AlertTriangle size={17} />;
}

function downloadManifest(report: TenantOpsReport) {
  const blob = new Blob([report.tenantManifest], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sepath-tenant-ops-manifest.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function TenantOpsPanel({ report }: TenantOpsPanelProps) {
  return (
    <section className="panel tenantops-panel" id="tenantops">
      <div className="panel-heading">
        <h2>多租户上云运营中心</h2>
        <span>把学校租户、课程复制、角色权限、成本护栏、SLO 和回滚路径变成可执行的上线工作台</span>
      </div>

      <div className="tenantops-hero">
        <article>
          <Cloud size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="tenantops-score">
          <span>上云运营分</span>
          <strong>{report.score}</strong>
        </div>
        <div className="tenantops-counts">
          <span>
            <b>{report.readyCount}</b> ready
          </span>
          <span>
            <b>{report.configuredCount}</b> config
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
          <span>
            <b>{report.blockedCount}</b> block
          </span>
        </div>
      </div>

      <div className="tenantops-mode">
        <DatabaseZap size={18} />
        <span>{report.cloudMode}</span>
      </div>

      <div className="tenantops-metrics">
        {report.metrics.map((metric) => (
          <div className={`tenantops-card ${metric.status}`} key={metric.id}>
            <span>{statusLabels[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.target}</p>
          </div>
        ))}
      </div>

      <div className="tenantops-grid">
        <article>
          <div className="ops-heading">
            <GraduationCap size={18} />
            <strong>租户工作区</strong>
          </div>
          <div className="tenantops-workspaces">
            {report.workspaces.map((workspace) => (
              <div className={`tenantops-status ${workspace.status}`} key={workspace.id}>
                <StatusIcon status={workspace.status} />
                <div>
                  <div className="tenantops-status-head">
                    <strong>{workspace.label}</strong>
                    <span>{statusLabels[workspace.status]}</span>
                  </div>
                  <p>{workspace.activeScope}</p>
                  <small>{workspace.tenantKey}</small>
                  <em>{workspace.isolationCheck}</em>
                  <b>{workspace.learnerSeats}</b>
                  <p>{workspace.goLiveGate}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>角色权限矩阵</strong>
          </div>
          <div className="tenantops-roles">
            {report.roleScopes.map((scope) => (
              <div className={`tenantops-card ${scope.status}`} key={scope.id}>
                <span>{statusLabels[scope.status]}</span>
                <strong>{scope.role}</strong>
                <p>{scope.evidence}</p>
                <div className="tenantops-tags">
                  {scope.permissions.map((permission) => (
                    <code key={permission}>{permission}</code>
                  ))}
                </div>
                <small>禁止：{scope.deniedActions.join(" / ")}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="tenantops-grid lower">
        <article>
          <div className="ops-heading">
            <CalendarDays size={18} />
            <strong>租户开通流程</strong>
          </div>
          <div className="tenantops-provisioning">
            {report.provisioning.map((step) => (
              <div className={`tenantops-status ${step.status}`} key={step.id}>
                <StatusIcon status={step.status} />
                <div>
                  <div className="tenantops-status-head">
                    <strong>{step.label}</strong>
                    <span>{step.phase} / {ownerLabels[step.owner]}</span>
                  </div>
                  <p>{step.automation}</p>
                  <small>{step.evidence}</small>
                  <em>{step.rollback}</em>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <PlugZap size={18} />
            <strong>成本护栏与服务 SLO</strong>
          </div>
          <div className="tenantops-guardrails">
            {report.costGuardrails.map((guardrail) => (
              <div className={`tenantops-card ${guardrail.status}`} key={guardrail.id}>
                <span>{statusLabels[guardrail.status]}</span>
                <strong>{guardrail.label}</strong>
                <p>{guardrail.limit}</p>
                <small>{guardrail.trigger}</small>
                <em>{guardrail.action}</em>
              </div>
            ))}
          </div>
          <div className="tenantops-slos">
            {report.slos.map((slo) => (
              <div className={`tenantops-card ${slo.status}`} key={slo.id}>
                <span>{statusLabels[slo.status]}</span>
                <strong>{slo.label}</strong>
                <p>{slo.objective}</p>
                <small>{slo.monitor}</small>
                <em>{slo.fallback}</em>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="tenantops-grid lower">
        <article>
          <div className="ops-heading">
            <Workflow size={18} />
            <strong>上线 Runbook 与检查清单</strong>
          </div>
          <div className="tenantops-runbooks">
            {report.runbooks.map((runbook) => (
              <div className={`tenantops-card ${runbook.status}`} key={runbook.id}>
                <span>{ownerLabels[runbook.owner]}</span>
                <strong>{runbook.label}</strong>
                <p>{runbook.trigger}</p>
                <ol>
                  {runbook.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <ol className="tenantops-checklist">
            {report.goLiveChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>

        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>交付包与租户 Manifest</strong>
          </div>
          <div className="tenantops-export">
            {report.exportPack.map((item) => (
              <div className={`tenantops-card ${item.status}`} key={item.id}>
                <span>{statusLabels[item.status]}</span>
                <strong>{item.label}</strong>
                <code>{item.artifact}</code>
                <p>{item.usage}</p>
              </div>
            ))}
          </div>
          <button className="primary-button compact" onClick={() => downloadManifest(report)}>
            <Download size={16} />
            下载租户 Manifest
          </button>
          <pre className="tenantops-manifest">{report.tenantManifest}</pre>
        </article>
      </div>
    </section>
  );
}
