### Package root caching and parallel lookups

Optimize resolution performance by caching package root lookups and parallelizing.

**Acceptance Criteria:**

- [x] Cache `findPackageRoot()` results so repeated lookups are instant
- [x] Cache intermediate directories during walk (all dirs in path get cached)
- [x] Parallelize package root lookups in batch resolution
- [x] Measurable improvement: Counter.tsx needed 0 batch calls, 0.6ms transform
