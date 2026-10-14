# Remix UI docs

A documentation site for the standalone `@remix-run/ui` package, with live examples, usage guidance and API references for each primitive and animation utility.

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

Pages are normal Remix components in `app/pages/primitives/` and `app/pages/animation/`. Each exports a small `meta` object with its title, category, slug, description and package import path. Add the component and its metadata to [the page list](https://github.com/remix-run/remix/blob/main/docs/ui/app/data/docs.ts) to include it in routing, navigation and prerendering.

Write the body as JSX inside `PageLayout`. Place prose, code blocks and examples where readers should see them:

```tsx
export default function AccordionPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <p>Use the root, item, trigger and content mixins together.</p>
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="state" title="State">
        <p>Pass a value to control the open panel.</p>
        <Example id="controlled" example={controlled} />
      </Section>
    </PageLayout>
  )
}
```

`PageLayout` reads the `Section` and titled `Example` elements in its children to build the table of contents. Keep these elements in the page JSX, including inside fragments or arrays; headings hidden inside another component's render function are not collected. Section and example IDs must be unique within a page. Give an example a `title` and optional `description` when it needs its own heading. Use `compact` for a shorter preview.

Load examples and highlight snippets once at module scope:

```tsx
const basic = await loadExample(
  new URL('../../../../../packages/ui/src/accordion/basic.example.tsx', import.meta.url),
)

const anatomyCode = await highlightSource(`import * as accordion from '@remix-run/ui/accordion'

<div mix={accordion.root()}>
  {/* Accordion items */}
</div>`)
```

Examples remain beside the UI implementation in `packages/ui/src/**/*.example.tsx`. Each default exports a normal Remix component. Keep each example self-contained, including its styles, so readers can copy the whole file. The site reads the file for highlighted source and hydrates its default export with `clientEntry`; no source macros, generated copies or import rewriting are involved. Example modules are excluded from the published package and its build.

Page components and their helpers stay on the server. Only example modules and the docs shell are sent to the browser. Export a loaded example as `preview` and include it in the page list to show it on Getting Started. Landing previews are decorative: server-rendered without hydration, inert and hidden from assistive technology.

## Site ownership

- `app/pages/` owns page content and metadata.
- `app/data/` lists pages and loads examples.
- `app/actions/docs/` owns Getting Started and shared page, section, code and example rendering.
- `app/actions/public/` owns browser startup and site-specific styles.
- `app/ui/document.tsx` composes the shared docs header, sidebar, table of contents and footer.
- `scripts/prerender.ts` generates static output with the shared crawler, including the example modules linked from rendered pages.

The shell, tokens, code-block rendering, copy behavior, search and static infrastructure come from [docs/shared](https://github.com/remix-run/remix/tree/main/docs/shared).
