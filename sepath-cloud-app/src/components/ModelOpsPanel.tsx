import { Beaker, BrainCircuit, GitCompareArrows, ShieldCheck } from "lucide-react";
import type { ModelOpsReport, ModelOpsStatus } from "../engine/modelOps";

interface ModelOpsPanelProps {
  report: ModelOpsReport;
}

const statusLabel: Record<ModelOpsStatus, string> = {
  ready: "可发布",
  watch: "观察中",
  manual: "人工门禁",
};

function statusClass(status: ModelOpsStatus) {
  return `modelops-status ${status}`;
}

export function ModelOpsPanel({ report }: ModelOpsPanelProps) {
  return (
    <section className="panel modelops-panel" id="modelops">
      <div className="panel-heading">
        <h2>模型与实验治理中心</h2>
        <span>把 SafeVOI、路径数字孪生、知识边界、隐私治理和 API 契约组织成可发布算法管线</span>
      </div>

      <div className="modelops-hero">
        <div>
          <BrainCircuit size={22} />
          <strong>{report.champion}</strong>
          <p>{report.gate}</p>
        </div>
        <div>
          <span>模型治理分</span>
          <b>{report.score}</b>
        </div>
        <div className="modelops-counts">
          <span>
            <b>{report.readyCount}</b> 可发布
          </span>
          <span>
            <b>{report.watchCount}</b> 观察中
          </span>
          <span>
            <b>{report.manualCount}</b> 人工门禁
          </span>
        </div>
      </div>

      <div className="modelops-grid">
        <article>
          <div className="ops-heading">
            <BrainCircuit size={18} />
            <strong>算法注册表</strong>
          </div>
          <div className="modelops-registry">
            {report.registry.map((item) => (
              <div className={statusClass(item.status)} key={item.id}>
                <span>{item.version}</span>
                <strong>{item.label}</strong>
                <p>{item.role}</p>
                <small>{item.outputContract}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Beaker size={18} />
            <strong>实验协议</strong>
          </div>
          <div className="modelops-protocols">
            {report.protocols.map((protocol) => (
              <div className={statusClass(protocol.status)} key={protocol.id}>
                <span>{statusLabel[protocol.status]}</span>
                <strong>{protocol.label}</strong>
                <p>{protocol.hypothesis}</p>
                <small>{protocol.primaryMetric} | {protocol.guardrail}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="modelops-grid lower">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>发布门与漂移监控</strong>
          </div>
          <div className="modelops-gates">
            {report.releaseGates.map((gate) => (
              <div className={statusClass(gate.status)} key={gate.id}>
                <span>{statusLabel[gate.status]}</span>
                <strong>{gate.label}</strong>
                <p>{gate.evidence}</p>
              </div>
            ))}
          </div>
          <div className="modelops-monitors">
            {report.monitors.map((monitor) => (
              <div className={statusClass(monitor.status)} key={monitor.id}>
                <span>{monitor.value}</span>
                <strong>{monitor.label}</strong>
                <p>{monitor.threshold}</p>
                <small>{monitor.action}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <GitCompareArrows size={18} />
            <strong>特征契约、离线/在线评价</strong>
          </div>
          <div className="feature-contracts">
            {report.featureContracts.map((feature) => (
              <div key={feature.id}>
                <span>{feature.source}</span>
                <strong>{feature.label}</strong>
                <p>{feature.refresh}</p>
                <small>{feature.privacy}</small>
              </div>
            ))}
          </div>
          <div className="modelops-eval">
            {report.offlineEval.map((item) => (
              <span key={item}>{item}</span>
            ))}
            {report.onlineEval.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <ol className="modelops-actions">
            {report.nextModelActions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>
      </div>

      <div className="modelops-version">
        <code>{report.modelVersion}</code>
        <code>{report.releaseMode}</code>
        <code>challenger={report.challenger}</code>
      </div>
    </section>
  );
}
