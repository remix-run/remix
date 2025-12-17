#!/bin/bash

set -e

pnpm clean

echo "Removing v6 artifacts..."
set -x
rm -rf demos/
rm -rf docs/api/
rm -rf docs/public/
rm -rf docs/typedoc/
rm -rf packages/async-context-middleware
rm -rf packages/compression-middleware
rm -rf packages/cookie
rm -rf packages/fetch-proxy
rm -rf packages/fetch-router
rm -rf packages/file-storage
rm -rf packages/form-data-middleware
rm -rf packages/form-data-parser
rm -rf packages/fs
rm -rf packages/headers
rm -rf packages/html-template
rm -rf packages/interaction
rm -rf packages/lazy-file
rm -rf packages/logger-middleware
rm -rf packages/method-override-middleware
rm -rf packages/mime
rm -rf packages/multipart-parser
rm -rf packages/node-fetch-server
rm -rf packages/response
rm -rf packages/route-pattern
rm -rf packages/session
rm -rf packages/session-middleware
rm -rf packages/static-middleware
rm -rf packages/tar-parser
set +x

echo "Installing and building..."
pnpm install --frozen-lockfile
pnpm build
