# Remix Guides

A runnable Remix app that hosts the in-progress Remix 3 guide docs. Run it
locally to browse and flesh out the chapters.

This is the narrative/guide documentation (Start Here, Core App Structure, …).
The auto-generated API reference lives separately in [`../docs`](../docs).

## App Shape

- `server.ts` boots a Node HTTP server backed by the Remix router.
- `app/routes.ts` defines the route contract (`/`, `/docs`, and one route per chapter).
- `app/router.ts` wires routes to controllers and installs middleware.
- `app/middleware/render.ts` installs the request-scoped `render` function and exports `AppContext`.
- `app/ui/document.tsx` is the HTML document shell (links in `public/docs.css`).
- `app/controllers/docs/` holds the docs:
  - `controller.tsx` maps the docs route map to handlers.
  - `index-page.tsx` is the docs landing page / table of contents.
  - `shared.tsx` holds the shared `DocsChapter` / `DocsSection` layout.
  - `chapters/01..16.tsx` are the individual chapter pages (currently placeholders).
- `public/docs.css` is a small hand-written stylesheet (no build step).

## Adding content

Each chapter is a single file under `app/controllers/docs/chapters/`. Fill in the
`<DocsSection>` bodies with real prose, code samples, and links. New sections show
up automatically in the "On this page" sidebar.

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
