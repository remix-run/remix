Added `@remix-run/route-pattern/parse` as a narrow subpath for parsing route pattern parts without importing the `RoutePattern` class, serializer, matcher, or href helpers.

Reduced browser-served href generation bytes by keeping pathname and hostname serialization helpers private to the href implementation.
