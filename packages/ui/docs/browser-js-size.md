# Browser JavaScript Size Findings

## Goal and decision rule

Reduce the actual compressed JavaScript bytes downloaded by typical hydrated Remix apps.

This phase is about making the browser-loaded module bodies themselves smaller, especially modules
that are already downloaded by a normal hydrated page. Per-entry graph wins are useful diagnostics,
but they are not enough if the same bytes still arrive through another asset on the same page.

A change is worth keeping when it reduces the full de-duped bookstore browser asset set in gzip and
brotli, keeps public/API churn low, and is not just another version of a rejected split below. Raw
bytes are useful for finding bloated code paths, but raw-only wins should be reverted when compressed
downloads regress.

Primary goals:

- reduce de-duped downloaded JavaScript bytes for the bookstore hydrated browser asset set;
- judge wins by gzip and brotli first, with raw bytes used as a diagnostic;
- keep meaningful changes that shrink already-downloaded modules without broad public API churn;
- identify the next high-leverage runtime or route modules worth investigating.

Non-goals:

- optimizing static-only pages;
- changing bookstore app authoring policy just to improve this fixture;
- splitting code into more public subpaths or helper modules when the de-duped page-level bytes do
  not improve meaningfully;
- landing raw-only rewrites that regress gzip or brotli;
- relying on compiler-only transformations unless they fit Remix's source-served asset philosophy.

## Measurement rules

Primary measurement is the de-duped module set fetched by the bookstore demo's hydrated browser
assets: the browser entry plus hydrated component assets and every URL returned by
`assetServer.getPreloads(...)`, using production asset-server settings.

Before keeping an experiment, answer these questions:

- Which downloaded module body actually gets smaller?
- Does the full de-duped bookstore set improve in gzip and brotli?
- Is the change still valuable after shared modules are counted only once?
- Does it avoid new public API surface or compiler behavior unless the compressed-byte win justifies
  that cost?
- Is this materially different from a path already tried and rejected below?

## Do not revisit without new evidence

These paths have either been measured as low-value or are outside the current goal:

- more fine-grained route helper subpaths;
- narrow helper/shim splits that add public exports but only move bytes around;
- static-route entry omission;
- passing concrete route strings into component props for bookstore-only savings;
- raw-only rewrites that regress gzip or brotli;
- cosmetic private-name shortening as a primary strategy;
- splitting `clientEntry` into another source-served runtime module unless there is a no-extra-module
  design with a measured full-set compressed win.

## Current checkpoint

The committed checkpoint before the current internal runtime cleanup was
`95,692 raw / 39,526 gzip / 34,984 brotli / 60 modules` for all bookstore browser assets.

The current working-tree checkpoint is
`95,200 raw / 39,427 gzip / 34,915 brotli / 60 modules`. That is a
`492 raw / 99 gzip / 69 brotli` improvement over the committed checkpoint and comes from removing
internal runtime export/factory bytes from modules already downloaded by hydrated pages, not from a
new graph split. The largest remaining package targets are still `reconcile.ts`, `frame.ts`,
`mixin.ts`, `diff-dom.ts`, route-map/href generation, SVG attribute normalization, and the runtime
CSS serializer.

## Measurement fixture

The bookstore demo is a useful fixture for measuring the JavaScript fetched by source-served Remix UI browser assets. These numbers use the demo's production asset server settings and sum the raw byte length of the requested entry module plus every module returned by `assetServer.getPreloads(...)`.

## Browser import narrowing

This comparison keeps the bookstore routes, hydration behavior, and authored imports unchanged. The asset server narrows selected browser-served imports from broad Remix barrels to smaller subpaths during source compilation.

The first pass narrows `remix/ui` imports for `clientEntry`, `css`, `on`, and `run`:

| Browser asset                   |      Full `remix/ui` graph | Narrowed `remix/ui/*` graph |              Savings |
| ------------------------------- | -------------------------: | --------------------------: | -------------------: |
| `app/assets/entry.tsx`          |  86,093 bytes / 38 modules |   78,398 bytes / 31 modules |   7,695 bytes (8.9%) |
| `app/assets/image-carousel.tsx` |  87,907 bytes / 40 modules |   19,998 bytes / 20 modules | 67,909 bytes (77.3%) |
| `app/assets/cart-button.tsx`    | 102,827 bytes / 59 modules |   30,555 bytes / 34 modules | 72,272 bytes (70.3%) |
| `app/assets/cart-items.tsx`     | 105,076 bytes / 59 modules |   37,167 bytes / 39 modules | 67,909 bytes (64.6%) |

The main browser entry still needs most of the client runtime, so its win is modest. Small hydrated component assets benefit more because `clientEntry`, `on`, and `css` can be compiled to narrow imports without pulling unrelated rendering, component, theme, and primitive exports through the package barrel.

## Tried and reverted: route helper exports

The cart browser assets import the bookstore route map, and that route map previously had to import every helper through the `remix/routes` barrel. Adding narrow route helper exports lets route maps import only the groups they need:

- `remix/routes/route`
- `remix/routes/method` (`del`, `get`, `head`, `options`, `patch`, `post`, and `put`)
- `remix/routes/form`
- `remix/routes/resource`
- `remix/routes/resources`

Measured on top of the narrowed `remix/ui/*` asset imports, asset-server import narrowing for the bookstore route map produces the following incremental wins:

| Browser asset                   | Narrowed `remix/ui/*` graph | Narrowed UI + route helper graph | Incremental savings |
| ------------------------------- | --------------------------: | -------------------------------: | ------------------: |
| `app/assets/entry.tsx`          |   78,398 bytes / 31 modules |        78,398 bytes / 31 modules |             0 bytes |
| `app/assets/image-carousel.tsx` |   19,998 bytes / 20 modules |        19,998 bytes / 20 modules |             0 bytes |
| `app/assets/cart-button.tsx`    |   30,555 bytes / 34 modules |        29,622 bytes / 38 modules |    933 bytes (3.1%) |
| `app/assets/cart-items.tsx`     |   37,167 bytes / 39 modules |        36,234 bytes / 43 modules |    933 bytes (2.5%) |

This was reverted during patch curation. The real de-duped page-level value was small:
`861 raw / 151 gzip / 124 brotli` for all bookstore browser assets. That was not enough to justify
five new public `@remix-run/fetch-router/routes/*` and `remix/routes/*` subpath exports plus asset
compiler rewrite cases. The route helpers remain available from `remix/routes`; only the narrow
route-helper subpaths and compiler rewrites were dropped.

## Mixin and JSX runtime splits

