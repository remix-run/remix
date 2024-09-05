#!/bin/bash

set -x

cp -r templates/cloudflare-pages/* packages/remix-dev/__tests__/fixtures/cloudflare/
rm -f packages/remix-dev/__tests__/fixtures/cloudflare/app/entry.client.tsx
rm -f packages/remix-dev/__tests__/fixtures/cloudflare/app/entry.server.tsx

cp -r templates/deno/* packages/remix-dev/__tests__/fixtures/deno/
rm -f packages/remix-dev/__tests__/fixtures/deno/app/entry.client.tsx
rm -f packages/remix-dev/__tests__/fixtures/deno/app/entry.server.tsx

cp -r templates/remix/* packages/remix-dev/__tests__/fixtures/node/
rm -f packages/remix-dev/__tests__/fixtures/node/app/entry.client.tsx
rm -f packages/remix-dev/__tests__/fixtures/node/app/entry.server.tsx

set +x
