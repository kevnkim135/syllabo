#!/usr/bin/env bash
# Merge agent branches one at a time into the CURRENT branch (run this in the main repo,
# on an integration branch such as `integrate`). Stops safely on conflict or test failure.
# Usage: scripts/merge-agents.sh [--test "pytest -q"] branch1 branch2 ...
set -uo pipefail
TEST=""
if [ "${1:-}" = "--test" ]; then TEST="$2"; shift 2; fi
[ $# -gt 0 ] || { echo "usage: $0 [--test CMD] branch..."; exit 2; }
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has uncommitted changes. Commit or stash first."; exit 1
fi
for b in "$@"; do
  before=$(git rev-parse HEAD)
  echo "=== merging $b ==="
  if ! git merge --no-ff -m "Merge agent branch $b" "$b"; then
    echo "CONFLICT merging $b. Aborting that merge; $(git rev-parse --abbrev-ref HEAD) is unchanged."
    echo "Conflicting files:"; git diff --name-only --diff-filter=U
    git merge --abort
    echo "Resolve by hand, or ask one agent to rebase onto the integration branch, then re-run."
    exit 1
  fi
  if [ -n "$TEST" ] && ! bash -c "$TEST"; then
    echo "TESTS FAILED after merging $b. Rolling back to $before."
    git reset --hard "$before"
    exit 1
  fi
  echo "ok: $b"
done
echo "All branches merged."