The narrow `remix/ui/on` and `remix/ui/css` exports originally imported the whole mixin runtime just to create authoring descriptors. Splitting the descriptor factory into `runtime/mixins/mixin-descriptor.ts` keeps small browser assets from downloading `resolveMixedProps`, lifecycle teardown, and mixin reconciliation helpers unless they also import the renderer.

The JSX runtime also exported `Fragment` from `runtime/component.ts`, which made every TSX asset preload the component runtime even when it only needed `jsx`. Moving `Fragment` to `runtime/fragment.ts` keeps `remix/ui/jsx-runtime` small while preserving the existing `runtime/component.ts` re-export.

Measured before route-helper export curation, these internal splits produced the following
diagnostic per-entry wins:

| Browser asset                   | Narrowed UI + route helper graph | Split mixin/Fragment graph |  Incremental savings |
| ------------------------------- | -------------------------------: | -------------------------: | -------------------: |
| `app/assets/entry.tsx`          |        78,398 bytes / 31 modules |  78,658 bytes / 33 modules |   -260 bytes (-0.3%) |
| `app/assets/image-carousel.tsx` |        19,998 bytes / 20 modules |   9,081 bytes / 19 modules | 10,917 bytes (54.6%) |
| `app/assets/cart-button.tsx`    |        29,622 bytes / 38 modules |  18,516 bytes / 36 modules | 11,106 bytes (37.5%) |
| `app/assets/cart-items.tsx`     |        36,234 bytes / 43 modules |  25,317 bytes / 42 modules | 10,917 bytes (30.1%) |

The main browser entry already downloads the full renderer, so the extra compatibility module edges
cost a few hundred bytes there. Small hydrated component assets benefit much more because they no
longer preload renderer-only mixin and component runtime modules. The route-helper subpaths from
that intermediate measurement are no longer part of the curated patch.

## Internal graph impact

The package also moves CSS value normalization helpers into `style/values.ts` and points runtime modules at lower-level style modules where possible. This keeps client runtime imports from reaching the full style barrel when they only need value normalization or the stylesheet manager.

Diagnostic bookstore measurements after the initial package/export changes:

| Browser asset                   | Original full-barrel graph |   Optimized package graph |              Savings |
| ------------------------------- | -------------------------: | ------------------------: | -------------------: |
| `app/assets/entry.tsx`          |  86,093 bytes / 38 modules | 78,658 bytes / 33 modules |   7,435 bytes (8.6%) |
| `app/assets/image-carousel.tsx` |  87,907 bytes / 40 modules |  9,081 bytes / 19 modules | 78,826 bytes (89.7%) |
| `app/assets/cart-button.tsx`    | 102,827 bytes / 59 modules | 18,516 bytes / 36 modules | 84,311 bytes (82.0%) |
| `app/assets/cart-items.tsx`     | 105,076 bytes / 59 modules | 25,317 bytes / 42 modules | 79,759 bytes (75.9%) |

## Actual downloaded module set

The optimized package graph above is helpful, but a rendered page downloads a de-duped union of the browser entry plus any hydrated component assets it references. That changes the practical impact: many small-entry wins disappear once the page has already downloaded the main UI runtime.

Current production source-served measurements before deeper file-size work:

| Browser asset set                 | Modules |       Bytes |
| --------------------------------- | ------: | ----------: |
| `entry`                           |      33 |  78,658 raw / 30,429 gzip |
| `entry + cart-button`             |      63 |  95,212 raw / 38,774 gzip |
| `entry + image-carousel + cart-button` | 68 | 101,193 raw / 41,397 gzip |
| `entry + cart-items`              |      67 | 101,339 raw / 41,215 gzip |
| all bookstore browser assets      |      69 | 104,263 raw / 42,600 gzip |

The largest modules in the full downloaded set are the UI runtime files:

| Module | Bytes |
| ------ | ----: |
| `packages/ui/src/runtime/reconcile.ts` | 20,812 raw / 6,749 gzip |
| `packages/ui/src/runtime/frame.ts` | 15,104 raw / 5,064 gzip |
| `packages/ui/src/runtime/mixins/mixin.ts` | 8,655 raw / 2,748 gzip |
| `packages/ui/src/runtime/diff-dom.ts` | 6,317 raw / 2,380 gzip |

These are now the biggest actual-byte opportunities. More entrypoint splitting has diminishing returns once the main runtime is present; shrinking or simplifying the runtime files themselves is likely higher leverage.

## Route href stack

The next package-level target was route href generation. The bookstore cart browser assets import the app route map for calls like `routes.api.cartToggle.href()` and `routes.books.show.href(...)`. Before this pass, adding `cart-button` to the main entry downloaded another 30 modules, `16,554 raw / 8,340 gzip`. Most of that was route code:

| Incremental group | Modules | Bytes |
| ----------------- | ------: | ----: |
| `route-pattern` | 10 | 10,051 raw / 4,484 gzip |
| `fetch-router` route helpers | 8 | 3,526 raw / 1,861 gzip |
| bookstore app routes/assets | 2 | 2,225 raw / 1,119 gzip |
| other wrappers | 10 | 752 raw / 876 gzip |

The first attempt split `route-pattern` parsing internals so `createHref('...')` could parse without importing the `RoutePattern` class and serializer. That helped the direct string-href dependency shape, but it did not reduce the bookstore page graph because `fetch-router` route maps still eagerly parsed and joined every route into `RoutePattern` instances. In fact, the intermediate measurement got slightly worse: `entry + cart-button` moved to `95,594 raw / 38,956 gzip` because the route map still downloaded the old class/serializer path plus the new parse-parts module.

The follow-up package change made `fetch-router` route maps string-first:

- `Route` stores its source string and materializes the parsed `pattern` lazily.
- `Route.href()` calls `createHref()` with the source string unless a parsed pattern was explicitly provided.
- `createRoutes()` joins route definitions through the lightweight route-pattern parse parts instead of importing `RoutePattern` and `joinPatterns`.
- `@remix-run/route-pattern/parse` and `remix/route-pattern/parse` expose the lightweight parser as
  a narrow public subpath.

After that change, plus a small `createHref()` cleanup that keeps the defensive `unreachable`
throw local instead of downloading `route-pattern`'s shared helper module, the bookstore de-duped
module set improved:

