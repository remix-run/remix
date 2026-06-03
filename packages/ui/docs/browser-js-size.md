# Browser JavaScript Size Notes

This is a working notebook for reducing actual JavaScript downloaded by a typical hydrated Remix
app. It intentionally tracks the full de-duped bookstore browser asset set, not just per-entry graph
sizes.

Current checkpoint:

| Browser asset set            | Modules |                                    Bytes |
| ---------------------------- | ------: | ---------------------------------------: |
| all bookstore browser assets |      60 | 94,225 raw / 39,121 gzip / 34,654 brotli |

The first full de-duped checkpoint was `104,263 raw / 42,600 gzip / 69 modules`, so the measured
downloaded set is down `10,038 raw / 3,479 gzip / 9 modules` from that point. Brotli was added to
the measurement later, so not every early delta has brotli data.

Keep a change only if the full bookstore set improves in both gzip and brotli once shared modules
are counted once. Revert raw-only wins, module-splitting churn, static-only wins, and bookstore-only
authoring changes.

## Goals To Try Next

Focus on the four largest downloaded UI runtime modules before trying broader ideas:

- `packages/ui/src/runtime/reconcile.ts`
  - Look for duplicate host/frame adoption paths, redundant controlled-reflection branches, cleanup
    paths that can share existing code, and behavior that is now obsolete after prior runtime
    simplifications.
- `packages/ui/src/runtime/frame.ts`
  - Look for duplicated frame-region traversal, marker/template handling that can be made smaller
    in place, and code that is unconditionally downloaded by `run()` but only needed by rare frame
    modes.
- `packages/ui/src/runtime/mixins/mixin.ts`
  - Look for duplicated lifecycle event dispatch, teardown/persist branches, descriptor/result
    normalization paths, and handle bookkeeping that can be removed without changing mixin semantics.
- `packages/ui/src/runtime/diff-dom.ts`
  - Look for duplicated marker-range handling, child matching/reorder branches, live-state
    preservation code, and subtree cleanup paths that can be simplified without adding shared helper
    modules.

Secondary targets after those four:

- route href/route-map body size in `route-pattern/src/lib/href.ts` and
  `fetch-router/src/lib/route-map.ts`;
- runtime CSS object serialization in `style/style.ts` and related already-downloaded style modules;
- SVG/attribute normalization only if a new shape improves compressed bytes, not just raw size.

Avoid starting with new public subpaths, more source-served modules, compiler-only transformations,
or stable-chunk work. Those may matter later, but they do not directly shrink the downloaded source
module bodies.

## Successful Improvements

These were kept because they reduced the full downloaded set or a directly relevant source-served
body without adding unacceptable API/compiler churn.

