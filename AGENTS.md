# Agent rules (read first)

You are one of several AI agents working on this repo IN PARALLEL. Each agent has its own
git worktree and branch, so you cannot overwrite each other's files, but your branches
will be merged later. Merge pain comes from overlapping edits, so follow these rules.

## Ownership
- Read `TASKS.md`. Work ONLY on the task assigned to you, and only edit files in your
  task's "Owns" list.
- Need a change in a file you don't own? Do NOT edit it. Add a line under "Requests" at the
  bottom of `TASKS.md`'s section for that file's owner, or work around it in your own files.
- Shared interfaces (API routes, data shapes, function signatures) live in
  `docs/CONTRACTS.md`. Code against the contract, not against another agent's in-progress code.
  If the contract must change, say so in your final message instead of silently changing it.

## Working style
- Commit early and often on your own branch with clear messages. Never commit to `main`.
- Never run `git checkout` to another branch, `git rebase`, or `git push --force`.
- Don't reformat or rename files you don't own (no repo-wide formatters, no mass imports sorting).
- Don't add dependencies without noting them in your final message; lockfile edits conflict.
- Keep it runnable: before finishing, run the project's test/build command and fix what you broke.

## When done
Reply with: what you built, files touched, any contract changes, anything the integrator must do.
