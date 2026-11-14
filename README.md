# LessonLab

Type any subject and get a full, explorable lesson:

- **History:** a timeline of key figures and findings
- **Topic map:** an overarching breakdown of everything in the field
- **Problems:** worked examples, including borderline and base cases
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

## Scripts
`dev` (web + api) · `typecheck` · `build` (frontend into `dist/`) · `start` (API + serves `dist/`)

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
- **Gestures:** pinch + drag to rotate · pinch with both hands and spread or close to zoom · fast open-hand swipe to change tabs
- **Voice:** "zoom in/out", "rotate left/right/up/down", "top/front/side view", "reset", "next", "previous"

## Building in parallel
`AGENTS.md`, `TASKS.md` and `.superset/` are set up for running several coding agents at once in Paradev, one worktree per task. See `docs/PARALLEL.md`.