| Browser asset set                 | Before | After | Savings |
| --------------------------------- | -----: | ----: | ------: |
| `cart-button` alone | 18,516 raw / 9,675 gzip / 36 modules | 17,385 raw / 8,908 gzip / 31 modules | 1,131 raw / 767 gzip |
| `cart-items` alone | 25,317 raw / 12,592 gzip / 42 modules | 24,186 raw / 11,824 gzip / 37 modules | 1,131 raw / 768 gzip |
| `entry + cart-button` | 95,212 raw / 38,774 gzip / 63 modules | 94,081 raw / 38,008 gzip / 58 modules | 1,131 raw / 766 gzip |
| `entry + image-carousel + cart-button` | 101,193 raw / 41,397 gzip / 68 modules | 100,062 raw / 40,629 gzip / 63 modules | 1,131 raw / 768 gzip |
| `entry + cart-items` | 101,339 raw / 41,215 gzip / 67 modules | 100,208 raw / 40,448 gzip / 62 modules | 1,131 raw / 767 gzip |
| all bookstore browser assets | 104,263 raw / 42,600 gzip / 69 modules | 103,132 raw / 41,833 gzip / 64 modules | 1,131 raw / 767 gzip |

The savings come from no longer downloading the `RoutePattern` class, serializer, `joinPatterns`,
the top-level `route-pattern` wrapper, and the shared `unreachable` helper for browser route-map
href usage. The `route-map` module grew because it now owns lightweight join/serialize helpers, so
the net win is modest. Still, it is an actual downloaded-byte reduction in the normal hydrated
bookstore pages without changing the demo.

After reverting the low-value route-helper subpath narrowing, the curated route href stack still
keeps the string-first route-map and lightweight parse changes, but not the `remix/routes/*`
subpaths. Current measurements after all curated changes are listed below.

This also clarifies the next route-related opportunity: `createHref()` itself is now the largest
remaining route-pattern module in the browser set at `3,603 raw / 1,376 gzip`, followed by
`fetch-router`'s `route-map` at `3,105 raw / 1,222 gzip`. Further route gains would need to make
href generation or route-map joining smaller, not just move parsing across subpaths.

## Remaining package opportunities after route href stack

At this stage, these were the opportunities that still mapped to actual downloaded bytes rather than
just smaller per-entry graphs:

- **UI runtime core size**: after de-duping all browser assets, `reconcile.ts` (`20,812 raw`),
  `frame.ts` (`15,104 raw`), `mixin.ts` (`8,655 raw`), and `diff-dom.ts` (`6,317 raw`) dominate the
  downloaded set. This is the highest-leverage area, but it needs behavior-preserving runtime
  simplification rather than more entrypoint splitting.
- **Route href generation**: `createHref()` is still the largest route-pattern file downloaded by
  route-map browser assets. A real win here would come from reducing the href algorithm/error path
  itself or sharing a smaller serializer/join primitive without pulling the full `RoutePattern`
  class path back in.
- **Stable bundled chunks**: for bundled production output, stable chunks are likely more valuable
  than many fine-grained chunks. This does not shrink source modules by itself, but it is still a
  practical network improvement for cache reuse once the module bodies have been made smaller.

## Tried and rejected: shared marker helpers

`frame.ts`, `diff-dom.ts`, `reconcile.ts`, and `vdom.ts` each contain small helpers for recognizing
`rmx:h:*`, `/rmx:h`, `rmx:f:*`, and `/rmx:f` comment markers. Moving those helpers into the already
downloaded `stream-protocol.ts` module looked promising because it removed duplicate marker parsing
logic from the largest UI runtime files.

The measured result was worse for the de-duped downloaded set:

| Browser asset set | Before | Shared marker helper experiment | Delta |
| ----------------- | -----: | -------------------------------: | ----: |
| `entry` | 78,658 raw / 30,426 gzip / 33 modules | 79,093 raw / 30,616 gzip / 33 modules | +435 raw / +190 gzip |
| `entry + cart-button` | 94,081 raw / 38,008 gzip / 58 modules | 94,516 raw / 38,191 gzip / 58 modules | +435 raw / +183 gzip |
| all bookstore browser assets | 103,132 raw / 41,833 gzip / 64 modules | 103,567 raw / 42,012 gzip / 64 modules | +435 raw / +179 gzip |

The individual large files did shrink (`frame.ts`, `diff-dom.ts`, and `reconcile.ts`), but the
shared helper added enough code to `stream-protocol.ts` that the page-level module set grew. This is
a useful guardrail: consolidating tiny repeated helpers is not automatically a network win in
source-served mode, even when the target module is already downloaded.

## UI runtime bulk-clear deletion

The first kept UI-runtime size reduction removes a `reconcile.ts` fast path that recursively
inspected a subtree before clearing all children with `textContent = ''` when the next child list was
empty. The branch avoided per-child DOM removals only when every existing descendant was safe to bulk
clear. It also carried extra recursive analysis code in the hottest downloaded module.

Deleting the branch lets the existing removal loop handle empty child lists. This preserves the
cleanup semantics already used for normal removals, keeps keyed/mixin/frame cleanup on the same path,
and removes bytes from `reconcile.ts` directly instead of moving helpers elsewhere.

Measured on top of the route href stack work:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| `entry` | 78,658 raw / 30,426 gzip / 33 modules | 78,277 raw / 30,332 gzip / 33 modules | 381 raw / 94 gzip |
| `entry + cart-button` | 94,081 raw / 38,008 gzip / 58 modules | 93,700 raw / 37,908 gzip / 58 modules | 381 raw / 100 gzip |
| `entry + image-carousel + cart-button` | 100,062 raw / 40,629 gzip / 63 modules | 99,681 raw / 40,530 gzip / 63 modules | 381 raw / 99 gzip |
| `entry + cart-items` | 100,208 raw / 40,448 gzip / 62 modules | 99,827 raw / 40,354 gzip / 62 modules | 381 raw / 94 gzip |
| all bookstore browser assets | 103,132 raw / 41,833 gzip / 64 modules | 102,751 raw / 41,734 gzip / 64 modules | 381 raw / 99 gzip |

`reconcile.ts` moved from `20,812 raw / 6,752 gzip` in the current measured graph to `20,431 raw /
6,648 gzip`. This is a modest byte win, but it is exactly the kind that matters for source-served
assets: fewer bytes in a module that every hydrated page already downloads.

## UI runtime direct-event deletion

A second `reconcile.ts` reduction removes the special direct-event fast path for `on(...)` mixins.
The fast path avoided creating full mixin runtime state when a host node only used `on(...)`
descriptors, but it duplicated listener binding, rebind, teardown, and reentry-abort logic that
already exists in `on-mixin.ts`.

