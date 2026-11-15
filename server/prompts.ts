import type { ExpandRequest, IntentRequest, LabKind, LessonKind, LessonRequest, SolveRequest } from '../shared/types';

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

  visual: `A JSON object describing ONE interactive 3D model that best illustrates a core idea of the subject. Draw it the way a good textbook or teacher would draw THIS topic, using that field's standard conventions, with every part labeled, and never as anonymous balls, boxes and lines. Pick exactly one shape:

1. Chemistry / molecular biology -> molecule with realistic geometry (coordinates in angstroms, use bond order 2 or 3 where real):
{"kind": "molecule", "title": "...", "atoms": [{"element": "O", "x": 0, "y": 0, "z": 0}], "bonds": [{"a": 0, "b": 1, "order": 1}]}

2. Functions of TWO variables only (multivariable calculus, partial derivatives, saddle points) -> surface z = f(x, y), expr in mathjs syntax:
{"kind": "surface", "title": "...", "expr": "sin(x) * cos(y)", "xRange": [-3, 3], "yRange": [-3, 3]}

3. Anything normally drawn as a 2D graph or figure -> a plot on a solid board (graphs of y = f(x), lines and intersections, parabolas, tangent lines, exponentials and logarithms, the unit circle, triangles and geometry figures, histograms and distributions, probability bar charts, scatter plots with a fit line or clusters, wave graphs, energy diagrams, titration curves, trend charts, Punnett squares):
{"kind": "plot", "title": "...", "xRange": [-5, 5], "yRange": [-4, 6], "xLabel": "x", "yLabel": "y",
 "curves": [{"expr": "x^2 - 2*x - 3", "label": "y = x^2 - 2x - 3", "dashed": false, "from": -2, "to": 4}],
 "points": [{"x": 1, "y": -4, "label": "vertex (1, -4)"}],
 "segments": [{"from": [0, 0], "to": [2, 1], "label": "slope 1/2", "dashed": true, "arrow": false}],
 "bars": [{"x": 2, "height": 0.03, "width": 1, "label": "2"}],
 "areas": [{"points": [[0, 0], [4, 0], [4, 3]], "label": "right triangle"}],
 "labels": [{"x": 3, "y": 5, "text": "note"}]}
- "curves" use mathjs syntax in x only (sin, cos, exp, log, sqrt, abs, ^); every element is optional except at least one of curves / points / bars / segments / areas.
- "ticks": false hides the axis numbers (conceptual sketches such as energy diagrams); "axes": false hides the axes entirely (pure geometry figures, Punnett squares, which then keep their true proportions).
- Keep everything inside xRange and yRange, and choose ranges that frame the interesting part (roots, vertex, intersection, peak).

4. Biology, anatomy, psychology / neuroscience, medicine, earth science, atoms (anything with a real physical structure) -> a realistic, colored 3D model, NEVER abstract circles and lines:
{"kind": "anatomy", "title": "...", "model": "brain", "focus": ["Frontal lobe"], "notes": {"Frontal lobe": "why this part matters for the lesson"}}
- "model" is a detailed built-in: "brain" (parts: Frontal lobe, Parietal lobe, Temporal lobe, Occipital lobe, Cerebellum, Brainstem), "neuron" (Cell body, Nucleus, Dendrites, Axon, Myelin sheath, Axon terminals), "cell" (Cell membrane, Nucleus, Nucleolus, Mitochondria, Endoplasmic reticulum, Golgi apparatus, Lysosomes, Ribosomes), "dna" (Sugar-phosphate backbone, Adenine, Thymine, Guanine, Cytosine), "heart" (Left ventricle, Right ventricle, Left atrium, Right atrium, Aorta, Pulmonary artery, Vena cava), "atom" (a Bohr model of carbon: Protons, Neutrons, Inner shell (n = 1), Outer shell (n = 2), Electrons), "mitochondrion" (Outer membrane, Inner membrane, Cristae, Matrix, ATP synthase, Mitochondrial DNA), "chloroplast" (Outer envelope, Inner envelope, Thylakoids, Stroma, Lamellae, Starch grain, Ribosomes). Use one whenever it fits, with "focus" and "notes" tailored to the topic.
- Otherwise compose the structure from parts with real colors and organic shapes (e.g. a chloroplast, a mitochondrion, a leaf, an eye, a lung, a ribosome on mRNA, a Bohr atom, a volcano, the layers of the Earth):
{"kind": "anatomy", "title": "...", "parts": [{"name": "Chloroplast", "shape": "ellipsoid" | "blob" | "sphere" | "capsule" | "cylinder" | "cone" | "torus" | "box" | "tube", "position": [x, y, z], "size": [sx, sy, sz], "rotation": [0, 0, 0], "color": "#3f8f4e", "surface": "smooth" | "folded" | "bumpy" | "glossy" | "translucent", "info": "one sentence on what it does"}]}
  6-20 parts within -4..4; "tube" parts also take "path": [[x,y,z], ...] (vessels, nerves, roots, an mRNA strand); put inner parts inside a "translucent" outer part. Several parts may share one name (all the electrons, all the thylakoids) so they highlight together.

5. Machine learning, neural networks, deep learning, language models (LLMs, transformers, GPT), AI, and any concept made of nodes and connections (graphs, trees, search algorithms, data structures, food webs, computer or social networks, state machines, an agent and its environment, flowcharts of a pipeline) -> a network:
{"kind": "network", "title": "...", "model": "transformer", "focus": ["Self-attention"], "notes": {"Self-attention": "why this part matters for the lesson"}}
- "model" is a detailed, animated built-in: "neural-network" (a feed-forward net; parts: Input layer, Hidden layer 1, Hidden layer 2, Output layer), "transformer" (one layer of a language model predicting the next word; parts: Input tokens, Embeddings, Self-attention, Feed-forward network, Stacked layers, Next-token probabilities), "cnn" (image classifier; parts: Input image, Convolution, Pooling, Fully connected, Output classes), "rnn" (unrolled over time; parts: Inputs over time, Hidden state, Outputs), "decision-tree" (parts: Decision nodes, Leaves), "graph" (a weighted graph with a shortest path; parts: Shortest path A to F, Other vertices). Use one whenever it fits, with "focus" and "notes" tailored to the topic.
- Otherwise compose it yourself (a linked list, a binary search tree, a GAN, an autoencoder, backpropagation, a Markov chain, a hash table, a food web, a reinforcement-learning loop):
{"kind": "network", "title": "...", "layout": "layers" | "tree" | "graph",
 "groups": [{"name": "Encoder", "color": "#4f8fe8", "info": "one sentence on what this layer or cluster does"}],
 "nodes": [{"id": "e1", "group": "Encoder", "label": "optional short text", "shape": "neuron" | "token" | "block" | "grid" | "bar" | "data", "value": 0.8, "info": "optional"}],
 "edges": [{"a": "e1", "b": "z1", "weight": 0.7, "kind": "flow" | "attention" | "skip" | "plain", "label": "optional short text"}]}
  "layers" puts the groups left to right in the order listed (input first) with each group's nodes in a column; "tree" runs top down along the edges (a to b is parent to child); "graph" spreads the nodes in space.
  Shapes: "neuron" a glowing unit ("value" 0-1 is its activation), "token" a tile showing its label (words, species, states, keys), "grid" an image, feature map or vector, "bar" a probability ("value" 0-1 is its height), "data" a small cube, "block" a large labeled stage.
  Edges: "weight" from -1 to 1 sets thickness (negative weights are drawn in a second color); "flow" edges carry moving signals in the direction a to b (energy in a food web flows prey -> predator), "attention" is a curved arc, "skip" a residual connection, "plain" a static link. 4-60 nodes; every edge must join two existing node ids; label what matters.

6. Physics and real-world situations -> a labeled diagram drawn like a textbook figure, coordinates within -5..5 (x right, y up):
{"kind": "diagram", "title": "...", "scene": "ground", "ground": -2, "elements": [
  {"type": "body", "id": "car", "label": "Car (1200 kg)", "x": -4, "y": -1.6, "shape": "car", "motion": {"vx": 2, "vy": 0, "ax": 0.5, "ay": 0, "duration": 3}},
  {"type": "vector", "from": "car", "label": "Friction", "dx": -1.2, "dy": 0},
  {"type": "link", "a": "m1", "b": "m2", "label": "rope"},
  {"type": "path", "points": [[-4, -1.6], [0, 1], [4, -1.6]], "label": "trajectory"},
  {"type": "wire", "points": [[-3, 2], [3, 2], [3, -2], [-3, -2], [-3, 2]], "current": true}
]}
- Every body has a "shape" that is a recognisable real object: ball, block, box, crate, car, truck, cart, plane, rocket, person, planet, sun, moon, satellite, boat, pulley, spring, ramp, charge, ladder, wall, tank (a cone-shaped water tank), cylinder (a can or pipe), cone, tree, house, cannon, balloon, table, and for circuits battery, resistor, bulb, switch, capacitor.
- Circuits: draw the real components (battery, resistor, bulb, switch, capacitor) as bodies with labels giving their values ("Battery 9 V", "R1 = 100 Ω", "Bulb"), and join them with "wire" elements: each wire is a list of right-angle corner points running from one component's end to the next, so the wires form a closed rectangular loop (parallel branches are separate wires). Components lie along x by default; "angle": 90 stands one upright on a vertical side. Component radius about 0.5. "current": true animates charge flowing from a wire's first point to its last, so start wires at the battery's + end (its right end when angle is 0). Add "vector" labels only for real quantities.
- Applied math belongs here too, as a real scene: related rates -> a ladder leaning on a wall, or a cone tank draining; optimization -> an open box or a can; projectiles -> a cannon and a ball; inclined planes -> a crate on a ramp; orbits -> a sun and planets.
- "radius" sets an object's size (default 0.4; a wall or house might be 1.5), "angle" tilts it in degrees (a ladder leaning at 70), "z" places it in depth for 3D scenes.
- "motion" animates a body with constant acceleration (units per second; gravity is about ay = -9.8 scaled to fit, e.g. -4). Use it for kinematics, projectiles, falling objects, so the diagram plays like a simulation. Vectors attached to the body move with it. Keep moving bodies inside -5..5 for the whole loop.
- "path" draws a dashed trajectory or outline (a circular path for circular motion, an orbit). "ground" is the y of the ground line when objects rest on or move over ground.

How common topics are normally drawn (follow these conventions):
- Math: linear equations -> plot of the lines with the intersection point labeled; quadratics -> plot of the parabola with vertex, roots and axis of symmetry (dashed segment); trigonometry -> plot with axes false of the unit circle (curves "sqrt(1-x^2)" and "-sqrt(1-x^2)"), an angle's radius, and its cos / sin legs labeled; geometry proofs -> plot with axes false of the figure (areas for triangles, segments for sides and altitudes, points for vertices A, B, C); probability -> plot with bars (e.g. the distribution of the sum of two dice); derivatives -> plot of a curve with the tangent line at a point and its slope labeled; exponents and logarithms -> plot of exp and log curves with the mirror line y = x dashed; statistics -> plot of a histogram with the mean and median as dashed vertical segments, or a normal curve with shaded areas.
- Physics: Newton's laws -> diagram of a crate or cart with labeled force vectors (weight, normal, applied, friction); projectile motion -> cannon, moving ball and dashed trajectory; work and energy -> a crate pushed along or a ball on a ramp with force and displacement; momentum and collisions -> two carts moving toward each other with velocity vectors and masses; circular motion -> a ball on a string with a circular path, velocity tangent and centripetal force toward the centre; waves and sound -> plot of the wave with wavelength and amplitude as labeled segments (two waves for comparison when useful); electric circuits -> circuit diagram as described above; gravity and orbits -> scene "space" with sun, planet and orbit path.
- Chemistry: atomic structure -> the "atom" built-in (compose your own Bohr atom only for a specific other element: nucleus of protons and neutrons, thin ring "tube" shells, electrons sitting exactly on the rings); periodic table trends -> plot with bars of the trend across a period (e.g. atomic radius from Li to Ne); chemical bonding -> molecule; balancing equations and stoichiometry -> ONE molecule spec holding every molecule of the balanced equation, reactants on the left (x below -2) and products on the right (x above 2), each molecule offset so none touch, so atoms can be counted on both sides (e.g. 2 H2 + O2 on the left, 2 H2O on the right); the title states the balanced equation; acids and bases -> plot of the pH scale (colored areas from 0 to 14 with everyday substances labeled) or a titration curve; thermochemistry -> plot with ticks false of an energy diagram (reactants, products, enthalpy change arrow); reaction rates -> plot with ticks false of a reaction profile with the activation-energy hump and a dashed catalyzed path.
- Biology: cell structure -> the "cell" built-in; photosynthesis -> the "chloroplast" built-in with notes on inputs and outputs; cellular respiration -> the "mitochondrion" built-in with notes on the stages; DNA replication -> the "dna" built-in with notes on the replication fork and enzymes; Mendelian genetics -> plot with axes false of a Punnett square (areas for the 4 boxes, labels for the gametes and genotypes); natural selection -> plot of a trait's distribution before and after selection (two curves, one dashed); protein synthesis -> anatomy of a ribosome on an mRNA strand (tube) with tRNA and the growing protein chain; ecosystems -> network food web (tokens for species from producers at the bottom up to top predators, "flow" edges prey -> predator).
- AI: machine learning basics -> plot scatter of data points with a fitted line; neural networks -> the "neural-network" built-in; supervised vs unsupervised learning -> plot scatter with two labeled clusters (colored points, cluster centres); natural language processing -> the "transformer" built-in; computer vision -> the "cnn" built-in; reinforcement learning -> network of the agent-environment loop (agent, environment, action, state, reward); search algorithms -> network tree or the "graph" built-in; AI ethics and bias -> plot with bars comparing a model's accuracy across groups.

Every model may also set "scene" for the world around it: "ground" (outdoors: sky and ground, for motion near the Earth), "space" (stars, for astronomy and orbits), "lab" (a lab bench floor, for chemistry), "water" (a water surface, for buoyancy and boats), or "plain" (empty, for abstract math, plots and circuits).`,
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
 "lab": "physics" | "chemistry" | "none",
 "overview": "a very brief 1-2 sentence overview",
 "suggestions": ["6-8 specific topics inside it worth exploring, 1-4 words each"]}
