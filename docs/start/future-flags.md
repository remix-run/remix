---
title: Future Flags
order: 5
---

# Gradual Feature Adoption with Future Flags

In our approach to software development, we aim to achieve the following goals for major releases:

1. **Incremental Feature Adoption:** Developers have the flexibility to choose and integrate new features and changes one by one, as they become available in the current major version. This is a departure from the traditional method of bundling all changes into a single new major release.
2. **Seamless Version Upgrades:** By selectively incorporating new features ahead of time, developers can smoothly transition to new major versions without the need to modify their existing application code.

## Unstable APIs and Future Flags

We introduce new features into the current release with a future flag in [`remix.config.js`][remix-config] that looks something like `unstable_someFeature`.

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
export default {
  future: {
    unstable_someFeature: true,
  },
};
```

- Once an unstable feature reaches a stable state, we remove the special prefix and include the feature in the next minor release. At this point, the API's structure remains consistent throughout subsequent minor releases.

- This approach allows us to refine the API collaboratively with early adopters, incorporating necessary changes in the unstable phase without affecting all users. The stable releases then benefit from these improvements without disruptions.

- If you're utilizing features labeled with `unstable_*` flags, it's crucial to review the release notes for each minor release. This is because the behavior or structure of these features might evolve. Your feedback during this phase is invaluable in enhancing the feature before the final release!

## Managing Breaking Changes with Future Flags

When we introduce breaking changes, we do so within the context of the current major version, and we hide them behind future flags. For instance, if we're in `v2`, a breaking change might be placed under a future flag named `v3_somethingDifferent`.

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
export default {
  future: {
    v3_someFeature: true,
  },
};
```

- Both the existing `v2` behavior and the new `v3_somethingDifferent` behavior coexist simultaneously.
- Applications can adopt changes incrementally, one step at a time, instead of having to adjust to a multitude of changes all at once in the next major release.
- If all the `v3_*` future flags are enabled, transitioning to `v3` should ideally not necessitate any changes to your codebase.
- Some future flags that bring about breaking changes initially start as `unstable_*` flags. These might undergo modifications during minor releases. Once they become `v3_*` future flags, the corresponding API is set and won't change further.

## Summary

Our development strategy focuses on gradual feature adoption and seamless version upgrades for major releases. This empowers developers to selectively integrate new features, avoiding the need for extensive code adjustments during version transitions. By introducing features through `unstable_*` flags, we refine the API collaboratively with early adopters while ensuring stable releases benefit from enhancements. Through careful management of breaking changes using `v3_*` flags, we provide the flexibility to adopt changes incrementally, facilitating a smoother transition between major versions. While this increases the complexity for developing Remix the framework, this developer-centric approach greatly simplifies application development with Remix, ultimately leading to improved software quality and (hopefully!) developer satisfaction.

For a list of currently available Future Flags, please see the [`future`][remix-config-future] section in the `remix.config.js` documentation.

[remix-config]: ../file-conventions/remix-config
[remix-config-future]: ../file-conventions/remix-config#future
