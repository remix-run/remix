# Remix Docs

The Remix docs and guides run as one Remix app. The API reference is mounted at `/`, and the hand-written guides are mounted at `/guides/`.

## Where things live

- `app/actions/reference/` contains API-only page content.
- `app/actions/guides/chapters/` contains guide chapters.
- `app/actions/guides/examples/` contains live guide examples.
- `app/actions/guides/markdown/` contains guide frame and frontmatter extensions.
- `app/actions/public/` contains the shared browser entry and site styles.
- `app/data/` builds one guide and API page registry.
- `app/markdown.ts` is the entry point for all site Markdown.
- `app/ui/document.tsx` contains the shared document shell, page layout, and navigation.
- `scripts/generate/` builds the API reference Markdown.
- `scripts/build.ts` generates content, builds demos, validates, prerenders, and indexes the site.
- `scripts/validate-guides.ts` checks guide frame URLs and example handlers.
- `public/` contains site-owned static files and guide images.

Generated reference Markdown, copied demos, and static output are written under `build/` and are not committed.

## Guide chapters

Chapter files use an order prefix. The prefix controls their order and label; the rest of the file name is the URL slug:

```txt
01-start-here.md -> Chapter 1 -> /guides/start-here/
```

Each chapter starts with YAML frontmatter. Level-2 headings build the page table of contents. Guide frames use URLs under `/guides/examples/:chapter/:example/` and must point to an example in the matching chapter directory.

Published chapters are also served as Markdown at `/guides/:chapter.md` and copied into `packages/remix/guides/` by `pnpm run generate-remix`.

## Commands

Run these from the repository root:

```sh
pnpm --filter remix-docs run build      # build the complete static site
pnpm --filter remix-docs run docs       # generate only the API reference Markdown
pnpm --filter remix-docs run build:demos # copy only API demos
pnpm --filter remix-docs run validate   # validate guide frames
pnpm --filter remix-docs run dev        # build, watch, and serve on port 44100
pnpm --filter remix-docs run start      # serve once
pnpm --filter remix-docs run prerender  # write build/site and build the search index
pnpm --filter remix-docs run test
pnpm --filter remix-docs run typecheck
```

Set `PORT` to change the local port. Pass `--dir` to `prerender` to choose another output directory.

The GitHub Pages repository can build a release with one command. Its existing `REMIX_REF`
environment variable keeps source links pinned to that release:

```sh
pnpm --filter remix-docs run build
```

The static artifact is always written to `docs/site/build/site/`.
