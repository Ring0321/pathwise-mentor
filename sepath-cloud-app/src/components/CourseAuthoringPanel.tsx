import {
  BookOpenCheck,
  ClipboardList,
  FileJson,
  GitBranch,
  ShieldCheck,
  SlidersHorizontal,
  Workflow,
} from "lucide-react";
import type { CourseAuthoringReport, CourseAuthoringStatus } from "../engine/courseAuthoring";

interface CourseAuthoringPanelProps {
  report: CourseAuthoringReport;
}

const statusLabel: Record<CourseAuthoringStatus, string> = {
  ready: "可发布",
  configured: "已配置",
  manual: "待人工",
};

function statusClass(status: CourseAuthoringStatus) {
  return `authoring-status ${status}`;
}

export function CourseAuthoringPanel({ report }: CourseAuthoringPanelProps) {
  return (
    <section className="panel authoring-panel" id="authoring">
      <div className="panel-heading">
        <h2>课程配置与 Rubric Studio</h2>
        <span>把软件工程课程、AI 使用边界、作业模板和发布门做成可迁移的配置包</span>
      </div>

      <div className="authoring-hero">
        <div>
          <BookOpenCheck size={22} />
          <strong>{report.courseTitle}</strong>
          <p>{report.gate}</p>
        </div>
        <div>
          <span>课程配置就绪度</span>
          <b>{report.score}</b>
        </div>
        <div className="authoring-counts">
          <span>
            <b>{report.readyCount}</b> 可发布
          </span>
          <span>
            <b>{report.configuredCount}</b> 已配置
          </span>
          <span>
            <b>{report.manualCount}</b> 待人工
          </span>
        </div>
      </div>

      <div className="authoring-grid">
        <article>
          <div className="ops-heading">
            <SlidersHorizontal size={18} />
            <strong>课程工作空间</strong>
          </div>
          <div className="authoring-workspace">
            {report.workspace.map((item) => (
              <div className={statusClass(item.status)} key={item.id}>
                <span>{statusLabel[item.status]} | {item.owner}</span>
                <strong>{item.label}</strong>
                <p>{item.value}</p>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ClipboardList size={18} />
            <strong>Rubric 能力矩阵</strong>
          </div>
          <div className="authoring-rubrics">
            {report.rubrics.map((rubric) => (
              <div className={statusClass(rubric.status)} key={rubric.competencyId}>
                <span>{statusLabel[rubric.status]} | weight {rubric.weight}%</span>
                <strong>{rubric.label}</strong>
                <p>{rubric.aiBoundary}</p>
                <small>{rubric.evidenceSignals.join(" / ")}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="authoring-grid lower">
        <article>
          <div className="ops-heading">
            <GitBranch size={18} />
            <strong>软件工程作业模板</strong>
          </div>
          <div className="assignment-templates">
            {report.assignments.map((assignment) => (
              <div className={statusClass(assignment.status)} key={assignment.id}>
                <span>{statusLabel[assignment.status]}</span>
                <strong>{assignment.label}</strong>
                <p>{assignment.scenario}</p>
                <small>{assignment.workflow.join(" -> ")}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>AI 边界与发布门</strong>
          </div>
          <div className="authoring-policies">
            {report.aiPolicies.map((policy) => (
              <div className={statusClass(policy.status)} key={policy.id}>
                <span>{policy.id}</span>
                <strong>{policy.label}</strong>
                <p>{policy.escalation}</p>
                <small>允许：{policy.allowed.join("、")}；禁止：{policy.blocked.join("、")}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="authoring-grid lower">
        <article>
          <div className="ops-heading">
            <Workflow size={18} />
            <strong>发布清单与创新模式</strong>
          </div>
          <div className="authoring-checklist">
            {report.publishChecklist.map((item) => (
              <div className={statusClass(item.status)} key={item.id}>
                <span>{statusLabel[item.status]} | {item.owner}</span>
                <strong>{item.label}</strong>
                <p>{item.evidence}</p>
              </div>
            ))}
          </div>
          <div className="design-patterns">
            {report.learningDesignPatterns.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <FileJson size={18} />
            <strong>可导出课程配置 Manifest</strong>
          </div>
          <pre className="authoring-manifest">{report.exportManifest}</pre>
          <div className="authoring-version">
            <code>{report.courseVersion}</code>
            <code>{report.mode}</code>
          </div>
        </article>
      </div>
    </section>
  );
}
