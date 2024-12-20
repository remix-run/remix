#!/bin/bash

ROUTER_VERSION="${1}"
RR_VERSION="${2}"

if [ "${ROUTER_VERSION}" == "" ]; then
  ROUTER_VERSION="latest"
  RR_VERSION="latest"
elif [ "${RR_VERSION}" == "" ]; then
  RR_VERSION="${ROUTER_VERSION}"
fi


echo "Updating the React Router dependencies to the following versions:"
echo "  @remix-run/router -> ${ROUTER_VERSION}"
echo "  react-router-dom -> ${RR_VERSION}"
echo ""

if [ ! -d "packages/remix-server-runtime" ]; then
  echo "Must be run from the remix repository"
  exit 1
fi

set -x

cd packages/remix-dev
npx pnpm@8 add -E @remix-run/router@${ROUTER_VERSION}
cd ../..

cd packages/remix-server-runtime
npx pnpm@8 add -E @remix-run/router@${ROUTER_VERSION}
cd ../..

cd packages/remix-react
npx pnpm@8 add -E @remix-run/router@${ROUTER_VERSION} react-router@${RR_VERSION} react-router-dom@${RR_VERSION}
cd ../..

cd packages/remix-testing
npx pnpm@8 add -E @remix-run/router@${ROUTER_VERSION} react-router-dom@${RR_VERSION}
cd ../..

cd integration
npx pnpm@8 add -E @remix-run/router@${ROUTER_VERSION}
cd ..

# Because deplicates...
npx pnpm@8 dedupe && rm -rf ./node_modules && npx pnpm@8 install

set +x