Deleting the fast path means `on(...)` consistently runs through the normal mixin lifecycle. This is
a runtime simplification rather than an import-graph split: the page-level module count mostly stays
the same, but the always-downloaded reconciler gets smaller and the main entry no longer downloads
`on-mixin.ts` just to recognize that special case.

Measured on top of the route href stack work and the bulk-clear deletion:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| `entry` | 78,277 raw / 30,321 gzip / 33 modules | 75,977 raw / 29,424 gzip / 32 modules | 2,300 raw / 897 gzip |
| `entry + cart-button` | 93,700 raw / 37,905 gzip / 58 modules | 92,133 raw / 37,422 gzip / 58 modules | 1,567 raw / 483 gzip |
| `entry + image-carousel + cart-button` | 99,681 raw / 40,527 gzip / 63 modules | 98,114 raw / 40,041 gzip / 63 modules | 1,567 raw / 486 gzip |
| `entry + cart-items` | 99,827 raw / 40,347 gzip / 62 modules | 98,260 raw / 39,862 gzip / 62 modules | 1,567 raw / 485 gzip |
| all bookstore browser assets | 102,751 raw / 41,733 gzip / 64 modules | 101,184 raw / 41,242 gzip / 64 modules | 1,567 raw / 491 gzip |

`reconcile.ts` moved from `20,431 raw / 6,646 gzip` to `18,864 raw / 6,167 gzip`. This is a better
shape than the rejected shared-marker helper experiment because it deletes a duplicate behavior path
instead of moving helper code into another already-downloaded module.

The main tradeoff is runtime cost, not network cost: simple `on(...)` handlers now use the general
mixin machinery. Targeted browser tests for `on(...)`, event integration, and mixin lifecycle pass,
but this should still be treated as a behavior-sensitive runtime change and validated broadly before
landing.

## UI runtime DOM disposal cleanup

The next kept reduction is in `diff-dom.ts`. Removed DOM subtrees previously walked once to dispose
hydrated virtual roots and again to dispose nested frames. Merging that into one traversal keeps the
same cleanup behavior while removing duplicate tree-walk code. The same pass also removes a couple
of redundant marker-comparison helpers that were already covered by the generic comment-node path.

Measured on top of the route href stack, bulk-clear deletion, and direct-event deletion:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 101,184 raw / 41,242 gzip / 64 modules | 101,053 raw / 41,214 gzip / 64 modules | 131 raw / 28 gzip |

`diff-dom.ts` moved from `6,317 raw / 2,379 gzip` at the start of UI runtime work, to `6,186 raw /
2,360 gzip` after this cleanup. The byte win is small, but it removes duplicate subtree cleanup work
from an always-downloaded module.

## UI frame cleanup consolidation

The next frame-runtime cleanup applies the same idea inside `frame.ts`. When a frame switches from
HTML content to client-rendered Remix node content, and when a frame is disposed, the runtime
previously walked the frame region once to dispose hydrated virtual roots and again to dispose nested
frames. Consolidating those into one ownership cleanup pass removes duplicate traversal code while
keeping DOM removal separate.

Measured on top of the previous runtime reductions:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 101,053 raw / 41,214 gzip / 64 modules | 100,900 raw / 41,187 gzip / 64 modules | 153 raw / 27 gzip |

`frame.ts` moved from `15,104 raw / 5,064 gzip` at the start of UI runtime work, to `14,951 raw /
5,016 gzip` after this cleanup. Like the `diff-dom.ts` cleanup, this is a small source-served win,
but it removes duplicate frame-region cleanup work from an always-downloaded module.

After this frame pass, the full bookstore browser asset set is
`100,900 raw / 41,187 gzip / 64 modules`.
The largest remaining files are still the UI runtime core:

| Module | Bytes |
| ------ | ----: |
| `packages/ui/src/runtime/reconcile.ts` | 18,864 raw / 6,167 gzip |
| `packages/ui/src/runtime/frame.ts` | 14,951 raw / 5,016 gzip |
| `packages/ui/src/runtime/mixins/mixin.ts` | 8,655 raw / 2,744 gzip |
| `packages/ui/src/runtime/diff-dom.ts` | 6,186 raw / 2,360 gzip |

Grouped by package area, the full downloaded set at this point is:

| Group | Modules | Bytes |
| ----- | ------: | ----: |
| UI runtime | 27 | 73,034 raw / 27,864 gzip |
| bookstore app code | 5 | 7,874 raw / 3,532 gzip |
| route-pattern | 5 | 6,753 raw / 2,926 gzip |
| UI style runtime | 5 | 6,558 raw / 3,036 gzip |
| fetch-router route helpers/map | 8 | 5,693 raw / 2,655 gzip |
| Remix shim wrappers | 9 | 564 raw / 724 gzip |

## Asset-server relative script import URLs

Source-served script modules were still emitting dependency specifiers as absolute
`/assets/...` URLs. That does not change which modules the browser eventually downloads, but it does
make each downloaded module body larger than it needs to be. The asset server can preserve absolute
URLs for `getHref()` and `getPreloads()` while rewriting only script import specifiers to relative
served URLs inside the emitted JavaScript.

Measured with the bookstore production asset settings and a stable `GITHUB_SHA=browser-js-size`, the
full downloaded module set improves without changing the module graph:

| Browser asset set | Before absolute import URLs | After relative import URLs | Savings |
| ----------------- | --------------------------: | -------------------------: | ------: |
| all bookstore browser assets | 100,878 raw / 41,177 gzip / 36,371 brotli / 64 modules | 98,301 raw / 40,228 gzip / 35,669 brotli / 64 modules | 2,577 raw / 949 gzip / 702 brotli |

The module count stays at 64. The win comes from shortening 112 script import specifiers from
`5,917` raw bytes as absolute served URLs to `3,340` raw bytes as relative served URLs. Preload URLs
remain absolute so HTML/link generation keeps the same external URL shape; only the downloaded script
source changes.

After this pass, the largest remaining files are:

| Module | Bytes |
| ------ | ----: |
| `packages/ui/src/runtime/reconcile.ts` | 18,594 raw / 6,141 gzip |
| `packages/ui/src/runtime/frame.ts` | 14,720 raw / 4,988 gzip |
| `packages/ui/src/runtime/mixins/mixin.ts` | 8,538 raw / 2,726 gzip |
| `packages/ui/src/runtime/diff-dom.ts` | 6,156 raw / 2,338 gzip |
| `packages/route-pattern/src/lib/href.ts` | 3,566 raw / 1,355 gzip |
| `packages/fetch-router/src/lib/route-map.ts` | 3,089 raw / 1,215 gzip |

