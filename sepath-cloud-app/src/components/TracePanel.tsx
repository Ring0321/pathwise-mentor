import { Activity, Gauge } from "lucide-react";
import type { ObservabilityTrace } from "../domain/types";

interface TracePanelProps {
  traces: ObservabilityTrace[];
}

export function TracePanel({ traces }: TracePanelProps) {
  return (
    <section className="panel trace-panel">
      <div className="panel-heading">
        <h2>可观测追踪</h2>
        <span>上线后能查模型、工具、成本与质量门</span>
      </div>
      <div className="trace-list">
        {traces.map((trace) => (
          <article className="trace-row" key={trace.id}>
            <Activity size={16} />
            <div>
              <strong>{trace.span}</strong>
              <span>{trace.model} · {trace.tool}</span>
            </div>
            <div className="trace-metrics">
              <span><Gauge size={13} /> {trace.latencyMs}ms</span>
              <span>{trace.tokenCost} tok</span>
              <b className={trace.qualityGate}>{trace.qualityGate}</b>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
