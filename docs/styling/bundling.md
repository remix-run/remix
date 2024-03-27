---
title: CSS Bundling
---

# CSS Bundling

<docs-warning>This documentation is only relevant when using the [Classic Remix Compiler][classic-remix-compiler]. If you're using [Remix Vite][remix-vite], you should refer to [Vite's CSS documentation][vite-css] instead.</docs-warning>

Some CSS features in Remix bundle styles into a single file that you load manually into the application including:

- [CSS Side Effect Imports][css-side-effect-imports]
- [CSS Modules][css-modules]
- [Vanilla Extract][vanilla-extract]

Note that any [regular stylesheet imports][regular-stylesheet-imports] will remain as separate files.

## Usage

Remix does not insert the CSS bundle into the page automatically so that you have control over the link tags on your page.

To get access to the CSS bundle, first install the `@remix-run/css-bundle` package.

```shellscript nonumber
npm install @remix-run/css-bundle
```

Then, import `cssBundleHref` and add it to a link descriptor—most likely in `app/root.tsx` so that it applies to your entire application.

```tsx filename=app/root.tsx
import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

export const links: LinksFunction = () => [
  ...(cssBundleHref
    ? [{ rel: "stylesheet", href: cssBundleHref }]
    : []),
  // ...
];
```

With this link tag inserted into the page, you're now ready to start using the various CSS bundling features built into Remix.

## Limitations

Avoid using `export *` due to an [issue with `esbuild`'s CSS tree shaking][esbuild-css-tree-shaking-issue].

[esbuild-css-tree-shaking-issue]: https://github.com/evanw/esbuild/issues/1370
[css-side-effect-imports]: ./css-imports
[css-modules]: ./css-modules
[vanilla-extract]: ./vanilla-extract
[regular-stylesheet-imports]: ./css
[classic-remix-compiler]: ../future/vite#classic-remix-compiler-vs-remix-vite
[remix-vite]: ../future/vite
[vite-css]: https://vitejs.dev/guide/features#css