Grouped by package area, the current full downloaded set is:

| Group | Modules | Bytes |
| ----- | ------: | ----: |
| UI runtime | 27 | 71,218 raw / 27,452 gzip |
| bookstore app code | 5 | 7,812 raw / 3,520 gzip |
| route-pattern | 5 | 6,599 raw / 2,829 gzip |
| UI style runtime | 5 | 6,432 raw / 2,976 gzip |
| fetch-router route helpers/map | 8 | 5,444 raw / 2,483 gzip |
| Remix shim wrappers | 9 | 504 raw / 611 gzip |
| other wrappers/helpers | 5 | 292 raw / 357 gzip |

This leaves the clearest package-level opportunities in:

- **Core UI runtime simplification**: the reconciler, frame runtime, mixin runtime, and DOM diffing
  still make up most of the downloaded bytes for hydrated pages. The successful reductions deleted
  behavior branches from `reconcile.ts`; similar wins are more likely than more subpath splitting.
- **Frame/runtime boundary review**: `run()` brings the full frame runtime, including streaming frame
  reload, template buffering, hydration marker, module loading, and navigation behavior. If a
  smaller default runtime is desired, it probably needs a cohesive Remix runtime API boundary rather
  than route/page-specific static optimizations.
- **Route href/map algorithm size**: `createHref()`, `parsePatternParts`, and `route-map.ts` are the
  largest non-UI package pieces left in the hydrated cart path. Further gains need smaller parsing,
  joining, and error-path code, not just narrower exports.
- **Shim/request overhead**: Remix shim wrappers are very small in bytes but still add requests in
  source-served mode. They are not a major file-size target compared with UI runtime code.

## Tried and rejected: parsed href helper subpath

The route href stack still downloads `route-pattern/src/lib/href.ts` for browser route-map href
calls. A tempting next split was to move the parsed-pattern href generator into a
`route-pattern/href-parts` subpath so `fetch-router` could call it after parsing or joining route
sources, without importing the public `createHref()` wrapper.

Measured result:

| Browser asset set | Before | Parsed href helper split | Delta |
| ----------------- | -----: | -----------------------: | ----: |
| all bookstore browser assets | 98,301 raw / 40,220 gzip / 35,638 brotli / 64 modules | 98,329 raw / 40,219 gzip / 35,622 brotli / 64 modules | +28 raw / -1 gzip / -16 brotli |

The core helper file was smaller than `href.ts`, but the added public/package shim module erased the
raw-byte win. This should not land as a standalone split. The route href stack still may have gains,
but they likely need actual algorithm/error-path reduction or a broader resolver-aware shim collapse,
not another narrow helper subpath.

## UI controlled-reflection cleanup

The next kept UI-runtime reduction is in `reconcile.ts`'s controlled form reflection state. The
runtime previously carried separate `input` and `change` listener functions, a
`listenersAttached` flag, persisted `managesValue`/`managesChecked` booleans, and longer state field
names for values that are already scoped to controlled reflection.

The cleanup keeps the behavior but shortens the always-downloaded reconciler:

- use one shared listener for `input` and `change`, with the existing `input` skip condition inline;
- remove the listener-attached flag because the deferred attach already checks `disposed` and
  `removeEventListener` is safe when no matching listener is present;
- keep `managesValue` and `managesChecked` as locals instead of persisted state;
- shorten private controlled-reflection state fields;
- remove the redundant hyphenated-property guard from the private property reflection helper, whose
  callers only check `value` and `checked`.

Measured on top of the relative script import URL pass:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 98,301 raw / 40,228 gzip / 35,669 brotli / 64 modules | 97,913 raw / 40,135 gzip / 35,554 brotli / 64 modules | 388 raw / 93 gzip / 115 brotli |

`reconcile.ts` moved from `18,594 raw / 6,141 gzip / 5,573 brotli` after the relative URL pass to
`18,206 raw / 6,049 gzip / 5,493 brotli`. This is small, but it is an actual byte reduction in a
module every hydrated page already downloads.

After this pass, the largest remaining files are:

| Module | Bytes |
| ------ | ----: |
| `packages/ui/src/runtime/reconcile.ts` | 18,206 raw / 6,049 gzip |
| `packages/ui/src/runtime/frame.ts` | 14,720 raw / 4,988 gzip |
| `packages/ui/src/runtime/mixins/mixin.ts` | 8,538 raw / 2,726 gzip |
| `packages/ui/src/runtime/diff-dom.ts` | 6,156 raw / 2,338 gzip |
| `packages/route-pattern/src/lib/href.ts` | 3,566 raw / 1,355 gzip |
| `packages/fetch-router/src/lib/route-map.ts` | 3,089 raw / 1,215 gzip |

## UI controlled-reflection and binding micro-cleanup

The controlled-reflection pass left a few tiny always-downloaded helpers in `reconcile.ts`:
property read/write wrappers that were only used by the controlled restore path, a property-test
helper that was only used by controlled sync, and temporary `managesValue`/`managesChecked` locals
that the minifier did not fully erase. Inlining those checks into the two controlled-reflection
sites keeps the runtime contract the same: the sync path still records whether the DOM element can
reflect `value` or `checked`, and the restore path only writes the properties when that recorded
state says the element is managed.

Two adjacent tiny cleanups also removed bytes from already-downloaded runtime files:

- `bindNodeMixRuntime()` no longer accepts the `StyleManager`, because it never used that argument.
- `copyOwnRmxEntries()` no longer calls `Object.hasOwn()` after iterating `Object.keys(source)`;
  the prototype-pollution key guard remains.

Measured on top of the previous controlled-reflection cleanup:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 97,913 raw / 40,135 gzip / 35,554 brotli / 64 modules | 97,740 raw / 40,074 gzip / 35,481 brotli / 64 modules | 173 raw / 61 gzip / 73 brotli |

The module graph is unchanged. `reconcile.ts` moved from `18,206 raw / 6,049 gzip / 5,493 brotli`
to `18,053 raw / 5,998 gzip / 5,433 brotli`; `frame.ts` moved from `14,720 raw / 4,988 gzip /
4,489 brotli` to `14,700 raw / 4,978 gzip / 4,478 brotli`.

## UI frame query and rmx-data cleanup

The frame runtime still carried two separate `rmx-data` merge helpers for documents and fragments,
and a few DOM query loops eagerly copied `NodeList` results into arrays before iterating. Merging the
`rmx-data` root scan and iterating query results directly removes a little more code from the
already-downloaded frame runtime without changing the module graph.

