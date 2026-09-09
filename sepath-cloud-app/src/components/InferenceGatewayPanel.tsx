import {
  Activity,
  Bot,
  BrainCircuit,
  CheckCircle2,
  DatabaseZap,
  ShieldCheck,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import type { InferenceGatewayReport, InferenceGatewayStatus } from "../engine/inferenceGateway";

interface InferenceGatewayPanelProps {
  report: InferenceGatewayReport;
}

const statusLabels: Record<InferenceGatewayStatus, string> = {
  ready: "就绪",
  shadow: "影子",
  manual: "人工",
  blocked: "阻断",
};

function StatusIcon({ status }: { status: InferenceGatewayStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "shadow") return <Activity size={17} />;
  if (status === "manual") return <ShieldCheck size={17} />;
  return <TriangleAlert size={17} />;
}

export function InferenceGatewayPanel({ report }: InferenceGatewayPanelProps) {
  return (
    <section className="panel inference-panel" id="inference-gateway">
      <div className="panel-heading">
        <h2>推理网关与 GraphRAG 试验台</h2>
        <span>把真实模型接入、RAG 上下文、密钥隔离、无 Key 降级和输出评测做成可上线链路</span>
      </div>

      <div className="inference-hero">
        <article>
          <BrainCircuit size={23} />
          <div>
            <strong>{report.mode}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="inference-score">
          <span>网关就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="inference-counts">
          <span>
            <b>{report.readyCount}</b> ready
          </span>
          <span>
            <b>{report.shadowCount}</b> shadow
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
          <span>
            <b>{report.blockedCount}</b> block
          </span>
        </div>
      </div>

      <div className="inference-provider-grid">
        {report.providers.map((provider) => (
          <article className={`inference-card ${provider.status}`} key={provider.id}>
            <div className="inference-card-head">
              <StatusIcon status={provider.status} />
              <strong>{provider.label}</strong>
              <span>{statusLabels[provider.status]}</span>
            </div>
            <b>{provider.endpoint}</b>
            <p>{provider.role}</p>
            <small>{provider.guardrail}</small>
            <em>{provider.fallback}</em>
            {provider.envVars.length > 0 && (
              <div className="inference-tags">
                {provider.envVars.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="inference-grid">
        <article>
          <div className="ops-heading">
            <DatabaseZap size={18} />
            <strong>GraphRAG 上下文包</strong>
          </div>
          <div className="inference-context">
            {report.contextChunks.map((chunk) => (
              <div key={chunk.id}>
                <span>{chunk.source}</span>
                <strong>{chunk.label}</strong>
                <p>{chunk.excerpt}</p>
                <b>{Math.round(chunk.score * 100)}% / {chunk.tokenBudget} tokens</b>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>推理发布门</strong>
          </div>
          <div className="inference-guardrails">
            {report.guardrails.map((guardrail) => (
              <div className={`inference-status ${guardrail.status}`} key={guardrail.id}>
                <StatusIcon status={guardrail.status} />
                <strong>{guardrail.label}</strong>
                <span>{statusLabels[guardrail.status]}</span>
                <p>{guardrail.evidence}</p>
                <small>{guardrail.enforcement}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="inference-grid lower">
        <article>
          <div className="ops-heading">
            <Workflow size={18} />
            <strong>端到端 Trace</strong>
          </div>
          <div className="inference-trace">
            {report.trace.map((step) => (
              <div className={`inference-status ${step.status}`} key={step.id}>
                <StatusIcon status={step.status} />
                <strong>{step.label}</strong>
                <span>{step.latencyMs} ms</span>
                <p>{step.tool}: {step.output}</p>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Bot size={18} />
            <strong>开源参考边界</strong>
          </div>
          <div className="inference-os">
            {report.openSourceReferences.map((item) => (
              <div key={item.id}>
                <span>{item.sourceUrl}</span>
                <strong>{item.label}</strong>
                <p>{item.referenceValue}</p>
                <small>{item.productBoundary}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="inference-code-grid">
        <article>
          <div className="ops-heading">
            <DatabaseZap size={18} />
            <strong>请求契约</strong>
          </div>
          <pre>{report.requestContract}</pre>
        </article>
        <article>
          <div className="ops-heading">
            <BrainCircuit size={18} />
            <strong>无 Key 响应预览</strong>
          </div>
          <pre>{report.responsePreview}</pre>
        </article>
      </div>

      <div className="inference-deploy">
        {report.deploymentSteps.map((step) => (
          <span key={step}>{step}</span>
        ))}
      </div>

      <div className="inference-code-grid">
        <article>
          <div className="ops-heading">
            <Workflow size={18} />
            <strong>Worker 契约</strong>
          </div>
          <pre>{report.workerContract}</pre>
        </article>
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>Inference Manifest</strong>
          </div>
          <pre>{report.inferenceManifest}</pre>
        </article>
      </div>
    </section>
  );
}
