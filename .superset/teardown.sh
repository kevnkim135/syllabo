#!/usr/bin/env bash
# Runs before Paradev deletes a worktree. Add cleanup (docker, ports) here.
echo "Tearing down: ${SUPERSET_WORKSPACE_NAME:-unknown}"
exit 0
