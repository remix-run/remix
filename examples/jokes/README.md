# Remix Jokes!

So great, it's funny!

Production deploy here: https://remix-jokes.lol

Tutorial here: https://rmx.as/jokes

This example demonstrates some of the basic features of Remix, including:

- Generating a new Remix project
- Conventional files
- Routes (including the nested variety ✨)
- Styling
- Database interactions (via `sqlite` and `prisma`)
- Mutations
- Validation
- Authentication
- Error handling: Both unexpected (the dev made a whoopsies) and expected (the end-user made a whoopsies) errors
- SEO with Meta Tags
- JavaScript...
- Resource Routes
- Deployment

This is the finished version of [the tutorial](https://remix.run/tutorials/jokes).

> For comparison, a variant of this sample app using [EdgeDB](https://www.edgedb.com) instead of SQLite/Prisma is [available here](https://github.com/edgedb/edgedb-examples/tree/main/remix).

- [Remix Docs](https://remix.run/docs)

## Development

From your terminal:

```sh
npm install
npx prisma migrate dev
npm run dev
```

This prepares the local dev database and starts your app in development mode, rebuilding assets on file changes.

## Deployment

First, build your app for production:

```sh
npm run build
```

Then apply any database changes:

```sh
npx prisma migrate deploy
```

Then run the app in production mode:

```sh
npm start
```

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/jokes)
