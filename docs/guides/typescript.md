---
title: TypeScript
toc: false
---

# TypeScript

Remix seamlessly supports both JavaScript and TypeScript. If you name a file with a `.ts` or `.tsx` extension, it will treat it as TypeScript (`.tsx` is for TypeScript files [with JSX][with-jsx] in them). But it isn't required. You can write all your files as `.js` files if you don't want TypeScript.

The Remix compiler will not do any type checking (it simply removes the types). If you want to do type checking, you'll want to use TypeScript's `tsc` CLI yourself. A common solution is to add a `typecheck` script to your package.json:

```json filename=package.json lines=[10]
{
  "name": "remix-app",
  "private": true,
  "sideEffects": false,
  "scripts": {
    "build": "remix build",
    "dev": "remix dev --manual",
    "lint": "eslint --ignore-path .gitignore .",
    "start": "remix-serve ./build/index.js",
    "typecheck": "tsc"
  },
  "dependencies": {
    "@remix-run/node": "latest",
    "@remix-run/react": "latest",
    "@remix-run/serve": "latest",
    "isbot": "^4.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@remix-run/dev": "latest",
    "@types/react": "^18.2.20",
    "@types/react-dom": "^18.2.7",
    "eslint": "^8.23.1",
    "typescript": "^5.1.6"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

Then you can run that script as part of continuous integration, alongside your tests.

Remix has TypeScript type definitions built-in as well. The starter templates create a `remix.env.d.ts` file that is referenced by the `tsconfig.json`:

```json filename=tsconfig.json lines=[2]
{
  "include": ["remix.env.d.ts", "**/*.ts", "**/*.tsx"],
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "isolatedModules": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "target": "ES2022",
    "strict": true,
    "allowJs": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "~/*": ["./app/*"]
    },

    // Remix takes care of building everything in `remix build`.
    "noEmit": true
  }
}
```

```ts filename=remix.env.d.ts
/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node" />
```

<docs-info>Note that the types referenced in `remix.env.d.ts` will depend on which environment you're running your app in. For example, there are different globals available in Cloudflare.</docs-info>

[with-jsx]: https://www.typescriptlang.org/docs/handbook/jsx.html
