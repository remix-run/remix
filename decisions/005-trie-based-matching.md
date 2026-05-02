# Use only trie-based matching for `route-pattern

`@remix-run/route-pattern` ships a single `Matcher` implementation (trie-based) constructed via `createMatcher()`.

Earlier versions exported both `ArrayMatcher` and `TrieMatcher` and asked users to pick based on app size and runtime.
However, in our benchmarks the trie-based matcher vastly outperformed the array matcher in "long-running server" benchmarks where the setup cost was ignored.
For "lambda" benchmarks, the array matcher was a bit faster (<2x), but both matchers consistently setup and match in under 10ms for even our [largest benchmark with ~2500 patterns](../packages/route-pattern/bench/patterns/shopify.ts).

While lambda providers don't guarantee warm workers, In practice, warm workers tend to be more common than cold starts anyway. 
Additionally, lambda providers like Cloudflare have [techniques for starting up your app during the TLS handshake](https://blog.cloudflare.com/eliminating-cold-starts-2-shard-and-conquer/) which mitigate even the negligible differences between the array matcher and trie-matcher startup times.

By eliminating the array matcher, we simplify our API and avoid any issues where competing matcher implementations have behavior drift.

The array matcher implementation has been moved to the benchmark sub-package, so that we can continue to monitor if these performance characteristics ever change. 
If any real-world scenarios benefit from having an array matcher, we can revisit this decision.