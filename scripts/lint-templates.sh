#!/bin/bash

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
