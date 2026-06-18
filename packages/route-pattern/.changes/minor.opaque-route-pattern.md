BREAKING CHANGE: `RoutePattern` is now an opaque parsed-pattern handle. Construct patterns with `RoutePattern.parse()` instead of `new RoutePattern(...)`, and use `pattern.source`, `pattern.toString()`, or `pattern.toJSON()` instead of reading parsed internals such as `pattern.pathname.tokens`, `pattern.hostname`, or `pattern.search`.

Added `getRoutePatternParams(pattern)` for supported param introspection. It returns readonly `{ part, type, name, optional }` entries in source order so consumers can inspect hostname and pathname params without relying on internal parser tokens.

Exported `RoutePatternParam` and `RoutePatternJSON` from `@remix-run/route-pattern`, `CreateHrefErrorDetails` from `@remix-run/route-pattern/href`, and `MatchParamMeta` from `@remix-run/route-pattern/match`.
