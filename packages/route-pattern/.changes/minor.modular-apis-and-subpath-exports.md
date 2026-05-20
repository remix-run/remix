BREAKING CHANGE: New modular APIs and subpath exports

Previously, this package shipped the default export and a `/specificity` export.
A typical Remix app does not do any client-side matching but all the matching logic would ship to the browser anyway causing JS bloat.

Now, features are organized into separate subpath exports, so even without a bundler, only the code you need ends up in the browser.
For example, this reduced JS from `route-pattern` in `demos/bookstore` from 25kB (14.9kB compressed) to 8.8kb (7kB compressed) which amounts to ~65% reduction (~53% reduction compressed).

To achieve this, we've reworked our core APIs to be simpler and more independently useful.
So instead of a single `RoutePattern` class that does it all (`.href`, `.match`, ...), the new `RoutePattern` class is a thin layer around the parsed pattern that includes `RoutePattern.parse` static method for parsing and `.source`, `.toString()` and `.toJSON()` for serialization.

The rest of the functionality comes from dedicated subpath exports:

- **remix/route-pattern/href** : Generate hrefs for patterns with type safe params.
- **remix/route-pattern/match** : Match against one pattern with type inference for params. Or match against many patterns with deterministic ranking and attached data.
- **remix/route-pattern/join** : Combine two patterns into one. Override protocol, hostname, port. Join pathnames. Merge search constraints.

**remix/route-pattern/specificity** remains the same as before, providing utilities for ranking matches.

Additionally, `ArrayMatcher` and `TrieMatcher` have been replaced by `createMultiMatcher` (which is now always backed by trie-based matching).
To match against only a single pattern while receiving type safe `params` from the match, use `createMatcher`.

See the new README for details.
