Added `@remix-run/route-pattern/parse` as a narrow subpath for parsing route pattern parts without importing the `RoutePattern` class, serializer, matcher, or href helpers.

Reduced browser-served href generation bytes by keeping pathname and hostname serialization helpers private to the href implementation.

Reduced browser-served href generation bytes by reusing search-param entries during href serialization.

Reduced browser-served href generation bytes further by compacting pathname encoding, hostname validation, and per-part param encoder selection.

Reduced browser-served href generation bytes a little more by normalizing missing params once and using native search-param value checks when deduplicating pattern search constraints.
