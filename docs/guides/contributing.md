---
title: Contributing
description: Thank you for contributing to Remix! Here's everything you need to know before you open a pull request.
---

# Contributing to Remix

Our goal is for Remix development to be steady, stable, and open. We can't do that without our wonderful community of users!

This document will familiarize you with our development process as well as how to get your environment set up.

**To ensure your work has the best chance of being accepted, please read this before contributing anything!**

## Contributor License Agreement

All contributors sending a Pull Request need to sign the Contributor License Agreement (CLA) that explicitly assigns ownership of the contribution to us.

When you start a pull request, the remix-cla-bot will prompt you to review the CLA and sign it by adding your name to [contributors.yml][contributors_yaml]

[Read the CLA][cla]

## Roles

This document refers to contributors with the following roles:

- **Admins**: GitHub organization team with admin rights, they set and manage the Roadmap.
- **Collaborators**: GitHub organization team with write access. They manage issues, PRs, discussion, etc.
- **Contributors**: you!

---

## Development Process

### Feature Development

If you have an idea for a new feature, please don't send a Pull Request, but follow this process instead:

1. Contributors add a **Proposal** to [GitHub Discussions][proposals].
2. The Remix **Admin Team** accepts Proposals in the **Roadmap Planning** meeting.
   - Proposals are accepted when the Admins create an **Issue** from the Proposal and add the issue to the [**Roadmap**][roadmap].
3. The Admins assign an **Owner** to the issue.
   - Owners are responsible for shipping the feature including all decisions for APIs, behavior, and implementation.
   - Owners organize the work with other contributors for larger issues.
   - Owners may be contributors from inside or outside the Remix team.
4. Owners create an **RFC** from the Proposal and development can begin.
5. Pairing is highly encouraged, particularly at the start.

### Bug-Fix Pull Requests

If you think you've found a bug we'd love a PR that fixes it! Please follow these guidelines:

1. Contributors add a failing test along with the fix in a Pull Request
   - It's ideal if the first commit is a failing test followed by the changes to the code that fix it.
   - This is not strictly enforced but very appreciated!
2. The Admins will review open bugfix PRs as part of Roadmap Planning.
   - Simple bugfixes will be merged on the spot.
   - Others will be added to the Roadmap and assigned an Owner to review the work and get it over the finish line.

Bug fix PRs without a test case might be closed immediately (some things are hard to test, we’ll use discretion here)

### Bug Report Issues

If you think you've found a bug but don't have the time to send a PR, please follow these guidelines:

