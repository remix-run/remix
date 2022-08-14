# Google App Engine Deployment

This example deploys a Remix application to Google Cloud App Engine (standard environment).

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/google-app-engine-deployment)

## Requirements

Google Cloud SDK setup and login is required.

### Google Cloud SDK Setup

1. Install the Google Cloud SDK:

[Quickstart: Install the Google Cloud CLI  \|  Google Cloud CLI Documentation](https://cloud.google.com/sdk/docs/install-sdk)

ex: homebrew

```bash
brew install --cask google-cloud-sdk
```

2. Sign up and log in to Google Cloud

```bash
gcloud auth login
```

## Deploy

By default, the runtime starts your application by running node server.js. If you specify a start script in your package.json file, the runtime runs the specified start script instead.

[Application startup - Google Cloud](https://cloud.google.com/appengine/docs/standard/nodejs/runtime#application_startup)

After the build is complete, deploy to the Google App Engine environment.

```bash
npm run build
```

```bash
gcloud app deploy
```

Preview:

```bash
$ gcloud app browse --service remix-app
```

## Settings

Deployment settings can be changed in `app.yaml` file. Please refer to the following for detailed options.

[app\.yaml Configuration File  \|  App Engine standard environment for Node\.js docs  \|  Google Cloud](https://cloud.google.com/appengine/docs/standard/nodejs/config/appref)

## Related Links

- [App Engine Application Platform  \|  Google Cloud](https://cloud.google.com/appengine)
- [Google App Engine standard environment docs  \|  Google Cloud](https://cloud.google.com/appengine/docs/standard?hl=en)
- [Cloud SDK \- Libraries and Command Line Tools  \|  Google Cloud](https://cloud.google.com/sdk)
