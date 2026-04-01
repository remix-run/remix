---
name: remix-project-layout
description: Describe the ideal layout of a Remix application, including canonical directories, route ownership, naming conventions, and file locations on disk. When asked to bootstrap that layout in a new directory, run the repo-local Remix CLI.
---

# Remix Project Layout

Use this skill when defining, reviewing, or bootstrapping the on-disk layout of a Remix
application.

This skill is about structure and conventions. It defines where code belongs, how route ownership
maps to files on disk, and how a Remix app should be organized as it grows. When the user wants a
new app scaffolded, run the repo-local Remix CLI instead of recreating the starter files by hand.

Use `../remix-routing/SKILL.md` when the question is about the shape of `app/routes.ts`, route
nesting, or controller-to-route mapping rather than where those files live.

## Root Layout

Use these root directories consistently:

- `app/` for runtime application code
- `db/` for database artifacts such as migrations and SQLite files
- `public/` for static files served as-is
- `test/` for shared test helpers, fixtures, and cross-app integration coverage
- `tmp/` for runtime scratch files such as uploads, caches, or local session files

## App Layout

Inside `app/`, organize code by responsibility:

- `assets/` for client entrypoints and client-owned behavior
- `controllers/` for route-owned handlers and route-local UI
- `data/` for schema, queries, persistence setup, and runtime data initialization
- `middleware/` for request lifecycle concerns such as auth, sessions, database injection, and
  uploads
- `ui/` for shared cross-route UI primitives
- `utils/` for genuinely cross-layer runtime helpers
- `routes.ts` for the route contract
- `router.ts` for router setup and route wiring

## Client Entries and Browser-Owned Modules

Use `app/assets/` for modules whose primary job is to run in the browser.

- Put `clientEntry(...)` modules in `app/assets/`, even when they are used by only one route.
- Put browser-owned enhancement modules in `app/assets/`, not in `app/controllers/`.
- Let route owners in `app/controllers/` render or import asset-owned client entries.
- Keep server-rendered wrappers, page modules, and route ownership in `app/controllers/`.
- If a module must be compiled by the script server or hydrated on the client, default to
  `app/assets/`.

Examples:

- `app/controllers/books/index-page.tsx` renders `app/assets/books-search-form.tsx`
- `app/controllers/account/settings/page.tsx` renders `app/assets/account-settings-form.tsx`

## Placement Precedence

When code could plausibly live in more than one place, use this order of precedence:

1. Put code in the narrowest owner first.
2. If it belongs to one route, keep it with that route.
3. If it is reused across route areas but is still UI, move it to `app/ui/`.
4. If it is part of request lifecycle setup, keep it in `app/middleware/`.
5. If it is schema, query, persistence, or startup data logic, keep it in `app/data/`.
6. Use `app/utils/` only when the code is genuinely cross-layer and does not clearly belong to one
   of the other app layers.

Prefer moving code to a narrower owner over introducing generic shared buckets.

## Route Ownership

The disk layout should make it possible to start from a route key in `app/routes.ts` and find the
implementation immediately.

### Flat Leaf Routes

Use a flat file in `app/controllers/` when a route is implemented by one exported `BuildAction`.

Examples:

- `routes.home` -> `app/controllers/home.tsx`
- `routes.about` -> `app/controllers/about.tsx`
- `routes.search` -> `app/controllers/search.tsx`
- `routes.uploads` -> `app/controllers/uploads.tsx`

Flat leaf route files are self-contained. If a helper component is used only by that route, keep it
in the same module.

### Controller Folders

Use a folder with `controller.tsx` when the route is implemented by a `Controller`, owns nested
child routes, or owns multiple actions such as `index`, `action`, `show`, or `update`.

Examples:

- `routes.contact` -> `app/controllers/contact/controller.tsx`
- `routes.auth` -> `app/controllers/auth/controller.tsx`
- `routes.account` -> `app/controllers/account/controller.tsx`
- `routes.cart` -> `app/controllers/cart/controller.tsx`

### Nested Route Objects

If a route is nested in `app/routes.ts`, mirror that nesting on disk.

Examples:

- `routes.auth.login` -> `app/controllers/auth/login/controller.tsx`
- `routes.account.settings` -> `app/controllers/account/settings/controller.tsx`
- `routes.account.orders` -> `app/controllers/account/orders/controller.tsx`
- `routes.cart.api` -> `app/controllers/cart/api/controller.tsx`
- `routes.admin.users` -> `app/controllers/admin/users/controller.tsx`

### Shared UI

If UI is reused across route areas, it belongs in `app/ui/`, not under `app/controllers/`.

Examples:

- `app/ui/document.tsx`
- `app/ui/layout.tsx`
- `app/ui/form-field.tsx`
- `app/ui/restful-form.tsx`

Only keep a component inside a controller folder when that UI is owned by that route or controller
feature.

### Route-Local UI

If a page component or helper is used only by one action or controller feature, keep it next to the
owning route.

Examples:

- `app/controllers/contact/page.tsx`
- `app/controllers/auth/login/page.tsx`
- `app/controllers/account/settings/page.tsx`
- `app/controllers/admin/books/form.tsx`
- `app/controllers/books/index-page.tsx`

For flat leaf actions, route-local UI lives in the same file as the action.

### Promotion Rule

If a route starts as a flat leaf file and later grows child routes or multiple actions, promote it
from:

- `app/controllers/home.tsx`

to:

- `app/controllers/home/controller.tsx`

Do this only when the route actually needs it. Do not create controller folders preemptively for
every leaf route.

## Naming Conventions

Use predictable file names so route ownership is obvious without opening files:

- `controller.tsx` for controller entrypoints
- `page.tsx` for a single controller-owned page module
- `index-page.tsx`, `show-page.tsx`, `edit-page.tsx`, and `form.tsx` for resource-style controller
  UI
- flat action files named after the route key, such as `home.tsx`, `about.tsx`, `search.tsx`, or
  `uploads.tsx`
- colocated tests named after the route owner, such as `home.test.ts` or `controller.test.ts`

Do not invent one-off naming schemes when an existing convention already fits.

## Bootstrap

When the user wants this layout scaffolded into a new directory, run:

```sh
pnpm --filter @remix-run/cli run cli -- new <target-dir>
```

Optional flags:

- `--app-name <name>` to override the generated app name
- `--force` to write into a non-empty target directory

The CLI generates the starter app, including `README.md`, route handlers, shared UI, test
helpers, and the root directory structure described in this skill.

## Anti-Patterns

- Do not create `app/lib/` as a generic dumping ground.
- Do not create `app/components/` as a second shared UI bucket when `app/ui/` already owns that
  role.
- Do not put shared cross-route UI in `app/controllers/`.
- Do not put route-owned page modules in `app/ui/`.
- Do not put middleware, session, auth, or database lifecycle helpers in `app/utils/` when they
  belong in `app/middleware/`.
- Do not put schema, query, or database setup code in `app/utils/` when it belongs in `app/data/`.
- Do not create folders for simple leaf actions unless they are real controllers.
- Do not split solo actions across multiple files.
- Do not define `clientEntry(...)` modules under `app/controllers/`, `app/ui/`, or `app/utils/`.
- Do not create vague files like `helpers.ts`, `common.ts`, or `misc.ts` unless the name is truly
  accurate for the module's ownership.