1. Create a minimal reproduction of the issue somewhere like Stackblitz, Replit, CodeSandbox, etc. that we can visit and observe the bug:

   - [https://remix.new][https_remix_new] makes this really easy

2. If this is not possible (related to some hosting setup, etc.) please create a GitHub repo that we can run with clear instructions in the README to observe the bug.

3. Open an issue and link to the reproduction.

Bug reports without a reproduction will be immediately closed asking for a reproduction.

### Roadmap Planning Meeting

You can always check in on Remix development in our live-streamed planning meeting:

- The Remix Admin team will meet weekly to report progress to the community and add Proposals and Verified Bugs to the Roadmap.
  - Unanimous agreement among the Remix Admin is required to add a Proposal to the Roadmap.
  - Proposals are not “rejected”, only “accepted” onto the Roadmap.
  - Contributors can continue to up-vote and comment on Proposals, they will bubble up for a future review if it’s getting new activity.
  - The Remix Admin team may lock Proposals for any reason.
- The meeting will be livestreamed on the [Remix YouTube channel][youtube].
  - Everyone is invited to the [Discord][discord] `#roadmap-livestream-chat` while the meeting is in progress.
  - Remix Collaborators are invited to attend.

### Issue Tracking

If a Roadmap Issue is expected to be large (involving multiple tasks, authors, PRs, etc.) a temporary project board will be created by the Admin team.

- The original issue will remain on the Roadmap project to see general progress.
- The subtasks will be tracked on the temporary project.
- When the work is complete, the temporary project will be archived.
- The Owner is responsible for populating the subproject with issues and splitting the work up into shippable chunks of work.
- Build / feature flags are encouraged over long-running branches.

### RFCs

- All Issues that are planned must have an RFC posted in the Official RFCs Discussion category before the Issue moves from _Planned_ to _In Progress_.
- Some Proposals may already be a sufficient RFC and can simply be moved to the Official RFCs Discussion category.
- Once the RFC is posted, development can begin, though Owners are expected to consider the community's feedback to alter their direction when needed.

### Support for Owners

- Owners will be added to the `#collaborators` private channel on [Discord][discord] to get help with architecture and implementation. This channel is private to help keep noise to a minimum so Admins don't miss messages and owners can get unblocked. Owners can also discuss these questions in any channel or anywhere!
- Admins will actively work with owners to ensure their issues and projects are organized (correct status, links to related issues, etc.), documented, and moving forward.
- An issue's Owner may be reassigned if progress is stagnating.

### Weekly Roadmap Reviews

Once a week, the Remix team and any external **Owners** are invited to review the Roadmap

- Identify blockers
- Find pairing opportunities within the team and the community

### Collaborator's Role

To help keep the repositories clean and organized, Collaborators will take the following actions:

### Issues Tab

- Bug reports without a reproduction will be immediately closed asking for a reproduction.
- Issues that should be proposals will be converted to a Proposal.
- Questions will be converted to a **Q\&A Discussion**.
- Issues with valid reproduction will be labeled as **Verified Bugs** and added to the Roadmap by the Admins in the Roadmap Planning Meeting.

### Pull Requests Tab

- Features that did not go through the **Development Process** will be immediately closed and asked to open a discussion instead.
- Bug fix PRs without a test case might be closed immediately asking for a test. (Some things are hard to test, Collaborators will use discretion here.)

---

## Development Setup

Before you can contribute to the codebase, you will need to fork the repo. This will look a bit different depending on what type of contribution you are making:

The following steps will get you set up to contribute changes to this repo:

1. Fork the repo (click the <kbd>Fork</kbd> button at the top right of [this page][fork]).

2. Clone your fork locally.

   ```shellscript nonumber
   # in a terminal, cd to parent directory where you want your clone to be, then
   git clone https://github.com/<your_github_username>/remix.git
   cd remix

   # if you are making *any* code changes, make sure to checkout the dev branch
   git checkout dev
   ```

3. Install dependencies by running `pnpm`. If you install using `npm`, unnecessary `package-lock.json` files will be generated.

4. Install Playwright to be able to run tests properly by running `npx playwright install`, or [use the Visual Studio Code plugin][vscode_playwright].

5. Verify you've got everything set up for local development by running `pnpm test`.

### Branches

**Important:** When creating the PR in GitHub, make sure that you set the base to the correct branch.

- **`dev`** is for changes to code.
- **`main`**: is for changes to documentation and some templates.

You can set the base in GitHub when authoring the PR with the dropdown below the "Compare changes" heading:

<img src="https://raw.githubusercontent.com/remix-run/react-router/main/static/base-branch.png" alt="" width="460" height="350" />

### Tests

We use a mix of `jest` and `playwright` for our testing in this project. We have a suite of integration tests in the integration folder and packages have their own jest configuration, which are then referenced by the primary jest config in the root of the project.

The integration tests and the primary tests can be run in parallel using `npm-run-all` to make the tests run as quickly and efficiently as possible. To run these two sets of tests independently you'll need to run the individual script:

- `pnpm test:primary`
- `pnpm test:integration`

We also support watch plugins for project, file, and test filtering. To filter things down, you can use a combination of `--testNamePattern`, `--testPathPattern`, and `--selectProjects`. For example:

```shellscript nonumber
pnpm test:primary --selectProjects react --testPathPattern transition --testNamePattern "initial values"
```

We also have watch mode plugins for these. So, you can run `pnpm test:primary --watch` and hit `w` to see the available watch commands.

Alternatively, you can run a project completely independently by `cd`-ing into that project and running `pnpm jest` which will pick up that project's jest config.

## Development Workflow

### Packages

Remix uses a monorepo to host code for multiple packages. These packages live in the `packages` directory.

We use [pnpm workspaces][pnpm_workspaces] to manage installation of dependencies and running various scripts. To get everything installed run `pnpm install` from the repo root.

### Building

Running `pnpm build` from the root directory will run the build. You can run the build in watch mode with `pnpm watch`.

### Playground

It's often really useful to be able to interact with a real app while developing features for apps. So you can place an app in the `playground` directory and the build process will automatically copy all the output to the `node_modules` of all the apps in the `playground` directory for you. It will even trigger a live reload event for you!

To generate a new playground, simply run:

```shellscript nonumber
pnpm playground:new <?name>
```

Where the name of the playground is optional and defaults to `playground-${Date.now()}`. Then you can `cd` into the directory that's generated for you and run `npm run dev`. In another terminal window have `pnpm watch` running, and you're ready to work on whatever Remix features you like with live reload magic 🧙‍♂️

The playground generated from `pnpm playground:new` is based on a template in `scripts/playground/template`. If you'd like to change anything about the template, you can create a custom one in `scripts/playground/template.local` which is `.gitignored` so you can customize it to your heart's content.

### Testing

Before running the tests, you need to run a build. After you build, running `pnpm test` from the root directory will run **every** package's tests. If you want to run tests for a specific package, use `pnpm test --selectProjects <display-name>`:

```shellscript nonumber
# Test all packages
pnpm test

# Test only @remix-run/express
pnpm test --selectProjects express
```

## Repository Branching

This repo maintains separate branches for different purposes. They will look something like this:

```
- main   > the most recent release and current docs
- dev    > code under active development between stable releases
```

There may be other branches for various features and experimentation, but all the magic happens from these branches.

## How do nightly releases work?

Nightly releases will run the action files from the `main` branch as scheduled workflows will always use the latest commit to the default branch, signified by [this comment on the nightly action file][nightly_action_comment], however they check out the `dev` branch during their setup as that's where we want our nightly releases to be cut from. From there, we check if the git SHA is the same and only cut a new nightly if something has changed.

## End-to-end testing

For every release of Remix (stable, experimental, nightly, and pre-releases), we will do a complete end-to-end test of Remix apps on each of our official adapters from `create-remix`, all the way to deploying them to production. We do this by utilizing the default [templates][templates] and the CLIs for Fly, and Arc. We'll then run some simple Cypress assertions to make sure everything is running properly for both development and the deployed app.

[proposals]: https://github.com/remix-run/remix/discussions/categories/proposals
[roadmap]: https://github.com/orgs/remix-run/projects/5
[youtube]: https://www.youtube.com/@Remix-Run/streams
[discord]: https://rmx.as/discord
[contributors_yaml]: https://github.com/remix-run/remix/blob/main/contributors.yml
[cla]: https://github.com/remix-run/remix/blob/main/CLA.md
[fork]: https://github.com/remix-run/remix
[pnpm_workspaces]: https://pnpm.io/workspaces
[vscode_playwright]: https://playwright.dev/docs/intro#using-the-vs-code-extension
[nightly_action_comment]: https://github.com/remix-run/remix/blob/main/.github/workflows/nightly.yml#L8-L12
[templates]: ./templates
[https_remix_new]: https://remix.new
