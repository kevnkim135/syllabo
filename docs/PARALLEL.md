# Parallel agent workflow with Paradev

Paradev doesn't have agents share one folder. It gives each agent its own git worktree
(its own folder + branch of the same repo), and you merge the branches. That's what makes
parallel work safe.

## One-time
1. Install Paradev (macOS) and an agent CLI such as Claude Code.
2. Unzip this kit into your project root; `git init` + first commit if needed
   (worktrees require at least one commit): `git add -A && git commit -m "scaffold"`.
3. Fill in `docs/CONTRACTS.md` and `TASKS.md`, then commit them on `main`.
4. Open the repo in Paradev (add project).

## Per agent
5. New workspace in Paradev (Cmd+N), one per task in TASKS.md. Setup script runs automatically.
6. Start the agent with: "Read AGENTS.md, TASKS.md and docs/CONTRACTS.md. You are Agent N (name).
   Do your task, commit on your branch, and finish with the report AGENTS.md asks for."
7. While they run: answer their questions, and try each workspace with `npm run dev` in its folder
   (one at a time, since they share ports 5173 and 8787).

## Integrate
8. `git switch -c integrate` in the main repo.
9. `scripts/overlap.sh main` to see files touched by 2+ branches.
10. `scripts/merge-agents.sh --test "npm run typecheck && npm test && npm run build" branch-a branch-b branch-c`
   Merges one at a time; aborts cleanly on conflict or failing tests.
11. When green: `git switch main && git merge integrate`.
