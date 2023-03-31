---
"@remix-run/dev": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
---

Stabilize built-in Tailwind support via the new `tailwind` option in `remix.config.js`. As a result, the `future.unstable_tailwind` option has also been deprecated.

The `tailwind` option is `false` by default, but when set to `true` will enable built-in support for Tailwind functions and directives in your CSS files if `tailwindcss` is installed.

If you followed the original Tailwind setup guide for Remix and want to make use of this feature, you should first delete the generated `app/tailwind.css`.

Then, if you have a `styles/tailwind.css` file, you should move it to `app/tailwind.css`.

```sh
rm app/tailwind.css
mv styles/tailwind.css app/tailwind.css
```

Otherwise, if you don't already have an `app/tailwind.css` file, you should create one with the following contents:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

You should then remove `/app/tailwind.css` from your `.gitignore` file since it now contains source code rather than processed output.

You can then update your `package.json` scripts to remove any usage of `tailwindcss` since Remix handles this automatically. For example, if you had followed the original setup guide:

```diff
{
  // ...
  "scripts": {
-    "build": "run-s \"build:*\"",
+    "build": "remix build",
-    "build:css": "npm run generate:css -- --minify",
-    "build:remix": "remix build",
-    "dev": "run-p \"dev:*\"",
+    "dev": "remix dev",
-    "dev:css": "npm run generate:css -- --watch",
-    "dev:remix": "remix dev",
-    "generate:css": "npx tailwindcss -o ./app/tailwind.css",
    "start": "remix-serve build"
  }
  // ...
}
```
