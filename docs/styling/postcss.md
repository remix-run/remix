---
title: PostCSS
---

# PostCSS

<docs-warning>This documentation is only relevant when using the [Classic Remix Compiler][classic-remix-compiler]. If you're using [Remix Vite][remix-vite], support for [PostCSS is built into Vite][vite-postcss].</docs-warning>

[PostCSS][postcss] is a popular tool with a rich plugin ecosystem, commonly used to prefix CSS for older browsers, transpile future CSS syntax, inline images, lint your styles and more. When a PostCSS config is detected, Remix will automatically run PostCSS across all CSS in your project.

For example, to use [Autoprefixer][autoprefixer], first install the PostCSS plugin.

```shellscript nonumber
npm install -D autoprefixer
```

Then add a PostCSS config file in the Remix root referencing the plugin.

```js filename=postcss.config.cjs
module.exports = {
  plugins: {
    autoprefixer: {},
  },
};
```

If you're using [Vanilla Extract][vanilla-extract], since it's already playing the role of CSS preprocessor, you may want to apply a different set of PostCSS plugins relative to other styles. To support this, you can export a function from your PostCSS config file which is given a context object that lets you know when Remix is processing a Vanilla Extract file.

```js filename=postcss.config.cjs
module.exports = (ctx) => {
  return ctx.remix?.vanillaExtract
    ? {
        // PostCSS plugins for Vanilla Extract styles...
      }
    : {
        // PostCSS plugins for other styles...
      };
};
```

<docs-info>Built-in PostCSS support can be disabled by setting the `postcss` option to `false` in `remix.config.js`.</docs-info>

## CSS Preprocessors

You can use CSS preprocessors like LESS and SASS. Doing so requires running an additional build process to convert these files to CSS files. This can be done via the command line tools provided by the preprocessor or any equivalent tool.

Once converted to CSS by the preprocessor, the generated CSS files can be imported into your components via the [Route Module `links` export][route-module-links] function, or included via [side effect imports][css-side-effect-imports] when using [CSS bundling][css-bundling], just like any other CSS file in Remix.

To ease development with CSS preprocessors you can add npm scripts to your `package.json` that generate CSS files from your SASS or LESS files. These scripts can be run in parallel alongside any other npm scripts that you run for developing a Remix application.

An example using SASS.

1. First you'll need to install the tool your preprocess uses to generate CSS files.

   ```shellscript nonumber
   npm add -D sass
   ```

2. Add an npm script to your `package.json`'s `scripts` section that uses the installed tool to generate CSS files.

   ```jsonc filename=package.json
   {
     // ...
     "scripts": {
       // ...
       "sass": "sass --watch app/:app/"
     }
     // ...
   }
   ```

   The above example assumes SASS files will be stored somewhere in the `app` folder.

   The `--watch` flag included above will keep `sass` running as an active process, listening for changes to or for any new SASS files. When changes are made to the source file, `sass` will regenerate the CSS file automatically. Generated CSS files will be stored in the same location as their source files.

3. Run the npm script.

   ```shellscript nonumber
   npm run sass
   ```

   This will start the `sass` process. Any new SASS files, or changes to existing SASS files, will be detected by the running process.

   You might want to use something like `concurrently` to avoid needing two terminal tabs to generate your CSS files and also run `remix dev`.

   ```shellscript nonumber
   npm add -D concurrently
   ```

   ```json filename=package.json
   {
     "scripts": {
       "dev": "concurrently \"npm run sass\" \"remix dev\""
     }
   }
   ```

   Running `npm run dev` will run the specified commands in parallel in a single terminal window.

[postcss]: https://postcss.org
[autoprefixer]: https://github.com/postcss/autoprefixer
[vanilla-extract]: ./vanilla-extract
[route-module-links]: ../route/links
[css-side-effect-imports]: ./css-imports
[css-bundling]: ./bundling
[postcss-preset-env]: https://preset-env.cssdb.org
[esbuild-css-tree-shaking-issue]: https://github.com/evanw/esbuild/issues/1370
[classic-remix-compiler]: ../guides/vite#classic-remix-compiler-vs-remix-vite
[remix-vite]: ../guides/vite
[vite-postcss]: https://vitejs.dev/guide/features#postcss
