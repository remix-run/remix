#!/bin/bash

VERSION="${1}"

if [ "${VERSION}" == "" ]; then
  VERSION="latest"
fi


echo "Updating the web-std-io dependencies to version '${VERSION}'"
echo ""

if [ ! -d "packages/remix-node" ]; then
  echo "Must be run from the remix repository"
  exit 1
fi

set -x

cd packages/remix-node
pnpm add @remix-run/web-fetch@${VERSION} @remix-run/web-file@${VERSION} @remix-run/web-stream@${VERSION}
cd ../..

set +x