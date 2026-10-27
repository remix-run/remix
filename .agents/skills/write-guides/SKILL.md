---
name: write-guides
description: Write, rewrite, or audit Remix guide chapters in the voice of docs/site/app/actions/guides/chapters/01-start-here.md. Use when drafting app guides, revising generated-sounding prose, tightening guide examples, preserving doc anchors, or reviewing Markdown chapters under docs/site/app/actions/guides/chapters/.
---

# Write Guides

## Overview

Use this skill for Remix guide chapters, especially `docs/site/app/actions/guides/chapters/*.md`.

The goal is guide prose that sounds like a person walking through real Remix code: concrete, direct, slightly conversational, and careful with examples. Avoid polished filler, repeated takeaways, and abstract claims that could fit any framework.

## Chapter Roles

Only `01-start-here.md` is a tutorial. It builds an app step by step, and each step assumes the reader did the previous one.

Every other chapter is a guide: general advice about how Remix handles one topic and how to accomplish common tasks with it. Guides use the albums record store as a shared example domain, not as an app the reader is building across chapters.

- Write each guide so it can be read on its own, without having followed chapter 1 or any earlier chapter.
- Write each section so a reader who lands on it from search can follow it without reading the sections above it.
- Use albums, artists, tracks, and covers as example names, but do not narrate a build. Avoid phrases like "next we'll add uploads to our app," "back in the albums controller we wrote earlier," or "now that our app has a form."
- Explain how the feature works and how to accomplish the task, then show a focused snippet. A snippet may be a partial file when the surrounding code is obvious.
- Steps are fine inside a section when a task genuinely has an order, such as configuring middleware before reading `context.formData`. Keep them local to the task.
- Assume an app shaped like the one `remix new` generates, but don't keep pointing at it. Avoid phrases like "the template does X" or "the template's asset server." Explain good ways to use Remix directly, such as "Serve them with `staticFiles()`" or "Create the asset server in its own module."
- When there is more than one reasonable approach, name the options and explain the trade-off instead of presenting one setup as the only way. For example, restarting on change is simpler, while hot module replacement is faster and keeps client state at the cost of more moving parts.

## Read First

Before editing a guide chapter:

1. Read `docs/site/app/actions/guides/chapters/01-start-here.md` for voice and example style. Borrow its tone, not its tutorial structure, unless you are editing chapter 1.
2. Read the target chapter completely.
3. Read adjacent chapters when the target chapter refers to earlier or later concepts.
4. If the chapter explains Remix app code, load the `remix` skill or relevant Remix references before inventing patterns.
5. If the task is only to identify AI-sounding prose, report findings with line numbers and do not edit unless asked.

## Voice

Match the tone of `01-start-here.md`:

- In chapter 1, start from what the reader just did or will do next. In guides, start from the task or the Remix behavior the section explains.
- Use concrete files, URLs, routes, handlers, components, and responses.
- In chapter 1, use `we` for walkthrough steps and `you` for choices the reader controls. In guides, address the reader as `you` and describe what Remix does directly.
- Keep paragraphs short. One idea per paragraph is usually enough.
- Explain code immediately after showing it, but do not narrate every line.
- Let examples carry the explanation when they can.
- Use small bullets for dense facts such as file roles, route expansions, and context fields.
- Link to other chapters when a topic deserves its own treatment, but do not use links as a substitute for the local explanation.

Chapter intros can set scope. A short paragraph before the first section that names what the chapter covers and where it sits in the request path is welcome, and it can be more thesis-like than a section opener. The line to hold is grounding: the intro should name the concrete files, APIs, or stages this chapter actually walks through, not make a generic claim that could open any framework guide. `01-start-here.md` does this with its six principles and "What is Remix?" section. Section openers stay tighter and start from the concrete work.

Good tutorial phrasing (chapter 1 only):

```md
Back in `routes.ts`, add the edit route with `form(...)`.
```

```md
Open `/albums/thriller/edit`. The route now returns an HTML form with the album data filled in.
```

Good guide phrasing:

```md
`staticFiles()` answers `GET` and `HEAD` requests for files under the directory you pass it, such as `./public`. Requests for missing files fall through to the router.
```