| Area                                          | What changed                                                                                                                                                                                                   | Measured improvement                                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Asset import URLs                             | Rewrote emitted script import specifiers from absolute `/assets/...` URLs to relative served URLs while keeping public href/preload URLs absolute.                                                             | `2,577 raw / 949 gzip / 702 brotli`, no module-count change                                                                   |
| Route href stack                              | Made browser route maps string-first and lazy for `Route.pattern`, added the narrow route-pattern parser used by route-map joining, and avoided downloading the full `RoutePattern` class path for href calls. | `1,131 raw / 767 gzip / 5 modules`                                                                                            |
| Route href/route-map body cleanup             | Reduced href encoding/validation branches, reused search-param entries, and compacted route-map serialization helpers.                                                                                         | `262 raw / 85 gzip / 81 brotli`, plus smaller follow-ups of `9 raw / 6 gzip / 9 brotli` and `53 raw / 17 gzip / 20 brotli`    |
| Reconciler bulk-clear deletion                | Removed a recursive empty-child bulk-clear fast path and used the normal removal path instead.                                                                                                                 | `381 raw / 99 gzip`                                                                                                           |
| Reconciler direct-event deletion              | Removed the separate `on(...)` direct-event fast path and let events use normal mixin lifecycle handling.                                                                                                      | `1,567 raw / 491 gzip`                                                                                                        |
| Reconciler host adoption cleanup              | Shared host element adoption across hydration matches, hydration retry matches, and newly-created host elements.                                                                                               | `173 raw / 17 gzip / 17 brotli`                                                                                               |
| Reconciler micro-cleanups                     | Compact SVG context inheritance, persisted mixin matching, controlled prop checks, explicit `<head>` adoption, and other one-use helper shapes.                                                                | Notable kept deltas include `68 raw / 7 gzip / 4 brotli`, `74 raw / 30 gzip / 16 brotli`, and `31 raw / 17 gzip / 20 brotli`  |
| DOM diff cleanup                              | Merged removed-subtree cleanup, simplified keyed lookup, marker fast-forwarding, child placement, comment updates, and frame-id helpers.                                                                       | Latest pass: `391 raw / 123 gzip / 108 brotli`; earlier cleanup: `131 raw / 28 gzip`                                          |
| Frame runtime cleanup                         | Merged frame-region cleanup passes, rmx-data scanning, frame runtime factory setup, and redundant marker/helper branches.                                                                                      | Notable kept deltas include `153 raw / 27 gzip`, `214 raw / 20 gzip / 24 brotli`, and part of `492 raw / 99 gzip / 69 brotli` |
| Mixin runtime cleanup                         | Inlined one-use helpers, shared insert/reclaimed event dispatch, and called the shared update dispatcher directly from the reconciler.                                                                         | `777 raw / 96 gzip / 76 brotli`                                                                                               |
| Controlled reflection cleanup                 | Simplified controlled form reflection state and inlined one-use value/checked detection helpers.                                                                                                               | `388 raw / 93 gzip / 115 brotli`, `173 raw / 61 gzip / 73 brotli`, and `31 raw / 17 gzip / 20 brotli`                         |
| Attribute/prop/style helper cleanup           | Moved SSR-only attribute tables out of browser helpers and shared style-value/CSS property helpers across already-downloaded runtime modules.                                                                  | `401 raw / 161 gzip / 158 brotli` and `146 raw / 63 gzip / 52 brotli`                                                         |
| Virtual root/navigation/internal exports      | Shared root scheduling/error/disposal/frame-stub setup, removed unused internal runtime exports, and passed frame accessors instead of importing them back from app runtime.                                   | `541 raw / 153 gzip / 103 brotli`, `242 raw / 92 gzip / 96 brotli`, and `492 raw / 99 gzip / 69 brotli`                       |
| DOM diff/style micro-cleanups                 | Removed temporary attribute-set construction, used smaller selector checks, and dropped an unused internal style-cache export.                                                                                 | `259 raw / 47 gzip / 34 brotli`                                                                                               |
| VNode/document-state/scheduler micro-cleanups | Shared safe child flattening for array and single children, trimmed redundant selection preservation checks, and simplified document-state restoration.                                                        | Known kept deltas include `146 raw / 63 gzip / 52 brotli`, `14 raw / 9 gzip / 4 brotli`, and smaller scheduler wins           |

Useful current hot modules:

| Module                                       |                                  Bytes |
| -------------------------------------------- | -------------------------------------: |
| `packages/ui/src/runtime/reconcile.ts`       | 17,412 raw / 5,898 gzip / 5,352 brotli |
| `packages/ui/src/runtime/frame.ts`           | 14,179 raw / 4,859 gzip / 4,384 brotli |
| `packages/ui/src/runtime/mixins/mixin.ts`    |  7,723 raw / 2,608 gzip / 2,388 brotli |
| `packages/ui/src/runtime/diff-dom.ts`        |  5,949 raw / 2,236 gzip / 2,018 brotli |
| `packages/route-pattern/src/lib/href.ts`     |  3,134 raw / 1,237 gzip / 1,102 brotli |
| `packages/fetch-router/src/lib/route-map.ts` |  3,033 raw / 1,187 gzip / 1,092 brotli |
| `packages/ui/src/style/style.ts`             |    2,473 raw / 1,001 gzip / 897 brotli |
| `packages/ui/src/runtime/svg-attributes.ts`  |      2,469 raw / 872 gzip / 739 brotli |
| `packages/ui/src/runtime/vdom.ts`            |  2,374 raw / 1,154 gzip / 1,022 brotli |
| `packages/ui/src/runtime/component.ts`       |      2,348 raw / 961 gzip / 844 brotli |

## Rejected Experiments

Do not retry these without new evidence that changes the full-set gzip and brotli outcome.

