import { GitPullRequestArrow, ShieldCheck } from "lucide-react";
import type { EvidenceEvent } from "../domain/types";

interface EvidenceTimelineProps {
  events: EvidenceEvent[];
}

export function EvidenceTimeline({ events }: EvidenceTimelineProps) {
  return (
    <section className="panel timeline-panel">
      <div className="panel-heading">
        <h2>证据账本</h2>
        <span>每个建议都能追溯来源</span>
      </div>
      <div className="timeline">
        {[...events].reverse().map((event) => (
          <article className="timeline-item" key={event.id}>
            <div className={`timeline-dot ${event.risk}`}>
              {event.source === "ci" || event.source === "git" ? (
                <GitPullRequestArrow size={15} />
              ) : (
                <ShieldCheck size={15} />
              )}
            </div>
            <div>
              <div className="timeline-title">
                <strong>{event.title}</strong>
                <span>{event.source}</span>
              </div>
              <p>{event.detail}</p>
              <small>{event.timestamp} · confidence {Math.round(event.confidence * 100)}%</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
