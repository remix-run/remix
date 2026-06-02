# Browser JavaScript Size Findings

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

## Route helper exports

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

## Mixin and JSX runtime splits

The narrow `remix/ui/on` and `remix/ui/css` exports originally imported the whole mixin runtime just to create authoring descriptors. Splitting the descriptor factory into `runtime/mixins/mixin-descriptor.ts` keeps small browser assets from downloading `resolveMixedProps`, lifecycle teardown, and mixin reconciliation helpers unless they also import the renderer.

The JSX runtime also exported `Fragment` from `runtime/component.ts`, which made every TSX asset preload the component runtime even when it only needed `jsx`. Moving `Fragment` to `runtime/fragment.ts` keeps `remix/ui/jsx-runtime` small while preserving the existing `runtime/component.ts` re-export.

Measured on top of narrowed UI and route helper imports, these internal splits produce the following incremental wins:

| Browser asset                   | Narrowed UI + route helper graph | Split mixin/Fragment graph |  Incremental savings |
| ------------------------------- | -------------------------------: | -------------------------: | -------------------: |
| `app/assets/entry.tsx`          |        78,398 bytes / 31 modules |  78,658 bytes / 33 modules |   -260 bytes (-0.3%) |
| `app/assets/image-carousel.tsx` |        19,998 bytes / 20 modules |   9,081 bytes / 19 modules | 10,917 bytes (54.6%) |
| `app/assets/cart-button.tsx`    |        29,622 bytes / 38 modules |  18,516 bytes / 36 modules | 11,106 bytes (37.5%) |
| `app/assets/cart-items.tsx`     |        36,234 bytes / 43 modules |  25,317 bytes / 42 modules | 10,917 bytes (30.1%) |

The main browser entry already downloads the full renderer, so the extra compatibility module edges cost a few hundred bytes there. Small hydrated component assets benefit much more because they no longer preload renderer-only mixin and component runtime modules.

## Internal graph impact

The package also moves CSS value normalization helpers into `style/values.ts` and points runtime modules at lower-level style modules where possible. This keeps client runtime imports from reaching the full style barrel when they only need value normalization or the stylesheet manager.

Final bookstore measurements after the package/export changes:

| Browser asset                   | Original full-barrel graph |   Optimized package graph |              Savings |
| ------------------------------- | -------------------------: | ------------------------: | -------------------: |
| `app/assets/entry.tsx`          |  86,093 bytes / 38 modules | 78,658 bytes / 33 modules |   7,435 bytes (8.6%) |
| `app/assets/image-carousel.tsx` |  87,907 bytes / 40 modules |  9,081 bytes / 19 modules | 78,826 bytes (89.7%) |
| `app/assets/cart-button.tsx`    | 102,827 bytes / 59 modules | 18,516 bytes / 36 modules | 84,311 bytes (82.0%) |
| `app/assets/cart-items.tsx`     | 105,076 bytes / 59 modules | 25,317 bytes / 42 modules | 79,759 bytes (75.9%) |

## Excluded demo experiments

Two bookstore-only experiments produced additional savings but are intentionally not part of this change:

- Emitting the browser entry script only on routes with hydrated components reduced non-hydrated route JS to 0 bytes.
- Passing concrete route href strings into client-entry props avoided importing the demo route map from small browser assets.

Those are app-level policy choices, not package improvements. The package changes focus on making efficient import paths available and documented without changing the bookstore demo's behavior.
