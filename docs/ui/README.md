# Remix UI docs

A demo-first documentation site for the standalone `@remix-run/ui` package. Getting Started introduces installation and stability; Primitives and Animation contain package-owned examples and usage guidance. The initial pages cover Accordion, Spring, Entrance and Exit, Layout, and Tween.

## Commands

Run from the repository root:

```sh
pnpm --filter remix-ui-docs run dev
pnpm --filter remix-ui-docs run test
pnpm --filter remix-ui-docs run typecheck
pnpm --filter remix-ui-docs run prerender
pnpm --filter remix-ui-docs run prerender:serve
```

The development server uses port 44100 by default. Set `PORT` to choose another port. Node's watch mode restarts the server after imported source changes; reload the browser to see them.

Prerender writes the documentation pages, example modules, shared assets and Pagefind search index into `docs/ui/build/site/`. Pass `--dir` to choose another output directory. Search becomes available in development after prerendering. Hosting and deployment are not configured yet.

## Authoring

Documentation lives beside the API it describes: `packages/ui/src/accordion.docs.tsx` and `packages/ui/src/animation/spring.docs.tsx`. The site discovers `**/*.docs.tsx` definitions beneath `packages/ui/src`. New pages need no registry entry or route changes.

Each module default exports an object satisfying `UiDocs`, defined in [the package's internal docs contract](https://github.com/remix-run/remix/blob/main/packages/ui/src/docs/types.ts). It provides a title, category (`primitives` or `animation`), slug, description, package import path, examples and optional JSX sections with code snippets. An example without a `section` is the canonical hero, shown directly below the page description with its source and no extra heading or caption; set `section` to a section ID to place a focused example beneath its explanation. Section and example IDs must be unique within a page.

Examples are nearby `.example.tsx` files referenced with `new URL('./example.example.tsx', import.meta.url)`. Each default exports a normal Remix component. Keep each example self-contained, including its styles, so readers can copy the whole file. Feature pages show the highlighted source directly below each live demo. The site reads the file for highlighted source and hydrates its default export with `clientEntry`; no source macros, generated copies or import rewriting are involved.

Docs definitions and authoring types are excluded from published UI files and builds. Example modules are also excluded. The `.example.tsx` suffix distinguishes structured UI examples from the legacy `.demo.tsx` modules discovered by the API site. Docs definitions are server-owned; only example modules and the docs shell are sent to the browser.

## Site ownership

- `app/data/` discovers definitions and loads examples.
- `app/actions/docs/` owns Getting Started and feature page rendering.
- `app/actions/public/` owns browser startup and site-specific styles.
- `app/ui/document.tsx` composes the shared docs header, sidebar, table of contents and footer.
- `scripts/prerender.ts` generates static output with the shared crawler.

The shell, tokens, code-block rendering, copy behavior, search and static infrastructure come from [docs/shared](https://github.com/remix-run/remix/tree/main/docs/shared). The header uses the same positions as Guides and API. Landing-page previews are decorative: server-rendered without hydration, inert and hidden from assistive technology. The feature pages provide the interactive versions.
