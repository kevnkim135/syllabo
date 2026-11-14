# LessonLab

Type any subject and get a full, explorable lesson:

- **Topic map:** a broad subject opens a hub that asks what to explore; a specific topic opens notes you can expand deeper and deeper
- **History:** a timeline of discoveries, events and prominent figures
- **Problems:** samples from base cases to edge cases that follow what you explored, plus your own problems typed, spoken or as a screenshot
- **Interactive model:** a 3D molecule, surface or diagram you control with **hand gestures and voice**, or request by name ("show me methane")

Narrowing the focus in one section updates all four.

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
shared/types.ts        contract: lesson, visual spec and API types (server & UI)
server/                API: routes, prompts, LLM calls, validation, mock fixtures
src/core/              lesson.ts (shared state), commands.ts (command bus), api.ts, input/ (gestures, voice, keys)
src/ui/                App shell; home/ (landing page), shell/ (sidebar), panels/ (history, topics, problems), visual/ (3D)
src/ui/styles/         tokens.css (palette) + one stylesheet per area
tests/                 unit tests for gesture math and voice parsing
```
Every input (mouse, keys, gesture, voice) goes through `src/core/commands.ts`, so a new gesture works everywhere automatically.

## Controls
- **Navigate:** sidebar, keys 1-4 (0 = home), or say "go to history", "open the topic map", "go home"
- **Talk naturally:** full sentences are understood in the context of the current lesson, e.g. "let's dive into SN2 reactions" (narrows this lesson), "ok, let's learn about photosynthesis instead" (opens a new lesson), "save this to my chemistry folder", "go back to organic chemistry", "show me benzene", "solve 2x + 3 = 7". Uses Claude when a key is set, built-in rules otherwise
- **Lessons:** several lessons stay open as tabs; Save keeps one in your Library (with folders) and it then saves itself as you go. Saved lessons reopen instantly, with every model, note and solved problem, without generating anything again (stored in this browser)
- **Models:** every model you build stays in the lesson; flip through them with an open-hand swipe left / right, `[` and `]`, the arrows on the stage, or "next model"
- **Model camera:** mouse drag and scroll, arrow keys, + / -, T / F / S views, R reset, the control bar on the stage
- **Gestures:** three-finger pinch held = zoom in, three fingers spread (ring and pinky folded) = zoom out, pinch with one hand + draw circles with the other index finger = rotate about that circle's axis, twirl a pointing finger = new example, swipe left / right = next / previous model, both fists = home

## Building in parallel
`AGENTS.md`, `TASKS.md` and `.superset/` are set up for running several coding agents at once in Paradev, one worktree per task. See `docs/PARALLEL.md`.
