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
6. Start the agent with: "Read AGENTS.md and TASKS.md. You are Agent N. Do your task."

## Integrate
7. `git switch -c integrate` in the main repo.
8. `scripts/overlap.sh main` to see files touched by 2+ branches.
9. `scripts/merge-agents.sh --test "<your test cmd>" branch-a branch-b branch-c`
   Merges one at a time; aborts cleanly on conflict or failing tests.
10. When green: `git switch main && git merge integrate`.
