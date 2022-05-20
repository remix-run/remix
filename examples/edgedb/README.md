# Remix Jokes ft. EdgeDB

This example demonstrates how to build an EdgeDB-backed application with Remix, including:

- Generating a new Remix project
- Conventional files
- Routes (including the nested variety ✨)
- Styling
- Running queries against [EdgeDB](https://www.edgedb.com)
- Mutations
- Validation
- Authentication
- Error handling
- SEO with meta tags
- Resource routes
- Deployment

- [Remix Docs](https://remix.run/docs)
- [EdgeDB Docs](https://www.edgedb.com/docs)

## Development

[Install](https://www.edgedb.com/install) the `edgedb` CLI if you haven't already.

Then from your terminal:

```sh
npm install             # install dependencies
edgedb project init     # initialize EdgeDB
npx edgeql-js           # generate query builder
npm run seed            # seed the database
npm run dev             # start dev server
```

After seeding, you can sign in with the following credentials, or create a new account:

- username: `username`
- password: `remixrulz`

This prepares the local dev database and starts your app in development mode, rebuilding assets on file changes.

## Deployment

First, deploy EdgeDB to your cloud platform of choice:

Following the instructions in the deployment guide, construct the DSN for your instance. It should have the following format.

`edgedb://user:password@hostname:port`

Apply the latest migrations against your remote instance.

```sh
edgedb migration --dsn <paste-dsn-here> --tls-security insecure
```

Build your Remix app for production.

```sh
npm run build
```

[Deploy your Remix app](https://remix.run/docs/en/v1/guides/deployment) to your platform of choice.

On your hosting platform, set the following environment variables.

```
EDGEDB_DSN=<paste-dsn-here>
EDGEDB_CLIENT_TLS_SECURITY=insecure
```

> The `EDGEDB_CLIENT_TLS_SECURITY=insecure` variable disables EdgeDB's TLS checks. As long as your database and application live in the same VPC and you guard your `DSN` well (don't add it to your Git repo!) this doesn't present a significant security risk. (Configuring TLS certificates is possible, but beyond the scope of this sample project. )

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/edgedb)
