---
"@remix-run/dev": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
---

Stabilize built-in PostCSS support via the new `postcss` option in `remix.config.js`. As a result, the `future.unstable_postcss` option has also been deprecated.

The `postcss` option is `false` by default, but when set to `true` will enable processing of all CSS files using PostCSS if `postcss.config.js` is present.

If you followed the original PostCSS setup guide for Remix, you may have a folder structure that looks like this, separating your source files from its processed output:

```
.
├── app
│   └── styles (processed files)
│       ├── app.css
│       └── routes
│           └── index.css
└── styles (source files)
    ├── app.css
    └── routes
        └── index.css
```

After you've enabled the new `postcss` option, you can delete the processed files from `app/styles` folder and move your source files from `styles` to `app/styles`:

```
.
├── app
│   └── styles (source files)
│       ├── app.css
│       └── routes
│           └── index.css
```

You should then remove `app/styles` from your `.gitignore` file since it now contains source files rather than processed output.

You can then update your `package.json` scripts to remove any usage of `postcss` since Remix handles this automatically. For example, if you had followed the original setup guide:

```diff
{
  "scripts": {
-    "dev:css": "postcss styles --base styles --dir app/styles -w",
-    "build:css": "postcss styles --base styles --dir app/styles --env production",
-    "dev": "concurrently \"npm run dev:css\" \"remix dev\""
+    "dev": "remix dev"
  }
}
```
