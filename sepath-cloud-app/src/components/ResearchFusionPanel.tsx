import {
  AlertTriangle,
  Beaker,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Download,
  GitBranch,
  Network,
  Workflow,
} from "lucide-react";
import type {
  ResearchFusionOwner,
  ResearchFusionReport,
  ResearchFusionStatus,
} from "../engine/researchFusion";

interface ResearchFusionPanelProps {
  report: ResearchFusionReport;
}

const statusLabels: Record<ResearchFusionStatus, string> = {
  ready: "就绪",
  watch: "观察",
  manual: "人工确认",
  blocked: "阻断",
};

const ownerLabels: Record<ResearchFusionOwner, string> = {
  product: "产品",
  algorithm: "算法",
  research: "科研",
  teacher: "教师",
  ops: "运营",
  legal: "合规",
};

function StatusIcon({ status }: { status: ResearchFusionStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "watch") return <Beaker size={17} />;
  if (status === "manual") return <ClipboardCheck size={17} />;
  return <AlertTriangle size={17} />;
}

function downloadManifest(report: ResearchFusionReport) {
  const blob = new Blob([report.fusionManifest], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sepath-research-fusion-manifest.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ResearchFusionPanel({ report }: ResearchFusionPanelProps) {
  return (
    <section className="panel fusion-panel" id="research-fusion">
      <div className="panel-heading">
        <h2>科研算法融合与开源证据中台</h2>
        <span>把算法思想、开源参考、研究假设、验证阶梯和答辩材料统一成可审计产品证据</span>
      </div>

      <div className="fusion-hero">
        <article>
          <Network size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="fusion-score">
          <span>科研融合度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="fusion-counts">
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

      <div className="fusion-metrics">
        {report.metrics.map((metric) => (
          <div className={`fusion-card ${metric.status}`} key={metric.id}>
            <span>{statusLabels[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.target}</p>
          </div>
        ))}
      </div>

      <div className="fusion-grid lower">
        <article>
          <div className="ops-heading">
            <Workflow size={18} />
            <strong>思想迁移链</strong>
          </div>
          <div className="fusion-migration">
            {report.ideaMigration.map((item) => (
              <div className={`fusion-status ${item.status}`} key={item.id}>
                <StatusIcon status={item.status} />
                <div>
                  <div className="fusion-status-head">
                    <strong>{item.label}</strong>
                    <span>{statusLabels[item.status]}</span>
                  </div>
                  <p>{item.sourceIdea}</p>
                  <small>{item.sePathImplementation}</small>
                  <em>{item.evidence}</em>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Network size={18} />
            <strong>算法贡献图谱</strong>
          </div>
          <div className="fusion-edge-list">
            {report.contributionGraph.map((edge) => (
              <div className={`fusion-edge ${edge.status}`} key={edge.id}>
                <div className="fusion-edge-flow">
                  <code>{edge.from}</code>
                  <span>→</span>
                  <code>{edge.to}</code>
                </div>
                <strong>{edge.relation}</strong>
                <p>{edge.judgeCheck}</p>
                <small>{statusLabels[edge.status]}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="fusion-grid">
        <article>
          <div className="ops-heading">
            <GitBranch size={18} />
            <strong>开源项目参考矩阵</strong>
          </div>
          <div className="fusion-source-list">
            {report.openSourceReferences.map((item) => (
              <div className={`fusion-status ${item.status}`} key={item.id}>
                <StatusIcon status={item.status} />
                <div>
                  <div className="fusion-status-head">
                    <strong>{item.label}</strong>
                    <span>{item.license}</span>
                  </div>
                  <p>{item.referenceValue}</p>
                  <small>{item.productMapping}</small>
                  <em>{item.boundary}</em>
                  <code>{item.sourceUrl}</code>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Beaker size={18} />
            <strong>自研算法贡献</strong>
          </div>
          <div className="fusion-algorithms">
            {report.algorithmContributions.map((item) => (
              <div className={`fusion-card ${item.status}`} key={item.id}>
                <span>{statusLabels[item.status]}</span>
                <strong>{item.label}</strong>
                <p>{item.novelty}</p>
                <div className="fusion-tags">
                  {item.inputs.map((input) => (
                    <code key={input}>{input}</code>
                  ))}
                </div>
                <small>{item.outputs}</small>
                <em>{item.evidence}</em>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="fusion-grid lower">
        <article>
          <div className="ops-heading">
            <BookOpenCheck size={18} />
            <strong>研究假设</strong>
          </div>
          <div className="fusion-hypotheses">
            {report.researchHypotheses.map((item) => (
              <div className={`fusion-status ${item.status}`} key={item.id}>
                <StatusIcon status={item.status} />
                <div>
                  <div className="fusion-status-head">
                    <strong>{item.label}</strong>
                    <span>{statusLabels[item.status]}</span>
                  </div>
                  <p>{item.hypothesis}</p>
                  <small>{item.method}</small>
                  <em>{item.primaryMetric}</em>
                  <b>{item.currentEvidence}</b>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Workflow size={18} />
            <strong>验证阶梯</strong>
          </div>
          <div className="fusion-stages">
            {report.validationStages.map((stage) => (
              <div className={`fusion-status ${stage.status}`} key={stage.id}>
                <StatusIcon status={stage.status} />
                <div>
                  <div className="fusion-status-head">
                    <strong>{stage.label}</strong>
                    <span>{ownerLabels[stage.owner]}</span>
                  </div>
                  <p>{stage.gate}</p>
                  <small>{stage.evidence}</small>
                  <em>{stage.nextAction}</em>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="fusion-grid lower">
        <article>
          <div className="ops-heading">
            <BookOpenCheck size={18} />
            <strong>论文与答辩转化</strong>
          </div>
          <ol className="fusion-outline">
            {report.paperOutline.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <div className="fusion-defense">
            {report.defenseScript.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Download size={18} />
            <strong>贡献证据包与 Research Fusion Manifest</strong>
          </div>
          <div className="fusion-evidence-pack">
            {report.contributionEvidencePack.map((item) => (
              <div className={`fusion-card ${item.status}`} key={item.id}>
                <span>{statusLabels[item.status]}</span>
                <strong>{item.label}</strong>
                <p>{item.claim}</p>
                <code>{item.evidencePath}</code>
                <em>{item.verification}</em>
              </div>
            ))}
          </div>
          <div className="fusion-deliverables">
            {report.deliverables.map((item) => (
              <div className={`fusion-card ${item.status}`} key={item.id}>
                <span>{statusLabels[item.status]}</span>
                <strong>{item.label}</strong>
                <code>{item.artifact}</code>
                <p>{item.usage}</p>
              </div>
            ))}
          </div>
          <button className="primary-button compact" onClick={() => downloadManifest(report)}>
            <Download size={16} />
            下载融合 Manifest
          </button>
          <pre className="fusion-manifest">{report.fusionManifest}</pre>
        </article>
      </div>
    </section>
  );
}
