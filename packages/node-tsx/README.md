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

Since TypeScript syntax is otherwise handled by Node.js, code must be compatible with Node's built-in type stripping. It's recommended to enable `erasableSyntaxOnly` in your `tsconfig.json` so type checking catches syntax that cannot be erased at runtime, such as `enum` and parameter properties:

```json
{
  "compilerOptions": {
    "erasableSyntaxOnly": true
  }
}
```

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
