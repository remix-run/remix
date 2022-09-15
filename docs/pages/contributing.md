---
title: Contributing
description: Thank you for contributing to Remix! Here's everything you need to know before you open a pull request.
order: 6
toc: false
---

# Contributing to Remix

Thanks for contributing, you rock!

When it comes to open source, there are many different kinds of contributions that can be made, all of which are valuable. Here are a few guidelines that should help you as you prepare your contribution.

## Contributor License Agreement

If you'd like to contribute something—whether it's a bug fix to scratch your own itch or a typo in the docs—we'd be happy to have your contribution. We need you to "sign" a contributor license agreement (CLA) first that assigns us ownership so we are able to include it in this software.

When you start a pull request, the remix-cla-bot will prompt you to review the [CLA][cla] and sign it by adding your name to `contributors.yml`.

## Setup

Before you can contribute to the codebase, you will need to fork the repo. This will look a bit different depending on what type of contribution you are making:

- All new features, bug-fixes, or **anything that touches `remix` code** should be branched off of and merged into the `dev` branch
- Changes that only touch templates or documentation can be branched off of and merged into the `main` branch

The following steps will get you setup to contribute changes to this repo:

1. Fork the repo (click the <kbd>Fork</kbd> button at the top right of [this page][this-page])

2. Clone your fork locally

   ```bash
   # in a terminal, cd to parent directory where you want your clone to be, then
   git clone https://github.com/<your_github_username>/remix.git
   cd remix

   # if you are making *any* code changes, make sure to checkout the dev branch
   git checkout dev
   ```

3. Install dependencies by running `yarn`. Remix uses [Yarn (version 1)][yarn-version-1], so you should too. If you install using `npm`, unnecessary `package-lock.json` files will be generated.

4. Install Playwright to be able to run tests properly by running `npx playwright install`, or [use the Visual Studio Code plugin][vscode-playwright]

5. Verify you've got everything set up for local development by running `yarn test`

## Think You Found a Bug?

Please send a PR with a failing test. There are instructions in [`integration/bug-report-test.ts`][integration-bug-report-test-ts]

## Proposing New or Changed API?

Before you put in the work to add your feature and send a pull request, please open a GitHub Discussion so we can get on the same page and give a thumbs up or thumbs down on it. We'd hate for you to spend a bunch of time on something we ultimately don't want to add to Remix!

But hey, who are we to tell you how to spend your time? Go ahead and build the feature if you want if it helps the discussion, but please don't be upset if we don't end up merging it :)

## Issue Not Getting Attention?

If you need a bug fixed and nobody is fixing it, your best bet is to provide a fix for it and make a [pull request][pull-request]. Open source code belongs to all of us, and it's all of our responsibility to push it forward.

## Making a Pull Request?

> **Important:** When creating the PR in GitHub, make sure that you set the base to the correct branch. If you are submitting a PR that touches any code, this should be the `dev` branch. Pull requests that only change documentation can be merged into `main`.
>
> You can set the base in GitHub when authoring the PR with the dropdown below the "Compare changes" heading:
>
> <img src="https://raw.githubusercontent.com/remix-run/react-router/main/static/base-branch.png" alt="" width="460" height="350" />

### Tests

All commits that fix bugs or add features need a test.

`<blink>`Do not merge code without tests!`</blink>`

We use a mix of `jest` and `playwright` for our testing in this project. We have a suite of integration tests in the integration folder and packages have their own jest configuration, which are then referenced by the primary jest config in the root of the project.

The integration tests, and the primary tests can be run in parallel using `npm-run-all` to make the tests run as quickly and efficiently as possible. To run these two sets of tests independently you'll need to run the individual script:

- `yarn test:primary`
- `yarn test:integration`

We also support watch plugins for project, file, and test filtering. To filter things down, you can use a combination of `--testNamePattern`, `--testPathPattern`, and `--selectProjects`. For example:

