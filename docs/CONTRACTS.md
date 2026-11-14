# Contracts

## Data shapes
`shared/types.ts` is the single source of truth (lesson kinds, visual specs, API request/response).

## API (all POST bodies are JSON; errors are `{ error }` with status 400 / 502 / 500)
- `GET /api/health` -> `{ ok: true, mock: boolean }`
- `POST /api/lesson` body `LessonRequest` `{ subject, kind, level?, focus?, explored?, request?, variant? }`
  -> `{ kind, subject, data: LessonMap[kind] }`
  - `focus`: specific topic inside the subject; every kind is generated about it.
  - `explored` (problems): topics the student opened; problems build on them.
  - `request` (visual): free text such as "benzene"; `variant` (visual): 1, 2, ... for a different example.
- `POST /api/expand` body `{ subject, topic, path?: string[], level? }` -> `TopicDetail`
  `{ title, explanation, keyPoints[], example?, subtopics: TopicNode[] }`
- `POST /api/scope` body `{ subject, level? }` -> `ScopeInfo` `{ scope: "broad"|"specific", overview, suggestions[] }`
- `POST /api/solve` body `SolveRequest` `{ subject, level?, focus?, question?, image?: { mediaType, data } }`
  (base64 PNG/JPEG/WebP/GIF under 5 MB; needs a question or an image) -> `Problem`

Model output is validated in `server/validate.ts`, retried once, then 502. Results are cached in memory
(except `/api/solve`). Client wrappers: `src/core/api.ts`.

## Shared lesson state
`src/core/lesson.ts`: read with `useLesson()`, change with `lesson.*`.
State: `subject, level, focus, scope, section, data, loading, errors, explored, visualRequest, visualVariant, solved, asked`.
Actions: `start, setFocus, markExplored, goto, home, retry, requestVisual, newExample, ask, addSolved`.
`data[kind]` stays visible while a newer version loads (`loading[kind]`).

## Interaction
`src/core/commands.ts` is the command bus. Input code only *emits* commands; UI code only *subscribes*.
- Camera (3D stage): `rotate {dx,dy}`, `rotateAxis {axis,angle}`, `zoom {factor}`, `view {top|front|side}`, `reset`
- Navigation (lesson store): `next`, `prev`, `goto {section}`, `home`
- Content (lesson store): `newExample`, `generate {request}`, `solve {question}`

Emitters: gestures, voice, keyboard (`src/core/input/`), on-screen controls (`src/ui/visual/`).

## Styles
`src/ui/styles/tokens.css` holds the palette and shape tokens. One CSS file per owner (see `TASKS.md`).

## Run commands
- Dev (web + api): `npm run dev`
- Checks: `npm run typecheck` · `npm test` · `npm run build`
