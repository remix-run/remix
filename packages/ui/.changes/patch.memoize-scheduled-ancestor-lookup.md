Speed up updates when many components are scheduled in the same flush by caching scheduled-ancestor lookups instead of walking up the tree for each component.
