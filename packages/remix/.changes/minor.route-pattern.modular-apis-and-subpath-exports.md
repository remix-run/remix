BREAKING CHANGE: New modular `remix/route-pattern` APIs and subpath exports

Previously, `remix/route-pattern` bundled URL generation, matching, and specificity helpers into one entrypoint. A typical Remix app does not do any client-side matching, but all the matching logic would ship to the browser anyway, causing JS bloat.

Now, route pattern features are organized into separate subpath exports, so even without a bundler, only the code you need ends up in the browser:

- `remix/route-pattern/href` generates hrefs for patterns with type-safe params.
- `remix/route-pattern/match` matches against one pattern with type inference for params, or against many patterns with deterministic ranking and attached data.
- `remix/route-pattern/join` combines two patterns into one, including protocol, hostname, port, pathname, and search constraints.
- `remix/route-pattern/specificity` continues to provide utilities for ranking matches.

The base `remix/route-pattern` export now focuses on parsing and serializing route patterns.
