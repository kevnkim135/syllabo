# LessonLab

Type any subject and get a full, explorable lesson:

- **History:** a timeline with discoveries, events and prominent figures color-coded
- **Topic map:** a complete overview of the field; click any topic for an in-depth explanation, then keep drilling into deeper subtopics
- **Problems:** worked examples ordered from base cases through edge cases, with hints and filters
- **Interactive model:** a 3D visual you control with **hand gestures and voice**. Chemistry gets molecules, multivariable calculus gets surfaces, physics gets force diagrams.

Built at **SanD Hacks 2026** (UCSD). Submission checklist and deadlines: [SUBMISSION.md](SUBMISSION.md).

## Stack
React + Vite + TypeScript · three.js via react-three-fiber · MediaPipe hand tracking · Web Speech API · Hono API server · Claude API

## Setup
Requires Node 22+ and Chrome or Edge (needed for voice).

```bash
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY (optional, see below)
npm run dev               # web on http://localhost:5173, API on :8787
git config core.hooksPath .githooks   # blocks commits outside the hackathon window
```

No key? The server runs in **mock mode** with canned data, so UI work can start right away.
Camera and mic only work on `localhost` or HTTPS.

## Environment variables
| Var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | _(empty → mock mode)_ | Claude API key |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Model for generation |
| `PORT` | `8787` | API port (Vite proxies `/api` here) |
| `MOCK_LLM` | `0` | `1` forces mock data even with a key |
| `MOCK_DELAY_MS` | `0` | Mock mode only: simulated latency to rehearse loading states |

## Scripts
`dev` (web + api) · `typecheck` · `test` (unit tests) · `build` (frontend into `dist/`) · `start` (API + serves `dist/`)

## Layout
```
shared/types.ts        contract: lesson + visual spec types (server & UI)
server/                API: routes, prompts, LLM call, mock fixtures
src/core/              app logic: api client, command bus, input/ (gestures, voice)
src/ui/                React: App, panels/ (timeline, topics, problems), visual/ (3D scenes)
src/utils/             pure helpers (gesture math, element colors)
```
Every input (mouse, gesture, voice) goes through `src/core/commands.ts`, so a new gesture works in every visual automatically.

## Controls
- **Two-hand steering:** pinch with both hands like gripping a wheel. Turn it to rotate the view, raise/lower both hands to tilt, spread/close to zoom
- **Other gestures:** one-hand pinch + drag to rotate · fast open-hand swipe to change tabs
- **Voice:** "zoom in/out", "rotate left/right/up/down", "top/front/side view", "reset", "next", "previous"
- **Keyboard:** arrows rotate (Shift = bigger steps) · + / - zoom · T / F / S views · R reset · 1-4 tabs
- **On-screen:** rotate / zoom / view buttons in the corner of the 3D stage; mouse drag and scroll also work

## Building in parallel
`AGENTS.md`, `TASKS.md` and `.superset/` are set up for running several coding agents at once in Paradev, one worktree per task. See `docs/PARALLEL.md`.
