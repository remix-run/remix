# Package for shared server features

Date: 2022-06-01

Status: proposed

## Context

Currently, users need to install 4 Remix dependencies:

- Dev (`@remix-run/dev`)
- Server runtime (`@remix-run/{cloudflare,deno,node}`)
- Adapter (`@remix-run/{arc,cloudflare-pages,cloudflare-workers,express,fly,netlify,vercel}`)
- Renderer (`@remix-run/react`)

User code currently looks like this:
```tsx
// server runtime
import { json, createFileSessionStorage } from "@remix-run/node";
// adapter
import { createRequestHandler } from "@remix-run/express"
// renderer
import { useLoaderData } from "@remix-run/react";
```

### Goals

- make DX and docs simpler: more intuitive, less magic, eliminate some user errors
- reduce bugs from `remix` internal complexity

### Non-goals

- maintainability of `remix` repo
- more portable `app/` directory
- reduce or increase number of packages

Some of these are nice-to-haves, but not the primary reasons for this proposal.

### Issues

1. Users can import features from their runtime that aren't supported by their adapter:

```tsx
import { createFileSessionStorage } from "@remix-run/node";
// Implementation only depends on server runtime, but _availability_ depends on the adapter!
// ❌ This will crash in netlify nor in vercel!
```

2. Docs, examples, and videos refer to `@remix-run/node` by default for shared functionality like `json`:

```tsx
import { json } from "@remix-run/node";
// Need docs to tell users that they should import from their corresponding runtime package, 
// and not from `@remix-run/server-runtime`.
```

3. Keeping shared exports consistent across runtime packages is [error-prone](https://github.com/remix-run/remix/pull/3215) and tedious.

## Decision

Users should import features from _adapter packages_, not from runtime packages. Each adapter can export only the features it supports. Shared features will be imported from a new package, `@remix-run/server`.

This means there won't be any imports needed from the runtime packages (`@remix-run/{cloudflare,deno,node`}) and these will become an implementation detail for most users. Only developers that need to develop adapters will import from the runtime packages directly.

### User-facing packages

Users still need to import from 4 Remix packages:

- Dev `@remix-run/dev` (unchanged)
- Shared server features `@remix-run/server`
- Adapter-specific server features (`@remix-run/{arc,cloudflare-pages,cloudflare-workers,express,fly,netlify,vercel}`)
- Renderer `@remix-run/react` (unchanged)

User code would look like this:
```tsx
// server
import { json } from "@remix-run/server";
// adapter
import { createRequestHandler, createFileSessionStorage } from "@remix-run/fly"
// renderer
import { useLoaderData } from "@remix-run/react";
```

### Internal packages

- Runtime packages for authoring adapters (`@remix-run/{cloudflare,deno,node}`)
- Package for authoring new runtimes (`@remix-run/server-runtime`), only including factory functions like:
  - `createCookieFactory`
  - `createSessionStorageFactory`
  - `createCookieSessionStorageFactory`
  - `createMemorySessionStorageFactory`

### Migration

Include a new migration for updating imports.

Can reuse and refactor code from the existing [replace-remix-imports](https://github.com/remix-run/remix/blob/main/packages/remix-dev/cli/migrate/migrations/replace-remix-imports/index.ts) migration with [small tweaks to the import maps](https://github.com/remix-run/remix/blob/main/packages/remix-dev/cli/migrate/migrations/replace-remix-imports/transform/mapNormalizedImports/packageExports.ts) and affected imports (`@remix-run/*` instead of `remix`).

## Consequences

DX will be simplified as it will be more obvious to users what package to import from. Less magic, complexity, abstraction, etc...

1. Users can only import features supported by their adapter, **eliminating a category of user errors**.
2. Docs, examples, and videos will unambiguously use `@remix-run/server` for shared features and particular adapter features from adapter packages when necessary.
3. All re-exports from runtime packages are obsoleted, **reducing bugs and missing features from Remix packages**.

Additionally,
- migrating imports will be automated via `npx @remix-run/dev migrate`.
- VS Code will recommend a _single_ package when importing values like `json`.
- Code in `app/` will be more portable and non-portable, adapter-specific features will be more obvious.

Note: While having portable `app/` code might be useful for users switching their runtime/adapter, the much more common upside is that it will be much easier for users, especially beginners, to copy code from docs, examples, and videos.

