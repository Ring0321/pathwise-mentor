import { CheckCircle2, CircleDashed, Lock, TriangleAlert } from "lucide-react";
import type { PathNodeState } from "../domain/types";

interface PathBoardProps {
  nodes: PathNodeState[];
}

function iconFor(status: PathNodeState["status"]) {
  if (status === "completed") return <CheckCircle2 size={17} />;
  if (status === "blocked") return <TriangleAlert size={17} />;
  if (status === "locked") return <Lock size={17} />;
  return <CircleDashed size={17} />;
}

export function PathBoard({ nodes }: PathBoardProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>下一步路径板</h2>
        <span>不是静态推荐，是可回放状态机</span>
      </div>
      <div className="path-board">
        {nodes.map((node) => (
          <article className={`path-node ${node.status}`} key={node.id}>
            <div>{iconFor(node.status)}</div>
            <strong>{node.label}</strong>
            <span>{node.status}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
