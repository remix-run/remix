Faster type inference for `RoutePattern.href`, `RoutePattern.match`, and `Params`

Reduced type instantiations for parsing param types, resulting in
~2-5x faster in relevant [type benchmarks](https://github.com/remix-run/remix/tree/main/packages/route-pattern/bench/types), but varies depending on your route patterns.
May fix `"Type instantiation is excessively deep and possibly infinite" (ts2589)` for some apps.
