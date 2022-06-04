---
title: Remix Stacks
description: The quickest way to get rocking and rolling with Remix
order: 3
---

# Remix Stacks

Remix Stacks is a feature of the Remix CLI that allows you to generate a Remix project quickly and easily. There are several built-in and official stacks that are full blown applications. You can also make your own (read more below).

[Read the feature announcement blog post](/blog/remix-stacks) and [watch Remix Stacks videos on YouTube](https://www.youtube.com/playlist?list=PLXoynULbYuEC8-gJCqyXo94RufAvSA6R3).

The built-in official stacks come ready with common things you need for a production application including:

- Database
- Automatic deployment pipelines
- Authentication
- Testing
- Linting/Formatting/TypeScript

What you're left with is everything completely set up for you to just get to work building whatever amazing web experience you want to build with Remix. Here are the built-in official stacks:

- [The Blues Stack](https://github.com/remix-run/blues-stack): Deployed to the edge (distributed) with a long-running Node.js server and PostgreSQL database. Intended for large and fast production-grade applications serving millions of users.
- [The Indie Stack](https://github.com/remix-run/indie-stack): Deployed to a long-running Node.js server with a persistent SQLite database. This stack is great for websites with dynamic data that you control (blogs, marketing, content sites). It's also a perfect, low-complexity bootstrap for MVPs, prototypes, and proof-of-concepts that can later be updated to the Blues stack easily.
- [The Grunge Stack](https://github.com/remix-run/grunge-stack): Deployed to a serverless function running Node.js with DynamoDB for persistence. Intended for folks who want to deploy a production-grade application on AWS infrastructure serving millions of users.

Yes, these are named after music genres. 🤘 Rock on.

There will be more stacks available in the future. And you can make your own (and we strongly encourage it)!

## Custom Stacks

The Remix CLI will help you get started with one of these built-in stacks, but if you want, you can create your own stack and the Remix CLI will help you get started with that stack. There are several ways to do this, but the most straightforward is to create a GitHub repo:

```
npx create-remix@latest --template my-username/my-repo
```

Custom stacks give an enormous amount of power and flexibility and we hope you create your own that suites the preferences of you and your organization (feel free to fork ours!).

<docs-success>Yes, we do recommend that you name your own stack after a music sub-genre (not "rock" but "indie"!). In the future, we will have a page where you can list your open source stacks for others to learn and discover. For now, please add the <a href="https://github.com/topics/remix-stack"><code>remix-stack</code></a> tag to your repo!</docs-success>

### `--template`

The template option can be any of the following values:

- The name of a stack in the remix-run GH org (e.g. `blues-stack`)
- A GH username/repo combo (e.g. `mcansh/snkrs`)
- A file path to a directory on disk (e.g. `/my/remix-stack`)
- A path to a tarball on disk (e.g. `/my/remix-stack.tar.gz`)
- A URL to a tarball (e.g. `https://example.com/remix-stack.tar.gz`)
- A file URL (e.g. `file:///Users/michael/remix-stack.tar.gz`)

Additionally, if your stack is in a private GitHub repo, you can set a GitHub token in the `GITHUB_TOKEN` environment variable:

```
GITHUB_TOKEN=yourtoken npx create-remix@latest --template your-private/repo
```

The [token just needs `repo` access][repo access token].

### Custom Template Tips

#### Dependency versions

If you set the any dependencies in package.json to `*`, the Remix CLI will change it to a semver caret of the latest released version:

```diff
-   "remix": "*",
+   "remix": "^1.2.3",
```

This allows you to not have to regularly update your template to the latest version of that specific package. Of course you do not have to put `*` if you'd prefer to manually manage the version for that package.

#### Customize Initialization

If the template has a `remix.init/index.js` file at the root then that file will be executed after the project has been generated and dependencies have been installed. This gives you a chance to do anything you'd like as part of the initialization of your template. For example, in the blues stack, the `app` property has to be globally unique so we use the `remix.init/index.js` file to change it to the name of the directory that was created for the project + a couple random characters.

You could even use `remix.init/index.js` to ask further questions of the developer for additional configuration (using something like [inquirer][inquirer]). Of course, sometimes you'll need dependencies installed to do this, but those deps are only useful during initialization. So, you can also create a `remix.init/package.json` with dependencies and the Remix CLI will install those dependencies before running your script.

After the init script has been run, it is deleted so you don't need to worry about it cluttering up the finished codebase.

#### Remove TypeScript

If there's a `tsconfig.json` file in the root of the project, the Remix CLI will ask whether the user wants the TypeScript automatically removed from the template. We don't recommend this, but some folks just really want to write regular JavaScript.

[repo access token]: https://github.com/settings/tokens/new?description=Remix%20Private%20Stack%20Access&scopes=repo
[inquirer]: https://npm.im/inquirer
