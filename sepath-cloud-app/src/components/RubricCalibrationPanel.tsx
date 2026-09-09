import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  Download,
  Scale,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import type {
  RubricCalibrationOwner,
  RubricCalibrationReport,
  RubricCalibrationStatus,
} from "../engine/rubricCalibration";

interface RubricCalibrationPanelProps {
  report: RubricCalibrationReport;
}

const statusLabels: Record<RubricCalibrationStatus, string> = {
  ready: "就绪",
  calibrating: "校准中",
  manual: "人工复核",
  blocked: "阻断",
};

const ownerLabels: Record<RubricCalibrationOwner, string> = {
  teacher: "教师",
  course_admin: "课程管理员",
  researcher: "研究负责人",
  ops: "运营",
  modelops: "ModelOps",
};

function StatusIcon({ status }: { status: RubricCalibrationStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "calibrating") return <Activity size={17} />;
  if (status === "manual") return <ClipboardCheck size={17} />;
  return <AlertTriangle size={17} />;
}

function downloadManifest(report: RubricCalibrationReport) {
  const blob = new Blob([report.calibrationManifest], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sepath-rubric-calibration-manifest.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function RubricCalibrationPanel({ report }: RubricCalibrationPanelProps) {
  return (
    <section className="panel calibration-panel" id="rubric-calibration">
      <div className="panel-heading">
        <h2>教师标注与 Rubric 校准中心</h2>
        <span>把教师锚点、AI 能力估计、一致性阈值、漂移监控和 ModelOps 发布门禁接成可审计闭环</span>
      </div>

      <div className="calibration-hero">
        <article>
          <Scale size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="calibration-score">
          <span>校准可信分</span>
          <strong>{report.score}</strong>
        </div>
        <div className="calibration-counts">
          <span>
            <b>{report.readyCount}</b> ready
          </span>
          <span>
            <b>{report.calibratingCount}</b> calibrate
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
          <span>
            <b>{report.blockedCount}</b> block
          </span>
        </div>
      </div>

      <div className="calibration-mode">
        <DatabaseZap size={18} />
        <span>{report.calibrationMode}</span>
      </div>

      <div className="calibration-metrics">
        {report.metrics.map((metric) => (
          <div className={`calibration-card ${metric.status}`} key={metric.id}>
            <span>{statusLabels[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.target}</p>
          </div>
        ))}
      </div>

      <div className="calibration-grid">
        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>教师锚点样本</strong>
          </div>
          <div className="calibration-samples">
            {report.anchorSamples.map((sample) => (
              <div className={`calibration-sample ${sample.status}`} key={sample.id}>
                <StatusIcon status={sample.status} />
                <div>
                  <div className="calibration-status-head">
                    <strong>{sample.label}</strong>
                    <span>{statusLabels[sample.status]}</span>
                  </div>
                  <p>{sample.source}</p>
                  <div className="calibration-score-pair">
                    <span>
                      教师 <b>{sample.teacherAnchor}</b>
                    </span>
                    <span>
                      AI <b>{sample.aiEstimate}</b>
                    </span>
                    <span>
                      差值 <b>{sample.delta}</b>
                    </span>
                  </div>
                  <small>{sample.decision}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Workflow size={18} />
            <strong>标注队列</strong>
          </div>
          <div className="calibration-queue">
            {report.annotationQueue.map((item) => (
              <div className={`calibration-card ${item.status}`} key={item.id}>
                <span>{ownerLabels[item.owner]}</span>
                <strong>{item.label}</strong>
                <p>{item.trigger}</p>
                <small>{item.action}</small>
                <em>{item.evidence}</em>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="calibration-grid lower">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>一致性与漂移检查</strong>
          </div>
          <div className="calibration-checks">
            {report.agreementChecks.map((check) => (
              <div className={`calibration-status ${check.status}`} key={check.id}>
                <StatusIcon status={check.status} />
                <div>
                  <div className="calibration-status-head">
                    <strong>{check.label}</strong>
                    <span>{check.value}</span>
                  </div>
                  <p>{check.target}</p>
                  <small>{check.method}</small>
                  <em>{check.riskControl}</em>
                </div>
              </div>
            ))}
            {report.driftChecks.map((check) => (
              <div className={`calibration-status ${check.status}`} key={check.id}>
                <StatusIcon status={check.status} />
                <div>
                  <div className="calibration-status-head">
                    <strong>{check.label}</strong>
                    <span>{check.signal}</span>
                  </div>
                  <p>{check.threshold}</p>
                  <small>{check.response}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <AlertTriangle size={18} />
            <strong>发布门禁与导出包</strong>
          </div>
          <div className="calibration-gates">
            {report.releaseGates.map((gate) => (
              <div className={`calibration-status ${gate.status}`} key={gate.id}>
                <StatusIcon status={gate.status} />
                <div>
                  <div className="calibration-status-head">
                    <strong>{gate.label}</strong>
                    <span>{statusLabels[gate.status]}</span>
                  </div>
                  <p>{gate.passCondition}</p>
                  <small>{gate.blockCondition}</small>
                  <em>{gate.evidence}</em>
                </div>
              </div>
            ))}
          </div>
          <div className="calibration-export">
            {report.exportPack.map((item) => (
              <div className={`calibration-card ${item.status}`} key={item.id}>
                <span>{statusLabels[item.status]}</span>
                <strong>{item.label}</strong>
                <code>{item.artifact}</code>
                <p>{item.usage}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="calibration-grid lower">
        <article>
          <div className="ops-heading">
            <Workflow size={18} />
            <strong>校准协议</strong>
          </div>
          <ol className="calibration-protocol">
            {report.calibrationProtocol.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>

        <article>
          <div className="ops-heading">
            <Download size={18} />
            <strong>Rubric Calibration Manifest</strong>
          </div>
          <button className="primary-button compact" onClick={() => downloadManifest(report)}>
            <Download size={16} />
            下载校准 Manifest
          </button>
          <pre className="calibration-manifest">{report.calibrationManifest}</pre>
        </article>
      </div>
    </section>
  );
}
