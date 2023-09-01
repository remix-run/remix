---
"@remix-run/dev": patch
---

[REMOVE] Improve browser compatibility of minified CSS

[REMOVE] We now minify CSS targeting the Remix browser support baseline (i.e. anything that supports [ES module scripts](https://caniuse.com/es6-module)), whereas previously CSS was minified using esbuild's default "esnext" target. This meant that CSS in the production build could be using properties that are unsupported in some browsers. This change also means you now have more control over CSS transformations using the built-in PostCSS support since they won't be reversed by esbuild's minification.
