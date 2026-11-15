import type { ExpandRequest, IntentRequest, LessonKind, LessonRequest, SolveRequest } from '../shared/types';

export const SYSTEM = `You are an expert teacher and curriculum designer.
Be accurate and prefer well-established facts, names and dates.
Respond with ONLY valid JSON matching the requested shape: no markdown, no code fences, no commentary.
Write every mathematical expression, formula and chemical equation in LaTeX between $...$ (inline) or $$...$$ (displayed), e.g. $F = ma$, $\\\\frac{dy}{dx}$. Because replies are JSON, double every backslash. Exceptions: labels and titles inside 3D model JSON, and voice-assistant replies, are plain text (LaTeX cannot render there).
Be concise: students read on screens, so prefer short sentences and few words.`;

const SCHEMAS: Record<LessonKind, string> = {
  timeline: `A JSON array of 12-16 events in chronological order covering the field's full history, from its origins up to the present day (it is now 2026). Include at least 4 events from 2000 or later, the last one within the past few years (recent discoveries, technologies, prizes, open problems being solved), so the timeline does not stop in the past.
Mix three types: "discovery" (a finding or invention), "event" (a historical event, publication, institution, war, experiment) and "figure" (a milestone in a prominent person's life or work). Always name the person when there is one. Include at least 3 of each type, so the timeline shows people and historical context, not only findings.
[{"year": "1869", "type": "discovery", "title": "Periodic table", "figure": "Dmitri Mendeleev", "detail": "one sentence on the finding and why it mattered", "related": ["2-4 short related terms, people or ideas worth exploring next"]}]`,

  topics: `A JSON array of 5-8 top-level topics that together give a complete overview of the subject. Each has a one-sentence summary and 2-5 children (subtopics, each with a summary, no deeper nesting needed: the user can click to expand any of them later):
[{"title": "...", "summary": "under 12 words", "children": [{"title": "...", "summary": "under 12 words"}]}]`,

  problems: `A JSON array of 8-12 example problems with worked solutions, ordered from easiest to hardest, that together cover everything a student needs to know. Use exactly these difficulty labels:
- "base": 2 trivial or base cases (zero, one, identity, empty, smallest valid input)
- "intro": 2 straightforward problems applying a single idea
- "core": 3-4 standard problems combining ideas
- "edge": 2-3 borderline cases where students commonly go wrong (limits, degenerate inputs, sign errors, units, division by zero)
Write every mathematical expression in LaTeX between $...$ (inline) or $$...$$ (a displayed equation), written in the JSON as "$\\\\frac{dy}{dx} = 3x^2$". Because this is JSON, double every backslash (\\\\frac, \\\\sqrt, \\\\times). Use plain text for everything else.
[{"prompt": "...", "solution": "numbered step-by-step worked solution, one step per line", "difficulty": "base", "why": "what this tests and the common mistake", "topic": "only when the student studied topics are listed above: the one this problem builds on, copied exactly; otherwise omit"}]`,

  visual: `A JSON object describing ONE interactive 3D model that best illustrates a core idea of the subject. Pick exactly one shape:

1. Chemistry / molecular biology -> molecule with realistic geometry (coordinates in angstroms, use bond order 2 or 3 where real):
{"kind": "molecule", "title": "...", "atoms": [{"element": "O", "x": 0, "y": 0, "z": 0}], "bonds": [{"a": 0, "b": 1, "order": 1}]}

2. Pure multivariable calculus with no real-world story (functions of two variables) -> surface z = f(x, y), expr in mathjs syntax. If the topic is an applied word problem (rates, optimization, motion), use a diagram scene of the real objects instead:
{"kind": "surface", "title": "...", "expr": "sin(x) * cos(y)", "xRange": [-3, 3], "yRange": [-3, 3]}

3. Physics or anything else -> a labeled diagram drawn like a textbook figure, coordinates within -5..5 (x right, y up):
{"kind": "diagram", "title": "...", "scene": "ground", "ground": -2, "elements": [
  {"type": "body", "id": "car", "label": "Car (1200 kg)", "x": -4, "y": -1.6, "shape": "car", "motion": {"vx": 2, "vy": 0, "ax": 0.5, "ay": 0, "duration": 3}},
  {"type": "vector", "from": "car", "label": "Friction", "dx": -1.2, "dy": 0},
  {"type": "link", "a": "m1", "b": "m2", "label": "rope"},
  {"type": "path", "points": [[-4, -1.6], [0, 1], [4, -1.6]], "label": "trajectory"}
]}
- Draw it like a textbook illustration of a real situation, NOT abstract spheres and cubes. Every body should have a "shape" that is a recognisable everyday object: ball, block, box, crate, car, truck, cart, plane, rocket, person, planet, sun, moon, satellite, boat, pulley, spring, ramp, charge, ladder, wall, tank (a cone-shaped water tank), cylinder (a can or pipe), cone, tree, house, cannon, balloon, table.
- Applied math belongs here too, as a real scene: related rates -> a ladder leaning on a wall, or a cone tank draining; optimization -> an open box or a can; projectiles -> a cannon and a ball; inclined planes -> a crate on a ramp; orbits -> a sun and planets.
- "radius" sets an object's size (default 0.4; a wall or house might be 1.5), "angle" tilts it in degrees (a ladder leaning at 70), "z" places it in depth for 3D scenes.
- "motion" animates a body with constant acceleration (units per second; gravity is about ay = -9.8 scaled to fit, e.g. -4). Use it for kinematics, projectiles, orbits-as-arcs, falling objects, so the diagram plays like a simulation. Vectors attached to the body move with it. Keep moving bodies inside -5..5 for the whole loop.
- "path" draws a dashed trajectory or outline. "ground" is the y of the ground line when objects rest on or move over ground.

Every model may also set "scene" for the world around it: "ground" (outdoors: sky and ground, for motion near the Earth), "space" (stars, for astronomy and orbits), "lab" (a lab bench floor, for chemistry), "water" (a water surface, for buoyancy and boats), or "plain" (empty, for abstract math).`,
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

Write every mathematical expression in LaTeX between $...$ (inline) or $$...$$ (a displayed equation), written in the JSON as "$\\\\frac{dy}{dx} = 3x^2$". Because this is JSON, double every backslash (\\\\frac, \\\\sqrt, \\\\times). Use plain text for everything else.

Produce a JSON object:
{"prompt": "the problem restated precisely",
 "solution": "numbered step-by-step worked solution, one step per line, ending with the final answer",
 "difficulty": "base" | "intro" | "core" | "edge",
 "why": "the key idea this tests and the common mistake"}`;
}

export function buildExpandPrompt({ subject, topic, path = [], level = 'high school' }: ExpandRequest) {
  const trail = [subject, ...path].join(' > ');
  return `Subject: ${subject}\nAudience level: ${level}\nContext: ${trail}\nTopic to explain in depth: ${topic}

Produce a JSON object:
{"title": "${topic}",
 "explanation": "1-2 short paragraphs separated by \\n\\n, at most 70 words in total, explaining the topic clearly in the context above",
 "keyPoints": ["3 bullet points a student must remember, each under 12 words"],
 "example": "one short concrete example or analogy, at most 2 sentences (optional)",
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
- Chemistry sandbox: ${c.sandbox ? (c.sandbox.length ? `open, holding ${list(c.sandbox)}` : 'open and empty') : 'closed'}

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
- {"action": "sandbox"}: open the chemistry sandbox (a shared 3D space for several molecules).
- {"action": "sandboxAdd", "name": "...", "count": 1}: put molecules into the sandbox ("add two waters" -> name "water", count 2).
- {"action": "sandboxMove", "target": "...", "direction": "left" | "right" | "up" | "down" | "closer" | "farther" | "together" | "apart"}: move sandbox molecules; target is a molecule name from the sandbox, "selected", or "all".
- {"action": "sandboxRemove", "target": "..."}
- {"action": "sandboxReact", "condition": "..."}: make the sandbox molecules react, optionally under a condition ("heat", "a spark", "a platinum catalyst", "in water"); omit condition if none given.
- {"action": "sandboxClear"}
- {"action": "sandboxPush", "target": "...", "direction": "left" | "right" | "up" | "down" | "closer" | "farther" | "together" | "apart", "force": 50}: shove or throw physical objects (cars, balls, crates, planets); force in newtons only if the student gives one.
- {"action": "sandboxSetting", "setting": "gravity" | "friction" | "air" | "elastic", "on": true | false}: physics switches; "air" is air resistance, "elastic" makes collisions perfectly bouncy (no energy lost).
- {"action": "none"}: chit-chat, or nothing actionable.

When the sandbox is open, "add X", "put X in", "move X left", "heat them up", "react these" refer to the sandbox. The sandbox holds both molecules and physical objects: use sandboxPush for pushing, kicking, throwing or launching objects, sandboxMove for simply placing them.

Decide "focus" vs "newLesson" by meaning, not shared words: "photosynthesis" during "organic chemistry" is a new lesson; "SN2 reactions" during "organic chemistry" is a focus.

Respond with ONLY a JSON object: {"intent": <one action object>, "say": "a short confirmation of what you are doing, under 10 words"}`;
}

export function buildMoleculePrompt(name: string) {
  return `Produce ONE molecule as a JSON object with realistic 3D geometry (coordinates in angstroms, centred near the origin, bond order 2 or 3 where real, include hydrogens):
{"kind": "molecule", "title": "Common name (formula)", "atoms": [{"element": "O", "x": 0, "y": 0, "z": 0}], "bonds": [{"a": 0, "b": 1, "order": 1}]}
Molecule: "${name}". If it is an element that exists as molecules, use the molecule (O2, N2, Cl2); a metal or ionic solid may be a single atom or one formula unit.`;
}

export function buildReactPrompt({ reactants, condition, level = 'high school' }: { reactants: { name: string; formula?: string; count?: number }[]; condition?: string; level?: string }) {
  const list = reactants.map((r) => `${r.count && r.count > 1 ? `${r.count} x ` : ''}${r.name}${r.formula ? ` (${r.formula})` : ''}`).join(', ');
  return `A ${level} student placed these together in a virtual chemistry sandbox: ${list}.
Condition: ${condition?.trim() || 'room temperature, nothing added'}.

Say what really happens. If they react under this condition, give the main products. If not, say so and what would be needed (for example heat, a spark, a catalyst, water).

Produce a JSON object:
{"reacts": true | false,
 "equation": "balanced equation in LaTeX, e.g. $\\\\mathrm{CH_4 + 2\\\\,O_2 \\\\rightarrow CO_2 + 2\\\\,H_2O}$ (empty string if no reaction)",
 "explanation": "2-3 short sentences: what happens and why, or why nothing happens and what would make it react",
 "products": [{"name": "Water", "count": 2, "molecule": {"kind": "molecule", "title": "Water (H2O)", "atoms": [...], "bonds": [...]}}]}
Products use realistic 3D geometry in angstroms with hydrogens; "count" is the number of that molecule to show (1-6). Empty products when there is no reaction.`;
}

/** Several different example models at once, so "new example" is instant and never repeats. */
export function buildExamplesPrompt({ subject, level = 'high school', focus, avoid = [] }: { subject: string; level?: string; focus?: string; avoid?: string[] }, n = 4) {
  return `Subject: ${subject}${focus ? `\nFocus: "${focus}"` : ''}\nAudience level: ${level}

Produce a JSON array of ${n} DIFFERENT interactive 3D models for this topic, each a separate illustration a student could flip through.
Make them varied: different molecules, different functions, different everyday situations or objects. Do not repeat any of these, which the student has already seen: ${avoid.length ? avoid.map((a) => `"${a}"`).join(', ') : 'none'}.
Each element uses exactly one of these shapes:

${SCHEMAS.visual.replace(/^A JSON object describing ONE interactive 3D model that best illustrates a core idea of the subject\. Pick exactly one shape:\n\n/, '')}`;
}

const BODY = 'ball, block, box, crate, car, truck, cart, plane, rocket, person, planet, sun, moon, satellite, boat, pulley, spring, ramp, charge, ladder, wall, tank, cylinder, cone, tree, house, cannon, balloon, table';

export function buildSandboxItemPrompt(name: string, subject = '', level = 'high school') {
  return `A ${level} student studying "${subject || 'science'}" wants to put "${name}" into a 3D sandbox where things can be moved, pushed, collided and reacted.

If it is a chemical substance, return a molecule with realistic 3D geometry (angstroms, hydrogens included, bond order 2 or 3 where real):
{"kind": "molecule", "name": "Methane", "molecule": {"kind": "molecule", "title": "Methane (CH4)", "atoms": [{"element": "C", "x": 0, "y": 0, "z": 0}], "bonds": [{"a": 0, "b": 1, "order": 1}]}}

Otherwise return a physical body:
{"kind": "body", "name": "Car", "body": {"shape": "car", "mass": 1200, "radius": 1.2, "charge": 0}}
- shape: one of ${BODY}
- mass in kg, realistic for the object (a tennis ball 0.06, a person 70, a car 1200; for planets and stars use a relative mass so a sun is about 1000 and a planet about 1-10)
- radius in scene units between 0.25 and 1.6, so objects of very different real size still fit on one bench
- charge: for charged particles (proton +1, electron -1, an ion), else 0`;
}
