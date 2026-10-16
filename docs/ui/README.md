# Remix UI docs

A documentation site for the standalone `@remix-run/ui` package, with live examples, usage guidance and API references for each UI pattern and animation utility.

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

The sidebar displays the version from `packages/ui/package.json`. Build published docs from the corresponding Remix UI release checkout so the version, documentation and live examples match.

## Authoring

Pages are normal Remix components in `app/pages/patterns/` and `app/pages/animation/`. Each exports a small `meta` object with its title, category, slug, description and package import path. Add the component and its metadata to [the page list](https://github.com/remix-run/remix/blob/main/docs/ui/app/data/pages.ts) to include it in routing, navigation and prerendering.

Pages follow the category order in `app/data/categories.ts`, then alphabetical title order within each category. The sidebar, landing card destinations and previous and next links all follow this list. Page navigation continues from Patterns into Animation.

Write the body as JSX inside `PageLayout`. Shared helpers live beside the page folders in `app/pages/page.tsx`, `app/pages/example.tsx` and `app/pages/api-table.tsx`. Place prose, code blocks and examples where readers should see them:

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

`PageLayout` reads `Section`, titled `Example` and native `h3` elements with IDs to build the page outline. Use `h3` for individual API parts. Function argument lists are shortened to `()` in outline labels. Keep these elements in the page JSX, including inside fragments or arrays; headings hidden inside another component's render function are not collected. IDs must be unique within a page. Give an example a `title` and optional `description` when it needs its own heading. Use `compact` for a shorter preview.

Use `ApiTable` with `ApiEntry` children for props, attributes, event fields and exported types. Give each table a stable, unique `id` such as `context-props` or `trigger-attributes`. Entry permalinks combine this prefix with the entry name. Set an entry's `id` explicitly when preserving an existing type link. Supply `type` and optional `defaultValue` as strings; the entry adds code formatting. Write descriptions, links and full type definitions as normal JSX children:

```tsx
<ApiTable id="entrance-options" label="Option" defaults>
  <ApiEntry name="duration" type="number" required>
    Playback time in milliseconds.
  </ApiEntry>
  <ApiEntry name="easing" type="string" defaultValue="'linear'">
    CSS easing function.
  </ApiEntry>
</ApiTable>
```

The shared components render native disclosures with borderless detail tables and a permalink in each expanded description. Fragment targets live inside the disclosure so native navigation reveals collapsed entries. The browser startup also restores targeted entries on reload. Headings and entries leave space below sticky navigation. APIs with no options or fields can use concise prose.

Load examples and highlight snippets once at module scope. Example names are relative to `app/examples/`, without the `.example.tsx` suffix. For example, use `accordion/basic` or `animation/spring/billing`:

```tsx
const basic = await loadExample('accordion/basic')

const anatomyCode = await highlightSource(`
  import * as accordion from '@remix-run/ui/accordion'

  <div mix={accordion.root()}>
    {/* Accordion items */}
  </div>
`)
```

`highlightSource` removes shared indentation and outer whitespace, then formats supported code snippets with the repository's Oxfmt rules before highlighting. It omits defensive semicolons before standalone JSX only when formatting without them produces the same code. Required statement separators and literal text are preserved. If formatting fails, it logs a warning and displays the original snippet. Shell commands and other unsupported languages retain their source formatting.

Examples live in `app/examples/**/*.example.tsx`. Each default exports a normal Remix component. Keep each example self-contained, including its styles, so readers can copy the whole file. The site reads the file for highlighted source and hydrates its default export with `clientEntry`; no source macros, generated copies or import rewriting are involved. These files belong to the site and import Remix UI through its public exports.

Page components and their helpers stay on the server. Only example modules and the docs shell are sent to the browser. Export a loaded example as `preview` and include it in the page list to show it on Getting Started. Landing previews are decorative: server-rendered without hydration, inert and hidden from assistive technology.

## Testing live examples

Each `*.example.tsx` has a matching `*.example.test.browser.tsx` beside it. Import and render the actual example with `mount` from `app/examples/test-helpers.ts`. Test the behavior the example teaches, including its visible state and relevant keyboard, focus or form behavior. Keep exhaustive primitive coverage in the Remix UI package.

These are interaction smoke tests, not exhaustive primitive or visual regression tests. For each example, identify a plausible broken behavior its test must catch. Temporarily break that wiring when adding or substantially changing a test, verify that it fails for the expected reason, and restore the source. A companion filename alone does not prove meaningful coverage.

Animation tests use real browser animations. Check that the first interaction and a return interaction animate and reach their intended endpoints. Assert motion on the intended element and property so an unrelated transition cannot satisfy the test. Wait for observable state or animation completion rather than fixed delays. The shared helpers register cleanup and provide bounded assertion polling. Check visual hiding as well as state attributes where it matters, and use a search alias that cannot match the normal label when testing aliases. Tests for snippets and page rendering run on the server. One docs-site smoke test covers hydration, real pointer and keyboard interaction, focus restoration and browser errors through the actual page layout.

Run all docs tests or focus on one example from the repository root.

```sh
pnpm --filter remix-ui-docs run test
pnpm --filter remix-ui-docs run test app/examples/toggle/controlled.example.test.browser.tsx
pnpm --filter remix-ui-docs run typecheck
```

The standard test command runs browser tests in Chromium. A server test checks that every live example has a companion browser test. Typechecking includes both the example source and its tests. Test files and helpers are excluded from public example assets.

## Site ownership

- `app/pages/` owns page content, metadata and shared page helpers. `getting-started.tsx` owns the landing page, including its snippets, previews and table of contents.
- `app/examples/` owns the runnable examples and their copyable source.
- `app/data/` lists pages and loads examples.
- `app/actions/docs/` owns the docs controller.
- `app/actions/public/` owns browser startup and site-specific styles.
- `app/ui/document.tsx` composes the shared docs header, sidebar, table of contents and footer.
- `scripts/prerender.ts` generates static output with the shared crawler, including the example modules linked from rendered pages.

The shell, tokens, code-block rendering, copy behavior, search and static infrastructure come from [docs/shared](https://github.com/remix-run/remix/tree/main/docs/shared).
