import type { LessonKind } from '../shared/types';

export const SYSTEM = `You are an expert teacher and curriculum designer.
Be accurate and prefer well-established facts, names and dates.
Respond with ONLY valid JSON matching the requested shape: no markdown, no code fences, no commentary.`;

const SCHEMAS: Record<LessonKind, string> = {
  timeline: `A JSON array of 8-15 events in chronological order covering the field's history, key figures and findings:
[{"year": "1869", "title": "Periodic table", "figure": "Dmitri Mendeleev", "detail": "1-2 sentences on the finding and why it mattered"}]`,

  topics: `A JSON array giving an overarching breakdown of ALL major topics in the subject, nested up to 3 levels:
[{"title": "...", "summary": "one sentence", "children": [ /* same shape */ ]}]`,

  problems: `A JSON array of 6-10 example problems with worked solutions, mixing difficulties.
At least 2 must be "edge": borderline or base cases where students commonly go wrong (zero, limits, degenerate inputs, sign errors).
[{"prompt": "...", "solution": "step-by-step worked solution", "difficulty": "intro" | "core" | "edge", "why": "what this tests"}]`,

  visual: `A JSON object describing ONE interactive 3D model that best illustrates a core idea of the subject. Pick exactly one shape:

1. Chemistry / molecular biology -> molecule with realistic geometry (coordinates in angstroms):
{"kind": "molecule", "title": "...", "atoms": [{"element": "O", "x": 0, "y": 0, "z": 0}], "bonds": [{"a": 0, "b": 1, "order": 1}]}

2. Multivariable calculus / functions of two variables -> surface z = f(x, y), expr in mathjs syntax:
{"kind": "surface", "title": "...", "expr": "sin(x) * cos(y)", "xRange": [-3, 3], "yRange": [-3, 3]}

3. Physics or anything else -> labeled diagram, coordinates within -5..5:
{"kind": "diagram", "title": "...", "elements": [
  {"type": "body", "id": "m1", "label": "Block (2 kg)", "x": 0, "y": 0},
  {"type": "vector", "from": "m1", "label": "Gravity", "dx": 0, "dy": -2},
  {"type": "link", "a": "m1", "b": "m2", "label": "rope"}
]}`,
};

export function buildPrompt(subject: string, kind: LessonKind, level = 'high school') {
  return `Subject: ${subject}\nAudience level: ${level}\n\nProduce: ${SCHEMAS[kind]}`;
}
