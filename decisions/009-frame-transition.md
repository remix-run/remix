# Wrap the top frame's swap with a `frameTransition` callback on `run()`

We chose a `frameTransition` option on `run()` that receives each top-frame navigation after its response is in hand and decides when the new page is swapped in. Apps use it to wrap the swap in `document.startViewTransition()`. Remix does not start view transitions itself.

Top-frame navigations render the response into the current document, so cross-document view transitions never run. Before this option, an app could only reach the moment between the response and the swap by replacing `resolveFrame`, which meant copying `defaultResolveFrame()` (request headers, body encoding, failure rules, nonce handling) and re-checking the copy after every release.

## What we tried first

[#11656](https://github.com/remix-run/remix/issues/11656) asked for view transitions on soft navigations. [#11754](https://github.com/remix-run/remix/pull/11754) added `data-rmx-view-transition` and a `viewTransition` option on `navigate()`, and was closed unmerged in favor of `document.startViewTransition(() => navigate(href))` from a delegated click handler, to be revisited if that needed a first-class solution. The maintainer also floated "a top level flag on `run`".

The click-handler workaround covers only link clicks that the app intercepts. It does not cover Back and Forward, which are the navigations most worth animating. It also starts the view transition before the request: the browser pauses rendering from the moment it captures the old page until the update callback settles, so a slow response freezes the old page, and the app cannot show its own progress UI while it loads.

## Why a callback and not a boolean

A top-level option on `run()` is the shape suggested in #11656, and `frameTransition` is one. A boolean that makes Remix call `startViewTransition()` itself was the alternative, and it would be the smallest API. We did not choose it because the parts an app needs to control are not decidable by Remix:

- Which navigations animate. A listing-to-product navigation morphs one image, and a sign-in redirect should not animate.
- Which elements get a `view-transition-name`, and when. Names must be unique at capture time, so an app that lists a product twice has to pick one card per navigation, and has to do it before the old state is captured.
- Direction. Back and Forward need opposite animations, and the callback can read the destination history entry.
- What to wait for before the new state is captured, such as decoding the destination's first image.

View transition types on `startViewTransition()` could cover direction in CSS, but not per-navigation element naming or waiting, so a boolean would leave apps with the same copied resolver.

## The contract

`frameTransition({ transition, to, signal, commit })`. Each field exists because the app cannot get it reliably elsewhere:

- `commit()` is the point of the option. It starts the swap, and resolves when the navigation has finished (scroll and focus restoration included) or is cancelled or superseded. That is the promise a view transition's update callback needs. Remix does not wait for the callback after the swap has started, because the navigation only finishes after the swap, and a callback awaiting `viewTransition.finished` would otherwise deadlock the navigation it waits on.
- `signal` aborts when the navigation is cancelled or superseded, so the callback can call `skipTransition()`.
- `to` is the destination after redirects. `navigation.currentEntry` shows the requested URL, not the redirected one.
- `transition` is the platform's `NavigationTransition`, which carries the entry being left (`from.url`, `from.index`, `from.key`) and `navigationType`. We pass it instead of copying `from`, `type` and a computed `direction` into new fields. Back versus Forward is a comparison of two indexes the app can make, and an app that keys state per history entry needs the entries anyway.

## Behavior

- The callback runs after the response is in hand, so the old page stays interactive and the app's own progress UI keeps working while a slow response loads.
- It runs for top-frame GET navigations handled by the Navigation API: links, GET forms, `navigate()`, Back, Forward and reload. POST form submissions, named frames, `frame.reload()` and `popstate` fallbacks swap as before.
- If the callback returns or throws without calling `commit()`, Remix swaps anyway, and reports a thrown error as a component error. A faulty callback never holds a navigation back. A callback that never settles holds it until it is cancelled or superseded.
- Remix does not read `prefers-reduced-motion`. The callback runs either way, so an app can still cross-fade.
- `transition.from` is whatever entry the browser is leaving. A push commits its entry before the response arrives, so a navigation that interrupts one whose page never rendered leaves that entry, not the page on screen, and the browser replaces it ([#12240](https://github.com/remix-run/remix/pull/12240)). Passing the platform object keeps that visible rather than inventing a `from` Remix cannot yet compute; committing GET navigations only once the response arrives would fix it at the source.

## Relation to other runtime work

- A frame navigation object ([#12051](https://github.com/remix-run/remix/pull/12051)) describes the navigation Remix is handling: `url` after redirects, `type`, `target`, `submission`, `signal`. `frameTransition` overlaps with it on `to` and `signal` but needs the entry being left and its index, which only the platform transition carries. The two can converge later by adding that object to `FrameTransitionOptions` without changing `commit()` or `transition`.
- `run()` options are functions, and declarative switches live on elements such as `<Frame prefetch>` ([#12239](https://github.com/remix-run/remix/pull/12239)). `frameTransition` follows that: a function, no config object, and a `viewTransition: true` switch is deferred until the same callback body repeats across apps.
- Reload metadata that resolvers must not see travels in `FrameNavigationOptions` and is stripped before `resolveFrame` ([#12183](https://github.com/remix-run/remix/pull/12183) adds `element`, `submitter` and `form` the same way `transition` is added here).
- The hook is wired per runtime, through `createFrame()`'s init and the navigation listener's top-frame check, so a runtime that owns its own frames ([#12245](https://github.com/remix-run/remix/pull/12245)) wraps only its own top frame.
- A thrown callback error is dispatched on the runtime's error target with `createComponentErrorEvent()`, the path every other runtime error takes ([#12242](https://github.com/remix-run/remix/pull/12242)).

## When to revisit

1. If most apps write the same twelve lines around `startViewTransition()`, a `viewTransition: true` shorthand can be added next to `frameTransition` without changing it.
2. If frames other than the top frame need transitions, `commit()` and `signal` generalize, and `transition` would need a different source.
3. If the Navigation API gains a way to run an update callback inside its own transition, `commit()` may reduce to that.
