#!/usr/bin/env bash
# Runs inside each NEW worktree right after Paradev creates it.
# Env vars Paradev provides: SUPERSET_WORKSPACE_NAME, SUPERSET_ROOT_PATH (main repo)
set -u

echo "Setting up workspace: ${SUPERSET_WORKSPACE_NAME:-unknown}"

# 1. Secrets / local env are gitignored, so copy them from the main repo.
for f in .env .env.local; do
  if [ -n "${SUPERSET_ROOT_PATH:-}" ] && [ -f "$SUPERSET_ROOT_PATH/$f" ]; then
    cp "$SUPERSET_ROOT_PATH/$f" "./$f" && echo "copied $f"
  fi
done

# 2. Dependencies (each worktree needs its own; don't symlink node_modules / venv).
if [ -f package.json ]; then
  if   [ -f pnpm-lock.yaml ]; then pnpm install
  elif [ -f yarn.lock ];      then yarn install
  elif [ -f bun.lockb ] || [ -f bun.lock ]; then bun install
  else npm install; fi
fi
if [ -f requirements.txt ]; then
  python3 -m venv .venv && ./.venv/bin/pip install -q -r requirements.txt
fi

echo "Setup done."
