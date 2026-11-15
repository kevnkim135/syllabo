# SanD Hacks 2026 submission checklist

Devpost: https://sand-hacks-26.devpost.com

## Hard rules (break one = disqualified or zero)
- [ ] **Commits only Sat Nov 14 10:30 AM to Sun Nov 15 12:00 PM (Pacific).** No commits before
      or after, on any branch that ends up in the repo. Enable the guard: `git config core.hooksPath .githooks`
- [ ] Team of 1 to 4. Everyone on Slack with display name "Full Name + School".
- [ ] Everyone present at check-in, judging and awards (in person).
- [ ] **Every team member at the table during judging** (Sun 12:30 to 2:30 PM, Qualcomm Room), or the team scores zero.

## Deadlines (Sunday Nov 15)
| Time | What |
|---|---|
| 11:00 AM | Initial Devpost submission (placeholder is fine) |
| 12:00 PM | **Final submission + last commit.** Nothing changes after this |
| 12:30 to 2:30 PM | Science-fair judging: 3 min pitch + 2 min Q&A |
| 4:00 PM | Closing ceremony, WLH 2005 (deck also says "event concludes 3:00 PM"; confirm on Slack) |

Hacking space closes Sat 9 PM, reopens Sun 7 AM.

## Devpost fields
- [ ] **GitHub repo link** (must be public): create repo, `git remote add origin ...`, `git push -u origin main`
- [ ] **3-minute demo video**, public YouTube or Google Drive link (check it opens in a logged-out window)
- [ ] **Short write-up** (draft below)
- [ ] Live demo link (optional; camera + mic need HTTPS)
- [ ] Opt into every prize track you qualify for

## Judging criteria (Best Overall Hack)
Design · Functionality · Innovation · Presentation. Pitch should hit all four in 3 minutes.

## 3-minute demo video script (record in Chrome, camera and mic already on)
| Time | On screen | Say |
|---|---|---|
| 0:00-0:15 | Home page, cursor moving through the triangle field | "Learning something new means jumping between a textbook, videos and static diagrams. Syllabo puts it all in one place, and lets you pick it up with your hands." |
| 0:15-0:40 | Type "Organic chemistry"; topic map appears; open one branch's notes | "Type any subject. In seconds you get a map of the whole field. Click any branch for short notes, key points and deeper topics." |
| 0:40-1:00 | Problems (reveal steps on one), then History timeline | "Worked problems go from base cases to the edge cases where students slip, with every step in proper math notation. And a timeline of the people and discoveries behind it, up to today." |
| 1:00-1:35 | Interactive model with the camera preview visible: zoom with a held pinch, rotate with pinch plus circles, say "show me benzene", swipe an open hand | "No mouse: I zoom by holding a pinch, and rotate by pinching with one hand and drawing a circle with the other. I can just ask for what I want, and swipe to flip through models." |
| 1:35-2:10 | Sandbox: say "add methane and two oxygens", point, close a fist, carry one into the other, say "react them with a spark" | "The sandbox is a chemistry lab. I point at a molecule, close my fist to grab it, and bring them together. With a spark, methane burns, and Syllabo shows the products, the balanced equation and why." |
| 2:10-2:30 | Physics tab sandbox: throw a ball at a crate, turn gravity off | "Switch to physics and the same sandbox becomes a physics lab. Collisions conserve momentum, and I can turn gravity or friction off." |
| 2:30-2:45 | Large language models tab, transformer model, click Self-attention | "It adapts to any subject. Here is the inside of a language model predicting the next word. Click a layer to see what it does." |
| 2:45-3:00 | Quick architecture slide or code, then the home page | "Under the hood, Claude generates a typed lesson spec that we validate, and one command bus routes mouse, gestures and voice to every 3D scene. Syllabo: any subject, in your hands." |

If time runs short, drop the physics segment (2:10-2:30).

## Write-up (paste into Devpost)
**Syllabo: type any subject, get a lesson you can pick up with your hands**

