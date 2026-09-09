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
import type { AgentRuntimeReport, AgentRuntimeStatus } from "../engine/agentRuntime";

interface AgentRuntimePanelProps {
  report: AgentRuntimeReport;
}

const statusLabels: Record<AgentRuntimeStatus, string> = {
  ready: "就绪",
  shadow: "影子",
  manual: "人工",
  blocked: "阻断",
};

function StatusIcon({ status }: { status: AgentRuntimeStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "shadow") return <Activity size={17} />;
  if (status === "manual") return <ShieldCheck size={17} />;
  return <TriangleAlert size={17} />;
}

export function AgentRuntimePanel({ report }: AgentRuntimePanelProps) {
  return (
    <section className="panel runtime-panel" id="ai-runtime">
      <div className="panel-heading">
        <h2>AI Agent 运行时与模型接入中心</h2>
        <span>把大模型路由、RAG 上下文、工具调用、安全降级和运行时观测做成可上线架构</span>
      </div>

      <div className="runtime-hero">
        <article>
          <BrainCircuit size={23} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="runtime-score">
          <span>运行时就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="runtime-counts">
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

      <div className="runtime-metrics">
        {report.metrics.map((metric) => (
          <article key={metric.id}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.target}</p>
          </article>
        ))}
      </div>

      <div className="runtime-route-grid">
        {report.routes.map((route) => (
          <article className={`runtime-route ${route.status}`} key={route.id}>
            <div>
              <StatusIcon status={route.status} />
              <strong>{route.label}</strong>
              <span>{statusLabels[route.status]}</span>
            </div>
            <b>{route.provider}</b>
            <p>{route.purpose}</p>
            <small>{route.guardrail}</small>
            <em>{route.fallback}</em>
          </article>
        ))}
      </div>

      <div className="runtime-grid">
        <article>
          <div className="ops-heading">
            <Bot size={18} />
            <strong>Prompt 契约与拒答规则</strong>
          </div>
          <div className="runtime-contracts">
            {report.promptContracts.map((contract) => (
              <div className={`runtime-status ${contract.status}`} key={contract.id}>
                <span>{statusLabels[contract.status]}</span>
                <strong>{contract.label}</strong>
                <p>{contract.refusalRule}</p>
                <small>in: {contract.inputSchema.join(" / ")}</small>
                <small>out: {contract.outputSchema.join(" / ")}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <DatabaseZap size={18} />
            <strong>RAG 上下文包</strong>
          </div>
          <div className="runtime-context">
            {report.contextPack.map((item) => (
              <div key={item.id}>
                <span>{item.source}</span>
                <strong>{item.label}</strong>
                <p>{item.reason}</p>
                <b>{item.tokenBudget} tokens</b>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="runtime-grid lower">
        <article>
          <div className="ops-heading">
            <Workflow size={18} />
            <strong>工具调用 Trace</strong>
          </div>
          <div className="runtime-trace">
            {report.toolTrace.map((step) => (
              <div className={`runtime-status ${step.gate}`} key={step.id}>
                <StatusIcon status={step.gate} />
                <strong>{step.tool}</strong>
                <span>{step.latencyMs} ms</span>
                <p>{step.input} {"->"} {step.output}</p>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>质量门与无 Key 降级</strong>
          </div>
          <div className="runtime-gates">
            {report.qualityGates.map((gate) => (
              <div className={`runtime-status ${gate.status}`} key={gate.id}>
                <StatusIcon status={gate.status} />
                <strong>{gate.label}</strong>
                <span>{statusLabels[gate.status]}</span>
                <p>{gate.evidence}</p>
                <small>{gate.action}</small>
              </div>
            ))}
          </div>
          <div className="runtime-fallback">
            {report.fallbackPlan.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </article>
      </div>

      <pre className="runtime-manifest">{report.deploymentManifest}</pre>
    </section>
  );
}
