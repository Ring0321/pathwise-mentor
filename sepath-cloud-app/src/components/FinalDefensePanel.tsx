import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  Mic2,
  Route,
  ShieldCheck,
  Timer,
} from "lucide-react";
import type { FinalDefenseReport, FinalDefenseStatus } from "../engine/finalDefense";

interface FinalDefensePanelProps {
  report: FinalDefenseReport;
}

const statusLabels: Record<FinalDefenseStatus, string> = {
  ready: "已就绪",
  watch: "观察",
  manual: "人工确认",
  blocked: "阻断",
};

const ownerLabels: Record<string, string> = {
  captain: "队长",
  algorithm: "算法",
  engineering: "工程",
  product: "产品",
  ops: "运营",
  teacher: "教师",
};

function StatusIcon({ status }: { status: FinalDefenseStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "blocked") return <AlertTriangle size={17} />;
  if (status === "manual") return <ClipboardCheck size={17} />;
  return <Route size={17} />;
}

function downloadManifest(report: FinalDefenseReport) {
  const blob = new Blob([report.manifest], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sepath-final-defense-manifest.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function FinalDefensePanel({ report }: FinalDefensePanelProps) {
  return (
    <section className="panel final-defense-panel" id="final-defense">
      <div className="panel-heading">
        <h2>决赛追问指挥台</h2>
        <span>把5分钟口播、尖锐追问、证据路径、运行命令和禁止夸大口径收敛成可现场跳转的答辩控制台</span>
      </div>

      <div className="final-defense-hero">
        <article>
          <Mic2 size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="final-defense-score">
          <span>答辩就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="final-defense-counts">
          <span>
            <b>{report.readyCount}</b> ready
          </span>
          <span>
            <b>{report.watchCount}</b> watch
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
          <span>
            <b>{report.blockedCount}</b> block
          </span>
        </div>
      </div>

      <div className="final-defense-metrics">
        {report.metrics.map((metric) => (
          <div className={`final-defense-card ${metric.status}`} key={metric.id}>
            <span>{statusLabels[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.target}</p>
          </div>
        ))}
      </div>

      <div className="final-defense-grid">
        <article>
          <div className="ops-heading">
            <Timer size={18} />
            <strong>口播三档</strong>
          </div>
          <div className="final-defense-scripts">
            {report.scripts.map((script) => (
              <div className={`final-defense-status ${script.status}`} key={script.id}>
                <StatusIcon status={script.status} />
                <div>
                  <div className="final-defense-status-head">
                    <strong>{script.label}</strong>
                    <span>{script.durationSeconds}秒 / {statusLabels[script.status]}</span>
                  </div>
                  <p>{script.script}</p>
                  <code>{script.screenAnchor}</code>
                  <small>{script.proof}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>答辩门禁</strong>
          </div>
          <div className="final-defense-gates">
            {report.readinessGates.map((gate) => (
              <div className={`final-defense-card ${gate.status}`} key={gate.id}>
                <span>{statusLabels[gate.status]}</span>
                <strong>{gate.label}</strong>
                <p>{gate.criteria}</p>
                <small>{gate.evidence}</small>
                <em>{gate.nextAction}</em>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="final-defense-grid lower wide">
        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>尖锐追问回答卡</strong>
          </div>
          <div className="final-defense-questions">
            {report.challengeCards.map((card) => (
              <div className={`final-defense-question ${card.status}`} key={card.id}>
                <StatusIcon status={card.status} />
                <div>
                  <div className="final-defense-status-head">
                    <strong>{card.question}</strong>
                    <span>{ownerLabels[card.owner]} / {statusLabels[card.status]}</span>
                  </div>
                  <p>{card.shortAnswer}</p>
                  <dl>
                    <div>
                      <dt>产品锚点</dt>
                      <dd>{card.demoAnchor}</dd>
                    </div>
                    <div>
                      <dt>证据材料</dt>
                      <dd>{card.evidencePath}</dd>
                    </div>
                    <div>
                      <dt>风险陷阱</dt>
                      <dd>{card.trap}</dd>
                    </div>
                    <div>
                      <dt>补救口径</dt>
                      <dd>{card.recovery}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="final-defense-grid lower">
        <article>
          <div className="ops-heading">
            <FileCheck2 size={18} />
            <strong>证据跳转路线</strong>
          </div>
          <div className="final-defense-routes">
            {report.evidenceRoutes.map((route) => (
              <div className={`final-defense-card ${route.status}`} key={route.id}>
                <span>{statusLabels[route.status]}</span>
                <strong>{route.label}</strong>
                <code>{route.productAnchor}</code>
                <p>{route.materialPath}</p>
                <small>{route.command}</small>
                <em>{route.judgeProof}</em>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <AlertTriangle size={18} />
            <strong>禁止夸大口径</strong>
          </div>
          <div className="final-defense-forbidden">
            {report.forbiddenLines.map((line) => (
              <div key={line.id}>
                <strong>{line.riskyLine}</strong>
                <p>{line.safeLine}</p>
                <small>{line.source}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="final-defense-grid lower">
        <article>
          <div className="ops-heading">
            <Route size={18} />
            <strong>现场Runbook</strong>
          </div>
          <ol className="final-defense-runbook">
            {report.runbook.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>

        <article>
          <div className="ops-heading">
            <Download size={18} />
            <strong>机器可读Manifest</strong>
          </div>
          <button className="primary-button compact" onClick={() => downloadManifest(report)}>
            <Download size={16} />
            下载追问Manifest
          </button>
          <pre className="final-defense-manifest">{report.manifest}</pre>
        </article>
      </div>
    </section>
  );
}
