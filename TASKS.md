# Task split (v2 redesign)

The foundation is on `main`: light theme and palette, home page, sidebar shell, shared lesson
state, command bus, and every API route (with mock data). Each agent below deepens ONE area.
Agents own whole files so branches do not overlap.

**Shared, read-only for agents** (request changes at the bottom): `shared/types.ts`,
`src/core/commands.ts`, `src/core/lesson.ts`, `src/core/api.ts`, `src/ui/App.tsx`, `src/ui/shell/**`,
`src/ui/home/**`, `src/ui/styles/{index,tokens,base,shell,home}.css`, `server/**`, `docs/**`.

**Design rules for everyone**
- Light mode only. Use the CSS variables in `src/ui/styles/tokens.css`; never write a raw color.
  Palette: white `#FFFFFF`, `#F3EAFF`, `#D5C2FF`, violet `#8B6BD6`, forest `#2F5D50`.
- Minimal, "bubbly rectangles": `var(--radius)` corners, `var(--pill)` for chips and inputs, soft
  `var(--shadow)`. Reuse `.card`, `.chip`, `.ask`, `.primary` from `base.css` / `home.css`.
- Content builds from the inside out: new elements enter with the `rise` / `bloom` keyframes and
  `var(--ease)`. Smooth, never abrupt. Laptop screens (1280 to 1680 px wide).
- Read state with `useLesson()` and change it with `lesson.*` (`src/core/lesson.ts`). Narrowing the
  focus (`lesson.setFocus`) or opening a topic (`lesson.markExplored`) must flow through the store
  so all four sections stay in sync. Do not keep your own copy of lesson data.
- Test with `npm run dev` (mock data works with no key; `MOCK_DELAY_MS=1500` in `.env` rehearses loading).

---

## Agent 1: model
- Goal: the 3D stage feels fluid and its controls look native to a MacBook.
- Owns: `src/ui/visual/**` except `InputControls.tsx`; `src/ui/styles/model.css`; `src/utils/elements.ts`
- Build:
  - Smooth camera: commands set a *target* (spherical position); every frame eases toward it
    (damped lerp in `useFrame`) instead of jumping. Applies to buttons, keys, gestures and voice.
  - Replace the corner button pad with a slim vertical control bar on the side of the stage that
    expands on hover/click into labelled controls (rotate, tilt, zoom, views, reset, new example).
    macOS look: translucent blur, hairline border, rounded, subtle spring on expand.
  - Handle the `rotateAxis {axis, angle}` command (rotate the view about an arbitrary view-space axis).
  - A small "Ask for a model" pill input on the stage that calls `lesson.requestVisual(text)`.
  - Replace the old "Two-hand steering" guide text with whatever Agent 2's gesture map is (see below).
  - Crossfade when the model changes; show `loading.visual` state on the stage.
- Done when: every control animates smoothly and no control looks bolted on.

## Agent 2: input
- Goal: accurate, clearly separated gestures, visible hand tracking, voice that requests content.
- Owns: `src/core/input/**`, `src/utils/gestureMath.ts`, `src/ui/visual/InputControls.tsx`,
  `src/ui/styles/input.css`, `tests/gesture*.test.ts`, `tests/voice.test.ts`
- Gesture map (replace the old wheel and one-hand rotate):
  - **One hand, open/close all fingers** (spread hand vs. fingers drawn together): zoom in/out.
    Emit `zoom`. Use hand openness normalized by hand size, with a dead zone.
  - **One hand, index-finger twirl** (fingertip traces a circle): emit `newExample` once per twirl, with a cooldown.
  - **Two hands: the user's left hand pinches thumb+index as a clutch; the right hand's index finger
    rotates the model** (confirmed by the user). The axis the finger rotates about is the axis the
    model rotates about: emit `rotateAxis {axis, angle}`. The video preview is mirrored, so check
    MediaPipe handedness to tell left from right.
  - **Navigation, strong movements only** (confirmed by the user):
    - A hard, fast open-hand swipe **up** emits `next`; a hard swipe **down** emits `prev`. The four
      sections run down the sidebar, so swiping up moves to the next one below, like scrolling a page.
      Require high speed and a long travel distance so ordinary hand movement never triggers it, and
      add a cooldown so one swipe moves exactly one section.
    - **Both hands as closed fists**, held about 0.7 s, emits `home`.
    - Remove the old sideways swipe.
  - Gestures must be mutually exclusive: classify the pose first, then act; add hysteresis so a
    pose must be held a few frames before it starts and released before another begins.
