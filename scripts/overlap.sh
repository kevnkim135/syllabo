#!/usr/bin/env bash
# Early-warning: which files are touched by more than one agent branch?
# Usage: scripts/overlap.sh [base-branch] branch1 branch2 ...
#   With no branch args, checks every local branch except the base.
set -euo pipefail
BASE="${1:-main}"; shift || true
BRANCHES=("$@")
if [ ${#BRANCHES[@]} -eq 0 ]; then
  while IFS= read -r b; do [ "$b" != "$BASE" ] && BRANCHES+=("$b"); done \
    < <(git for-each-ref --format='%(refname:short)' refs/heads)
fi
tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT
for b in "${BRANCHES[@]}"; do
  mb=$(git merge-base "$BASE" "$b")
  git diff --name-only "$mb" "$b" | sed "s|^|$b\t|" >> "$tmp"
done
echo "== Files changed per branch =="
cut -f1 "$tmp" | sort | uniq -c | awk '{print "  " $2 ": " $1 " file(s)"}'
echo; echo "== Files touched by 2+ branches (merge-conflict risk) =="
dups=$(cut -f2 "$tmp" | sort | uniq -d)
if [ -z "$dups" ]; then echo "  none"; else
  while IFS= read -r f; do
    echo "  $f  <- $(awk -F'\t' -v f="$f" '$2==f{printf "%s ", $1}' "$tmp")"
  done <<< "$dups"
fi
