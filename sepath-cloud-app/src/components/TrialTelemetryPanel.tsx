import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  Download,
  FileCheck2,
  GraduationCap,
  ShieldCheck,
  Timer,
  Workflow,
} from "lucide-react";
import type { TrialTelemetryReport, TrialTelemetryStatus } from "../engine/trialTelemetry";

interface TrialTelemetryPanelProps {
  report: TrialTelemetryReport;
}

const statusLabels: Record<TrialTelemetryStatus, string> = {
  ready: "就绪",
  collecting: "采集中",
  manual: "人工",
  blocked: "阻断",
};

const ownerLabels: Record<string, string> = {
  teacher: "教师",
  ops: "工程",
  researcher: "研究",
  course_admin: "课程管理员",
  school: "学校",
};

function StatusIcon({ status }: { status: TrialTelemetryStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "collecting") return <Activity size={17} />;
  if (status === "manual") return <ClipboardCheck size={17} />;
  return <AlertTriangle size={17} />;
}

function downloadManifest(report: TrialTelemetryReport) {
  const blob = new Blob([report.telemetryManifest], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sepath-trial-telemetry-manifest.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function TrialTelemetryPanel({ report }: TrialTelemetryPanelProps) {
  return (
    <section className="panel telemetry-panel" id="trial-telemetry">
      <div className="panel-heading">
        <h2>试点遥测与效果验证中心</h2>
        <span>把真实课程试点的数据契约、对照设计、效果指标和声明边界变成可执行研究闭环</span>
      </div>

      <div className="telemetry-hero">
        <article>
          <GraduationCap size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="telemetry-score">
          <span>试点可信度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="telemetry-counts">
          <span>
            <b>{report.readyCount}</b> ready
          </span>
          <span>
            <b>{report.collectingCount}</b> collect
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
          <span>
            <b>{report.blockedCount}</b> block
          </span>
        </div>
      </div>

      <div className="telemetry-metrics">
        {report.metrics.map((metric) => (
          <div className={`telemetry-card ${metric.status}`} key={metric.id}>
            <span>{statusLabels[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.target}</p>
          </div>
        ))}
      </div>

      <div className="telemetry-grid">
        <article>
          <div className="ops-heading">
            <DatabaseZap size={18} />
            <strong>遥测数据流</strong>
          </div>
          <div className="telemetry-streams">
            {report.streams.map((stream) => (
              <div className={`telemetry-status ${stream.status}`} key={stream.id}>
                <StatusIcon status={stream.status} />
                <div>
                  <div className="telemetry-status-head">
                    <strong>{stream.label}</strong>
                    <span>{stream.cadence}</span>
                  </div>
                  <p>{stream.source}</p>
                  <small>{stream.privacyGate}</small>
                  <em>{stream.qualityCheck}</em>
                  <div className="telemetry-tags">
                    {stream.fields.map((field) => (
                      <code key={field}>{field}</code>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Workflow size={18} />
            <strong>试点分组设计</strong>
          </div>
          <div className="telemetry-arms">
            {report.experimentArms.map((arm) => (
              <div className={`telemetry-card ${arm.status}`} key={arm.id}>
                <span>{statusLabels[arm.status]}</span>
                <strong>{arm.label}</strong>
                <p>{arm.population}</p>
                <small>{arm.intervention}</small>
                <em>{arm.comparison}</em>
                <b>{arm.successSignal}</b>
                <p>{arm.riskControl}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="telemetry-grid lower">
        <article>
          <div className="ops-heading">
            <Timer size={18} />
            <strong>效果指标与分析方法</strong>
          </div>
          <div className="telemetry-outcomes">
            {report.outcomeMeasures.map((measure) => (
              <div className={`telemetry-card ${measure.status}`} key={measure.id}>
                <span>{statusLabels[measure.status]}</span>
                <strong>{measure.label}</strong>
                <p>{measure.baseline}</p>
                <small>{measure.target}</small>
                <em>{measure.analysisMethod}</em>
                <p>{measure.evidence}</p>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>验证计划</strong>
          </div>
          <div className="telemetry-plan">
            {report.validationPlan.map((step) => (
              <div className={`telemetry-status ${step.status}`} key={step.id}>
                <StatusIcon status={step.status} />
                <div>
                  <div className="telemetry-status-head">
                    <strong>{step.label}</strong>
                    <span>{step.day} / {ownerLabels[step.owner]}</span>
                  </div>
                  <p>{step.action}</p>
                  <small>{step.exitCriteria}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="telemetry-grid lower">
        <article>
          <div className="ops-heading">
            <FileCheck2 size={18} />
            <strong>匿名分析数据包</strong>
          </div>
          <div className="telemetry-datasets">
            {report.analysisDataset.map((dataset) => (
              <div className={`telemetry-card ${dataset.status}`} key={dataset.id}>
                <span>{statusLabels[dataset.status]}</span>
                <strong>{dataset.label}</strong>
                <code>{dataset.fileName}</code>
                <p>{dataset.grain}</p>
                <small>{dataset.purpose}</small>
                <em>隐私：{dataset.privacyRule}</em>
                <b>{dataset.readinessCheck}</b>
                <div className="telemetry-tags">
                  {dataset.fields.map((field) => (
                    <code key={field}>{field}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>分析检查与效果分级</strong>
          </div>
          <div className="telemetry-checks">
            {report.analysisChecks.map((check) => (
              <div className={`telemetry-card ${check.status}`} key={check.id}>
                <span>{statusLabels[check.status]}</span>
                <strong>{check.label}</strong>
                <p>{check.method}</p>
                <small>通过：{check.passRule}</small>
                <em>失败处理：{check.failAction}</em>
              </div>
            ))}
          </div>
          <div className="telemetry-decisions">
            {report.effectDecisionRules.map((rule) => (
              <div className={`telemetry-card ${rule.status}`} key={rule.id}>
                <span>{rule.claimTier}</span>
                <strong>{rule.label}</strong>
                <p>{rule.minEvidence}</p>
                <small>可判定：{rule.allowedDecision}</small>
                <em>阻断：{rule.blockedDecision}</em>
                <b>{rule.reviewerQuestion}</b>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="telemetry-grid lower">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>声明门禁</strong>
          </div>
          <div className="telemetry-claims">
            {report.claimGates.map((gate) => (
              <div className={`telemetry-card ${gate.status}`} key={gate.id}>
                <span>{statusLabels[gate.status]}</span>
                <strong>{gate.label}</strong>
                <p>可说：{gate.allowedClaim}</p>
                <small>禁止：{gate.forbiddenClaim}</small>
                <em>证据：{gate.evidenceNeeded}</em>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <FileCheck2 size={18} />
            <strong>导出与分析包</strong>
          </div>
          <div className="telemetry-export">
            {report.exportPack.map((item) => (
              <div className={`telemetry-card ${item.status}`} key={item.id}>
                <span>{statusLabels[item.status]}</span>
                <strong>{item.label}</strong>
                <code>{item.path}</code>
                <p>{item.content}</p>
              </div>
            ))}
          </div>
          <div className="telemetry-contract">
            {report.dataContract.map((field) => (
              <code key={field}>{field}</code>
            ))}
          </div>
          <p className="telemetry-notebook">{report.analysisNotebook}</p>
          <button className="primary-button compact" onClick={() => downloadManifest(report)}>
            <Download size={16} />
            下载遥测 Manifest
          </button>
          <pre className="telemetry-manifest">{report.telemetryManifest}</pre>
        </article>
      </div>
    </section>
  );
}
