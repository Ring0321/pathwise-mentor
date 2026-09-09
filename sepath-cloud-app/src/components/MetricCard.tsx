import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  note: string;
  icon: ReactNode;
}

export function MetricCard({ label, value, note, icon }: MetricCardProps) {
  return (
    <section className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </section>
  );
}
