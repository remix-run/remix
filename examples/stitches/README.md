# Example app with [Stitches](https://stitches.dev/)

This example features how to use [Stitches](https://stitches.dev/) with Remix.

## How this implementation works

### Stitches related files

```
- app/
  - styles/
    - client.context.tsx
    - stitches.config.ts
  - entry.client.tsx
  - entry.server.tsx
  - root.tsx
```

1. `client.context.tsx` - Keeps the client context of styles and to reset styles sheets after every interaction into the state.
2. `stitches.config.ts` - Keeps the Stitches configuration that is shared into
   the project.
3. `entry.client.tsx` - Every time that styles update and be re-injected it sets the
   Stitches sheet to a React state.
4. `entry.server.tsx` - Create the markup with the styles injected to serve on the server response.

## Preview

Open this example on [CodeSandbox](https://codesandbox.io/):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/stitches)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/routes/index.tsx`. The page auto-updates as you edit the file.

## Commands

- `dev`: runs your application on `localhost:3000`
- `build`: creates the production build version
- `start`: starts a simple server with the build production code

## Related Links

[Stitches](https://stitches.dev/)