- Hand overlay: draw the 21 landmarks and their connections as lines and dots on a canvas over the
  video preview (use `HandLandmarker.HAND_CONNECTIONS`), plus a label of the recognized gesture.
- Smoother tracking with open-source tools already in the stack:
  - `GestureRecognizer` from `@mediapipe/tasks-vision` (same package, no new dependency) gives robust
    built-in poses (Closed_Fist, Open_Palm, Pointing_Up, Victory, ...) plus landmarks and handedness.
  - Add a One Euro filter (about 30 lines, no dependency) on landmarks instead of plain smoothing.
- Voice: focus on content, not camera movement. Keep navigation and `generate` / `solve` /
  `newExample` phrases in `voice.ts`; make them forgiving (interim results, synonyms). Show the heard
  transcript and the action taken. Camera phrases can stay as a fallback.
- Move the dock so it does not cover content (for example a compact panel that expands the preview).
- Done when: each gesture triggers only its own action, the skeleton is visible, tests cover the pure math.

## Agent 3: history
- Goal: a living timeline down the centre of the page.
- Owns: `src/ui/panels/TimelineView.tsx`, `src/ui/panels/history/**`, `src/ui/styles/history.css`
- Build:
  - A literal vertical line starting at the top middle of the view that draws itself downward as the
    user scrolls or opens cards; events alternate left and right and come into view progressively.
  - Each event is an expandable, collapsible bubble. Expanded, it reads like a short encyclopedia
    entry: fetch it with `fetchExpand({ subject, level, topic: event.title, path: [focus] })`.
  - Clickable terms inside a bubble (`event.related`, and the entry's `subtopics`) open a new related
    bubble branching off it; call `lesson.markExplored(term)` when one opens.
  - Around the line, smooth airflow lines (canvas) that bend around the cursor, in the same spirit as
    `src/ui/home/DeltaField.tsx`. Keep them faint so text stays readable.
  - Keep discovery / event / figure distinguishable using palette colors only.
- Done when: the line grows with progress, bubbles expand and branch, and the flow lines react to the cursor.

## Agent 4: topics
- Goal: a hub for broad subjects, a growing note sheet for specific topics.
- Owns: `src/ui/panels/TopicsView.tsx`, `src/ui/panels/topics/**`, `src/ui/styles/topics.css`
- Build:
  - Broad subject and no focus (`scope.scope === 'broad' && !focus`): only a rectangular bubble in the
    middle with the subject, the very brief `scope.overview`, and an input asking what to explore.
    Suggested topics (`scope.suggestions`) are clickable bubbles that visibly branch out from the
    centre bubble (connector lines, staggered entrance). Clicking one equals typing it: `lesson.setFocus(topic)`.
    A basic version of this hub exists; make it the whole view and add the branching layout.
  - Specific topic (a focus is set, or `scope.scope === 'specific'`): no hub. Show a highly organized
    note sheet in an outline, flowing note-taking style: headings from `data.topics`, indented points,
    and each point expandable in place via `fetchExpand` so the sheet builds on itself as the user
    clicks. Call `lesson.markExplored(topic)` for each expansion.
  - Offer "focus the whole lesson on this" on any note (calls `lesson.setFocus`).
- Done when: broad input shows only the hub, specific input shows only notes, and notes grow in place.

## Agent 5: problems
- Goal: practice that follows what the student explored, plus their own problems.
- Owns: `src/ui/panels/ProblemsView.tsx`, `src/ui/panels/problems/**`, `src/ui/styles/problems.css`
- Build:
  - Polish the solve bar (typed problem, attached or pasted screenshot via `fetchSolve`): drag and
    drop, a larger preview, clear loading and error states. Solved problems live in `solved` in the store.
  - Spoken problems already arrive as `asked` in the store; show what was heard while it solves.
  - Make the link to the topic map visible: show which explored topics (`explored`) the set builds
    on, and present the sample problems as branching from them (grouped or connected, inside-out).
  - Keep base / intro / core / edge labels, hints and worked solutions; reveal solutions step by step.
- Done when: a screenshot, a typed problem and a spoken problem all produce a solved card, and the
  samples visibly follow the explored topics.

---

## Requests (agents append here; format: `to <owner>: <file> - <what you need>`)
