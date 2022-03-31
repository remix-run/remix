# Welcome to Remix for Azure Static Web Apps!

- [Remix Docs](https://docs.remix.run)
- [Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps)

## Development

From your terminal:

```sh
npm run dev
```

This starts the [Static Web Apps emulator](https://github.com/Azure/static-web-apps-cli) and the Remix server in the background.

A [VS Code Devcontainer definition](https://code.visualstudio.com/docs/remote/containers) has been included to setup a local development environment with all the dependencies and recommended VS Code extensions.

## Deploying

Prerequisites:

- [Azure Account](https://portal.azure.com/)
- [GitHub Account](https://github.com/)

First, you need to follow the [instructions](https://docs.microsoft.com/azure/static-web-apps/get-started-portal?tabs=vanilla-javascript) to create a new project on Azure. This will also setup the GitHub Actions workflow to perform automated deployments of your site.