```
yarn test:primary --selectProjects react --testPathPattern transition --testNamePattern "initial values"
```

We also have watch mode plugins for these. So, you can run `yarn test:primary --watch` and hit `w` to see the available watch commands.

Alternatively, you can run a project completely independently by `cd`-ing into that project and running `yarn jest` which will pick up that project's jest config.

### Docs + Examples

All commits that change or add to the API must be done in a pull request that also updates all relevant examples and docs.

## Development

### Packages

Remix uses a monorepo to host code for multiple packages. These packages live in the `packages` directory.

We use [Yarn workspaces][yarn-workspaces] to manage installation of dependencies and running various scripts. To get everything installed, make sure you have [Yarn (version 1) installed][yarn-version-1], and then run `yarn` or `yarn install` from the repo root.

### Building

Running `yarn build` from the root directory will run the build. You can run the build in watch mode with `yarn watch`.

### Playground

It's often really useful to be able to interact with a real app while developing features for apps. So you can place an app in the `playground` directory and the build process will automatically copy all the output to the `node_modules` of all the apps in the `playground` directory for you. It will even trigger a live reload event for you!

To generate a new playground, simply run:

```sh
yarn playground:new <?name>
```

Where the name of the playground is optional and defaults to `playground-${Date.now()}`. Then you can `cd` into the directory that's generated for you and run `npm run dev`. In another terminal window have `yarn watch` running and you're ready to work on whatever Remix features you like with live reload magic 🧙‍♂️

The playground generated from `yarn playground:new` is based on a template in `scripts/playground/template`. If you'd like to change anything about the template, you can create a custom one in `scripts/playground/template.local` which is `.gitignored` so you can customize it to your heart's content.

### Testing

Before running the tests, you need to run a build. After you build, running `yarn test` from the root directory will run **every** package's tests. If you want to run tests for a specific package, use `yarn test --selectProjects <display-name>`:

```bash
# Test all packages
yarn test

# Test only @remix-run/express
yarn test --selectProjects express
```

## Repository Branching

This repo maintains separate branches for different purposes. They will look something like this:

```
- main   > the most recent release and current docs
- dev    > code under active development between stable releases
```

There may be other branches for various features and experimentation, but all of the magic happens from these branches.

## How the heck do nightly releases work?

Nightly releases will run the action files from the `main` branch as scheduled workflows will always use the latest commit to the default branch, signified by [this comment on the nightly action file][nightly-action-comment] and the explicit branch appended to the reuasable workflows in the [postrelease action][postrelease-action], however they checkout the `dev` branch during their set up as that's where we want our nightly releases to be cut from. From there, we check if the git sha is the same and only cut a new nightly if something has changed.

## End to end testing

For every release of Remix (stable, experimental, nightly, and pre-releases), we will do a complete end-to-end test of Remix apps on each of our official adapters from `create-remix`, all the way to deploying them to production. We do this by by utilizing the default [templates][templates] and the CLIs for Fly, Vercel, Netlify, and Arc. We'll then run some simple Cypress assertions to make sure everything is running properly for both development and the deployed app.

[cla]: https://github.com/remix-run/remix/blob/main/CLA.md
[this-page]: https://github.com/remix-run/remix
[yarn-version-1]: https://classic.yarnpkg.com/lang/en/docs/install
[integration-bug-report-test-ts]: https://github.com/remix-run/remix/blob/dev/integration/bug-report-test.ts
[pull-request]: https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request
[yarn-workspaces]: https://classic.yarnpkg.com/en/docs/workspaces
[vscode-playwright]: https://playwright.dev/docs/intro#using-the-vs-code-extension
[nightly-action-comment]: https://github.com/remix-run/remix/blob/main/.github/workflows/nightly.yml#L8-L12
[postrelease-action]: https://github.com/remix-run/remix/blob/main/.github/workflows/postrelease.yml
[templates]: /templates
