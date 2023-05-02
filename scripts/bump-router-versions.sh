#!/bin/bash

VERSION="${1}"

if [ "${VERSION}" == "" ]; then
  VERSION="latest"
fi

echo "Updating all router versions to ${VERSION}"


if [ ! -d "packages/remix-server-runtime" ]; then
  echo "Must be run from the remix repository"
  exit 1
fi

set -x

cd packages/remix-server-runtime
yarn add -E @remix-run/router@${VERSION}
cd ../..

# cd packages/remix-express
# yarn add -E @remix-run/router@${VERSION}
# cd ../..

cd packages/remix-react
yarn add -E @remix-run/router@${VERSION} react-router-dom@${VERSION}
cd ../..

cd packages/remix-testing
yarn add -E @remix-run/router@${VERSION} react-router-dom@${VERSION}
cd ../..

set +x