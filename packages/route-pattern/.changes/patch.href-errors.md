Previously, `href` was throwing an `HrefError` with `missing-params` type when a nameless wildcard was encountered outside of an optional.
But that was misleading since nameless optionals aren't something the user should be passing in values for.
Instead, `href` now throws an `HrefError` with the correct `nameless-wildcard` type for this case.

Error messages have also been improved for many of the `HrefError` types.
Notably, the variants shown in `missing-params` were confusing since they leaked internal formatting for params.
That has been removed and the resulting error message is now shorter and simpler.
