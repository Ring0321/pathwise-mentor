import { FileCheck2, UserRoundCheck } from "lucide-react";
import type { ReviewTicket } from "../domain/types";

interface TeacherConsoleProps {
  ticket: ReviewTicket;
}

export function TeacherConsole({ ticket }: TeacherConsoleProps) {
  return (
    <section className="panel teacher-panel">
      <div className="panel-heading">
        <h2>教师复核台</h2>
        <span>高风险建议必须有人类发布门</span>
      </div>
      <article className={`ticket ${ticket.action}`}>
        <div className="ticket-title">
          <FileCheck2 size={18} />
          <strong>{ticket.title}</strong>
          <span>{ticket.action}</span>
        </div>
        <p>{ticket.reason}</p>
        <div className="ticket-actions">
          {(ticket.requiredActions.length ? ticket.requiredActions : ["记录审计日志并允许推送"]).map((item) => (
            <span key={item}>
              <UserRoundCheck size={14} />
              {item}
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}
