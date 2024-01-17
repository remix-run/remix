---
title: Panda CSS
---

# Panda CSS

[Panda CSS][pandacss] is a styling engine that generates styling primitives to author atomic CSS and recipes in a type-safe and readable manner.

Panda combines the developer experience of CSS-in-JS and the performance of atomic CSS. It leverages static analysis to scan your JavaScript and TypeScript files for JSX style props and function calls, generating styles on-demand (aka Just-in-Time)

You can use the Panda CLI, or integrate it into [Post CSS][remix_postcss]. For the purpose of this guide, we'll use the Post CSS method.

To use Panda CSS, first install it as a dev dependency:

```shellscript nonumber
npm install -D @pandacss/dev
```

Then initialize the panda config:

```shellscript nonumber
npx panda init --postcss --out-extension js
```

<docs-info>The `--out-extension` flag tells Panda to generate codegen in `.js`. Panda generated `.mjs` by default, which is not currently supported in Remix.</docs-info>

Now, we update the `scripts` section in `package.json`

```json filename=package.json
{
  "scripts": {
    "prepare": "panda codegen"
  }
}
```

<docs-info>The `"prepare"` - script that will run Panda CSS CLI codegen before each build.</docs-info>


Then we configure the paths that are parsed by Panda CSS, through the `include` section of the Panda config:

```ts filename=panda.config.ts lines=[11]
import { defineConfig } from "@pandacss/dev"
 
export default defineConfig({
 // File extension for generated javascript files
 outExtension: 'js',
 
 // Whether to use css reset
 preflight: true,
 
 // Where to look for your css declarations
 include: ["./app/routes/**/*.{ts,tsx,js,jsx}", "./app/components/**/*.{ts,tsx,js,jsx}"],
 
 // Files to exclude
 exclude: [],
 
 // The output directory for your css system
 outdir: "styled-system",
})
```

Then include the panda layers in your root CSS. For example, you could create an `index.css` file at the root of your app:

```css filename=app/index.css
@layer reset, base, tokens, recipes, utilities;
```

Then add `index.css` to your root route's `links` function:

```tsx filename=app/root.tsx
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

// ...

import styles from "./index.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];
```

Now you can use Panda CSS in your application:

```tsx filename=app/routes/_index.tsx
import type { MetaFunction } from "@remix-run/node";
import { css } from "styled-system/css";
 
export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};
 
export default function Index() {
  return (
    <div className={css({ fontSize: "2xl", fontWeight: 'bold' })}>Hello 🐼!</div>
  );
}
```


[pandacss]: https://panda-css.com
[remix_postcss]: ./postcss
