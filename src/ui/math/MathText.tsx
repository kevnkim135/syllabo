import { useMemo } from 'react';
import katex from 'katex';
import 'katex/contrib/mhchem'; // \ce{2H2 + O2 -> 2H2O} and \pu{...} for chemistry
import 'katex/dist/katex.min.css';

// Inline $...$ / \(...\) and display $$...$$ / \[...\] math, rendered with KaTeX. Plain text is escaped by
// React; only the math goes through KaTeX (throwOnError: false, so bad LaTeX shows as quiet source, never crashes).
//
// Inline $...$ follows the usual Markdown rule so prices are not mistaken for math: the opening $ is followed
// by a non-space, the closing $ is preceded by a non-space and not followed by a digit ("$5 and $10" is text).
const MATH = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?=[^\s$])((?:\\\$|[^$\n])*?[^\s\\$])\$(?!\d)/g;

// LaTeX the model wrote without delimiters ("\frac{1}{2} mv^2"): a known command with its braces and
// attached sub/superscripts. Only these commands, so ordinary backslashes in prose are left alone.
const BARE = /\\(?:frac|dfrac|tfrac|sqrt|int|iint|oint|sum|prod|lim|infty|partial|nabla|vec|hat|bar|dot|ddot|mathrm|mathbf|text|ce|pu|alpha|beta|gamma|delta|Delta|epsilon|varepsilon|theta|lambda|mu|pi|rho|sigma|Sigma|tau|phi|varphi|omega|Omega|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|propto|rightarrow|leftarrow|Rightarrow|leftrightarrow|rightleftharpoons|to|degree|circ)(?![a-zA-Z])(?:\s*(?:\{(?:[^{}]|\{[^{}]*\})*\}|\[[^\]]*\]))*(?:[_^](?:\{(?:[^{}]|\{[^{}]*\})*\}|\w))*/g;

// Inline fractions are unreadably small in text style; show them at display size inline.
const TALL = /\\(?:frac|binom)(?![a-zA-Z])/; // sums and integrals stay compact inline (display size makes lines too tall)

const MACROS = { '\\R': '\\mathbb{R}', '\\N': '\\mathbb{N}', '\\Z': '\\mathbb{Z}', '\\Q': '\\mathbb{Q}', '\\C': '\\mathbb{C}', '\\degree': '^{\\circ}' };

type Part = { text: string } | { html: string; display: boolean };

const cache = new Map<string, string>();
/** KaTeX HTML for one expression (cached: the same formulas re-render on every lesson switch). */
export function renderTex(tex: string, display: boolean): string {
  const key = `${display ? 'D' : 'I'}${tex}`;
  let html = cache.get(key);
  if (html === undefined) {
    const opts = { displayMode: display, throwOnError: false, strict: 'ignore' as const, output: 'html' as const, macros: { ...MACROS }, errorColor: '#8B6BD6' };
    html = katex.renderToString(!display && TALL.test(tex) ? `\\displaystyle ${tex}` : tex, opts);
    if (html.includes('katex-error')) html = katex.renderToString(tex, opts); // show the source as written
    if (cache.size > 2000) cache.clear();
    cache.set(key, html);
  }
  return html;
}

// Short undelimited powers in prose: "mv^2", "x^3", "e^{-kt}".
const POWER = /(?<![\w\\])[A-Za-z]{1,3}\^(?:\d+|\{[^{}\s]{1,12}\})(?!\w)/g;
const BARES = new RegExp(`${BARE.source}|${POWER.source}`, 'g');

/** Plain text, with any undelimited LaTeX commands rendered. */
function bare(text: string, parts: Part[]) {
  let last = 0;
  for (const m of text.matchAll(BARES)) {
    if (m.index! > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ html: renderTex(m[0], false), display: false });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
}

export function splitMath(src: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of src.matchAll(MATH)) {
    if (m.index! > last) bare(src.slice(last, m.index), parts);
    const display = m[1] !== undefined || m[2] !== undefined;
    const tex = (m[1] ?? m[2] ?? m[3] ?? m[4]).trim();
    parts.push({ html: renderTex(tex, display), display });
    last = m.index! + m[0].length;
  }
  if (last < src.length) bare(src.slice(last), parts);
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

// ---- plain-text math, for places KaTeX cannot render (3D labels, tooltips, tab titles) ----
const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};
const SYMBOLS: Record<string, string> = {
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', propto: '∝', infty: '∞', partial: '∂', nabla: '∇',
  rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒', leftrightarrow: '↔', rightleftharpoons: '⇌', degree: '°', circ: '°', int: '∫', sum: 'Σ', prod: 'Π', sqrt: '√', ldots: '…', cdots: '⋯', quad: ' ', qquad: '  ',
};
const SUP: Record<string, string> = { '°': '°', '∘': '°', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', x: 'ˣ', y: 'ʸ', T: 'ᵀ' };
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', o: 'ₒ', x: 'ₓ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', n: 'ₙ', m: 'ₘ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ' };
const script = (s: string, map: Record<string, string>, mark: string) => ([...s].every((c) => map[c]) ? [...s].map((c) => map[c]).join('') : `${mark}${s.length > 1 ? `(${s})` : s}`);

/** LaTeX to readable plain text: "$v_0^2 = \frac{1}{2}\alpha$" -> "v₀² = 1/2 α". Text without LaTeX is unchanged. */
export function plainMath(src: string): string {
  if (!/[$\\^_]/.test(src)) return src;
  let s = src.replace(/\$\$|\$|\\\(|\\\)|\\\[|\\\]/g, '');
  for (let i = 0; i < 3; i++) s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a: string, b: string) => `${/^\w+$/.test(a) ? a : `(${a})`}/${/^\w+$/.test(b) ? b : `(${b})`}`);
  s = s
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, (_, a: string) => `√${a.length > 1 ? `(${a})` : a}`)
    .replace(/\\(?:mathrm|mathbf|mathit|text|textbf|operatorname|ce|pu|vec|hat|bar|overline)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:left|right|displaystyle)(?![a-zA-Z])|\\([,;!:])/g, (_, w?: string) => (w && w !== '!' ? ' ' : ''))
    .replace(/\\([a-zA-Z]+)/g, (m, w: string) => GREEK[w] ?? SYMBOLS[w] ?? w)
    .replace(/\^\{([^{}]*)\}|\^(.)/g, (_, a?: string, b?: string) => script(a ?? b ?? '', SUP, '^'))
    .replace(/_\{([^{}]*)\}|_(.)/g, (_, a?: string, b?: string) => script(a ?? b ?? '', SUB, '_'))
    .replace(/->/g, '→')
    .replace(/[{}]/g, '')
    .replace(/\s{2,}/g, ' ');
  return s.trim();
}
