---
title: TypeScript
---

# TypeScript

Remix seamlessly supports both JavaScript and TypeScript. If you name a file with a `.ts` or `.tsx` extension, it will treat it as TypeScript (`.tsx` is for TypeScript files [with JSX](https://www.typescriptlang.org/docs/handbook/jsx.html) in them). But it isn't required. You can write all your files as `.js` files if you don't want TypeScript.

<docs-warning>To use JSX without TypeScript, you need to use the `.jsx` extension.</docs-warning>

The remix compiler will not do any type checking (it simply removes the types). If you want to do type checking, you'll want to use TypeScript's `tsc` CLI yourself. A common solution is to add a `typecheck` script to your package.json:

```json filename=package.json lines=[9]
{
  "private": true,
  "name": "remix-app",
  "description": "Example remix app using TypeScript",
  "license": "MIT",
  "scripts": {
    "build": "remix build",
    "dev": "remix dev",
    "typecheck": "tsc -b",
    "postinstall": "remix setup node",
    "start": "remix-serve build"
  },
  "dependencies": {
    "@remix-run/react": "^1.1.1",
    "react": "^17.0.2",
    "react-dom": "^17.0.2",
    "remix": "^1.1.1",
    "@remix-run/serve": "^1.1.1"
  },
  "devDependencies": {
    "@remix-run/dev": "^1.1.1",
    "@types/react": "^17.0.38",
    "@types/react-dom": "^17.0.11",
    "typescript": "^4.5.4"
  },
  "engines": {
    "node": ">=14"
  },
  "sideEffects": false
}
```

Then you can run that script as part of continuous integration alongside your tests.

Remix has TypeScript type definitions built-in as well. The starter templates create a `remix.env.d.ts` file that is referenced by the `tsconfig.json`:

```json filename=tsconfig.json lines=[2]
{
  "include": ["remix.env.d.ts", "**/*.ts", "**/*.tsx"],
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2019"],
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "target": "ES2019",
    "strict": true,
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
/// <reference types="@remix-run/node/globals" />
```

<docs-info>Note that the types referenced in `remix.env.d.ts` will depend on which environment you're running your app in. For example, there are different globals available in Cloudflare</docs-info>
