import type { TopicNode } from '../../../shared/types';

export function TopicsView({ topics }: { topics: TopicNode[] }) {
  return (
    <ul className="topics">
      {topics.map((t, i) => (
        <Topic key={i} node={t} depth={0} />
      ))}
    </ul>
  );
}

function Topic({ node, depth }: { node: TopicNode; depth: number }) {
  const label = (
    <>
      <strong>{node.title}</strong>
      {node.summary && <span className="muted"> · {node.summary}</span>}
    </>
  );
  if (!node.children?.length) return <li>{label}</li>;
  return (
    <li>
      <details open={depth === 0}>
        <summary>{label}</summary>
        <ul>
          {node.children.map((c, i) => (
            <Topic key={i} node={c} depth={depth + 1} />
          ))}
        </ul>
      </details>
    </li>
  );
}
