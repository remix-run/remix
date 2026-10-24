# Shared docs infrastructure

`remix-docs-shared` contains infrastructure used by `docs/site` and `docs/ui`. It is a private workspace package, not a standalone site.

## Ownership

- `assets/` — static files required by the shared UI.
- `hmr/` — hot module reloading for `pnpm run dev`.
- `prerender/` — crawling and static-output helpers.
- `search/` — Pagefind elements and browser behavior.
- `server.ts` — local Node server startup, request adaptation, errors, and graceful shutdown.
- `styles/` — shared tokens and docs-shell stylesheets.
- `ui/` — shared server-rendered components and browser behaviors.

Browser source is colocated with its owner under `public/` directories. Server modules remain outside that boundary.

Site-specific routes, document shells, Markdown transforms, styles, and static files stay in the owning site. For example, the docs site's `favicon.ico` remains in `docs/site/public/`. Repository README artwork lives in `.github/assets/` rather than either site's public directory.

Each site's main stylesheet imports `styles/public/docs.css`, which pulls in every shared stylesheet in order, followed by the site's own stylesheets.

Link previews use `DocsSocialMeta` from `ui/social-meta.tsx`, which renders canonical, Open Graph and Twitter card tags. The 1200x630 preview image, `assets/social/remix.jpg`, is remix.run's share thumbnail.

Navigation lists share the `.docs-nav-item` and `.docs-nav-heading` styles in `styles/public/nav.css`. Each site keeps only its own sizing and layout, such as the Guides chapter numbers and the API package menus.

## Markdown contract

Both sites use the shared unified/remark/rehype pipeline under `markdown/`. It preserves raw HTML, defaults unlabeled code fences to TypeScript, generates linked heading IDs, and renders shared Shiki code-block chrome.

Site-specific transforms remain with their owners. Guides handles frame directives and chapter metadata; API handles versioned links, source metadata, and symbol links inside highlighted code.

## Page layout

Every site shares the same vertical rhythm, defined in `styles/public/article.css` and `styles/public/demo.css`:

- **Page header** — `.docs-page-header` wraps a `.docs-page-eyebrow`, the `.rmx-page-title` heading and an optional `.docs-page-description`, followed by 40px of space.
- **Sections** — each `h2` and the content under it sit in a `.docs-section`, which owns the 48px gap above it. Spacing lives on the wrapper rather than the heading, so the gap stays consistent whether a section follows prose, a demo or a table. Pass `sections: true` to `renderMarkdownHtml` to wrap rendered Markdown. Guides groups sections itself so a section can span frame boundaries.
- **Demos** — `DocsDemo` from `remix-docs-shared/ui/demo` renders a live preview above its highlighted source, which starts collapsed behind a "Show code" button.

Prose rendered from Markdown uses the `.docs-markdown` class from `styles/public/markdown.css`, which follows the same rhythm: semibold `h2`s, plus spacing for lists, quotes, tables and images.

## Asset contract

`Icon`, `DocsHeader`, and `DocsFooter` load the following root-relative URLs:

- `/icons.svg`
- `/remix-logo-light-mode.svg`
- `/remix-wordmark-light-mode.svg`

Document shells also load `/favicon.svg`. These files live in `assets/`. Each site must:

1. Serve `assets/` as static files at the site root during development and server rendering.
2. Include `assets/` in the prerenderer's `publicDirs` so the files are copied to the static output root.
3. Keep the asset names stable when changing the shared components.

Shared browser modules and styles use a separate source-asset contract. Each site's Remix asset server must allow `docs/shared/**/public/**` and mount `docs/shared` at `docs-shared`. Local dependencies of shared browser modules must remain inside a colocated `public/` directory. This produces browser URLs beneath the site's asset base, such as `/assets/docs-shared/ui/public/docs-shell.tsx`; it does not replace the root-relative static asset URLs above.

The static prerenders discover TypeScript modules beneath site and shared `public/` directories so frame client entries are emitted even though their URLs live inside the streamed frame payload rather than ordinary `<script>` elements.

## Commands

Run from the repository root:

```sh
pnpm --filter remix-docs-shared run test
pnpm --filter remix-docs-shared run typecheck
```

Changes consumed by a site should also be validated in that site:

```sh
pnpm --filter remix-docs run test
pnpm --filter remix-docs run typecheck
pnpm --filter remix-ui-docs run test
pnpm --filter remix-ui-docs run typecheck
```
