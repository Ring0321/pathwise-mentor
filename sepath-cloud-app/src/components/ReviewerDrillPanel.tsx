import { AlertTriangle, CheckCircle2, ClipboardCheck, MonitorPlay, Route, Timer } from "lucide-react";
import type { ReviewerDrillReport, ReviewerDrillStatus } from "../engine/reviewerDrill";

interface ReviewerDrillPanelProps {
  report: ReviewerDrillReport;
}

const statusLabels: Record<ReviewerDrillStatus, string> = {
  ready: "可执行",
  fallback: "走兜底",
  manual: "人工口径",
  blocked: "阻断",
};

function StatusIcon({ status }: { status: ReviewerDrillStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "fallback") return <Route size={17} />;
  if (status === "manual") return <ClipboardCheck size={17} />;
  return <AlertTriangle size={17} />;
}

export function ReviewerDrillPanel({ report }: ReviewerDrillPanelProps) {
  return (
    <section className="panel reviewer-drill-panel" id="reviewer-drill">
      <div className="panel-heading">
        <h2>评委 5 分钟实操演练中心</h2>
        <span>把试用账号、点击路线、教师复核、SLO 证据、评分标准和真实性边界压缩成可执行现场路径</span>
      </div>

      <div className="drill-hero">
        <article>
          <Timer size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="drill-score">
          <span>演练就绪度</span>
          <strong>{report.score}</strong>
          <small>{Math.round(report.durationSeconds / 60)} min</small>
        </div>
        <div className="drill-counts">
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

      <div className="drill-command">
        <MonitorPlay size={17} />
        <code>{report.command}</code>
        <span>{report.reportPath}</span>
      </div>

      <div className="drill-personas">
        {report.personas.map((persona) => (
          <article className={`drill-persona ${persona.status}`} key={persona.id}>
            <div>
              <StatusIcon status={persona.status} />
              <strong>{persona.label}</strong>
              <span>{persona.role} / {statusLabels[persona.status]}</span>
            </div>
            <p>{persona.entry}</p>
            <small>{persona.credentialPolicy}</small>
            <em>{persona.successSignal}</em>
          </article>
        ))}
      </div>

      <div className="drill-grid">
        <article>
          <div className="ops-heading">
            <Timer size={18} />
            <strong>5 分钟操作时间轴</strong>
          </div>
          <div className="drill-timeline">
            {report.steps.map((step) => (
              <div className={`drill-step ${step.status}`} key={step.id}>
                <div className="drill-step-time">
                  <span>{step.minute}</span>
                  <StatusIcon status={step.status} />
                </div>
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.action}</p>
                  <dl>
                    <div>
                      <dt>成功信号</dt>
                      <dd>{step.expectedSignal}</dd>
                    </div>
                    <div>
                      <dt>产品入口</dt>
                      <dd>{step.productAnchor}</dd>
                    </div>
                    <div>
                      <dt>材料入口</dt>
                      <dd>{step.materialAnchor}</dd>
                    </div>
                  </dl>
                  <code>{step.evidence}</code>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>自检命令与验收点</strong>
          </div>
          <div className="drill-checks">
            {report.checkpoints.map((checkpoint) => (
              <div className={`drill-check ${checkpoint.status}`} key={checkpoint.id}>
                <StatusIcon status={checkpoint.status} />
                <div>
                  <strong>{checkpoint.label}</strong>
                  <code>{checkpoint.command}</code>
                  <span>{checkpoint.evidence}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="ops-heading drill-subheading">
            <Route size={18} />
            <strong>异常兜底路线</strong>
          </div>
          <div className="drill-recovery">
            {report.recoveryLanes.map((lane) => (
              <div className={`drill-recovery-row ${lane.status}`} key={lane.id}>
                <strong>{lane.trigger}</strong>
                <p>{lane.switchTo}</p>
                <code>{lane.proof}</code>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="drill-grid lower">
        <article>
          <div className="ops-heading">
            <CheckCircle2 size={18} />
            <strong>比赛评分映射</strong>
          </div>
          <div className="drill-scoring">
            {report.scoringMap.map((item) => (
              <div key={item.id}>
                <div>
                  <strong>{item.criterion}</strong>
                  <span>{item.scoreWeight}</span>
                </div>
                <p>{item.judgeQuestion}</p>
                <small>{item.productProof}</small>
                <code>{item.materialProof}</code>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <MonitorPlay size={18} />
            <strong>机器可读 Manifest</strong>
          </div>
          <p className="drill-boundary">{report.truthBoundary}</p>
          <pre className="drill-manifest">{report.manifest}</pre>
        </article>
      </div>
    </section>
  );
}
