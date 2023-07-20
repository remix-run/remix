---
"@remix-run/react": major
---

Remove deprecated `useTransition` hook in favor of `useNavigation`. `useNavigation` is _almost_ identical with a few exceptions:_

* `useTransition.type` has been removed since it can be derived from other available information
* "Submission" fields have been flattened from `useTransition().submission` down onto the root `useNavigation()` object
* `<Form method="get">` is now more accurately categorized as `state:"loading"` instead of `state:"submitting"` to better align with the underlying GET navigation
