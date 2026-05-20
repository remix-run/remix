Initial release of `@remix-run/node-tsx`, a Node.js loader for running `.ts`, `.tsx`, and `.jsx` files with TypeScript and JSX syntax support.

The loader transforms TypeScript syntax that requires JavaScript output, including enums, runtime namespaces, and parameter properties. It reads JSX compiler options from the nearest `tsconfig.json` and supports scoped module loading through `@remix-run/node-tsx/load-module`.
