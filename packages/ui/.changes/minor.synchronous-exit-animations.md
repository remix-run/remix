BREAKING CHANGE: Exit animations now start synchronously in `beforeRemove` instead of being deferred to a microtask. This allows `animateLayout` to measure the updated layout when exiting elements are taken out of normal flow.

This is unlikely to be a breaking change for most consumers. Custom mixins that read computed styles or use `getAnimations()` to inspect or cancel animations in `beforeRemove` may now observe exit effects that previously started after the callback.