```md
`formData()` parses the body before your action runs, so an upload handler stores each file before the action sees the rest of the form.
```

Avoid in guides:

```md
Now that our album app can list records, let's let users upload cover art.
```

## Avoid AI-Sounding Patterns

Cut or rewrite prose that has these tells:

- Abstract thesis sentences before the concrete work starts. This applies to section openers; a chapter intro can state scope as long as it names the concrete files, APIs, or stages the chapter covers.
- Generic claims like “doing real work,” “seamlessly,” “robust,” “powerful,” “unlock,” or “designed to make it easy.”
- “One source of truth” unless the paragraph immediately shows the exact typed value and what breaks when it changes.
- Repeating the same idea before and after an example.
- Staccato explanation where several short sentences define obvious neighboring parts in a row. Combine related clauses when it reads more naturally.
- Semicolons used as prose punctuation when a period, comma, colon, or split sentence would read more naturally. This does not apply to code snippets, which should follow the local Prettier config.
- Soft transitions such as “Additionally,” “Furthermore,” “It is important to note,” “A few things to keep in mind,” or “This is where X comes in.”
- Placeholder nouns such as “thing,” “stuff,” “pieces,” or “functionality” when a precise noun exists.
- Overconfident reassurance such as “TypeScript tells you every place” or “the failure is loud.” Say what actually happens.
- Generic web advice that could belong in any framework guide.
- A summary paragraph that restates the section instead of moving the reader forward.

Prefer:

```md
Remix checks this during router setup. If a controller is missing an action for a leaf it owns, setup throws before the app starts serving requests.
```

Avoid:

```md
This keeps ownership explicit and makes failures loud, ensuring your app stays in sync as it grows.
```

## Structure

Value pedagogical reordering. A guide should introduce ideas in the order that helps the reader build the model, not necessarily in the order the API reference would list them. It is often better to show the explicit shape first, then introduce helpers as shorthand. For example, teach a full route object with `{ method, pattern }` before `get(...)`, `post(...)`, or `form(...)` when that makes leaves, branches, and generated helpers easier to understand.

Keep guides distinct from API overviews. Teach just enough syntax or API surface for the reader to understand the guide, show the power of advanced usage with one strong example when it helps, then link to the API overview for the full grammar or exhaustive details. Avoid duplicating feature-by-feature reference docs inside a guide.

For guide chapters:

1. Keep the frontmatter title and description unless the chapter scope changes.
2. Preserve explicit heading anchors that are already linked from other chapters.
3. Introduce each section with the smallest amount of context needed.
4. Order concepts for learning: concrete shape first, shorthand second, edge cases last.
5. Prefer “look what I can do” examples over slow feature-by-feature tours when showing advanced capabilities.
6. Show code before long explanation when the code is the object being explained.
7. Put related explanation adjacent to the code or list it describes.
8. End sections by pointing to the next practical detail, not by restating the thesis.

For the chapter 1 tutorial:

1. State the next thing the reader will build or change.
2. Show the file path and command or code.
3. Explain what changed and how to see it work.
4. Mention related chapters only after the reader has enough local context.

For guides (every other chapter):

1. Start from the concrete app surface: files, imports, functions, route maps, responses.
2. Draw examples from the shared albums domain, but keep each snippet self-contained and do not depend on code from earlier chapters or sections.
3. Prefer the most explicit form before helpers, aliases, or generated shortcuts.
4. Teach the common case directly, then summarize advanced cases in a compact list or one expressive example.
5. Name the rule, then show the consequence in code.
6. Prefer a short table or bullets over parallel paragraphs when comparing related pieces.

## Code Examples

Examples in `docs/site/app/actions/guides/chapters/` should follow the local chapter formatting and teach the shape in the clearest order:

