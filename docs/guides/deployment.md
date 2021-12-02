---
title: Deployment
toc: false
---

# Deployment

Remix maintains a few starter templates to help you deploy to various servers right from the start. You should be able to initialize your app and get it live within a couple of minutes.

Running `npx create-remix` will prompt you to pick a deployment target:

```sh
npx create-remix@latest
? Where do you want to deploy? (Use arrow keys)
❯ Remix App Server
  Architect
  Cloudflare Workers
  Fly.io
  Netlify
  Vercel
```

Each target has unique file structures, configuration files, cli commands that need to be run, server environment variables to be set etc. Because of this, it's important to read the README.md to deploy the app. It's got all of the steps you need to take to get your app live within minutes.

<docs-info>After initializing an app, make sure to read the README.md</docs-info>

Additionally, Remix doesn't abstract over your infrastructure, so the templates don't hide anything about where you're deploying to (you may want other functions besides the Remix app!). You're welcome to tweak the configuration to suit your needs. Remix runs on your server, but it is not your server.

In a nutshell: if you want to deploy your app, Read the manual 😋
