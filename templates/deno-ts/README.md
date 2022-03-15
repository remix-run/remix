# Remix Deno Template

⚠️ EXPERIMENTAL ⚠️

## Install

```sh
npx create-remix@latest --template <path/to/this/template>
```

## Scripts

```sh
npm run build
```

```sh
npm run start
```

```sh
npm run dev
```

## 🚧 Under construction 🚧

This section details temporary scaffolding for the Remix Deno template.
All of this scaffolding is planned for removal at a later date.

### `package.json`

A `package.json` is included for now so that `remix` CLI (from `@remix-run/dev`) can run the Remix compiler.

In the future, we could provide a stand-alone executable for the Remix compiler OR `npx remix`, and we would remove the `package.json` file from this Deno template.

### Local `remix-deno` package

For now, we are inlining Remix's `@remix-run/deno` package into `remix-deno` to enable faster experimentation and development.

In the future, this template would not include the `remix-deno` directory at all.
Instead, users could import from `@remix-run/deno` (exact URL TBD).

### Required `installGlobals` call

Remix depends on specific globals (`sign`/`unsign`) for internal functionality (cookie signing).
Right now, the values for those globals are defined in the local `remix-deno` package.
The globals are _actually_ assigned these values in the `installGlobals` function that must be called in user code (i.e. `server.ts`).

In the future, we plan to obviate these globals (`sign`/`unsign`), removing the `installGlobals` call (and even the import) from user code in `server.ts`.

## 🐞 Known issues 🐞

### `dev` does not live reload

Deno server is not currently configured to live reload when `--watch` detects changes, requiring a manual refresh in the browser for non-server changes (e.g. changing JSX content).

To enable live reload, `@remix-run/react` must be built with `NODE_ENV=development`.
To do so with `esm.sh`, `?dev` must be added to all imports that depend on React.
However, bundling the React development build for `esm.sh` (`https://esm.sh/react@17.0.2?dev`) runs into an [esbuild bug](https://github.com/evanw/esbuild/issues/2099).

Need a better way to switch from development to production mode than adding/removing `?dev` for all React-dependent imports.
Also, need esbuild bug to be resolved.

### Pinned React imports

For all React-related imports (including `@remix-run/*` imports), we append `?pin=v68` to the URL.
This is the only reliable way we were able to guarantee that only one copy of React would be present in the browser.

No plans on how to address this yet.

### @remix-run/dev/server-build

The `@remix-run/dev/server-build` import within `server.ts` (`import * as build from '@remix-run/dev/server-build'`) is a special import for the Remix compiler that points to the built server entry point (typically within `./build`).

The `vscode_deno` plugin complains about this import with a red squiggly underline as Deno cannot resolve this special import.

No plans on how to address this yet.
