# Remix Turborepo Vercel

Example of setting up a Remix app that will be deployed to Vercel from inside a Turborepo monorepo.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

<!-- TODO: update this link to the path for your example: -->

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/turborepo-vercel)

## Example

In order for this to work, your Vercel config should look like this:

build command: 
```sh
cd ../.. && npx turbo run build --scope=remix-app --include-dependencies --no-deps
```

![Vercel project config](./vercel-project-config-example.jpg)
