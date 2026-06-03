# Browser JavaScript Size Notes

Goal: shrink the actual JavaScript downloaded by a typical hydrated Remix app.

Measurement target: the full de-duped bookstore browser asset set: the main browser entry, hydrated
component assets, and every module returned by `assetServer.getPreloads(...)`.

Keep a change only when the full set improves in both gzip and brotli. Do not chase raw-only wins,
static-only wins, bookstore-only authoring changes, or module-splitting churn that does not shrink
downloaded bytes.

Current checkpoint: `60 modules / 92,830 raw / 38,966 gzip / 34,508 brotli`.

First full checkpoint: `69 modules / 104,263 raw / 42,600 gzip`. The downloaded set is down
`11,433 raw / 3,634 gzip / 9 modules` from that point. Brotli was added later, so early wins do not
all have brotli deltas.

## Goals To Try Next

Probe these downloaded package modules next. Use small in-place changes and measure the full set
after every candidate.

| Module                                      | Current size                         | Goal                                                                 |
| ------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| `fetch-router/src/lib/route-map.ts`         | `3,033 raw / 1,187 gzip / 1,092 br`  | Shrink route-map serialization and path joining without broad API churn. |
| `ui/src/style/style.ts`                     | `2,473 raw / 1,001 gzip / 897 br`    | Reduce runtime CSS object serialization without changing object-key semantics. |
| `ui/src/runtime/vdom.ts`                    | `2,374 raw / 1,154 gzip / 1,023 br`  | Look for duplicated element/component construction paths already loaded by JSX. |
| `ui/src/runtime/component.ts`               | `2,349 raw / 954 gzip / 836 br`      | Look for compact component task/state handling without changing lifecycle behavior. |
| `ui/src/style/stylesheet.ts`                | `2,248 raw / 1,052 gzip / 941 br`    | Reduce stylesheet insertion/cache bookkeeping in place.              |
| `route-pattern/src/lib/route-pattern/parse-parts.ts` | `1,997 raw / 906 gzip / 827 br` | Shrink parser helpers only if it improves the full hydrated asset set. |

The largest UI runtime modules (`reconcile.ts`, `frame.ts`, `mixin.ts`, `diff-dom.ts`) already had
focused cleanup passes. Revisit them only with a concrete new candidate that has not been rejected
below.

## Successful Improvements

| Area                         | What changed                                                                 | Measured improvement |
| ---------------------------- | ---------------------------------------------------------------------------- | -------------------- |
| Asset import URLs            | Emitted relative served import specifiers while keeping public href/preload URLs absolute. | `2,577 raw / 949 gzip / 702 brotli` |
| Route href stack             | Made browser route maps string-first/lazy and avoided downloading the full `RoutePattern` class path for hrefs. | `1,131 raw / 767 gzip / 5 modules` |
| Route helper cleanup         | Reduced href encoding/validation branches, reused search-param entries, lazily allocated missing-param errors, and compacted serialization helpers. | `329 raw / 109 gzip / 116 brotli` |
| Route parser cleanup         | Removed an unreachable empty-protocol branch from parsed route-pattern protocol handling. | `20 raw / 4 gzip / 3 brotli` |
| SVG namespaced aliases       | Generated the repeated `xlink`, `xml`, and `xmlns` alias table from grouped names instead of shipping every alias literal. | `1,031 raw / 54 gzip / 54 brotli` |
| Component render cache       | Removed a local render-function alias so cached component render functions are read directly after initialization. | `+1 raw / 7 gzip / 5 brotli` |
| Reconciler and DOM diff      | Removed larger deletion paths, compacted host/frame adoption, and simplified marker-range replacement. | Known kept deltas include `2,857 raw / 808 gzip / 186 brotli` |
| Frame runtime                | Merged frame-region cleanup paths, trimmed redundant traversal guards, and simplified template/rmx-data handling. | Known kept deltas include `475 raw / 75 gzip / 47 brotli` |
| Mixin runtime                | Inlined one-use helpers, shared insert/reclaimed event dispatch, and compacted descriptor handling. | `795 raw / 107 gzip / 88 brotli` |
| Controlled props/state       | Simplified controlled form reflection and inlined one-use value/checked helpers. | `592 raw / 171 gzip / 208 brotli` |
| Attribute/style helpers      | Moved SSR-only attribute tables out of browser helpers and shared style-value/CSS property helpers. | `547 raw / 224 gzip / 210 brotli` |
| Runtime miscellany           | Shared virtual-root/navigation setup, removed unused internal exports, and trimmed vnode/document/scheduler branches. | Known kept deltas include `1,435 raw / 416 gzip / 324 brotli` |

## Rejected Experiments

Do not retry these without new full-set gzip and brotli evidence.

| Rejected path                         | Why it was rejected |
| ------------------------------------- | ------------------- |
| More route subpaths/compiler rewrites | Too much public API/compiler churn for a small full-set win (`861 raw / 151 gzip / 124 brotli`). |
| Module splitting/shared helper churn  | Often shrank one file but grew the downloaded set; source-served apps pay for the extra modules. |
| Static-only or bookstore-only changes | Not the target; the goal is a typical hydrated app and package/runtime improvements. |
| Route branch/manual-loop rewrites     | Several href/search-param/path-join rewrites regressed gzip or brotli in the full set. |
| Route-map local fast paths            | Empty-search fast paths and `replaceAll` serialization changes shrank or helped one module but regressed the full asset set. |
| VDOM frame-init local                 | Saved raw bytes but regressed gzip and brotli in the full set. |
| Style hash bitwise rewrite            | Improved brotli but regressed raw and gzip. |
| Component task-signal inline check     | Improved brotli but regressed gzip versus the kept component render-cache shape. |
| Parser `.at()` to index access         | Replacing `.at(-1)` with manual indexing regressed compressed bytes in the full set. |
| Parser escaped-character indexing      | Raw/gzip improved after the protocol cleanup, but full-set brotli regressed by 2 bytes. |
| VDOM implicit undefined returns        | Did not shrink the served module and regressed gzip. |
| Stylesheet truthy empty-css check      | Saved raw/gzip locally but tied full-set brotli, so it failed the keep gate. |
| SVG/style table reshapes              | Raw or local wins repeatedly regressed compressed bytes; the kept SVG alias generator is the exception with full-set evidence. |
| Style empty-check rewrites             | `for...in` saved bytes but changed inherited-key semantics; preserving own-key semantics gave up the win. |
| Frame/mixin/scheduler micro-shapes    | Truthiness, guard reordering, phase counters, marker locals, and traversal rewrites mostly moved bytes around or regressed one compressed format. |
| Shared client-frame init helper       | Saved raw bytes in `reconcile.ts` but regressed gzip (`93,867 raw / 39,103 gzip / 34,632 brotli`). |
| Unsafe child normalization shortcut   | Saved bytes but broke non-array, null, and boolean children. |
| Cosmetic private-name shortening      | Too much churn for tiny or mixed compressed-byte wins. |