Measured on top of the previous controlled-reflection and binding micro-cleanup:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 97,740 raw / 40,074 gzip / 35,481 brotli / 64 modules | 97,526 raw / 40,054 gzip / 35,457 brotli / 64 modules | 214 raw / 20 gzip / 24 brotli |

`frame.ts` moved from `14,700 raw / 4,978 gzip / 4,478 brotli` to `14,486 raw / 4,963 gzip /
4,455 brotli`.

## UI browser/runtime attribute helper cleanup

The browser runtime imports `runtime/core/attributes.ts` through `patchHostProps()`, so anything in
that module is downloaded by typical hydrated pages. The module was also exporting SSR-only tables
for the server renderer: omitted framework props, self-closing tag names, and a tiny boolean-attribute
wrapper used only while producing HTML strings.

Moving those SSR-only tables into `server/stream.ts` keeps the shared browser helper focused on
runtime DOM patching. This does not change browser behavior or the downloaded module graph; it
removes bytes from an already-downloaded runtime helper.

Measured on top of the frame query and `rmx-data` cleanup:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 97,526 raw / 40,054 gzip / 35,457 brotli / 64 modules | 97,125 raw / 39,893 gzip / 35,299 brotli / 64 modules | 401 raw / 161 gzip / 158 brotli |

`runtime/core/attributes.ts` moved from `1,773 raw / 900 gzip / 788 brotli` to `1,372 raw /
739 gzip / 629 brotli`.

## Tried and rejected: smaller SVG attribute alias tables

`runtime/svg-attributes.ts` is also in the normal hydrated page set because browser prop patching
needs SVG attribute normalization. A smaller implementation removed the generated kebab-to-camel
alias map and replaced the namespaced SVG alias table with compact prefix parsing.

That did reduce raw bytes, but the compressed result was not a clear network win:

| Browser asset set | Before | SVG alias parser experiment | Delta |
| ----------------- | -----: | ---------------------------: | ----: |
| all bookstore browser assets | 97,526 raw / 40,054 gzip / 35,457 brotli / 64 modules | 96,743 raw / 40,055 gzip / 35,465 brotli / 64 modules | -783 raw / +1 gzip / +8 brotli |

The experiment also made SVG normalization code less direct. Since real downloads are normally
compressed, this should not land as-is. The better lesson is that `svg-attributes.ts` remains a
visible browser-runtime target, but wins there need to improve gzip/brotli too.

## Tried and rejected: mixin scheduler phase count storage

`runtime/mixins/mixin.ts` keeps per-scope listener counts for `beforeUpdate` and `commit` so a
released mixin scope can detach the global scheduler listeners when its lifecycle callbacks go away.
A prototype folded those per-scope phase counts into the scoped event target object and tracked the
global `beforeUpdate` and `commit` counts as separate fields.

That helped compressed bytes slightly, but grew raw bytes and made the lifecycle accounting less
direct:

| Browser asset set | Before | Mixin phase-count prototype | Delta |
| ----------------- | -----: | ---------------------------: | ----: |
| all bookstore browser assets | 97,125 raw / 39,893 gzip / 35,299 brotli / 64 modules | 97,227 raw / 39,880 gzip / 35,288 brotli / 64 modules | +102 raw / -13 gzip / -11 brotli |

The `mixin.ts` module moved from `8,538 raw / 2,726 gzip / 2,488 brotli` to `8,640 raw /
2,713 gzip / 2,474 brotli`. The compressed-byte gain is too small to justify the raw-byte increase
and less obvious state ownership, so this should not land as-is.

## UI virtual root consolidation

`runtime/vdom.ts` had two root constructors, `createRoot()` and `createRangeRoot()`, with duplicated
scheduler setup, frame-stub setup, DOM error forwarding, render scheduling, disposal, and flushing
logic. Consolidating the shared root controller into one helper removes duplicate code from an
already-downloaded runtime module without changing the module graph or public API.

Measured on top of the browser/runtime attribute helper cleanup:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 97,125 raw / 39,893 gzip / 35,299 brotli / 64 modules | 96,584 raw / 39,740 gzip / 35,196 brotli / 64 modules | 541 raw / 153 gzip / 103 brotli |

`runtime/vdom.ts` moved from `3,024 raw / 1,331 gzip / 1,156 brotli` to `2,461 raw /
1,186 gzip / 1,050 brotli`. This is another small but real source-served win: fewer bytes in a file
the main hydrated runtime already downloads.

## UI DOM diff and style runtime micro-cleanups

Two small UI runtime cleanups reduce actual downloaded module bodies without changing the module
graph:

- `runtime/diff-dom.ts` no longer builds a temporary `Set` of incoming attribute names when the DOM
  can answer the same removal question with `next.hasAttribute(name)`.
- `style/style.ts` uses compact selector tests for nested selectors and keyframes at-rules, and drops
  the unused internal `clearStyleCache()` export from the source-served style compiler module.

Measured on top of the virtual root consolidation:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 96,584 raw / 39,740 gzip / 35,196 brotli / 64 modules | 96,325 raw / 39,693 gzip / 35,162 brotli / 64 modules | 259 raw / 47 gzip / 34 brotli |

`runtime/diff-dom.ts` moved from `6,156 raw / 2,338 gzip / 2,109 brotli` to `6,152 raw /
2,332 gzip / 2,105 brotli`. `style/style.ts` moved from `2,728 raw / 1,042 gzip / 919 brotli` to
`2,473 raw / 1,001 gzip / 897 brotli`. These are deliberately small, low-risk reductions in modules
already downloaded by normal hydrated pages.

## Route href helper privacy

`route-pattern/src/lib/href.ts` was still exporting pathname and hostname serialization helpers that
are only used inside the href implementation. The package-facing `@remix-run/route-pattern/href`
subpath only re-exports `createHref`, `CreateHrefError`, and `CreateHrefArgs`, so those helper
exports were adding source-served module body bytes without being part of the public subpath API.

Making those helpers private reduces the downloaded href module directly:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 96,325 raw / 39,693 gzip / 35,162 brotli / 64 modules | 96,121 raw / 39,654 gzip / 35,122 brotli / 64 modules | 204 raw / 39 gzip / 40 brotli |

`route-pattern/src/lib/href.ts` moved from `3,566 raw / 1,355 gzip / 1,210 brotli` at the start of
this pass to `3,362 raw / 1,316 gzip / 1,171 brotli`. This is a useful reminder that source-served
ESM exports matter even when bundlers could theoretically tree-shake them later.

## UI internal export and navigation listener micro-cleanups

Two additional small UI runtime cleanups reduce already-downloaded module bodies:

