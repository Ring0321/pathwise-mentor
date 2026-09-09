import { Activity, ClipboardCheck, DatabaseZap, FileJson, RotateCcw, ShieldCheck } from "lucide-react";
import type { DataPlaneReport, DataPlaneStatus } from "../engine/dataPlane";

interface DataPlanePanelProps {
  report: DataPlaneReport;
}

const statusLabel: Record<DataPlaneStatus, string> = {
  ready: "就绪",
  configured: "已配置",
  manual: "人工确认",
  blocked: "阻断",
};

function statusClass(status: DataPlaneStatus) {
  return `status-card ${status}`;
}

function statusIcon(status: DataPlaneStatus) {
  if (status === "ready") return <ShieldCheck size={17} />;
  if (status === "configured") return <Activity size={17} />;
  if (status === "manual") return <ClipboardCheck size={17} />;
  return <RotateCcw size={17} />;
}

export function DataPlanePanel({ report }: DataPlanePanelProps) {
  return (
    <section className="panel data-plane-panel" id="data-plane">
      <div className="panel-heading">
        <h2>生产数据平面与部署运维中心</h2>
        <span>把数据库、RLS、备份恢复、健康探针和环境变量做成可上线数据架构</span>
      </div>

      <div className="data-plane-hero">
        <article>
          <DatabaseZap size={23} />
          <div>
            <strong>{report.mode}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="data-plane-score">
          <span>数据平面就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="data-plane-counts">
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

      <div className="data-plane-metrics">
        {report.metrics.map((metric) => (
          <article className={statusClass(metric.status)} key={metric.id}>
            <span>{statusLabel[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.target}</p>
          </article>
        ))}
      </div>

      <div className="data-plane-grid">
        <article>
          <div className="ops-heading">
            <DatabaseZap size={18} />
            <strong>Postgres / Supabase 核心表</strong>
          </div>
          <div className="data-table-list">
            {report.tables.map((table) => (
              <div className={statusClass(table.status)} key={table.id}>
                <div>
                  {statusIcon(table.status)}
                  <strong>{table.name}</strong>
                  <span>{statusLabel[table.status]}</span>
                </div>
                <p>{table.purpose}</p>
                <small>
                  PK {table.primaryKey} | tenant {table.tenantKey} | {table.retention}
                </small>
                <div className="data-tags">
                  {table.fields.map((field) => (
                    <code key={field}>{field}</code>
                  ))}
                </div>
                <em>{table.piiPolicy}</em>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>RLS 与数据访问策略</strong>
          </div>
          <div className="data-policy-list">
            {report.policies.map((policy) => (
              <div className={statusClass(policy.status)} key={policy.id}>
                <span>{statusLabel[policy.status]}</span>
                <strong>{policy.label}</strong>
                <p>{policy.scope}</p>
                <code>{policy.rule}</code>
                <small>{policy.evidence}</small>
              </div>
            ))}
          </div>

          <div className="ops-heading data-section-heading">
            <Activity size={18} />
            <strong>健康探针</strong>
          </div>
          <div className="data-probe-list">
            {report.probes.map((probe) => (
              <div className={statusClass(probe.status)} key={probe.id}>
                <span>{statusLabel[probe.status]}</span>
                <strong>{probe.label}</strong>
                <code>{probe.endpoint}</code>
                <p>{probe.expected}</p>
                <small>{probe.evidence}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="data-plane-grid two">
        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>迁移与发布命令</strong>
          </div>
          <div className="data-migration-list">
            {report.migrations.map((migration) => (
              <div className={statusClass(migration.status)} key={migration.id}>
                <span>{statusLabel[migration.status]}</span>
                <strong>{migration.title}</strong>
                <code>{migration.command}</code>
                <p>{migration.rollback}</p>
                <div className="data-tags">
                  {migration.checks.map((check) => (
                    <code key={check}>{check}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <RotateCcw size={18} />
            <strong>备份、恢复与事故 Runbook</strong>
          </div>
          <div className="data-backup-grid">
            {report.backups.map((backup) => (
              <div className={statusClass(backup.status)} key={backup.id}>
                <span>{statusLabel[backup.status]}</span>
                <strong>{backup.label}</strong>
                <p>{backup.cadence}</p>
                <small>
                  RPO {backup.rpo} / RTO {backup.rto}
                </small>
                <em>{backup.restoreDrill}</em>
              </div>
            ))}
          </div>
          <div className="data-runbook">
            {report.runbook.map((step) => (
              <div className={statusClass(step.status)} key={step.id}>
                <span>{statusLabel[step.status]}</span>
                <strong>{step.label}</strong>
                <p>{step.trigger}</p>
                <small>{step.action}</small>
                <em>{step.evidence}</em>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="data-plane-grid two">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>环境变量与密钥边界</strong>
          </div>
          <div className="data-env-list">
            {report.env.map((item) => (
              <div className={statusClass(item.status)} key={item.key}>
                <span>{item.exposedToBrowser ? "browser" : "server-only"}</span>
                <strong>{item.key}</strong>
                <p>{item.requiredFor}</p>
                <small>
                  {item.owner} | {item.storage}
                </small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <FileJson size={18} />
            <strong>DDL 预览与导出包</strong>
          </div>
          <pre className="data-ddl">{report.ddlPreview}</pre>
          <div className="data-export-grid">
            {report.exportPack.map((item) => (
              <div className={statusClass(item.status)} key={item.id}>
                <strong>{item.label}</strong>
                <code>{item.path}</code>
                <p>{item.purpose}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <details className="data-manifest">
        <summary>查看 sepath-data-plane.v1 Manifest</summary>
        <pre>{report.dataPlaneManifest}</pre>
      </details>
    </section>
  );
}
