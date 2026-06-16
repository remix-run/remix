# ui-hmr

Hot module replacement runtime and transforms for Remix UI components.

## Features

- **Component Runtime**: Tracks mounted component handles by module URL and export name
- **Stable Wrappers**: Lets transformed modules keep component identity stable while swapping implementations
- **Remount Fallback**: Marks components stale when their setup scope changes so Remix UI can remount them
- **Assets Integration**: Provides a transform that `remix/assets` can run during development

## Installation

```sh
npm i remix
```

## Usage

This package is primarily consumed by Remix development tooling. The transform rewrites supported Remix UI component declarations and injects `import.meta.hot` usage so the generic assets HMR transport can deliver updates.

```ts
import { transformComponentsForBrowser, transformComponentsForServer } from '@remix-run/ui-hmr'
```

The browser runtime is imported by transformed modules:

```ts
import { registerComponentForHmr } from '@remix-run/ui-hmr/browser-runtime'
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
