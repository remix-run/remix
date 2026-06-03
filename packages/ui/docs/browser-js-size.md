# Browser JavaScript Size Notes

Goal: shrink the actual JavaScript downloaded by a typical hydrated Remix app. Measure the full
de-duped bookstore browser asset set: the main browser entry, hydrated component assets, and every
module returned by `assetServer.getPreloads(...)`.

Keep a change only when the full set improves in both gzip and brotli. Ignore raw-only wins,
static-only wins, bookstore-only authoring changes, and module-splitting churn that does not shrink
the downloaded bytes.

Current checkpoint: `60 modules / 93,885 raw / 39,032 gzip / 34,576 brotli`.

First full checkpoint: `69 modules / 104,263 raw / 42,600 gzip`. The measured downloaded set is down
`10,378 raw / 3,568 gzip / 9 modules` from that point. Brotli was added later, so early wins do not
all have brotli deltas.

## Goals To Try Next

Probe the four largest downloaded UI runtime modules first:

| Module                                    | Current size                          | What to look for                                                                                       |
| ----------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `ui/src/runtime/reconcile.ts`             | `17,255 raw / 5,863 gzip / 5,322 br`  | Duplicate host/frame adoption paths, redundant controlled-reflection branches, and cleanup paths.      |
| `ui/src/runtime/frame.ts`                 | `14,071 raw / 4,835 gzip / 4,362 br`  | Duplicated frame-region traversal, marker/template handling, and rare frame modes on the `run()` path. |
| `ui/src/runtime/mixins/mixin.ts`          | `7,705 raw / 2,600 gzip / 2,382 br`   | Lifecycle event dispatch, teardown/persist branches, descriptor normalization, and handle bookkeeping. |
| `ui/src/runtime/diff-dom.ts`              | `5,892 raw / 2,222 gzip / 2,002 br`   | Marker-range handling, child matching/reorder branches, live-state preservation, and subtree cleanup.  |

Secondary probes after those:

- `route-pattern/src/lib/href.ts` and `fetch-router/src/lib/route-map.ts`: reduce route href and
  route-map body size without adding public subpaths or compiler rewrites.
- `ui/src/style/style.ts` and related already-downloaded style modules: reduce runtime CSS object
  serialization in place.
- `ui/src/runtime/svg-attributes.ts`: only revisit SVG/attribute normalization if the new shape
  improves the full-set compressed bytes.

## Successful Improvements

| Improvement                               | What changed                                                                                                      | Measured improvement                                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Asset import URLs                         | Emitted relative served import specifiers while keeping public href/preload URLs absolute.                         | `2,577 raw / 949 gzip / 702 brotli`                                                                                        |
| Route href stack                          | Made browser route maps string-first/lazy and avoided downloading the full `RoutePattern` class path for hrefs.   | `1,131 raw / 767 gzip / 5 modules`                                                                                         |
| Route href and route-map cleanup          | Reduced href encoding/validation branches, reused search-param entries, and compacted serialization helpers.      | `262 raw / 85 gzip / 81 brotli`, plus smaller follow-ups of `9 raw / 6 gzip / 9 brotli` and `53 raw / 17 gzip / 20 brotli` |
| Reconciler deletion cleanup               | Removed recursive bulk-clear and direct-event fast paths that were larger than the normal runtime paths.          | `381 raw / 99 gzip`, then `1,567 raw / 491 gzip`                                                                            |
| Reconciler adoption and micro-cleanups    | Shared host adoption and compacted one-use helper shapes around SVG context, client frame resolution, head adoption, persisted mixins, and controlled props. | Kept deltas include `90 raw / 27 gzip / 22 brotli`, `67 raw / 9 gzip / 22 brotli`, and `173 raw / 17 gzip / 17 brotli`     |
| DOM diff cleanup                          | Merged removed-subtree cleanup and simplified keyed lookup, marker fast-forwarding, child placement, comments, and marker-range replacement. | `57 raw / 14 gzip / 17 brotli`, `391 raw / 123 gzip / 108 brotli`; earlier cleanup: `131 raw / 28 gzip`                    |
| Frame runtime cleanup                     | Merged frame-region cleanup passes, rmx-data scanning, runtime factory setup, child traversal, template watching, and redundant marker/helper paths. | Kept deltas include `108 raw / 28 gzip / 23 brotli`, `153 raw / 27 gzip`, and `214 raw / 20 gzip / 24 brotli`              |
| Mixin runtime cleanup                     | Inlined one-use helpers, shared insert/reclaimed event dispatch, compacted descriptor handling, and called the update dispatcher directly. | `18 raw / 11 gzip / 12 brotli` and `777 raw / 96 gzip / 76 brotli`                                                         |
| Controlled reflection cleanup             | Simplified controlled form reflection state and inlined one-use value/checked detection helpers.                  | `388 raw / 93 gzip / 115 brotli`, `173 raw / 61 gzip / 73 brotli`, and `31 raw / 17 gzip / 20 brotli`                      |
| Attribute, prop, and style helper cleanup | Moved SSR-only attribute tables out of browser helpers and shared style-value/CSS property helpers.               | `401 raw / 161 gzip / 158 brotli` and `146 raw / 63 gzip / 52 brotli`                                                      |
| Virtual root/navigation/internal exports  | Shared root scheduling/error/disposal/frame-stub setup and removed unused internal runtime exports.               | `541 raw / 153 gzip / 103 brotli`, `242 raw / 92 gzip / 96 brotli`, and `492 raw / 99 gzip / 69 brotli`                    |
| VNode/document-state/scheduler cleanup    | Shared safe child flattening and trimmed redundant selection/document-state/scheduler branches.                   | Known kept deltas include `146 raw / 63 gzip / 52 brotli` and `14 raw / 9 gzip / 4 brotli`                                 |

