import { Activity, ClipboardCheck, DatabaseZap, ShieldCheck } from "lucide-react";
import type { ApiContractReport, ApiContractStatus } from "../engine/apiContract";

interface ApiContractPanelProps {
  report: ApiContractReport;
}

const statusLabel: Record<ApiContractStatus, string> = {
  ready: "可接入",
  configured: "已设计",
  manual: "人工确认",
};

function statusClass(status: ApiContractStatus) {
  return `api-status ${status}`;
}

export function ApiContractPanel({ report }: ApiContractPanelProps) {
  return (
    <section className="panel api-panel" id="api">
      <div className="panel-heading">
        <h2>API 与集成契约中心</h2>
        <span>把真实仓库、CI、LMS、飞书和数据库接入前的 API、Webhook、幂等和租户隔离做成上线契约</span>
      </div>

      <div className="api-hero">
        <div>
          <DatabaseZap size={22} />
          <strong>{report.mode}</strong>
          <p>{report.gate}</p>
        </div>
        <div>
          <span>契约就绪度</span>
          <b>{report.score}</b>
        </div>
        <div className="api-counts">
          <span>
            <b>{report.readyCount}</b> 可接入
          </span>
          <span>
            <b>{report.configuredCount}</b> 已设计
          </span>
          <span>
            <b>{report.manualCount}</b> 人工确认
          </span>
        </div>
      </div>

      <div className="api-residency">
        <span>
          OpenAPI 机器契约 <code>{report.openApiSpecPath}</code>
        </span>
        <span>
          校验报告 <code>{report.openApiValidationReportPath}</code>
        </span>
        <span>
          校验命令 <code>{report.openApiValidationCommand}</code>
        </span>
        <span>{report.openApiOperationCount} 个已声明 operation</span>
      </div>
      <pre className="api-payload">{report.openApiManifest}</pre>

      <div className="api-grid">
        <article>
          <div className="ops-heading">
            <Activity size={18} />
            <strong>核心 API 契约</strong>
          </div>
          <div className="api-endpoints">
            {report.endpoints.map((endpoint) => (
              <div className={statusClass(endpoint.status)} key={endpoint.id}>
                <span>{endpoint.method}</span>
                <strong>{endpoint.path}</strong>
                <p>{endpoint.purpose}</p>
                <small>{endpoint.authScope} | {endpoint.idempotency}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>Webhook 与字段保护</strong>
          </div>
          <div className="api-webhooks">
            {report.webhooks.map((webhook) => (
              <div className={statusClass(webhook.status)} key={webhook.id}>
                <span>{webhook.source}</span>
                <strong>{webhook.eventName}</strong>
                <p>{webhook.evidenceMapping}</p>
                <small>{webhook.retryPolicy}</small>
                <div>
                  {webhook.protectedFields.map((field) => (
                    <code key={field}>{field}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="api-grid lower">
        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>开班接入步骤</strong>
          </div>
          <div className="api-provisioning">
            {report.provisioning.map((step) => (
              <div className={statusClass(step.status)} key={step.id}>
                <span>{statusLabel[step.status]}</span>
                <strong>{step.label}</strong>
                <p>{step.evidence}</p>
                <small>{step.owner} | {step.nextAction}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <DatabaseZap size={18} />
            <strong>环境变量、样例载荷与迁移路线</strong>
          </div>
          <div className="api-metrics">
            {report.metrics.map((metric) => (
              <div key={metric.id}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.target}</p>
              </div>
            ))}
          </div>
          <div className="api-env">
            {report.environmentVariables.map((item) => (
              <code key={item}>{item}</code>
            ))}
          </div>
          <pre className="api-payload">{report.samplePayload}</pre>
          <ol className="api-plan">
            {report.migrationPlan.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>
      </div>

      <div className="api-residency">
        {report.dataResidencyRules.map((rule) => (
          <span key={rule}>{rule}</span>
        ))}
      </div>
    </section>
  );
}
