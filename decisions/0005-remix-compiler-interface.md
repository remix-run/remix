# Remix Compiler interface

Date: 2022-08-03

Status: proposed

## Context

The ethos of Remix is "use the platform", but many popular tools and frameworks 
require compiler-level support for syntax not natively supported by the browser runtime or the server runtime.

Some tools, like Typescript, are ubiquitous.
For these, we think it best to include them as part of the Remix compiler.

But there are a myriad of different CSS frameworks, a handful of different package managers, etc... that require compiler-level integration to fully support their features.

The status quo has been to assess each framework/tool and add plugins to our compiler to support each of the ones that we decide have enough upside to warrant the maintenance burden.
For example, here are PRs for [Yarn PnP support](https://github.com/remix-run/remix/pulls?q=pnp) and [CSS Modules support](https://github.com/remix-run/remix/pulls?q=%22css+modules%22).
But that places Remix releases on the critical path for support and bug fixes for each of these features!
We're already feeling some maintenance pressure from this and we don't users to have to wait for us to review and merge PRs for N different CSS frameworks before we get to the one they are using.

But Remix shouldn't care how you prefer to do CSS nor what package manager you use.
At the end of the day, Remix wants to introduce as few things on top of the platform for excellent DX and UX.
For example, Remix has strong opinions on routing that enables awesome features like loaders fetching in parallel.
But Remix does not want to prescribe your package manager.

## Considered

### Remix as a {vite,esbuild,...} plugin

Other web frameworks have instead ditched the idea of having their own compiler and instead provide plugins for popular compilers like Vite.
The idea is that users would invoke Vite (or their compiler of choice) directly.

As a proof-of-concept, we prototyped Remix plugins for Webpack.
However, Remix requires the server build to have access to the assets manifest produced by the browser build at build-time.

Coordinating the assets manifest handoff is not possible when invoking webpack directly.

### Pluggable compiler

Alternatively, we could open up our esbuild-based compiler for users to add their own esbuild plugins.

In the short term, this sounds great, but we know how this goes in the long term.
Users will add plugins and we'll have to be extremely careful whenever we change our compiler not to conflict with _any_ plugins users may be using.

## Decision

- our compiler's interface is:
  - porcelain/CLI: `build`, `watch` commands
  - plumbing/Node API:
    - `createBrowserCompiler`, `createServerCompiler`
    - from `compiler-kit`: `build`, `watch` functions

the remix build expects web standards: (#useThePlatform)
- e.g. css as stylesheets!

for features that require compiler-support (e.g. custom CSS framework),
run a pre-remix build step.
example: [vanilla extract](https://github.com/remix-run/remix/pull/4173)

## Consequences

- future work: partial build/jit (via cache)
- future work: HMR