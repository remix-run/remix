# Browser JavaScript Size Findings

The bookstore demo is a useful fixture for measuring the JavaScript fetched by source-served Remix UI browser assets. These numbers use the demo's production asset server settings and sum the raw byte length of the requested entry module plus every module returned by `assetServer.getPreloads(...)`.

## Package entrypoint impact

This comparison keeps the bookstore routes and hydration behavior unchanged. The only measured app-code difference is replacing full `remix/ui` imports in browser-served asset modules with the new narrow `remix/ui/*` subpaths added by this change.

| Browser asset                   |      Full `remix/ui` graph | Narrow `remix/ui/*` graph |              Savings |
| ------------------------------- | -------------------------: | ------------------------: | -------------------: |
| `app/assets/entry.tsx`          |  86,093 bytes / 38 modules | 78,398 bytes / 31 modules |   7,695 bytes (8.9%) |
| `app/assets/image-carousel.tsx` |  87,907 bytes / 40 modules | 19,998 bytes / 20 modules | 67,909 bytes (77.3%) |
| `app/assets/cart-button.tsx`    | 102,827 bytes / 59 modules | 30,555 bytes / 34 modules | 72,272 bytes (70.3%) |
| `app/assets/cart-items.tsx`     | 105,076 bytes / 59 modules | 37,167 bytes / 39 modules | 67,909 bytes (64.6%) |

The main browser entry still needs most of the client runtime, so its win is modest. Small hydrated component assets benefit more because `clientEntry`, `on`, and `css` can now be imported without pulling unrelated rendering, component, theme, and primitive exports through the package barrel.

## Internal graph impact

The package also moves CSS value normalization helpers into `style/values.ts` and points runtime modules at lower-level style modules where possible. This keeps client runtime imports from reaching the full style barrel when they only need value normalization or the stylesheet manager.

## Excluded demo experiments

Two bookstore-only experiments produced additional savings but are intentionally not part of this change:

- Emitting the browser entry script only on routes with hydrated components reduced non-hydrated route JS to 0 bytes.
- Passing concrete route href strings into client-entry props avoided importing the demo route map from small browser assets.

Those are app-level policy choices, not package improvements. The package change focuses on making the efficient import path available and documented without changing the bookstore demo's behavior.
