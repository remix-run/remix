BREAKING CHANGE: Remove exports for `TrieMatcher` and `TrieMatcherOptions`

`TrieMatcher` prototype produces inconsistent matches based on ad hoc scoring.
That means that swapping `ArrayMatcher` for `TrieMatcher` could alter which route was picked as the best match for a given URL.

We'll restore the `TrieMatcher` export after it produces correct, consistent matches.
