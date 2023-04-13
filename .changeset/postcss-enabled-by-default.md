---
"@remix-run/dev": major
"@remix-run/react": major
"@remix-run/server-runtime": major
"@remix-run/testing": major
---

PostCSS support is now enabled by default if a `postcss.config.js` file is present at the root of your project.

If you already have a custom PostCSS setup that you'd like to maintain, you can disable this behavior by setting the `postcss` option to `false` in `remix.config.js`.

Otherwise, if you followed the original PostCSS setup guide for Remix and want to make use of this feature, you may have a folder structure that looks like this, separating your source files from its processed output:

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

With the new built-in PostCSS support, you can delete the processed files from `app/styles` folder and move your source files from `styles` to `app/styles`:

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
