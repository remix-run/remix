---
title: TypeScript
---

# TypeScript

Remix seamlessly supports both JavaScript and TypeScript. If you name a file with a .ts or .tsx extension, it will treat it as TypeScript (.tsx is for TypeScript files [with JSX](https://www.typescriptlang.org/docs/handbook/jsx.html) in them). But it isn't required. You can write all your files as .js files if you don't want TypeScript.

Right now it will automatically compile any .ts and .tsx files in the app directory.Though we just use tsc to compile them directly instead of our compiler. This will probably change soon.