- Import from `remix/...`, not `@remix-run/...`.
- Let the local chapter formatter config format code snippets. `docs/site/app/actions/guides/chapters/.oxfmtrc.json` intentionally uses double quotes in snippets instead of the repo TypeScript style, so do not hand-edit snippets back to repo style.
- Use TypeScript file extensions in relative imports.
- Make snippets internally consistent: every used helper is imported, unused imports are removed, and names match the surrounding example.
- Prefer the shared albums record-store domain unless the chapter needs a different one. Outside chapter 1, treat it as a source of example names, not a continuing build.
- Use `routes.<name>.href(...)` for links, redirects, forms, and tests.
- Return explicit Web `Response` objects from actions.
- Keep examples realistic enough to copy into a project, but short enough that the point is visible.
- If a snippet omits surrounding code, mark it with a short comment such as `// inside an action:` rather than pretending it is a complete file.

## Anchors And Links

- Use generated heading anchors by default. Add an explicit `{#anchor}` only when preserving an existing linked anchor or intentionally choosing an anchor that differs from the generated value.
- Remove explicit anchors that only repeat the generated heading anchor.
- Before changing or removing a heading anchor, search for incoming links with `rg "#anchor-name" docs packages`.
- Preserve old anchors when another chapter links to them, even if you simplify the heading text.
- Same-document anchors can stay relative.
- Link the relevant words in the sentence instead of quoting a section or chapter title. Write "the same options [`createFileResponse()` accepts](#send-stored-and-on-disk-files)," not "covered in [Send Stored and On-Disk Files](#send-stored-and-on-disk-files)." If you must name a section, write it in sentence case without capitalizing words mid-sentence.
- Point cross-chapter links at the most specific heading anchor that covers the topic, such as `/production/#caching`, rather than the top of the chapter.
- Cross-chapter docs links use the chapter slug without its number prefix, such as `/interactivity/#browser-entry-with-run`.
- Link every prose reference to a `remix/*` package or subpath to its API overview at `https://docs.remix.run/<path-after-remix>/`, for example [`remix/middleware/form-data/future`](https://docs.remix.run/middleware/form-data/future/). Link each occurrence, not just the first. Do not add links inside code blocks or headings.
- Do not add link-heavy “for more information” endings to every section.
- Link to API overviews when the guide intentionally skips exhaustive syntax, options, or package surface area.

## AI-Prose Audit Workflow

When asked to identify generated-sounding prose:

1. Read the file and get line numbers.
2. Group findings by pattern, not just by sentence.
3. Quote short phrases that triggered the concern.
4. Explain why the phrase feels generated.
5. Suggest the direction of the rewrite without rewriting the whole file unless asked.
6. Include concrete mistakes such as missing imports, unused imports, mismatched headings, stale anchors, and examples that do not compile.

## Rewrite Workflow

1. Preserve useful technical content and examples.
2. Remove repeated takeaways and generic transitions.
3. Replace abstract framing with the concrete file, API, route, or response being discussed.
4. Reorder sections and examples when the current order teaches shorthand before the underlying shape.
5. Fix example drift while rewriting prose.
6. Re-read the chapter next to `01-start-here.md` and smooth any voice mismatch.
7. Outside chapter 1, remove narration that treats the albums app as an ongoing build.
8. Run Oxfmt on the changed Markdown file:

```sh
pnpm exec oxfmt --check <path-to-chapter.md>
```

Use `pnpm exec oxfmt --write <path-to-chapter.md>` only when formatting changes are expected and acceptable.

9. Run `pnpm run generate-remix` to refresh the guide copies in `packages/remix/guides/`.

## Review Checklist

- Does the chapter match the tone of `01-start-here.md`?
- If it isn't chapter 1, does it read as a standalone guide rather than the next step of a tutorial?
- Does it explain good ways to use Remix and their trade-offs, rather than describing what "the template" does?
- Does the first paragraph start with useful context instead of a generic thesis?
- Did you remove repeated “write once / stay in sync / TypeScript catches it” takeaways unless each one adds new information?
- Are all code snippets internally consistent?
- Does the order teach the underlying shape before helper shortcuts and edge cases?
- Does the chapter avoid duplicating API overview material while still showing why the lower-level API is useful?
- Are route names, params, imports, and file paths consistent across the chapter?
- Did you preserve anchors that other docs link to?
- Is every prose reference to a `remix/*` package linked to its `docs.remix.run` overview?
- Are links used for real next steps instead of filler endings?
- Do links wrap relevant words in the sentence rather than quoting capitalized section or chapter titles?
- Did Oxfmt pass for the changed Markdown?
