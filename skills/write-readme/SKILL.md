---
name: write-readme
description: Write or rewrite package README files in the style used by the Remix repository. Use when drafting a new package README, revising an existing README, or reviewing README structure, examples, installation instructions, and section ordering for Remix packages.
---

# Write Readme

## Overview

Draft README files as concise package documentation for real users, not as marketing copy or API dumps. Mirror the structure used across this repository, keep examples production-oriented, and avoid awkward manual line breaks in prose.

## Workflow

1. Read the package API and at least one or two sibling package READMEs before drafting.
2. Document the package as it exists today, not the package you wish existed.
3. Start with a realistic production usage example as soon as the installation section is done.
4. Cover each major feature with a concrete example.
5. Finish with internal ecosystem links, external related work, and license info.

## Structure

Use this section order unless there is a strong package-specific reason not to:

1. `# short package-name` (i.e. `fetch-router` instead of `@remix-run/fetch-router`)
2. Intro: one or two sentences explaining what the package does and why it exists
3. `## Features`: a flat bullet list of the main highlights
4. `## Installation`
5. `## Usage`: a production-like example that shows the package in context
6. One section per major feature, each with focused examples
7. `## Related Packages`
8. `## Related Work`
9. `## License`

## Rules

- Installation should always start with:

```sh
npm i remix
```

- If the package requires a third-party dependency or peer, include it explicitly in the installation section after `remix`.
- Usage examples should import from `remix/...`, not `@remix-run/...`.
- The first example should look like real application code, not the smallest possible snippet.
- Feature sections should show how to use the package's major capabilities in practice, with one example per capability when useful.
- Keep prose compact. Do not hard-wrap paragraphs at awkward places in the middle of a sentence just to force a line length.
- Prefer flat bullets and short paragraphs over long explanatory blocks.
- `Related Packages` should point to relevant Remix packages in the monorepo.
- `Related Work` should point to external libraries, specs, standards, or prior art that help readers place the package.
- `License` should use the standard repo wording and link.

## Checklist

- Does the intro explain the package in one or two sentences?
- Does the features list surface the package's main value quickly?
- Does the installation section use `npm i remix`?
- Does the main usage example show a realistic production scenario?
- Does each major feature have an example?
- Does the README end with `Related Packages`, `Related Work`, and `License`?
- Does the prose read naturally without awkward manual line breaks?
