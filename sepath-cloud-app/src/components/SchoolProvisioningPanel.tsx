import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  Download,
  GraduationCap,
  KeyRound,
  ShieldCheck,
  TriangleAlert,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import type {
  SchoolProvisioningReport,
  SchoolProvisioningRole,
  SchoolProvisioningStatus,
} from "../engine/schoolProvisioning";

interface SchoolProvisioningPanelProps {
  report: SchoolProvisioningReport;
}

const statusLabels: Record<SchoolProvisioningStatus, string> = {
  ready: "就绪",
  configured: "已配置",
  manual: "人工确认",
  blocked: "阻断",
};

const roleLabels: Record<SchoolProvisioningRole, string> = {
  school_admin: "学校管理员",
  course_admin: "课程管理员",
  teacher: "教师",
  student: "学生",
  reviewer: "评委",
  ops: "运维",
};

function StatusIcon({ status }: { status: SchoolProvisioningStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "configured") return <Activity size={17} />;
  if (status === "manual") return <ClipboardCheck size={17} />;
  return <TriangleAlert size={17} />;
}

function downloadManifest(report: SchoolProvisioningReport) {
  const blob = new Blob([report.accountManifest], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sepath-school-provisioning-manifest.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function SchoolProvisioningPanel({ report }: SchoolProvisioningPanelProps) {
  return (
    <section className="panel school-panel" id="school-provisioning">
      <div className="panel-heading">
        <h2>学校初始化与演示账号中心</h2>
        <span>把学校管理员、教师、学生、评委的入口、权限、邀请和回滚边界做成可上线账号方案</span>
      </div>

      <div className="school-hero">
        <article>
          <UserRoundCog size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="school-score">
          <span>账号就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="school-counts">
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

      <div className="school-notice">
        {report.accountNotice.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <div className="school-metrics">
        {report.metrics.map((metric) => (
          <article className={`school-card ${metric.status}`} key={metric.id}>
            <span>{statusLabels[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.target}</p>
          </article>
        ))}
      </div>

      <div className="school-grid">
        <article>
          <div className="ops-heading">
            <KeyRound size={18} />
            <strong>身份入口</strong>
          </div>
          <div className="school-stack">
            {report.identityProviders.map((provider) => (
              <div className={`school-status ${provider.status}`} key={provider.id}>
                <StatusIcon status={provider.status} />
                <div>
                  <div className="school-status-head">
                    <strong>{provider.label}</strong>
                    <span>{statusLabels[provider.status]}</span>
                  </div>
                  <p>{provider.entry}</p>
                  <small>{provider.mode}</small>
                  <em>{provider.boundary}</em>
                  {provider.envVars.length > 0 && (
                    <div className="school-tags">
                      {provider.envVars.map((item) => (
                        <code key={item}>{item}</code>
                      ))}
                    </div>
                  )}
                  <b>{provider.fallback}</b>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <UsersRound size={18} />
            <strong>演示身份与可见范围</strong>
          </div>
          <div className="school-account-grid">
            {report.demoAccounts.map((account) => (
              <div className={`school-card ${account.status}`} key={account.id}>
                <span>{roleLabels[account.role]}</span>
                <strong>{account.label}</strong>
                <code>{account.entryPath}</code>
                <p>{account.workspace}</p>
                <div className="school-tags">
                  {account.canView.map((item) => (
                    <code key={item}>{item}</code>
                  ))}
                </div>
                <small>禁止：{account.deniedActions.join(" / ")}</small>
                <em>{account.credentialPolicy}</em>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="school-grid lower">
        <article>
          <div className="ops-heading">
            <GraduationCap size={18} />
            <strong>开通阶段与邀请策略</strong>
          </div>
          <div className="school-stage-list">
            {report.stages.map((stage) => (
              <div className={`school-status ${stage.status}`} key={stage.id}>
                <StatusIcon status={stage.status} />
                <div>
                  <div className="school-status-head">
                    <strong>{stage.label}</strong>
                    <span>{stage.phase} / {roleLabels[stage.owner]}</span>
                  </div>
                  <p>{stage.action}</p>
                  <small>{stage.evidence}</small>
                  <em>{stage.rollback}</em>
                </div>
              </div>
            ))}
          </div>
          <div className="school-invites">
            {report.invitations.map((invite) => (
              <div className={`school-card ${invite.status}`} key={invite.id}>
                <span>{roleLabels[invite.role]}</span>
                <strong>{invite.label}</strong>
                <p>{invite.channel}</p>
                <code>{invite.tokenScope}</code>
                <small>{invite.expiresIn}</small>
                <em>{invite.approvalGate}</em>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>访问门禁与审计</strong>
          </div>
          <div className="school-gates">
            {report.gates.map((gate) => (
              <div className={`school-status ${gate.status}`} key={gate.id}>
                <StatusIcon status={gate.status} />
                <div>
                  <div className="school-status-head">
                    <strong>{gate.label}</strong>
                    <span>{statusLabels[gate.status]}</span>
                  </div>
                  <p>{gate.evidence}</p>
                  <small>{gate.enforcement}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="school-audit">
            {report.auditTrail.map((event) => (
              <div className={`school-card ${event.status}`} key={event.id}>
                <span>{roleLabels[event.actor]}</span>
                <strong>{event.label}</strong>
                <code>{event.trace}</code>
                <p>{event.evidence}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="school-grid lower">
        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>角色进入路线</strong>
          </div>
          <div className="school-playbooks">
            {report.playbooks.map((playbook) => (
              <div className="school-card ready" key={playbook.id}>
                <span>{roleLabels[playbook.role]} / {playbook.minutes} min</span>
                <strong>{playbook.label}</strong>
                <p>{playbook.route}</p>
                <small>{playbook.successSignal}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Download size={18} />
            <strong>账号交付包</strong>
          </div>
          <div className="school-notice">
            <span>
              评委种子包 <code>{report.demoSeedManifestPath}</code>
            </span>
            <span>
              材料说明 <code>{report.demoSeedMaterialPath}</code>
            </span>
            <span>
              生成命令 <code>{report.demoSeedCommand}</code>
            </span>
            <span>{report.demoSeedRuntime}</span>
          </div>
          <div className="school-export">
            {report.exportPack.map((item) => (
              <div className={`school-card ${item.status}`} key={item.id}>
                <span>{statusLabels[item.status]}</span>
                <strong>{item.label}</strong>
                <code>{item.artifact}</code>
                <p>{item.usage}</p>
              </div>
            ))}
          </div>
          <button className="primary-button compact" onClick={() => downloadManifest(report)}>
            <Download size={16} />
            下载账号 Manifest
          </button>
          <pre className="school-manifest">{report.accountManifest}</pre>
        </article>
      </div>
    </section>
  );
}
