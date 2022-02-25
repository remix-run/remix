# Example app with [emotion](https://emotion.sh/)

This example features how to use [emotion](https://emotion.sh/) with Remix.

## How this implementation works

### Emotion related files

```
- app/
  - styles/
    - client.context.tsx
    - createEmotionCache.ts
    - server.context.tsx
  - entry.client.tsx
  - entry.server.tsx
  - root.tsx
```

1. `client.context.tsx` - Keeps the client context of styles and to reset based on the flush of Emotion styles sheets after every interaction into the state.
2. `createEmotionCache.ts` - Create an instance of [Emotion cache](https://emotion.sh/docs/@emotion/cache).
3. `server.context.tsx` - Keeps the server context mounted on `entry.server.tsx`
   with the Emotion sheets cache.
4. `entry.client.tsx` - Every time that styles update and be re-injected it sets the
   Emotion cache to a React state.
5. `entry.server.tsx` - Create the markup with the styles injected to serve on the server response.

## Preview

Open this example on [CodeSandbox](https://codesandbox.io/):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/emotion)

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

[Emotion](https://emotion.sh/)