- `runtime/vdom.ts` no longer re-exports internal reconciler and style-test helpers that are not
  part of the public `@remix-run/ui` barrel.
- `runtime/navigation.ts` no longer imports frame accessors back from `runtime/run.ts`. `run()`
  passes those accessors into the listener directly, which removes the navigation-to-run import cycle
  and collapses the now-unneeded test wrapper.

Measured on top of route href helper privacy:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 96,121 raw / 39,654 gzip / 35,122 brotli / 64 modules | 95,879 raw / 39,562 gzip / 35,026 brotli / 64 modules | 242 raw / 92 gzip / 96 brotli |

`runtime/vdom.ts` moved from `2,461 raw / 1,186 gzip / 1,050 brotli` to `2,374 raw /
1,157 gzip / 1,021 brotli`. `runtime/navigation.ts` moved from `1,750 raw / 751 gzip / 647 brotli`
to `1,567 raw / 688 gzip / 577 brotli`; `runtime/run.ts` grew slightly from passing the accessors,
so the page-level navigation win is smaller than the module-local navigation reduction.

## Curated patch checkpoint

After reverting the low-value route helper subpath/export work, the current full bookstore browser
asset set is:

| Browser asset set | Modules | Bytes |
| ----------------- | ------: | ----: |
| all bookstore browser assets | 60 | 96,740 raw / 39,713 gzip / 35,150 brotli |

Compared to the earlier actual downloaded module-set baseline (`104,263 raw / 42,600 gzip / 69
modules`), the curated package changes still save `7,523 raw / 2,887 gzip` and remove nine modules
from the normal hydrated bookstore page set. Compared to the maximal patch before curation, this
intentionally gives back `861 raw / 151 gzip / 124 brotli` to avoid adding low-value route-helper
subpath APIs.

The largest modules at this curated checkpoint were:

| Module | Bytes |
| ------ | ----: |
| `packages/ui/src/runtime/reconcile.ts` | 18,053 raw / 5,991 gzip / 5,433 brotli |
| `packages/ui/src/runtime/frame.ts` | 14,486 raw / 4,962 gzip / 4,458 brotli |
| `packages/ui/src/runtime/mixins/mixin.ts` | 8,560 raw / 2,718 gzip / 2,481 brotli |
| `packages/ui/src/runtime/diff-dom.ts` | 6,152 raw / 2,332 gzip / 2,105 brotli |
| `packages/route-pattern/src/lib/href.ts` | 3,362 raw / 1,316 gzip / 1,171 brotli |
| `packages/fetch-router/src/lib/route-map.ts` | 3,089 raw / 1,215 gzip / 1,124 brotli |
| `packages/ui/src/runtime/svg-attributes.ts` | 2,524 raw / 873 gzip / 741 brotli |
| `packages/ui/src/style/style.ts` | 2,473 raw / 1,001 gzip / 897 brotli |
| `packages/ui/src/runtime/component.ts` | 2,357 raw / 965 gzip / 848 brotli |
| `packages/ui/src/style/stylesheet.ts` | 2,248 raw / 1,052 gzip / 941 brotli |

## UI mixin runtime helper and private-name cleanup

The next kept pass reduces `runtime/mixins/mixin.ts`, the third-largest UI runtime file in the
hydrated page set. This pass avoids another module split and instead removes or merges one-use
runtime helpers and shortens private names that the source-server compiler preserves in emitted
JavaScript:

- inline the one-call mixin runtime state and handle factories;
- inline the one-call composed-props helper;
- share insert and reclaimed node event construction;
- export the existing mixin phase dispatcher directly instead of keeping separate
  `dispatchMixinBeforeUpdate()` and `dispatchMixinCommit()` wrappers.
- shorten private mixin handle field/method names while keeping them readable in source.

Measured on top of the curated patch checkpoint:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 96,740 raw / 39,713 gzip / 35,150 brotli / 60 modules | 95,963 raw / 39,617 gzip / 35,074 brotli / 60 modules | 777 raw / 96 gzip / 76 brotli |

`runtime/mixins/mixin.ts` moved from `8,560 raw / 2,718 gzip / 2,481 brotli` to `7,739 raw /
2,615 gzip / 2,393 brotli`. The shared phase dispatcher makes `reconcile.ts` grow from `18,053 raw
/ 5,991 gzip / 5,433 brotli` to `18,097 raw / 6,001 gzip / 5,444 brotli`, but the actual de-duped
page total still improves.

## Tried and rejected: frame context and child-existence micro-cleanup

A small `frame.ts` experiment reused the already-created frame runtime object when constructing the
frame context and replaced a few `childNodes.length` checks with `firstChild`. This saved raw bytes
in `frame.ts`, but it was not a compressed network win:

| Browser asset set | Before | Frame micro-cleanup experiment | Delta |
| ----------------- | -----: | -----------------------------: | ----: |
| all bookstore browser assets | 96,511 raw / 39,680 gzip / 35,122 brotli / 60 modules | 96,425 raw / 39,712 gzip / 35,125 brotli / 60 modules | -86 raw / +32 gzip / +3 brotli |

The experiment was reverted. The lesson matches the earlier SVG and scheduler experiments: in these
runtime files, raw-byte reductions that disturb repeated compressed shapes are not enough.

## Route href search-param cleanup

`route-pattern/src/lib/href.ts` still used `Object.keys(searchParams)` for its no-search early
return and then used `Object.entries(searchParams)` to serialize user-provided search params.
Reusing the entries array removes one emitted object enumeration from a module downloaded by browser
route-map href calls.

Measured on top of the UI mixin cleanup:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 95,963 raw / 39,617 gzip / 35,074 brotli / 60 modules | 95,954 raw / 39,611 gzip / 35,065 brotli / 60 modules | 9 raw / 6 gzip / 9 brotli |

`route-pattern/src/lib/href.ts` moved from `3,362 raw / 1,316 gzip / 1,171 brotli` at the curated
checkpoint to `3,353 raw / 1,310 gzip / 1,162 brotli`.

Also tried shortening `Route`'s private `#source`/`#pattern` fields in `fetch-router` route maps.
That got the full set to `95,912 raw / 39,609 gzip / 35,066 brotli`, which saved raw and gzip but
regressed brotli by 1 byte versus the href-search cleanup alone. It was reverted as too small and
too name-churny.

Current measurements after the kept mixin and route href cleanups:

| Browser asset set | Modules | Bytes |
| ----------------- | ------: | ----: |
| all bookstore browser assets | 60 | 95,954 raw / 39,611 gzip / 35,065 brotli |

