# Remix Guides

A runnable Remix app for the in-progress Remix 3 guide docs. Use it to browse, write, and test narrative docs with live Remix examples.

The guides are the hand-authored docs: Start Here, Core App Structure, Server Runtime, and the rest of the chapter sequence. The generated API reference lives in [`../docs`](../docs).

## Where things live

- `app/actions/controller.tsx` — top-level route actions such as assets and the root redirect.
- `app/actions/docs/chapters/*.md` — guide chapters.
- `app/actions/docs/markdown.tsx` — Markdown rendering, syntax highlighting, heading IDs, and `:::frame` parsing.
- `app/actions/docs/markdown-chapters.tsx` — chapter loading, ordering, slugs, navigation, and summaries.
- `app/actions/docs/examples/` — frame-backed examples used by chapters.
- `app/assets/` — browser entrypoints and other browser-owned modules.
- `app/middleware/asset-entry.ts` — source-served browser module hrefs and preloads.
- `app/middleware/render.ts` — the request-scoped `render()` helper and frame resolver.
- `app/routes.ts` and `app/router.ts` — the typed route contract and controller wiring.
- `app/ui/` — shared UI used across routes.
- `app/utils/assets.ts` — the source asset server configuration.
- `public/docs.css` — shared docs chrome styles.

## How chapters work

Chapter files live in `app/actions/docs/chapters/`. The file name controls order, chapter label, URL slug, and previous/next links:

```txt
01-start-here.md -> Chapter 1 -> /docs/start-here
```

Each chapter needs frontmatter. Level-2 headings power the docs index and "On this page" navigation. IDs are generated from heading text unless you add an explicit one:

```md
---
title: Start Here
description: A high-level introduction to Remix.
---

An optional chapter introduction can go here.

## Build your first page

## Stable custom anchor {#custom-anchor}
```

## Adding frame examples

Use a frame directive in Markdown:

```md
:::frame /docs/examples/start-here/server-clock
:::
```

Then add the matching example module:

```txt
app/actions/docs/examples/start-here/server-clock.tsx
```

```tsx
import type { AppContext } from '../../../../router.ts'

export async function handler({ render }: AppContext) {
  return render(<p>Hello from a frame.</p>)
}
```

No route changes are needed. The examples controller maps `/docs/examples/:chapter/:example` to `examples/<chapter>/<example>.tsx`, dynamically imports the module, and calls its named `handler` export.

At render time, `markdown.tsx` turns the directive into `<Frame src="..." />`. The render middleware resolves that frame by doing an internal `router.fetch()` for the frame URL, so examples are normal Remix routes that return normal `Response` objects. Co-located client entries can live beside the example in `examples/<chapter>/<example>.client.tsx`.

## Commands

Run from the repo root or from `guides/`.

```sh
pnpm install                            # once, from the repo root
pnpm --filter remix-guides run dev      # watch + serve
pnpm --filter remix-guides run start    # serve once
pnpm --filter remix-guides run validate # check frame URLs and example files
pnpm --filter remix-guides run typecheck
```

The dev server listens on http://localhost:44100 by default. Set `PORT` to override. `/` redirects to `/docs`.
