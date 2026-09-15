---
name: remix
description: Build and review Remix 3 applications using the remix npm package and subpath imports. Use for app structure, routes, controllers, middleware, validation, data, auth, sessions, uploads, UI, hydration, navigation, assets, or tests.
---

# Build a Remix App

Remix 3 uses Web APIs (`Request`, `Response`, `URL`, `FormData`) and imports from `remix/<subpath>`, not a top-level `remix` entry. Its UI runtime is **not React**: components use a setup function, `handle.props`, and a returned render function rather than hooks.

This skill owns app conventions and cross-package workflows. Installed package READMEs own API details. Start with the existing app, then load only the recipe and documentation needed for the task. To find which `remix/*` export does what, read [the package index](references/package-index.md).

## Inspect Before Changing

1. Read the app's `AGENTS.md`, `package.json`, and `tsconfig.json`. Use its package manager, scripts, runtime, and import conventions.
2. Check the installed Remix version, not just the dependency range. Read `node_modules/remix/package.json` or run the installed `remix version` command.
3. Inspect the relevant existing code: `app/routes.ts`, `app/router.ts`, the owning controller, and any middleware or browser entry involved. For asset or HMR changes, inspect `app/assets.ts`, `server.ts`, and `hmr.ts` before adding setup.
4. Decide what actually changes: URL contract, request lifecycle, persistence, identity, or UI. A component-only change does not need new routes; a server-only change does not need hydration.

The skill is copied into an app when it is scaffolded. Upgrading `remix` does not automatically refresh that copy. When examples disagree with the installed version, use that version's exports, types, and documentation rather than inventing compatibility wrappers or trusting older framework knowledge.

## Find Package Documentation

Look inside the directly installed `remix` package; do not assume transitive `@remix-run/*` packages are linked at the app root.

1. Inspect `node_modules/remix/package.json` to resolve the relevant `exports` entry. The public import name can differ from the underlying module name.
2. Look for its README beneath `node_modules/remix/src/`. Published exports usually point into `dist/`; README mirrors use the corresponding source module name beneath `src/`, without the file extension.
3. If there is no module-specific README, look in the mapped module's parent directories. Read the relevant headings/examples rather than loading every related package in full.
4. If the README is missing or unclear, inspect the installed source/types and follow relevant documentation links. Check version compatibility before applying examples from online `main` documentation.

Examples of mapped README paths, relative to `node_modules/remix/`:

| Import                         | README                            |
| ------------------------------ | --------------------------------- |
| `remix/router`, `remix/routes` | `src/fetch-router/README.md`      |
| `remix/middleware/render`      | `src/render-middleware/README.md` |
| `remix/session-storage/fs`     | `src/session/README.md`           |
| `remix/data-table/sqlite`      | `src/data-table-sqlite/README.md` |
| `remix/ui/button`              | `src/ui/button/README.md`         |

In the Remix monorepo itself, the mirrors are untracked; read the owning `packages/*` README instead.

## Choose a Recipe

Reference links are relative to this skill. Each recipe identifies the installed READMEs for its APIs; those README paths are relative to `node_modules/remix/`.

| Task                                                    | Start here                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Which `remix/*` export to reach for                     | [Package index](references/package-index.md)                                   |
| Placing files, adding a route area, sharing code        | [App structure](references/app-structure.md)                                   |
| Routes, controllers, forms, HTTP responses              | [Routing and controllers](references/routing-and-controllers.md)               |
| Middleware order, typed context, server lifecycle       | [Middleware and server](references/middleware-and-server.md)                   |
| Browser module access, asset URLs, development HMR      | [Assets and browser modules](references/assets-and-browser-modules.md)         |
| Input validation, persistence, migrations               | [Data and validation](references/data-and-validation.md)                       |
| Login, sessions, route protection, CSRF                 | [Auth and sessions](references/auth-and-sessions.md)                           |
| Multipart limits, upload authorization, cleanup         | [File uploads](references/file-uploads.md)                                     |
| Component state, props, lifecycle, context              | [Component model](references/component-model.md)                               |
| Events, styling, refs, accessible interactions          | [Mixins, styling, and events](references/mixins-styling-events.md)             |
| Client entries, frames, navigation, form error bodies   | [Hydration, frames, and navigation](references/hydration-frames-navigation.md) |
| Choosing a runner, router tests, browser tests          | [Testing](references/testing-patterns.md)                                      |
| Authoring a reusable host-element behavior              | [Creating mixins](references/create-mixins.md)                                 |
| Animation, spring, tween                                | Installed `src/ui/animation/README.md`                                         |
| Existing UI controls such as menus, tabs, or comboboxes | Installed README for the relevant `remix/ui/<primitive>` export                |
| Intentionally browser-only routing                      | Installed `src/spa/README.md`                                                  |