## Route href and route-map serialization cleanup

The next route pass keeps the same public route APIs and module graph, but removes bytes from the
two route modules already downloaded by browser route-map assets:

- `createHref()` now chooses the pathname/hostname param encoder once per route part instead of
  repeating the part-type branch for every variable token.
- pathname param encoding uses `String.replace()` with `encodeURIComponent` directly instead of a
  manual structural-character table.
- hostname param validation uses the first regex match to preserve `CreateHrefError.details.char`
  without carrying two manual structural-character loops.
- `fetch-router` route-map serialization inlines tiny one-use `RoutePattern` serializer wrappers
  and passes the search constraint map directly to the search serializer.

Measured on top of the previous route href cleanup:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 95,954 raw / 39,611 gzip / 35,065 brotli / 60 modules | 95,692 raw / 39,526 gzip / 34,984 brotli / 60 modules | 262 raw / 85 gzip / 81 brotli |

`route-pattern/src/lib/href.ts` moved from `3,353 raw / 1,310 gzip / 1,162 brotli` to
`3,147 raw / 1,245 gzip / 1,108 brotli`. `fetch-router/src/lib/route-map.ts` moved from
`3,089 raw / 1,215 gzip / 1,124 brotli` to `3,033 raw / 1,187 gzip / 1,092 brotli`.

## UI internal runtime export and factory cleanup

The next kept UI-runtime pass removes bytes from modules already downloaded by hydrated pages without
changing the module graph:

- `frame.ts` inlines the one-use `createFrameRuntime()` factory into `createFrame()`.
- frame template buffering helpers, reconciler DOM-anchor helpers, and SVG attribute normalization
  are now private implementation details instead of source-served exports.

Measured on top of the route href and route-map cleanup:

| Browser asset set | Before | After | Savings |
| ----------------- | -----: | ----: | ------: |
| all bookstore browser assets | 95,692 raw / 39,526 gzip / 34,984 brotli / 60 modules | 95,200 raw / 39,427 gzip / 34,915 brotli / 60 modules | 492 raw / 99 gzip / 69 brotli |

`runtime/frame.ts` moved from `14,486 raw / 4,962 gzip / 4,458 brotli` to
`14,242 raw / 4,879 gzip / 4,402 brotli`. `runtime/reconcile.ts` moved from
`18,097 raw / 6,001 gzip / 5,444 brotli` to `17,904 raw / 5,986 gzip / 5,435 brotli`, and
`runtime/svg-attributes.ts` moved from `2,524 raw / 873 gzip / 741 brotli` to
`2,469 raw / 872 gzip / 739 brotli`.

## Tried and rejected: clientEntry source-module split

A follow-up experiment split `clientEntry` into a new `runtime/client-entry.ts` module while leaving
`client-entries.ts` for the hydration/server helpers. This made the graph more granular, but it
added a source-served module and regressed the full compressed set:

| Browser asset set | Before | Split `clientEntry` module | Delta |
| ----------------- | -----: | -------------------------: | ----: |
| all bookstore browser assets | 95,200 raw / 39,427 gzip / 34,915 brotli / 60 modules | 95,249 raw / 39,520 gzip / 35,007 brotli / 61 modules | +49 raw / +93 gzip / +92 brotli |

This should stay reverted unless there is a no-extra-module design with a measured full-set gzip and
brotli win. It is the same kind of module-splitting churn this investigation is trying to avoid.

The largest package modules in the current full downloaded set are now:

| Module | Bytes |
| ------ | ----: |
| `packages/ui/src/runtime/reconcile.ts` | 17,904 raw / 5,986 gzip / 5,435 brotli |
| `packages/ui/src/runtime/frame.ts` | 14,242 raw / 4,879 gzip / 4,402 brotli |
| `packages/ui/src/runtime/mixins/mixin.ts` | 7,739 raw / 2,615 gzip / 2,393 brotli |
| `packages/ui/src/runtime/diff-dom.ts` | 6,152 raw / 2,332 gzip / 2,105 brotli |
| `packages/route-pattern/src/lib/href.ts` | 3,147 raw / 1,245 gzip / 1,108 brotli |
| `packages/fetch-router/src/lib/route-map.ts` | 3,033 raw / 1,187 gzip / 1,092 brotli |
| `packages/ui/src/style/style.ts` | 2,473 raw / 1,001 gzip / 897 brotli |
| `packages/ui/src/runtime/svg-attributes.ts` | 2,469 raw / 872 gzip / 739 brotli |
| `packages/ui/src/runtime/vdom.ts` | 2,374 raw / 1,156 gzip / 1,022 brotli |
| `packages/ui/src/runtime/component.ts` | 2,357 raw / 965 gzip / 848 brotli |

This keeps the main opportunity map pointed at actual byte reductions:

- **UI runtime behavior breadth**: the reconciler, frame runtime, mixin runtime, and HTML DOM diff
  still dominate the hydrated page set. The worthwhile wins so far have deleted duplicate or unused
  branches from these modules. Future changes should keep looking for behavior that is duplicated,
  unconditionally downloaded, or owned by the wrong runtime boundary.
- **Frame runtime boundary**: `run()` still downloads document reload diffing, streamed frame
  template parsing, nested frame lifecycle, client-entry hydration, module loading, and navigation
  reload semantics together. A larger win would need a cohesive smaller runtime boundary, not another
  standalone helper split.
- **Route map/href code shape**: browser route-map usage still downloads href generation, pattern
  joining, and `Route.pattern` support even when a client asset only calls `.href()`. Further route
  wins need to reduce that code or separate advanced pattern materialization without breaking the
  synchronous route API.
- **Runtime CSS object serialization**: apps using `css()` still download the browser style object
  serializer and stylesheet manager. A meaningful win here would likely require a Remix-shaped
  static-style pre-evaluation path in the existing asset pipeline; micro rewrites need to improve
  gzip and brotli, not just raw bytes.
- **SVG/attribute normalization**: SVG alias handling remains visible in the browser prop patcher,
  but the smaller parser experiment regressed compressed bytes. Any future table reduction should be
  judged by gzip/brotli first.

## Excluded demo experiments

Two bookstore-only experiments produced additional savings but are intentionally not part of this change:

- Emitting the browser entry script only on routes with hydrated components reduced non-hydrated route JS to 0 bytes.
- Passing concrete route href strings into client-entry props avoided importing the demo route map from small browser assets.

Those are app-level policy choices, not package improvements. The package changes focus on making efficient import paths available and documented without changing the bookstore demo's behavior.
