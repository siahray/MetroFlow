#!/usr/bin/env bash
#
# Ruff check + format for staged Python files.
#
# Kept separate from lint-staged because lint-staged lives inside web-lgu/ and
# owns the Node toolchain; this side only needs the backend virtualenv.
set -eo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

FILES=()
while IFS= read -r path; do
  [ -n "$path" ] && FILES+=("$path")
done < <(git diff --cached --name-only --diff-filter=ACM -- 'backend/*.py')

if [ "${#FILES[@]}" -eq 0 ]; then
  exit 0
fi

# Prefer the project virtualenv so the pinned ruff version is used. Falling back
# to PATH keeps the hook usable from CI or a machine without the venv.
if [ -x "$ROOT/backend/venv/bin/ruff" ]; then
  RUFF="$ROOT/backend/venv/bin/ruff"
elif command -v ruff >/dev/null 2>&1; then
  RUFF="ruff"
else
  echo "pre-commit: ruff not found, skipping backend checks"
  echo "            install: backend/venv/bin/pip install -r backend/requirements-dev.txt"
  exit 0
fi

echo "pre-commit: ruff on ${#FILES[@]} Python file(s)"

for file in "${FILES[@]}"; do
  "$RUFF" check --fix --force-exclude "$file"
  "$RUFF" format --force-exclude "$file"
  # --fix and format rewrite files in place, so re-stage them.
  git add "$file"
done
