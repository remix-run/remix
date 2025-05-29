#!/bin/bash

PACKAGE="./packages/remix/package.json"
IS_PRERELEASE=$(node -e "console.log(/-pre/.test(require('${PACKAGE}').version))")

# Can only provide a custom --tag when not in prerelease mode
# The prerelease tags come from the `pre.json` "tag" field
if [ ${IS_PRERELEASE} == "true" ]; then
  echo "Publishing with default changesets tag (pre-release)"
  pnpm exec changeset publish
else
  # Once we start v3 releases we'll need to use this
  # echo "Publishing with version-2 tag (stable release)"
  # pnpm exec changeset publish --tag version-2

  # But for now we can continue with using the `latest`
  # tag which is the default
  pnpm exec changeset publish
fi
