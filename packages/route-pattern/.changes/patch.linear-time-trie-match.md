Faster `TrieMatcher.match`: `O(m·log(m))` -> `O(m)`

Previously, `TrieMatcher.match` internally called `.matchAll`, then sorted the result to find the best match. For `m` matching route patterns, this took `O(m·log(m))` operations.

Now, `TrieMatcher.match` loops over the `m` matches, keeping track of the best one, resulting in `O(n)` operations.

In our benchmarks, this made our largest workload (~5000 route patterns) 17% faster with negligible or modest improvements to other workloads.
