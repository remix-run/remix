# Route Pattern Helpers

This directory contains helpers for [`route-pattern.ts`](../route-pattern.ts).

## Organization

- **[`part-pattern.ts`](./part-pattern.ts)**: Logic that applies to any `PartPattern` (i.e. hostname _and_ pathname)
- **Other files**: Organize by feature (not by pattern part)
  - [`href.ts`](./href.ts): Href generation
  - [`join.ts`](./join.ts): Pattern joining
  - [`match.ts`](./match.ts): URL matching
  - [`parse.ts`](./parse.ts): Parsing patterns
  - [`serialize.ts`](./serialize.ts): Serializing to strings
  - [`split.ts`](./split.ts): Splitting source strings