## Rejected Experiments

Do not retry these without new full-set gzip and brotli evidence.

| Rejected path                             | Why it was rejected                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| More public route helper subpaths         | Required five new public subpaths plus compiler rewrites for only `861 raw / 151 gzip / 124 brotli` in the full set.    |
| Shared marker/helper modules              | Shrunk some individual files but grew the downloaded set; one marker helper attempt regressed by `435 raw / 179 gzip`.  |
| Splitting source-served runtime modules   | Added requests/modules and regressed bytes; `clientEntry` splitting was `+49 raw / +93 gzip / +92 brotli`.              |
| Static-only entry omission                | Helps static pages, but not the hydrated-app target.                                                                     |
| Bookstore-only route prop authoring       | Reduced the fixture by hand, but was not a package/runtime improvement.                                                  |
| SVG alias/parser/table rewrites           | Raw bytes sometimes improved, but compressed bytes regressed; one measured shape was `-783 raw / +1 gzip / +8 brotli`.  |
| Route href/search-param branch reshapes   | Several versions improved one metric but regressed another, especially brotli or gzip.                                  |
| Fetch-router manual path-join loops       | Grew the full set to `95,224 raw / 39,436 gzip / 34,920 brotli`.                                                        |
| Style serialization reshapes              | `Object.entries()` reuse, ignored-prop `Set`, style-value module moves, and CSSRule tracking all regressed compression. |
| Scheduler bookkeeping reshapes            | Indexed flushing, parent-list reuse, and mixin phase-count storage measured worse or regressed one compressed format.   |
| Mixin `Math.max` phase counter rewrite    | Saved raw bytes, but regressed gzip/brotli versus the kept mixin shape.                                                  |
| Mixin update-dispatch guard reorder       | Kept raw unchanged but regressed gzip/brotli versus the smaller mixin batch.                                             |
| Frame micro-shapes                        | Context/child checks, `getAttributeNames()`, and duplicate doctype-strip removal saved local/raw bytes but regressed compression. |
| Frame end-marker local inlining           | Saved raw/gzip in traversal loops, but regressed brotli: `93,911 raw / 39,048 gzip / 34,605 brotli`.                   |
| Frame template queue truthiness           | Saved raw and local frame gzip/brotli, but regressed full-set brotli by 1 byte.                                        |
| Shared client frame init helper           | Saved raw bytes in `reconcile.ts`, but regressed gzip: `93,867 raw / 39,103 gzip / 34,632 brotli`.                      |
| Document-state regex/gating reshapes      | Selectable-input regex and render-batch selection gating were smaller in one metric but worse overall.                  |
| Unsafe child normalization shortcut       | Saved bytes but broke non-array, null, and boolean children.                                                            |
| Cosmetic private-name shortening          | Too much churn for tiny or mixed compressed-byte wins.                                                                   |
