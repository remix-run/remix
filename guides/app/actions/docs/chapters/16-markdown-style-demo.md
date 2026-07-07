---
title: Markdown Style Demo
description: A fixture page for reviewing guide markdown, code block chrome, and frame rendering.
---

This page is a rendering fixture, not product documentation. Use it to review how the guides app styles common Markdown elements and custom docs features.

## Inline text, links, and emphasis {#inline-text-links-and-emphasis}

A paragraph can mix **strong text**, _emphasis_, `inline code`, and [links to another chapter](/docs/routing-and-controllers). Inline code should stay compact enough to read in a sentence without looking like a full code block.

Raw HTML is escaped instead of rendered:

<section data-demo="escaped-html">
  <p>This should appear as text, not as a real section.</p>
</section>

## Headings below the page title {#headings-below-the-page-title}

The page title is the level-one heading. Chapter bodies should usually start at level two, but lower heading levels are available when a section needs more structure.

### Level three heading

Use level three headings for subsections inside a page section.

#### Level four heading

Use level four headings sparingly. They work best when several neighboring subsections share the same shape.

##### Level five heading

Level five headings are available for dense reference sections.

###### Level six heading

Level six headings are the smallest heading style.

## Lists and task states {#lists-and-task-states}

Unordered lists work well for parallel facts:

- Web APIs are the baseline.
- Route maps own URL construction.
- Controllers return `Response` objects.
  - Nested bullets keep supporting details near the parent item.
  - Keep nesting shallow enough to scan.

Ordered lists work well when order matters:

1. Receive a `Request`.
2. Match the route.
3. Run the controller.
4. Return a `Response`.

Task lists show checklist states:

- [x] Render Markdown from a chapter file.
- [x] Highlight code blocks.
- [ ] Replace these demo frames with real global frames later.

## Blockquotes and rules {#blockquotes-and-rules}

> Frames render route-owned UI inside another page. They are useful when part of the page should fetch, reload, or hydrate independently from the surrounding document.

Horizontal rules separate examples that need a stronger break than paragraph spacing.

---

The content after the rule should still feel like part of the same chapter.

## Tables {#tables}

| Element     | What to check                     | Example               |
| ----------- | --------------------------------- | --------------------- |
| Paragraph   | Spacing and line length           | Most prose in a guide |
| Inline code | Contrast and wrapping             | `context.render(...)` |
| Table       | Borders, padding, and scanability | This table            |
| Frame       | Margin around embedded UI         | The examples below    |

## Images {#images}

Images should scale to the content width and keep rounded corners.

![Remix favicon](/favicon.svg)

## Code blocks with and without filenames {#code-blocks}

A plain code fence gets syntax highlighting and a copy button.

```ts
import { redirect } from "remix/response/redirect";

export async function createProject(request: Request) {
  let formData = await request.formData();
  let name = String(formData.get("name") ?? "").trim();

  if (name === "") {
    return new Response("Project name is required", { status: 400 });
  }

  return redirect(`/projects/${name}`, 303);
}
```

A code fence can include a filename and highlighted lines in its metadata. The guides renderer pulls the filename into the header and marks the requested line ranges.

```tsx filename=app/actions/projects/create.tsx lines=[4-5,8]
import type { AppContext } from "../../router.ts";

export async function createProject({ request }: AppContext) {
  let formData = await request.formData();
  let name = String(formData.get("name") ?? "").trim();

  return new Response(`Created ${name || "untitled project"}`);
}
```

Line highlighting also works with `highlight=` and `lines=` metadata if a fence already has other parameters.

```ts [2,4-6]
let status = "idle";
let retries = 0;

if (status === "idle") {
  retries++;
}
```

Shell, JSON, and plain text fences use the same code block chrome.

```sh filename=terminal
pnpm --filter remix-guides run validate
```

```json filename=package.json
{
  "scripts": {
    "validate": "node --import remix/node-tsx scripts/validate-docs.ts"
  }
}
```

```txt
Plain text stays unhighlighted but still gets copy behavior.
```

## Markdown custom logic {#markdown-custom-logic}

Use an explicit heading ID when a section needs a stable URL that should not change with the visible text. The heading for this section uses `{#markdown-custom-logic}`.

The `::frame` directive is docs-specific Markdown. Inside a code fence it stays text:

````md filename=chapter.md
::frame{src="/docs/examples/16-markdown-style-demo/callout"}

```tsx filename=app/actions/docs/examples/16-markdown-style-demo/callout.demo.tsx
export function CalloutDemo() {
  return () => <p>Hello from a frame.</p>;
}
```
````

Outside a code fence, the renderer replaces the directive with a Remix `<Frame>`.

## Reusable frame pieces without new directives {#reusable-frame-pieces}

A one-off frame can still share structure. These examples use normal `::frame` directives, but the examples export focused components instead of frame routes. The parent example handler hydrates the component, wraps it in a shared demo shell, and shows only the component source.

The counter demo uses browser events, but the example itself does not call `clientEntry`. It assumes the parent frame handler will hydrate it.

::frame{src="/docs/examples/16-markdown-style-demo/counter"}

The callout is a plain server-rendered frame: no hydration, no source display, just the markup the handler returns.

::frame{src="/docs/examples/16-markdown-style-demo/callout"}
