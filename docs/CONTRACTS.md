# Contracts

## Data shapes
`shared/types.ts` is the single source of truth (lesson kinds, visual specs, API request/response).

## API (all POST bodies are JSON; errors are `{ error }` with status 400 / 502 / 500)
- `GET /api/health` -> `{ ok: true, mock: boolean }`
- `POST /api/lesson` body `LessonRequest` `{ subject, kind, level?, focus?, explored?, request?, variant? }`
  -> `{ kind, subject, data: LessonMap[kind] }`
  - `focus`: specific topic inside the subject; every kind is generated about it.
  - `explored` (problems): topics the student opened; problems build on them and set `Problem.topic`
    (validated server-side against `explored`, so it is always one of those strings or absent).
  - `request` (visual): free text such as "benzene"; `variant` (visual): 1, 2, ... for a different example.
- `POST /api/expand` body `{ subject, topic, path?: string[], level? }` -> `TopicDetail`
  `{ title, explanation, keyPoints[], example?, subtopics: TopicNode[] }`
- `POST /api/scope` body `{ subject, level? }` -> `ScopeInfo` `{ scope: "broad"|"specific", lab?: "physics"|"chemistry"|"none", overview, suggestions[] }` (`lab` picks which sandbox features apply)
- `POST /api/solve` body `SolveRequest` `{ subject, level?, focus?, question?, image?: { mediaType, data } }`
  (base64 PNG/JPEG/WebP/GIF under 5 MB; needs a question or an image) -> `Problem`

- `POST /api/intent` body `IntentRequest` `{ transcript, context: { subject?, focus?, section?, model?, topics?, open?, saved?, folders? } }`
  -> `IntentResult` `{ intent: VoiceIntent, say }`. Uses Claude with a key, `shared/intentRules.ts` otherwise or on failure.

- `POST /api/molecule` body `{ name }` -> `MoleculeSpec` (chemistry sandbox)
- `POST /api/react` body `ReactRequest` `{ reactants: [{ name, formula?, count? }], condition?, level? }` -> `ReactionResult`
  `{ reacts, equation, explanation, products: [{ name, count, molecule }] }`

Model output is validated in `server/validate.ts`, retried once, then 502. Results are cached in memory
(except `/api/solve`). Client wrappers: `src/core/api.ts`.

## Shared lesson state
`src/core/lesson.ts`: several lessons can be open at once (tabs). `useLesson()` returns the ACTIVE lesson,
`useWorkspace()` returns `{ view: 'home'|'lesson'|'library', activeId, level, tabs }`. Change state with `lesson.*`.
Lesson: `id, subject, level, focus, scope, section, data, loading, errors, explored, visualRequest, visualVariant,
models, modelIndex, solved, asked, savedAt, folderId`. `data.visual` is always `models[modelIndex]`.
Actions: `start, setFocus, markExplored, goto, home, showLibrary, switchTo, close, retry, save, unsave, moveToFolder,
openSaved, requestVisual, newExample, selectModel, stepModel, removeModel, ask, addSolved`.

`src/core/library.ts`: saved lessons and folders in localStorage (`lessonlab.library.v1`); a saved lesson is
re-saved automatically when it changes. Drill-down explanations are cached in localStorage too (`src/core/api.ts`).

`src/core/assistant.ts`: resolves `ask` commands (free-form speech) through `POST /api/intent`, falling back to
`shared/intentRules.ts` in the browser.

## Interaction
`src/core/commands.ts` is the command bus. Input code only *emits* commands; UI code only *subscribes*.
- Camera (3D stage): `rotate {dx,dy}`, `rotateAxis {axis,angle}`, `zoom {factor}`, `view {top|front|side}`, `reset`
- Navigation (lesson store): `next`, `prev`, `goto {section}`, `home`
- Content (lesson store): `newExample`, `modelStep {step}`, `generate {request}`, `solve {question}`
- Speech (assistant): `ask {text}`

Emitters: gestures, voice, keyboard (`src/core/input/`), on-screen controls (`src/ui/visual/`).

## Styles
`src/ui/styles/tokens.css` holds the palette and shape tokens. One CSS file per owner (see `TASKS.md`).

## Run commands
- Dev (web + api): `npm run dev`
- Checks: `npm run typecheck` · `npm test` · `npm run build`