**Inspiration.** Learning a new subject means hopping between a textbook, a video, a problem set and a static diagram. We wanted one place where you type a subject and get the whole picture, including a 3D model you can grab, turn and experiment with using your hands and voice.

**What it does.** Type any subject and Syllabo builds four connected sections:
- **Topic map:** the whole field at a glance; click a branch for short notes, key points, an example and deeper subtopics.
- **Problems:** worked examples from base cases to tricky edge cases, one at a time, in LaTeX; type, say or screenshot your own problem to have it solved.
- **Interactive model:** molecules for chemistry, surfaces for multivariable calculus, everyday-object scenes (cars, ladders, cannons) for physics and applied math, anatomy models (brain, cell, heart, DNA, neuron) for biology and psychology, and animated networks (neural nets, a transformer predicting the next word, CNNs, decision trees, graphs) for machine learning and computer science.
- **History:** the people, discoveries and events behind the field, up to the present.

You control it without the keyboard: hold a pinch to zoom, pinch with one hand and draw circles with the other to rotate, swipe an open hand to flip models, or just say "show me benzene" or "solve two x plus three equals seven".

The **sandbox** adapts to the subject. In chemistry, add molecules, bring them together and they react, with the balanced equation and an explanation (or turn on auto react). In physics, objects have mass: throw them, collide them, toggle gravity, friction and air resistance, watch momentum stay conserved, make a planet orbit a sun. For every other subject it is a calm space to arrange and compare objects. Point at an object, close your fist to grab it; each hand can carry its own. Lessons open in tabs and save into folders.

**How we built it.** React 19, Vite and TypeScript; three.js via react-three-fiber; KaTeX for math; MediaPipe hand tracking in the browser with our own gesture engine (smoothing filters, palm-based depth, hysteresis); the Web Speech API with local rules plus Claude for harder commands; a Hono server calling the Claude API, which returns typed JSON that we validate and repair. One command bus routes mouse, keyboard, gesture and voice to every 3D scene. The physics is a small custom simulation. 90 automated tests, including synthetic hands replayed frame by frame.

**Challenges.** Webcam hand tracking is noisy: objects blinked, got dropped mid-carry, and pinches read as fists, so we rebuilt selection several times and settled on point-then-fist with a magnetic pointer and a grace period for lost frames. Curling fingers looked like moving closer, so we measure depth from the palm only. LaTeX inside JSON breaks in subtle ways (a stray backslash turns \frac into a form feed), so we repair and validate every reply. Abstract spheres and lines felt flat, so we moved to recognisable objects and detailed anatomy.

**Accomplishments.** Two hands can each carry a different object at once; the sandbox works out what kind of lab a subject needs; a transformer you can look inside; it works for subjects we never planned for.

**What we learned.** Natural input is mostly about forgiveness: hysteresis, grace periods and snapping matter more than raw accuracy. A strict typed spec plus hard validation makes generated content dependable enough to render in 3D.

**What's next.** Narrated walkthroughs, shareable lesson links, more built-in models, multiplayer sandboxes for classes.

**Built with:** React, TypeScript, Vite, three.js, react-three-fiber, MediaPipe, Web Speech API, KaTeX, Hono, Node.js, Claude API

## Prize tracks that could fit (decide early; each needs real use, not a mention)
| Track | Fit | What it would take |
|---|---|---|
| ElevenLabs | Strong | Narrate timeline entries / problem walkthroughs with ElevenLabs TTS; voice already central |
| Neon (database / agent backend) | Good | Postgres cache of generated lessons keyed by (subject, level, kind); share links |
| Gemini API | Possible | Gemini as a second generation provider (must actually call the API) |
| GoDaddy Registry domain | Easy | Register a domain for the live demo |
| SpaceXSI (Cursor + Grok Bot) | Only if used | Must use both and describe how in the submission |
| DEV writing challenge | Easy | Publish one post about the project |
