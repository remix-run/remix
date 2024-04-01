---
title: Future Flags
order: 5
---

# Gradual Feature Adoption with Future Flags

In our approach to software development, we aim to achieve the following goals for major releases:

1. **Incremental Feature Adoption:** Developers have the flexibility to choose and integrate new features and changes one by one, as they become available in the current major version. This is a departure from the traditional method of bundling all changes into a single new major release.
2. **Seamless Version Upgrades:** By selectively incorporating new features ahead of time, developers can smoothly transition to new major versions without the need to modify their existing application code.

## Unstable APIs and Future Flags

We introduce new features into the current release with a future flag that looks something like `unstable_someFeature`. You can specify these flags in the Remix Vite Plugin `future` option in your [`vite.config.ts`][vite-config-future] file:

```ts filename=vite.config.ts lines=[7-9]
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      future: {
        unstable_someFeature: true,
      },
    }),
  ],
});
```

<docs-info>If you are not yet using Vite, you can provide Future Flags via the [`remix.config.js` `future`][remix-config-future] option</docs-info>

- Once an unstable feature reaches a stable state, we remove the special prefix and include the feature in the next minor release. At this point, the API's structure remains consistent throughout subsequent minor releases.

- This approach allows us to refine the API collaboratively with early adopters, incorporating necessary changes in the unstable phase without affecting all users. The stable releases then benefit from these improvements without disruptions.

- If you're utilizing features labeled with `unstable_*` flags, it's crucial to review the release notes for each minor release. This is because the behavior or structure of these features might evolve. Your feedback during this phase is invaluable in enhancing the feature before the final release!

## Managing Breaking Changes with Future Flags

When we introduce breaking changes, we do so within the context of the current major version, and we hide them behind future flags. For instance, if we're in `v2`, a breaking change might be placed under a future flag named `v3_somethingDifferent`.

```ts filename=vite.config.ts lines=[7-9]
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_someFeature: true,
      },
    }),
  ],
});
```

- Both the existing `v2` behavior and the new `v3_somethingDifferent` behavior coexist simultaneously.
- Applications can adopt changes incrementally, one step at a time, instead of having to adjust to a multitude of changes all at once in the next major release.
- If all the `v3_*` future flags are enabled, transitioning to `v3` should ideally not necessitate any changes to your codebase.
- Some future flags that bring about breaking changes initially start as `unstable_*` flags. These might undergo modifications during minor releases. Once they become `v3_*` future flags, the corresponding API is set and won't change further.

## Summary

Our development strategy focuses on gradual feature adoption and seamless version upgrades for major releases. This empowers developers to selectively integrate new features, avoiding the need for extensive code adjustments during version transitions. By introducing features through `unstable_*` flags, we refine the API collaboratively with early adopters while ensuring stable releases benefit from enhancements. Through careful management of breaking changes using `v3_*` flags, we provide the flexibility to adopt changes incrementally, facilitating a smoother transition between major versions. While this increases the complexity for developing Remix the framework, this developer-centric approach greatly simplifies application development with Remix, ultimately leading to improved software quality and (hopefully!) developer satisfaction.

## Current Future Flags

The following future flags currently exist in Remix v2 and will become the default behavior in Remix v3:

- **`v3_fetcherPersist`**: Change fetcher persistence/cleanup behavior in 2 ways ([RFC][fetcherpersist-rfc]):
  - Fetchers are no longer removed on unmount, and remain exposed via [`useFetchers`][use-fetchers] until they return to an `idle` state
  - Fetchers that complete while still mounted no longer persist in [`useFetchers`][use-fetchers] since you can access those fetchers via [`useFetcher`][use-fetcher]
- **`v3_relativeSplatPath`**: Fixes buggy relative path resolution in splat routes. Please see the [React Router docs][relativesplatpath] for more information.
- **`v3_throwAbortReason`**: When a server-side request is aborted, Remix will throw the `request.signal.reason` instead of an error such as `new Error("query() call aborted...")`
- **`unstable_singleFetch`**: Opt into [Single Fetch][single-fetch] behavior

[vite-config-future]: ../file-conventions/vite-config#future
[remix-config-future]: ../file-conventions/remix-config#future
[fetcherpersist-rfc]: https://github.com/remix-run/remix/discussions/7698
[use-fetchers]: ../hooks/use-fetchers
[use-fetcher]: ../hooks/use-fetcher
[relativesplatpath]: https://reactrouter.com/en/main/hooks/use-resolved-path#splat-paths
[single-fetch]: ../guides/single-fetch
