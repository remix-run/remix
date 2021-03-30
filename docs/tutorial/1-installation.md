---
title: Installing Remix
description: Get started with Remix, first step is installing.
order: 1
---

Welcome to Remix! Thank you so much for supporting us. We'll get you up and running in a few minutes.

If you run into any trouble, ask for help through one of the [support channels](/dashboard/support).

## Cloning a starter project

Remix isn't a full web server, it's just a function that can run on any web server where JavaScript runs. In production you only deploy two things:

- An http request handler on your server of choice
- Static assets to the server or CDN

We have three starter repositories right now and plan to add more, so take your pick:

- [Express](https://github.com/remix-run/starter-express)
- [Vercel](https://github.com/remix-run/starter-vercel)
- AWS API Gateway via [Architect](https://github.com/remix-run/starter-vercel)

For this tutorial we'll be using our express starter repo since it doesn't require an account anywhere. Note that Remix does not depend on express, express is simply our server that we'll attach the Remix request handler to. If you picked another starter, make sure you check out the README to get it running.

```bash
# depending on how you're machine is set up with github

# can do this:
$ git clone git@github.com:remix-run/starter-express.git my-remix-app

# or this
$ git clone https://github.com/remix-run/starter-express.git my-remix-app

cd my-remix-app
```

**TypeScript Note**

Our starters use TypeScript, we encourage you to learn it if you haven't tried it yet. We keep the types very basic in this tutorial. If you really don't want to use TypeScript there is a [branch in the express repo without TypeScript](https://github.com/remix-run/starter-express/tree/no-typescript), you can use that.

## Edit `.npmrc`

In order for npm (or yarn) to be able to install Remix, you need to add your license key to the `.npmrc` configuration. You'll find it on the [dashboard](/dashboard).

It should look something like this:

```bash
//npm.remix.run/:_authToken=<your token>
@remix-run:registry=https://npm.remix.run
```

The first line allows npm to authenticate you with our npm registry when installing packages and the second line tells npm to use our registry whenever you are installing something with the npm scope `@remix-run`.

You can also add those lines to your home directory `~/.npmrc`, then all of your Remix projects don't need their own `.npmrc` file.

### Environment variable for NPM tokens

A lot our customers like to use an environment variable for their token. You can export it from your bash profile and/or set it up on your CI.

```bash
//npm.remix.run/:_authToken=${REMIX_REGISTRY_TOKEN}
@remix-run:registry=https://npm.remix.run
```

This way you can share a repo with other people who have a remix license without commiting it to the source code.

## Start the development server

Depending on the starter template you used, the step here can be a little different. Refer to the README.md in your project for more specific instructions on how to start the dev server and which port it will be running on.

If you're using the express starter, you'll do this:

```bash
$ npm install
$ npm run dev
```

Now open up your browser to [http://localhost:3000](http://localhost:3000) and you should see the hello world page!

**Note**: We're using pm2-dev in package.json to run two processes in the same window with `npm run dev`. Remix does not require two processes in production, just development. If you look in `pm2.config.js` we're calling `remix run`. It's just a file watcher to rebuild the Remix assets. In production those files will be built and deployed to your static asset server or CDN. The other process is the app server which Remix doesn't own. It could be express, or vercel, or arc, etc.
