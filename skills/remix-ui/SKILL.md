---
name: remix-ui
description: Build the UI behavior of a Remix app. Use when creating pages, layouts, client entries, interactions, stateful UI, navigation, hydration, animations, reusable mixins, or UI tests.
---

# Remix UI

Use this skill for the UI behavior of a Remix app: pages, layouts, rendering, interactivity,
frames, navigation behavior, client entries, animations, mixins, and UI tests.

This skill uses Remix Component as the UI model behind the app's pages, layouts, interactions, and
client behavior.

Use `../remix-styling/SKILL.md` when the task is primarily about styling, visual polish, or CSS
structure rather than component behavior.

## Defaults

1. Follow the two-phase component shape:
   - setup runs once
   - returned render function runs on every update
2. Keep state in setup scope as plain JavaScript variables and call `handle.update()` explicitly.
3. Prefer host-element mixins over legacy host props:
   - `mix={[on(...)]}`
   - `mix={[css(...)]}`
   - `mix={[ref(...)]}`
   - `mix={[keysEvents()]}`
   - `mix={[pressEvents()]}`
   - `mix={[link(href, options)]}`
4. Use `css(...)` for all static styles via `mix`. Only use `style` for dynamic values.
5. Prefer inline JSX over render helper functions. If UI needs extraction, make it a proper
   component, not a plain function that returns JSX.
6. Use `addEventListeners(target, handle.signal, listeners)` for global listeners.
7. Use `queueTask(...)` for post-render DOM work, reactive effects, or hydration-sensitive setup.
8. Keep `<head>` explicit in document or layout code.

## When Hydrating UI

Use this section only when adding `clientEntry(...)` or browser-owned behavior.

1. Check `../remix-project-layout/SKILL.md` before choosing a file location.
2. Put hydrated entry modules and browser-owned behavior in `app/assets/`.
3. Prefer a route-rendered `clientEntry(...)` island over adding route-specific logic to shared
   boot files such as `app/assets/entry.tsx`.
4. Pass server-derived initialization to hydrated islands through serializable `setup`.

## Verify

For interactive UI, validate runtime behavior and not just types:

- check typecheck or tests
- watch the dev server for script-server or hydration errors
- verify one pointer path and one keyboard path
- verify closed, hidden, and empty states after styling interactive UI
- use `root.flush()` when unit tests need synchronous assertions

## Load These References As Needed

- [./references/component-model.md](./references/component-model.md)
  Use for component shape, state, `handle` usage, and global listeners.
- [./references/mixins-styling-events.md](./references/mixins-styling-events.md)
  Use for host-element events, refs, styling, and built-in behavior helpers. Prefer these helpers
  over re-implementing keyboard, press, link, or animation behavior yourself.
- [./references/hydration-frames-navigation.md](./references/hydration-frames-navigation.md)
  Use for `clientEntry`, `run`, frames, SSR frame context, navigation APIs, and explicit `<head>`
  management.
- [./references/testing-patterns.md](./references/testing-patterns.md)
  Use for component tests, `root.flush()`, and high-value testing heuristics.
- [./references/animate-elements.md](./references/animate-elements.md)
  Use when the task is about enter/exit transitions, FLIP reordering, shared-layout swaps, or
  animation-heavy interactions in app code.
- [./references/create-mixins.md](./references/create-mixins.md)
  Use when authoring or reviewing reusable mixins, touching `createMixin(...)`, using
  `handle.addEventListener('insert' | 'remove', ...)`, or reasoning about mixin lifecycle
  semantics and type flow.
- [packages/component/docs](https://github.com/remix-run/remix/tree/main/packages/component/docs)
  Use as the general upstream docs directory when the local references here are not enough and you
  need to choose the most relevant Component docs to open.
