# Preserve the 2024 browser baseline with capability-based navigation

We chose a practical browser baseline of Chrome and Edge 123, Firefox 125, and Safari and iOS Safari 17.5. Rendering, hydration, and interactive UI should work at that baseline. Frame-aware client navigation is an enhancement with a separate capability check.

This records the August–September 2026 browser-support investigation and the decision shipped in [PR #11820][navigation-pr]. The original investigation covered the client runtime then housed in `packages/ui`, `spa`, `fetch-router`, and `route-pattern`. The rendering and navigation runtime now lives in `packages/component`; `packages/ui` contains the headless primitives. This is a compatibility target, not a claim that every package and feature has been tested in these browser versions.

## The baseline and its original constraints

| Browser             | Minimum version | Release date   | Original binding feature |
| ------------------- | --------------- | -------------- | ------------------------ |
| Chrome              | 123             | March 19, 2024 | CSS `light-dark()`       |
| Edge                | 123             | March 22, 2024 | CSS `light-dark()`       |
| Firefox             | 125             | April 16, 2024 | Popover API              |
| Safari / iOS Safari | 17.5            | May 13, 2024   | CSS `light-dark()`       |

The shared release-date floor is May 13, 2024. The table describes specific minimum versions, not a rolling “last two versions” policy. The [merged PR][navigation-pr] records the original table; MDN documents [`light-dark()`][light-dark] and the [Popover API][popover]. The binding features explain the original result rather than requiring every package to use those features.

JavaScript syntax, Web APIs, and CSS all count toward compatibility. Lowering the asset server's compilation `target` does not polyfill runtime APIs or transform CSS emitted at runtime by `css()`. A configuration example with an older target is not evidence that the whole framework supports that browser.

## Navigation is an enhancement

Remix installs frame-aware navigation interception only when both `window.navigation` and `NavigateEvent.sourceElement` exist. `getInterceptableNavigation()` in `packages/component/src/runtime/navigation.ts` owns this check. Listener setup and imperative `navigate()` use the same check.

Without those capabilities, links and forms keep native document navigation. Imperative `navigate()` uses `location.assign()` or `location.replace()`. At the Chrome and Edge 123 baseline, rendering and hydration work while navigation goes through the document; frame-aware navigation starts at Chrome and Edge 135. Firefox and Safari gain the enhancement when they expose both capabilities, without browser-name or version checks in Remix.

We considered capturing global click and submit events to recover the source element in older Chromium. [PR #11756][source-capture-pr] explored that approach. Cancellation, activation correlation, and stale-source tracking added complexity to preserve an enhancement on Chrome and Edge 123–134. We chose document navigation instead and retained the independent native `formdata` tracking needed for supported form navigations.

Document fallback assumes the application serves usable destination documents. It does not make a client-only route available on the server.

## Newer features need a compatible path

Use feature detection and graceful degradation wherever possible. Prefer the native implementation when the capability exists. When it is missing, preserve the core interaction with a compatible fallback or omit the optional enhancement. Selecting an unavailable enhancement must not throw or break the underlying interaction. Raising the minimum versions requires an explicit decision and an update to this record.

Multiple import maps are one example. Native support arrives after the baseline. The [browser-entry guide][browser-entry] and template use `remix/multiple-import-maps-polyfill` for module loading and client-entry preloads. Keep that integration when frame responses or HMR introduce new mappings. A custom loader using native `import()` alone must account for the target browsers and whether later import maps are needed. One complete initial import map remains sufficient for modules that need no later mappings.

`Promise.withResolvers()`, `AbortSignal.any()`, constructed stylesheets, and `Array.prototype.toReversed()` are available within the baseline. Their presence alone does not raise it. In particular, `Promise.withResolvers()` is now used by the runtime as well as tests; the old PR's description of its test-only use was specific to that change.

## Compatibility checks

The original follow-up proposed a committed Browserslist baseline, compatibility linting over browser runtime code, and a small smoke suite against pinned browser versions. Those checks were recommendations, not part of PR #11820, and are not implemented in this checkout.

The existing Playwright configuration exercises Chromium, Firefox, and WebKit supplied by the installed Playwright version. It does not pin the historical minimum versions, and Playwright WebKit is not a test of released Safari 17.5. Passing that matrix does not establish conformance to this baseline. Browserslist alone would not enforce compatibility either; API checks and tests must consume the policy.

## When to revisit

1. Deliberately adopting a platform feature without a workable fallback requires a higher baseline.
2. Evidence from supported browsers shows that a capability check or fallback does not preserve the expected behavior.
3. Pinned-browser coverage or compatibility tooling gives us better evidence about these minimum versions.

[navigation-pr]: https://github.com/remix-run/remix/pull/11820
[source-capture-pr]: https://github.com/remix-run/remix/pull/11756
[light-dark]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark
[popover]: https://developer.mozilla.org/en-US/docs/Web/API/Popover_API
[browser-entry]: https://github.com/remix-run/remix/blob/main/docs/site/app/actions/guides/chapters/05-interactivity.md#browser-entry-with-run
