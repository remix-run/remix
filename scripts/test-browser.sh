#!/usr/bin/env bash
set -euo pipefail

filters=()
while IFS= read -r -d '' config; do
  dir="${config%/*}"
  if [[ "$dir" != . && -f "$dir/package.json" ]]; then
    filters+=(--filter "$dir")
  fi
done < <(find . -type d \( -name node_modules -o -name .git -o -name reference \) -prune -o \
  -type f \( -name playwright.config.ts -o -name playwright.config.js \) -print0)

if [[ ${#filters[@]} -eq 0 ]]; then
  echo 'No browser test workspaces found' >&2
  exit 1
fi

exec pnpm --recursive --no-sort --workspace-concurrency=4 --stream \
  "${filters[@]}" --if-present run test --type browser --type e2e
