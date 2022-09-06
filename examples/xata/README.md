# Xata template

This example showcases how to use Remix with [Xata](https://xata.io) as your data layer.

With this template you get out-of-the-box:

- API Route to connect to your Xata database
- Type-safe Codegen
- Accessibility-Ready
  - Dark/Light mode
  - Respects `prefers-reduce-motion` for CSS Transitions

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

- [![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/xata)
- [Check it live](https://remix-with-xata.netlify.app)

## Example

Execute [`create-remix-app`](https://github.com/vercel/next.js/tree/canary/packages/create-remix-app) with [npm](https://docs.npmjs.com/cli/init), [Yarn](https://yarnpkg.com/lang/en/docs/cli/create/), or [pnpm](https://pnpm.io) to bootstrap the example:

```sh
npx create-remix-app --template xata remix-xata-app

```

<details>
<summary> Yarn or PNPM</summary>

```sh
yarn create remix-app --template xata remix-xata-app
```

```sh
pnpm create remix-app --template xata remix-xata-app
```

</details>

### Link Your Xata Workspace and Run Codegen

```sh
npm run start:xata
```

> 💡 consider [installing the Xata CLI globally](https://xata.io/docs/cli/getting-started), it will likely improve your experience managing your databases


<details>
<summary> Yarn or PNPM</summary>

```sh
yarn start:xata
```

```sh
pnpm run start:xata
```

</details>

> ⚠️ once linked, you can just run `xata` to re-generate types.

### Start Coding

Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

> 💡 the template will prompt you to create a dummy new table (`remix_with_xata_example`) with some useful resources.

## Related Links

- [Xata Docs](https://xata.io/docs)
- [Xata VS Code Extension](https://marketplace.visualstudio.com/items?itemName=xata.xata) will make managing your data more comfortable
- [Xata Discord](https://xata.io/discord)
