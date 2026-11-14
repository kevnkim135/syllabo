import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Inline $...$ / \(...\) and display $$...$$ / \[...\] math, rendered with KaTeX. Plain text is escaped by
// React; only the math goes through KaTeX (throwOnError: false, so bad LaTeX shows as source, never crashes).
const MATH = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$((?:\\\$|[^$\n])+?)\$/g;

type Part = { text: string } | { html: string; display: boolean };

export function splitMath(src: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of src.matchAll(MATH)) {
    if (m.index! > last) parts.push({ text: src.slice(last, m.index) });
    const display = m[1] !== undefined || m[2] !== undefined;
    const tex = (m[1] ?? m[2] ?? m[3] ?? m[4]).trim();
    parts.push({ html: katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'html' }), display });
    last = m.index! + m[0].length;
  }
  if (last < src.length) parts.push({ text: src.slice(last) });
  return parts;
}

export function MathText({ text, as: Tag = 'span', className }: { text: string; as?: 'span' | 'p' | 'div'; className?: string }) {
  const parts = useMemo(() => splitMath(text), [text]);
  return (
    <Tag className={className}>
      {parts.map((p, i) =>
        'text' in p ? (
          <span key={i}>{p.text}</span>
        ) : (
          <span key={i} className={p.display ? 'math-block' : 'math-inline'} dangerouslySetInnerHTML={{ __html: p.html }} />
        ),
      )}
    </Tag>
  );
}
