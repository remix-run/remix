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

**We don't yet have a CLA, but we are working on it and we will be able to accept your contributions as soon as we do.** Until then, please keep letting us know about our bugs and typos in Discord and we will do our best to address them.

## Setup

Before you can contribute to the codebase, you will need to fork the repo. This will look a bit different depending on what type of contribution you are making:

- All new features, bug-fixes, or **anything that touches `remix` code** should be branched off of and merged into the `dev` branch
- Changes that only touch documentation can be branched off of and merged into the `main` branch

The following steps will get you setup to contribute changes to this repo:

1. Fork the repo (click the <kbd>Fork</kbd> button at the top right of [this page](https://github.com/remix-run/remix))
2. Clone your fork locally

```bash
# in a terminal, cd to parent directory where you want your clone to be, then
git clone https://github.com/<your_github_username>/remix.git
cd remix

# if you are making *any* code changes, make sure to checkout the dev branch
git checkout dev
```

1. Install dependencies and build. Remix uses [`yarn` (version 1)](https://classic.yarnpkg.com/lang/en/docs/install), so you should too. If you install using `npm`, unnecessary `package-lock.json` files will be generated.

## Think You Found a Bug?

Please conform to the issue template and provide a clear path to reproduction with a code example. Best is a pull request with a failing test. Next best is a link to CodeSandbox or repository that illustrates the bug.

## Proposing New or Changed API?

Please provide thoughtful comments and some sample code that show what you'd like to do with Remix in your app. It helps the conversation if you can show us how you're limited by the current API first before jumping to a conclusion about what needs to be changed and/or added.

## Issue Not Getting Attention?

If you need a bug fixed and nobody is fixing it, your best bet is to provide a fix for it and make a [pull request](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request). Open source code belongs to all of us, and it's all of our responsibility to push it forward.

## Making a Pull Request?

> **Important:** When creating the PR in GitHub, make sure that you set the base to the correct branch. If you are submitting a PR that touches any code, this should be the `dev` branch. Pull releases that only change documentation can be merged into `main`.
>
> You can set the base in GitHub when authoring the PR with the dropdown below the "Compare changes" heading:
>
> <img src="https://raw.githubusercontent.com/remix-run/react-router/main/static/base-branch.png" alt="" width="460" height="350" />

### Tests

All commits that fix bugs or add features need a test.

`<blink>`Do not merge code without tests!`</blink>`

### Docs + Examples

All commits that change or add to the API must be done in a pull request that also updates all relevant examples and docs.

## Development

### Packages

Remix uses a monorepo to host code for multiple packages. These packages live in the `packages` directory.

We use [Yarn workspaces](https://classic.yarnpkg.com/en/docs/workspaces/) to manage installation of dependencies and running various scripts. To get everything installed, make sure you have [Yarn (version 1) installed](https://classic.yarnpkg.com/lang/en/docs/install), and then run `yarn` or `yarn install` from the repo root.

### Building

Running `yarn build` from the root directory will run the build.

### Testing

Before running the tests, you need to run a build. After you build, running `yarn test` from the root directory will run **every** package's tests. If you want to run tests for a specific package, use `yarn test --projects packages/<package-name>`:

```bash
# Test all packages
yarn test

# Test only @remix-run/express
yarn test --projects packages/remix-express
```

## Repository Branching

This repo maintains separate branches for different purposes. They will look something like this:

```
- main   > the most recent release and current docs
- dev    > code under active development between stable releases
```

There may be other branches for various features and experimentation, but all of the magic happens from these branches.
