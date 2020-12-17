---
title: Installing Remix
description: Get started with Remix, first step is installing.
---

Welcome to Remix! Thank you so much for supporting us. We'll get you up and running in a few minutes.

If you run into any trouble, ask for help through one of the support channels.

## Cloning the starter project

For this tutorial we'll be using our express starter repo. We have other starters we're working on (firebase, vercel, architect, etc.) Remix does not depend on express, once we've got more starters, you'll be able to pick whatever hosting service provider you want.

```bash
# depending on how you're machine is set up with github

# can do this:
$ git clone git@github.com:remix-run/starter-express.git my-remix-app

# or this
$ git clone https://github.com/remix-run/starter-express.git my-remix-app

cd my-remix-app
```

**TypeScript Note**

This project uses TypeScript, we encourage you to learn it if you haven't tried it yet. We keep the types very basic. If you really don't want to use TypeScript, there is `no-typescript` branch you can use. When following along, just skip the types we add here :)

```bash
git checkout no-typescript
```

## Edit `.npmrc`

In order for yarn/npm on your computer to be able to install Remix, you need to add your license key to the npmrc. You'll find it on the [dashboard](/dashboard).

It should look something like this:

```
//npm.remix.run/:_authToken=<your token>
@remix-run:registry=https://npm.remix.run
```

The first line allows npm to authenicate you with our npm registry when installing packages and the second line tells npm to use our registry whenever you are installing something with the npm scope `@remix-run`.

You can also add those lines to your home directory npmrc at `~/.npmrc`, then all of your remix projects don't need their own npmrc.

## Start the development server

```bash
$ npm install
$ npm run dev
```

Now open up your browser to [http://localhost:3000](http://localhost:3000) and you should see the hello world page!

## Two processes

We're using a tool called concurrently in package.json to run two processes in the same window with `npm run dev`, but sometimes it's nice to split them out. In the first tab do:

```bash
$ remix run
```

This starts the development asset server. Then in another tab run

```bash
$ nodemon server.js
```

**Note**: Remix does not require two processes in production, just Development. Because Remix doesn't own your stack, we fit into your exist server, whether that's express or an AWS stack with lambdas. `remix run` is just a development asset server for the browser. In production those files will be built and deployed to your static asset server or CDN.

Alright, let's make some routes!

---

[Next up: Defining Routes](/dashboard/docs/tutorial/defining-routes)
