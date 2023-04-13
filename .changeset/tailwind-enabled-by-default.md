---
"@remix-run/dev": major
"@remix-run/react": major
"@remix-run/server-runtime": major
"@remix-run/testing": major
---

Tailwind support is now enabled by default if a Tailwind config file is present at the root of your project.

If you already have a custom Tailwind setup that you'd like to maintain, you can disable this behavior by setting the `tailwind` option to `false` in `remix.config.js`.

Otherwise, if you followed the original Tailwind setup guide for Remix and want to make use of this feature, you should first delete the generated `app/tailwind.css`.

Then, if you have a `styles/tailwind.css` file, you should move it to `app/tailwind.css`.

```sh
rm app/tailwind.css
mv styles/tailwind.css app/tailwind.css
```

If you don't already have an `app/tailwind.css` file, you should create one with the following contents:

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
