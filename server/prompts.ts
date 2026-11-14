import type { ExpandRequest, IntentRequest, LessonKind, LessonRequest, SolveRequest } from '../shared/types';

export const SYSTEM = `You are an expert teacher and curriculum designer.
Be accurate and prefer well-established facts, names and dates.
Respond with ONLY valid JSON matching the requested shape: no markdown, no code fences, no commentary.
Write math as plain text (x^2, sqrt(x), integral of f dx), never LaTeX.`;

const SCHEMAS: Record<LessonKind, string> = {
  timeline: `A JSON array of 10-16 events in chronological order covering the field's full history.
Mix three types: "discovery" (a finding or invention), "event" (a historical event, publication, institution, war, experiment) and "figure" (a milestone in a prominent person's life or work). Always name the person when there is one.
[{"year": "1869", "type": "discovery", "title": "Periodic table", "figure": "Dmitri Mendeleev", "detail": "1-2 sentences on the finding and why it mattered", "related": ["2-4 short related terms, people or ideas worth exploring next"]}]`,

  topics: `A JSON array of 5-8 top-level topics that together give a complete overview of the subject. Each has a one-sentence summary and 2-5 children (subtopics, each with a summary, no deeper nesting needed: the user can click to expand any of them later):
[{"title": "...", "summary": "one sentence", "children": [{"title": "...", "summary": "one sentence"}]}]`,

  problems: `A JSON array of 8-12 example problems with worked solutions, ordered from easiest to hardest, that together cover everything a student needs to know. Use exactly these difficulty labels:
- "base": 2 trivial or base cases (zero, one, identity, empty, smallest valid input)
- "intro": 2 straightforward problems applying a single idea
- "core": 3-4 standard problems combining ideas
- "edge": 2-3 borderline cases where students commonly go wrong (limits, degenerate inputs, sign errors, units, division by zero)
[{"prompt": "...", "solution": "numbered step-by-step worked solution", "difficulty": "base", "why": "what this tests and the common mistake", "topic": "only when the student studied topics are listed above: the one this problem builds on, copied exactly; otherwise omit"}]`,

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

export function buildPrompt({ subject, kind, level = 'high school', focus, explored, request, variant }: LessonRequest) {
  const lines = [`Subject: ${subject}`, `Audience level: ${level}`];
  if (focus) lines.push(`Focus: "${focus}". Everything you produce must be about this specific topic within the subject.`);
  if (kind === 'problems' && explored?.length) {
    lines.push(`The student just studied: ${explored.join('; ')}. At least half the problems must build directly on these, and each of those must set "topic" to the topic it builds on, copied exactly from this list.`);
  }
  if (kind === 'visual' && request) {
    lines.push(`The student asked to see: "${request}". Model exactly that, choosing whichever shape fits the request regardless of the subject.`);
  } else if (kind === 'visual' && variant) {
    lines.push(`This is example number ${variant + 1}. Choose a DIFFERENT model from the most obvious one, still central to the topic.`);
  }
  return `${lines.join('\n')}\n\nProduce: ${SCHEMAS[kind]}`;
}

export function buildScopePrompt(subject: string, level = 'high school') {
  return `A ${level} student typed this into a lesson generator: "${subject}"

Decide whether it is "broad" (a whole subject, field or course, e.g. "physics", "organic chemistry", "multivariable calculus") or "specific" (one concept or skill, e.g. "chain rule", "SN2 reactions", "projectile motion").

Produce a JSON object:
{"scope": "broad" | "specific",
 "overview": "a very brief 1-2 sentence overview",
 "suggestions": ["6-8 specific topics inside it worth exploring, 1-4 words each"]}`;
}

export function buildSolvePrompt({ subject, level = 'high school', focus, question }: SolveRequest, hasImage: boolean) {
  return `Subject: ${subject}${focus ? ` (${focus})` : ''}\nAudience level: ${level}
${hasImage ? 'The attached image contains a problem the student wants solved.' : ''}${question ? `\nThe student says: "${question}"` : ''}

Produce a JSON object:
{"prompt": "the problem restated precisely as plain text",
 "solution": "numbered step-by-step worked solution ending with the final answer",
 "difficulty": "base" | "intro" | "core" | "edge",
 "why": "the key idea this tests and the common mistake"}`;
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

export function buildIntentPrompt({ transcript, context: c }: IntentRequest) {
  const list = (xs?: string[]) => (xs?.length ? xs.map((x) => `"${x}"`).join(', ') : 'none');
  return `You turn a student's spoken request into ONE action for LessonLab, a lesson app with four sections:
the interactive 3D model ("visual"), history ("timeline"), the topic map ("topics") and practice problems ("problems").

Current state:
- Lesson subject: ${c.subject ? `"${c.subject}"` : 'none (home page)'}${c.focus ? `, narrowed to "${c.focus}"` : ''}
- Section on screen: ${c.section ?? 'none'}
- Current 3D model: ${c.model ? `"${c.model}"` : 'none'}
- Topics inside this subject: ${list(c.topics)}
- Lessons open in tabs: ${list(c.open)}
- Saved lessons: ${list(c.saved)}
- Folders: ${list(c.folders)}

The student said: "${transcript}"

Actions (pick exactly one):
- {"action": "focus", "topic": "..."}: the student wants to dig into a topic that is PART OF the current subject.
- {"action": "newLesson", "subject": "..."}: the student wants a DIFFERENT subject, or a topic unrelated to the current one, or there is no lesson yet. Use a clean subject name.
- {"action": "widen"}: back from a narrowed topic to the whole subject.
- {"action": "goto", "section": "visual" | "timeline" | "topics" | "problems"}
- {"action": "model", "request": "..."}: build a specific 3D model (a molecule, a graph or surface, a physics diagram, a model of a real-world problem).
- {"action": "newExample"}: a different example model for the current topic.
- {"action": "modelStep", "step": 1 | -1}: next or previous model already built in this lesson.
- {"action": "solve", "question": "..."}: solve a specific problem the student states; restate it as written math or text.
- {"action": "save", "folder": "..."}: save the current lesson, optionally into a named folder (omit folder if none named).
- {"action": "open", "title": "..."}: switch to an open lesson or reopen a saved one; title must be copied exactly from the open or saved lists.
- {"action": "library"}: show saved lessons and folders.
- {"action": "home"}
- {"action": "none"}: chit-chat, or nothing actionable.

Decide "focus" vs "newLesson" by meaning, not shared words: "photosynthesis" during "organic chemistry" is a new lesson; "SN2 reactions" during "organic chemistry" is a focus.

Respond with ONLY a JSON object: {"intent": <one action object>, "say": "a short confirmation of what you are doing, under 10 words"}`;
}
