#!/bin/bash

# Helper script for us to use to validate template lint setups outside of the
# monorepo.  This script will, for each template in your local Remix repo clone:
#
# * Install an app via create-remix for the template (into a temp/ directory)
# * Install deps
# * npm run lint
#
# Usage:
#   lint-templates.sh [path-to-remix-repo]
#
# So from a sibling folder to the remix repo:
#   ../remix/scripts/lint-templates.sh ../remix

REPO_DIR="${1}"

if [ "${REPO_DIR}" == "" ]; then
  REPO_DIR="../remix"
fi

if [ ! -e "${REPO_DIR}" ]; then
  echo "Invalid repo directory: ${REPO_DIR}";
  exit 1;
fi

TEMPLATES=$(find ${REPO_DIR}/templates -type d -mindepth 1 -maxdepth 1 | grep -v deno | grep -v tutorial | sort)

for D in ${TEMPLATES}; do
  echo "Linting template: ${D}";
  echo "-------------------------------------------------------";
  rm -rf temp;
  npx create-remix@latest --template "${D}" temp -y;
  cd temp;
  npm run lint;
  echo "";
  echo "";
  cd ..;
done
