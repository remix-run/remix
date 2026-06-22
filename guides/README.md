# Remix Guides

A runnable Remix app that hosts the in-progress Remix 3 guide docs. Run it
locally to browse and flesh out the chapters.

This is the narrative/guide documentation (Start Here, Core App Structure, …).
The auto-generated API reference lives separately in [`../docs`](../docs).

## App Shape

- `server.ts` boots a Node HTTP server backed by the Remix router.
- `app/routes.ts` defines the route contract (`/`, `/docs`, generic `/docs/:chapter`, and generic `/docs/examples/:chapter/:example`).
- `app/router.ts` wires routes to controllers and installs middleware.
- `app/middleware/render.ts` installs the request-scoped `render` function and exports `AppContext`.
- `app/ui/document.tsx` is the HTML document shell (links in `public/docs.css`).
- `app/controllers/docs/` holds the docs:
  - `controller.tsx` maps the docs index and generic chapter route to handlers.
  - `index-page.tsx` renders the docs landing page / table of contents from Markdown chapters.
  - `shared.tsx` holds the shared docs document and chapter layout.
  - `markdown.tsx` renders guide Markdown with Marked/Shiki and splits out frame directives.
  - `markdown-chapters.tsx` loads `chapters/*.md`, derives slugs/chapter labels/navigation from file names, and renders chapter pages.
  - `chapters/01..16-*.md` are the guide chapters.
  - `examples/controller.ts` dispatches `/docs/examples/:chapter/:example` frame routes.
  - `examples/<chapter>/<example>.tsx` holds individual frame examples with co-located client entries.
- `public/docs.css` is a small hand-written stylesheet for shared docs chrome; examples keep their own styles co-located with `css(...)` mixins.

## Adding content

Markdown chapters live in `app/controllers/docs/chapters/`. The file name controls the chapter order, chapter label, slug, URL, and previous/next pagination:

```txt
01-start-here.md -> Chapter 1 -> /docs/start-here
```

Put the human-authored metadata in frontmatter, then start each section with a level-2 heading.
Explicit heading IDs keep links stable:

```md
---
title: Start Here
description: A high-level introduction to Remix.
---

## Build your first page {#build-your-first-page}
```

Embed dynamic Remix examples with a frame directive:

```md
:::frame /docs/examples/start-here/server-clock
:::
```

The renderer uses each level-2 heading to build the "On this page" sidebar and
the docs index automatically.

Add an example by creating `app/controllers/docs/examples/<chapter>/<example>.tsx` and
exporting a `handler(context)` function. Client entries can live beside it, such as in
`app/controllers/docs/examples/<chapter>/client.tsx`. No route or router changes are
needed for each new example.

## Commands

Run from the repo root or from this directory.

```sh
pnpm install            # once, from the repo root
pnpm --filter remix-guides run dev    # watch + serve
pnpm --filter remix-guides run start  # serve once
pnpm --filter remix-guides run typecheck
```

The dev server listens on http://localhost:44100 (set `PORT` to override).
`/` redirects to `/docs`.
