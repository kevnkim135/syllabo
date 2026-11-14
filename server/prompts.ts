import type { ExpandRequest, LessonKind } from '../shared/types';

export const SYSTEM = `You are an expert teacher and curriculum designer.
Be accurate and prefer well-established facts, names and dates.
Respond with ONLY valid JSON matching the requested shape: no markdown, no code fences, no commentary.
Write math as plain text (x^2, sqrt(x), integral of f dx), never LaTeX.`;

const SCHEMAS: Record<LessonKind, string> = {
  timeline: `A JSON array of 10-16 events in chronological order covering the field's full history.
Mix three types: "discovery" (a finding or invention), "event" (a historical event, publication, institution, war, experiment) and "figure" (a milestone in a prominent person's life or work). Always name the person when there is one.
[{"year": "1869", "type": "discovery", "title": "Periodic table", "figure": "Dmitri Mendeleev", "detail": "1-2 sentences on the finding and why it mattered"}]`,

  topics: `A JSON array of 5-8 top-level topics that together give a complete overview of the subject. Each has a one-sentence summary and 2-5 children (subtopics, each with a summary, no deeper nesting needed: the user can click to expand any of them later):
[{"title": "...", "summary": "one sentence", "children": [{"title": "...", "summary": "one sentence"}]}]`,

  problems: `A JSON array of 8-12 example problems with worked solutions, ordered from easiest to hardest, that together cover everything a student needs to know. Use exactly these difficulty labels:
- "base": 2 trivial or base cases (zero, one, identity, empty, smallest valid input)
- "intro": 2 straightforward problems applying a single idea
- "core": 3-4 standard problems combining ideas
- "edge": 2-3 borderline cases where students commonly go wrong (limits, degenerate inputs, sign errors, units, division by zero)
[{"prompt": "...", "solution": "numbered step-by-step worked solution", "difficulty": "base", "why": "what this tests and the common mistake"}]`,

  visual: `A JSON object describing ONE interactive 3D model that best illustrates a core idea of the subject. Pick exactly one shape:

1. Chemistry / molecular biology -> molecule with realistic geometry (coordinates in angstroms, use bond order 2 or 3 where real):
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

export function buildExpandPrompt({ subject, topic, path = [], level = 'high school' }: ExpandRequest) {
  const trail = [subject, ...path].join(' > ');
  return `Subject: ${subject}\nAudience level: ${level}\nContext: ${trail}\nTopic to explain in depth: ${topic}

Produce a JSON object:
{"title": "${topic}",
 "explanation": "2-4 short paragraphs separated by \\n\\n explaining the topic clearly in the context above",
 "keyPoints": ["3-6 short bullet points a student must remember"],
 "example": "one concrete worked example or analogy (optional)",
 "subtopics": [{"title": "...", "summary": "one sentence"}]}
Give 3-5 subtopics that go one level deeper than "${topic}".`;
}
