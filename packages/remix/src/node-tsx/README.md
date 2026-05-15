# node-tsx

Run Node.js with JSX syntax support in `.tsx` and `.jsx` files.

JSX compiler options are read from the nearest `tsconfig.json` for each loaded file.

## Installation

```sh
npm i remix
```

## Usage

Pass the `--import` flag to register the `remix/node-tsx` loader when executing `node`:

```sh
node --import remix/node-tsx ./server.ts
```

### TypeScript configuration

Since TypeScript syntax and import resolution are otherwise handled by Node.js, you should configure type checking to match native Node loading and type stripping:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "rewriteRelativeImportExtensions": true
  }
}
```

- [`module`](https://www.typescriptlang.org/tsconfig/#module) and [`moduleResolution`](https://www.typescriptlang.org/tsconfig/#moduleResolution) use `NodeNext` so TypeScript resolves modules the way Node does.
- [`allowImportingTsExtensions`](https://www.typescriptlang.org/tsconfig/#allowImportingTsExtensions) allows source files to import `.ts` and `.tsx` modules directly.
- [`erasableSyntaxOnly`](https://www.typescriptlang.org/tsconfig/#erasableSyntaxOnly) rejects TypeScript syntax Node cannot erase.
- [`isolatedModules`](https://www.typescriptlang.org/tsconfig/#isolatedModules) avoids patterns that require whole-program compilation, such as re-exporting a type without `export type`.
- [`verbatimModuleSyntax`](https://www.typescriptlang.org/tsconfig/#verbatimModuleSyntax) requires type-only imports and exports to be marked so runtime imports are unambiguous.
- [`rewriteRelativeImportExtensions`](https://www.typescriptlang.org/tsconfig/#rewriteRelativeImportExtensions) preserves a `tsc` emit path by rewriting relative `.ts` and `.tsx` imports to JavaScript extensions.

### Programmatic usage

#### Registering the loader

Import `remix/node-tsx` as a side effect to register the loader.

```ts
import 'remix/node-tsx'
```

#### Loading a module with scoped JSX support

Load a module with JSX syntax support scoped to its import graph:

```ts
import { loadModule } from 'remix/node-tsx/load-module'

let mod = await loadModule('./app/server.tsx', import.meta.url)
```

## Related Work

- [Node.js Modules: Customization hooks](https://nodejs.org/api/module.html#customization-hooks)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
