# Task split

Each agent owns whole directories so branches don't overlap. `shared/types.ts` and
`src/core/commands.ts` are the contracts: humans change them, agents request changes.

## Agent 1: api
- Goal: reliable, fast lesson generation.
- Owns: `server/**`
- Ideas: validate model JSON against `shared/types.ts` and retry once on failure; cache by (subject, level, kind); stream the timeline.
- Done when: all 4 kinds return valid JSON for chemistry, calculus and physics subjects.

## Agent 2: panels
- Goal: polished timeline, topic map and problems views.
- Owns: `src/ui/App.tsx`, `src/ui/panels/**`, `src/ui/styles.css`
- Ideas: visual timeline, collapsible topic mind-map, "reveal hint" before the solution.
- Done when: all three views look good with real model output.

## Agent 3: visuals
- Goal: make the 3D models genuinely interactive and accurate.
- Owns: `src/ui/visual/**` (except `InputControls.tsx`), `src/utils/elements.ts`
- Ideas: double/triple bonds, orbitals; surface axes, tangent plane / gradient at a picked point; draggable physics bodies with live forces.
- Done when: each visual kind responds to mouse AND command-bus events.

## Agent 4: input
- Goal: robust gesture + voice control.
- Owns: `src/core/input/**`, `src/utils/gestureMath.ts`, `src/ui/visual/InputControls.tsx`
- Ideas: smoothing / dead zones, two-hand pan, more voice phrases, hand-skeleton overlay on the preview.
- Done when: rotate, zoom and tab switching feel smooth with gestures and voice.

## Requests (agents append here; format: `to <agent>: <file> - <what you need>`)
