import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Gauge,
  Route,
  ShieldCheck,
  Timer,
} from "lucide-react";
import type { LaunchLoopAcceptanceReport, LaunchLoopStatus } from "../engine/launchLoopAcceptance";

interface LaunchLoopAcceptancePanelProps {
  report: LaunchLoopAcceptanceReport;
}

const statusLabels: Record<LaunchLoopStatus, string> = {
  ready: "可验收",
  fallback: "走兜底",
  manual: "人工确认",
  blocked: "阻断",
};

const ownerLabels: Record<string, string> = {
  captain: "队长",
  algorithm: "算法",
  engineering: "工程",
  product: "产品",
  ops: "运维",
  teacher: "教师",
  team: "全队",
  organizer: "主办方",
};

function StatusIcon({ status }: { status: LaunchLoopStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "manual") return <ClipboardCheck size={17} />;
  if (status === "fallback") return <Route size={17} />;
  return <AlertTriangle size={17} />;
}

function downloadManifest(report: LaunchLoopAcceptanceReport) {
  const blob = new Blob([report.manifest], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sepath-launch-loop-acceptance-manifest.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function LaunchLoopAcceptancePanel({ report }: LaunchLoopAcceptancePanelProps) {
  return (
    <section className="panel launch-loop-panel" id="launch-loop">
      <div className="panel-heading">
        <h2>上线级闭环验收中心</h2>
        <span>把可运行 Demo、后端状态、SLO、技术验收、提交门禁和真实性边界串成评委可复查路线</span>
      </div>

      <div className="launch-loop-hero">
        <article>
          <Gauge size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="launch-loop-score">
          <span>上线准备度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="launch-loop-counts">
          <span>
            <b>{report.readyCount}</b> ready
          </span>
          <span>
            <b>{report.fallbackCount}</b> fallback
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
          <span>
            <b>{report.blockedCount}</b> block
          </span>
        </div>
      </div>

      <div className="launch-loop-metrics">
        {report.metrics.map((metric) => (
          <article className={`launch-loop-card ${metric.status}`} key={metric.id}>
            <span>{statusLabels[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.note}</p>
          </article>
        ))}
      </div>

      <div className="launch-loop-note">
        <ShieldCheck size={17} />
        <code>{report.materialPath}</code>
        <code>{report.machinePath}</code>
        <p>{report.truthBoundary}</p>
      </div>

      <div className="launch-loop-grid">
        <article>
          <div className="ops-heading">
            <Timer size={18} />
            <strong>7 分钟闭环验收分镜</strong>
          </div>
          <div className="launch-loop-timeline">
            {report.stages.map((stage) => (
              <div className={`launch-loop-step ${stage.status}`} key={stage.id}>
                <div className="launch-loop-step-meta">
                  <span>{stage.minute}</span>
                  <StatusIcon status={stage.status} />
                </div>
                <div>
                  <div className="launch-loop-step-head">
                    <strong>{stage.label}</strong>
                    <span>{ownerLabels[stage.owner]} / {statusLabels[stage.status]}</span>
                  </div>
                  <p>{stage.evidence}</p>
                  <dl>
                    <div>
                      <dt>产品锚点</dt>
                      <dd>{stage.productAnchor}</dd>
                    </div>
                    <div>
                      <dt>材料入口</dt>
                      <dd>{stage.materialAnchor}</dd>
                    </div>
                    <div>
                      <dt>评委应看到</dt>
                      <dd>{stage.judgeSignal}</dd>
                    </div>
                    <div>
                      <dt>兜底路线</dt>
                      <dd>{stage.fallback}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>正式上传前人工门禁</strong>
          </div>
          <div className="launch-loop-gates">
            {report.gates.map((gate) => (
              <div className={`launch-loop-card ${gate.status}`} key={gate.id}>
                <span>{ownerLabels[gate.owner]} / {statusLabels[gate.status]}</span>
                <strong>{gate.label}</strong>
                <p>{gate.currentState}</p>
                <small>{gate.acceptCriteria}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="launch-loop-grid lower">
        <article>
          <div className="ops-heading">
            <Route size={18} />
            <strong>现场路线</strong>
          </div>
          <div className="launch-loop-routes">
            {report.routes.map((route) => (
              <div key={route.id}>
                <div>
                  <strong>{route.label}</strong>
                  <span>{route.duration}</span>
                </div>
                <ol>
                  {route.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Download size={18} />
            <strong>机器可读 Manifest</strong>
          </div>
          <div className="launch-loop-command">
            <code>{report.command}</code>
            <code>{report.packageManifestPath}</code>
          </div>
          <button className="primary-button compact" onClick={() => downloadManifest(report)} type="button">
            <Download size={16} />
            下载上线验收 Manifest
          </button>
          <pre className="launch-loop-manifest">{report.manifest}</pre>
        </article>
      </div>
    </section>
  );
}
