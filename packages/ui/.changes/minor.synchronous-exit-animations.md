BREAKING CHANGE: The `animateExit()` mixin now starts animations synchronously in `beforeRemove` instead of deferring them to a microtask. This allows `animateLayout()` to measure the updated layout when exiting elements are taken out of normal flow.

This is unlikely to be a breaking change for most consumers. Custom mixins used alongside `animateExit()` may be affected if they inspect computed styles or call `getAnimations()` in `beforeRemove` and rely on the exit animation starting later.
