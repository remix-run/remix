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

Code fences support filename headers and line highlighting:

````md
```tsx filename=app/actions/projects/create.tsx lines=[4-5,8]
export async function createProject(request: Request) {
  let formData = await request.formData()
  let name = String(formData.get('name') ?? '').trim()

  if (name === '') {
    return new Response('Project name is required', { status: 400 })
  }

  return new Response(`Created ${name}`)
}
```
````

## Adding frame examples

Use a frame directive in Markdown:

```md
:::frame /docs/examples/interactivity/basic-counter
:::
```

Then add the matching example module:

```txt
app/actions/docs/examples/interactivity/basic-counter.tsx
```

```tsx
import { css, on } from 'remix/ui'
import type { Handle } from 'remix/ui'

/**
 * @name Client entry counter
 * @description The frame route hydrates this component and renders this source beside the preview.
 */
export default function ClientCounterDemo(handle: Handle) {
  let count = 0

  return () => (
    <button
      mix={[
        on('click', () => {
          count++
          handle.update()
        }),
        css({ borderRadius: '999px', padding: '0.7rem 1rem' }),
      ]}
      type="button"
    >
      Count: {count}
    </button>
  )
}
```

No route changes are needed. The examples controller maps `/docs/examples/:chapter/:example` to `app/actions/docs/examples/<chapter>/<example>.tsx` and dynamically imports the module. The validator requires the `:chapter` segment to match the chapter slug so examples stay scoped to the chapter that references them.

For component demos that should use the shared preview/source shell, default export the component. The examples controller wraps default exports in `clientEntry`, renders the preview, and shows the component source after stripping its `@name`/`@description` JSDoc block. For route-style frames, export a named `handler` that returns a `Response`.

At render time, `markdown.tsx` turns the directive into `<Frame src="..." />`. The render middleware resolves that frame by doing an internal `router.fetch()` for the frame URL, so examples are normal Remix routes that return normal `Response` objects. Co-located client entries can live beside route-style examples in `app/actions/docs/examples/<chapter>/<example>.client.tsx`.

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