Load connected recipes when a feature crosses layers. For example, a protected form needs routing, auth, and testing; an enhanced form also needs the navigation response policy. Follow relevant links rather than reading the entire skill directory.

## Essential Rules

### Routes and ownership

- Treat `app/routes.ts` as the shared URL contract. Use `routes.<name>.href(...)` for internal links, redirects, form actions, and test URLs.
- Controllers under `app/actions/` own direct leaf routes. Map nested route maps explicitly with their own controllers; controller middleware does **not** protect other controllers.
- Put code in the narrowest owner first. Extract shared modules when reuse is real. Apply layout conventions to the work at hand, not as a reason to reorganize unrelated existing code.
- Install `render()` from `remix/middleware/render` for normal UI apps. Actions call `context.render(node, init)`; pass the asset server to the middleware for source-based client entries.

### Request behavior

- Make the server path correct before adding browser behavior. Actions return explicit responses for expected outcomes: success, validation failure, conflict, not found, or redirect. Reserve thrown errors for unexpected failures.
- Validate untrusted input before rendering or persistence. Prefer `parseSafe` from `remix/data-schema` when validation failure should re-render a form.
- Model status, headers, caching, and content type as part of the route behavior. Use an explicit `303` for POST-redirect-GET.
- Preserve middleware context types with inline arrays or `createMiddleware()` for stored chains. Do not cast away missing context. Only call `getContext()` outside handlers when `asyncContext()` is installed.
- Keep secrets and persistence code server-only. Browser asset allow/deny rules are a security boundary, not just build configuration.

### UI and browser behavior

- Read changing props inside render/callbacks through `handle.props`. Keep local state in setup-scope variables and request updates with `handle.update()`.
- Keep rendering free of DOM side effects. Use events, `ref(...)`, or `handle.queueTask(...)`; tie cleanup and cancellation to the appropriate signal.
- Compose host behavior with `mix={mixin(...)}`, or `mix={[...]}` for multiple mixins. Prefer existing first-party primitives over recreating complex controls.
- Add `clientEntry(...)` only where browser behavior is needed. Its props cross a serialization boundary; never pass functions, secrets, or server runtime objects.
- Use native links, buttons, and forms. Preserve labels, keyboard behavior, focus, validation feedback, and reduced-motion preferences when enhancing them.

### Security

- Require production session/provider secrets from the environment; never copy demo secrets. Session cookies should be `httpOnly`, use `sameSite`, and be `secure` over HTTPS.
- Rotate sessions on login/privilege changes and invalidate them on logout. Authentication does not replace per-resource authorization.
- Protect cookie-authenticated mutations against CSRF. Use the auth recipe to connect middleware, form tokens, and failure behavior; CORS is not CSRF protection.
- Treat upload names, types, and contents as untrusted. Apply limits before buffering or storing data, authorize writes, and clean up failed uploads.

## Verify the Changed Behavior

Use the app's existing scripts and the installed CLI. Read `src/cli/README.md` for flags; do not install a newer CLI merely to inspect the app.

| Change                            | Useful verification                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| Any code change                   | Relevant tests and the app's typecheck script                                                     |
| Route contract or registration    | `remix routes`, plus `router.fetch(...)` tests                                                    |
| Asset reachability or URL mapping | `remix assets inspect <url-or-file>`; confirm private source is denied                            |
| Environment or app conventions    | `remix doctor`; review findings before applying fixes                                             |
| Schema or migrations              | `remix db status`, then migration checks against a disposable database                            |
| Interactive forms or navigation   | Browser flow plus ordinary document submission; check validation/error bodies, focus, and history |
| Auth or uploads                   | Rejection paths as well as success; prove unauthorized requests cannot write data                 |

The scaffold's `npm test` runs `remix test` and ships a router smoke test in `app/actions/controller.test.ts`; extend that pattern. Check reported test counts, not just the exit code.

Do not run destructive database commands or rewrite existing project configuration just to make a diagnostic pass. Report what was checked and what remains unverified.
