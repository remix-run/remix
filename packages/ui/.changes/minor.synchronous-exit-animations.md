BREAKING CHANGE: Exit animations now start synchronously when removal begins, rather than after the synchronous DOM update. This allows the `animateLayout` mixin to handle animating a set of elements when exiting elements are taken out of normal flow.

This is unlikely to be a breaking change for most consumers. Custom mixins that read computed styles or use `getAnimations()` to inspect or cancel animations in `beforeRemove` may now observe exit effects that previously started after the callback.