"lab" says what a hands-on 3D sandbox for this subject should simulate: "physics" when objects should move, fall, collide and be pushed (mechanics, forces, motion, orbits, electricity, engineering), "chemistry" when molecules should be combined and reacted, "none" for everything else (biology, medicine, psychology, history, economics, computer science, machine learning, pure math, languages...), where objects are only placed and arranged.`;
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
  return `You turn a student's spoken request into ONE action for Syllabo, a lesson app with four sections:
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
- {"action": "sandboxNew"}: start another, empty sandbox (the lesson can have several)
- {"action": "sandboxStep", "step": 1 | -1}: next or previous sandbox
- {"action": "sandboxPush", "target": "...", "direction": "left" | "right" | "up" | "down" | "closer" | "farther" | "together" | "apart", "force": 50}: shove or throw physical objects (cars, balls, crates, planets); force in newtons only if the student gives one.
- {"action": "sandboxSetting", "setting": "gravity" | "friction" | "air" | "elastic" | "autoReact", "on": true | false}: sandbox switches; "air" is air resistance, "elastic" makes collisions perfectly bouncy, "autoReact" makes molecules react by themselves when they touch.
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

${SCHEMAS.visual.replace(/^A JSON object describing ONE interactive 3D model[^\n]*\n\n/, '')}`;
}

const BODY = 'ball, block, box, crate, car, truck, cart, plane, rocket, person, planet, sun, moon, satellite, boat, pulley, spring, ramp, charge, ladder, wall, tank, cylinder, cone, tree, house, cannon, balloon, table, node, chip, database, document';

export function buildSandboxItemPrompt(name: string, subject = '', level = 'high school', lab: LabKind = 'physics') {
  const what = lab === 'none' ? 'a 3D sandbox where things are placed side by side, arranged and compared (nothing moves, falls or reacts here)' : 'a 3D sandbox where things can be moved, pushed, collided and reacted';
  return `A ${level} student studying "${subject || 'science'}" wants to put "${name}" into ${what}.

If it is a chemical substance, return a molecule with realistic 3D geometry (angstroms, hydrogens included, bond order 2 or 3 where real):
{"kind": "molecule", "name": "Methane", "molecule": {"kind": "molecule", "title": "Methane (CH4)", "atoms": [{"element": "C", "x": 0, "y": 0, "z": 0}], "bonds": [{"a": 0, "b": 1, "order": 1}]}}

Otherwise return a physical body:
{"kind": "body", "name": "Car", "body": {"shape": "car", "mass": 1200, "radius": 1.2, "charge": 0}}
- shape: one of ${BODY}; for ideas rather than physical things use "node" (a unit, a neuron, a vertex, a person in a network, an abstract concept), "chip" (a processor, a model, hardware), "database" (stored data, a dataset, memory) or "document" (a text, a law, a file, a book)
- mass in kg, realistic for the object (a tennis ball 0.06, a person 70, a car 1200; for planets and stars use a relative mass so a sun is about 1000 and a planet about 1-10)
- radius in scene units between 0.25 and 1.6, so objects of very different real size still fit on one bench
- charge: for charged particles (proton +1, electron -1, an ion), else 0`;
}