| Experiment                                                              | Why it was rejected                                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| More fine-grained route helper subpaths and compiler rewrites           | Saved only `861 raw / 151 gzip / 124 brotli` in the full set and required five new public route subpaths plus compiler rewrite cases. |
| Shared marker helper module                                             | Shrunk some large files locally but grew the page-level set by `435 raw / 179 gzip`.                                                  |
| Splitting `clientEntry` into another source-served runtime module       | Added a module and regressed the full set by `49 raw / 93 gzip / 92 brotli`.                                                          |
| Static-route entry omission                                             | Good for static-only pages, but outside this goal because it does not shrink typical hydrated app assets.                             |
| Passing concrete route href strings into component props                | Bookstore-only authoring win, not a package/runtime improvement.                                                                      |
| Parsed href helper subpath                                              | Added graph/API churn without a sufficient full-set win.                                                                              |
| SVG alias parser/table rewrites                                         | Raw bytes improved in some shapes, but compressed bytes regressed; one measured shape was `-783 raw / +1 gzip / +8 brotli`.           |
| SVG ternary micro-shape                                                 | Preserved raw size but moved the full set to `95,146 raw / 39,408 gzip / 34,914 brotli`, worse than the kept shape.                   |
| `fetch-router` `joinPathname()` manual loops                            | Grew the full set to `95,224 raw / 39,436 gzip / 34,920 brotli`.                                                                      |
| Removing route-map `baseIsPattern`/`needsSeparator` locals              | Improved one compressed format but regressed brotli, so the existing branch shape stayed.                                             |
| Cosmetic private field shortening in `Route`                            | Saved raw/gzip but regressed brotli by 1 byte and was too name-churny for the value.                                                  |
| `createHref()` search params left undefined until needed                | Saved raw/brotli but regressed gzip: `94,644 raw / 39,263 gzip / 34,780 brotli`.                                                      |
| Unified scalar/array search-param serialization                         | Saved raw/gzip but regressed brotli versus the kept search-param cleanup.                                                             |
| Style `Object.entries()` reuse                                          | Grew `style.ts` and moved the full set to `95,182 raw / 39,411 gzip / 34,892 brotli`.                                                 |
| Ignored-prop `Set` rewrite                                              | Saved raw bytes but regressed compressed bytes: `95,011 raw / 39,367 gzip / 34,887 brotli`.                                           |
| Moving `styleValueToCss()` into `style/values.ts`                       | Improved gzip by 2 bytes but regressed brotli by 6 bytes.                                                                             |
| Tracking inserted stylesheet `CSSRule` objects                          | Passed behavior tests but regressed brotli: `95,028 raw / 39,344 gzip / 34,849 brotli`.                                               |
| Scheduler indexed task flushing                                         | Grew the full set to `95,011 raw / 39,353 gzip / 34,849 brotli`.                                                                      |
| Scheduler update-parent list reuse for render-batch checks              | Improved raw/gzip but regressed brotli: `94,606 raw / 39,235 gzip / 34,764 brotli`.                                                   |
| Mixin scheduler phase-count storage                                     | Raw/gzip/brotli shape was worse than the existing scheduler listener bookkeeping.                                                     |
| Frame context/child-existence micro-cleanups                            | Saved a little raw in local code but regressed compressed full-set bytes.                                                             |
| Frame `syncElementAttributes()` via `getAttributeNames()`               | Saved raw bytes but regressed brotli: `94,780 raw / 39,313 gzip / 34,823 brotli`.                                                     |
| Frame `createFragmentFromString()` duplicate-doctype-strip removal      | Saved raw/brotli but regressed full-set gzip.                                                                                         |
| Document-state selectable-input regex                                   | Saved raw/brotli but regressed gzip versus the kept explicit comparisons.                                                             |
| Scheduler selection capture gated on component render batches           | Made task-only flush semantics less direct and measured worse than the kept document-state cleanup.                                   |
| Unconditional `normalizeChildren(node.props.children)` in `to-vnode.ts` | Saved bytes but broke non-array, null, and boolean children.                                                                          |
| Cosmetic private-name shortening as a primary strategy                  | Too low-value and too churn-heavy unless paired with a real compressed-byte win.                                                      |

## Measurement Fixture

Use the bookstore demo production asset server with a stable `GITHUB_SHA=browser-js-size`. Count the
de-duped union of:

- the main browser entry;
- all hydrated component assets;
- every module returned by `assetServer.getPreloads(...)`.

Per-entry numbers are useful diagnostics, but a change only counts when the full de-duped downloaded
set improves in both gzip and brotli.
