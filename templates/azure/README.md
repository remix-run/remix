# Welcome to Remix!

- [Remix Docs](https://docs.remix.run)
- [Customer Dashboard](https://remix.run/dashboard)

## Development

From your terminal:

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deploying

Prerequisites:

- [Azure Account](https://portal.azure.com/)
- [GitHub Account](https://github.com/)

First, you need to follow the [instructions](https://docs.microsoft.com/en-us/azure/static-web-apps/get-started-portal?tabs=vanilla-javascript) to create a new project on Azure.

Next, you'll need to add your `REMIX_TOKEN`, and your `AZURE_STATIC_WEB_APPS_TOKEN` as a GitHub project [secrets](https://docs.github.com/en/actions/reference/encrypted-secrets)

You can find your azure token in the Azure portal for your static web app under "management deployment token".
