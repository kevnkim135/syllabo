# Contracts

## Data shapes
`shared/types.ts` is the single source of truth (lesson kinds, visual specs, API request/response).

## API
- `GET /api/health` -> `{ ok: true, mock: boolean }`
- `POST /api/lesson` body `{ subject, kind: "timeline"|"topics"|"problems"|"visual", level? }`
  -> `{ kind, subject, data: LessonMap[kind] }`, or `{ error }` with status 400/502/500
- `POST /api/expand` body `{ subject, topic, path?: string[], level? }` (path = ancestor topic titles, root first)
  -> `TopicDetail` `{ title, explanation, keyPoints[], example?, subtopics: TopicNode[] }`, or `{ error }`

Responses are validated server-side (`server/validate.ts`); invalid model output is retried once, then 502.
Successful results are cached in memory by (subject, level, kind) or (subject, level, path, topic).

## Interaction
`src/core/commands.ts` is the command bus. Input code only *emits* commands; UI code only *subscribes*.
Commands: `rotate {dx,dy}`, `zoom {factor}`, `view {top|front|side}`, `reset`, `next`, `prev`.
Emitters: gestures (`input/gestures.ts`), voice (`input/voice.ts`), keyboard (`input/keyboard.ts`), on-screen pad (`ui/visual/ViewPad.tsx`).

## Run commands
- Dev (web + api): `npm run dev`
- Checks: `npm run typecheck` · `npm test` · `npm run build`
