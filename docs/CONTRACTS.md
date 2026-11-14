# Contracts

## Data shapes
`shared/types.ts` is the single source of truth (lesson kinds, visual specs, API request/response).

## API
- `GET /api/health` -> `{ ok: true, mock: boolean }`
- `POST /api/lesson` body `{ subject, kind: "timeline"|"topics"|"problems"|"visual", level? }`
  -> `{ kind, subject, data: LessonMap[kind] }`, or `{ error }` with status 400/502/500

## Interaction
`src/core/commands.ts` is the command bus. Input code only *emits* commands; UI code only *subscribes*.
Commands: `rotate {dx,dy}`, `zoom {factor}`, `view {top|front|side}`, `reset`, `next`, `prev`.

## Run commands
- Dev (web + api): `npm run dev`
- Checks: `npm run typecheck`
