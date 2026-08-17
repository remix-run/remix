BREAKING CHANGE: Expose the new `remix/assets` boolean fingerprinting API through the umbrella `remix` package. Replace `fingerprint: { buildId }` with `fingerprint: true`; scripts now keep JavaScript imports as authored and require the matching asset import map to be included before their modulepreload links and module scripts.

If you previously used `fingerprint.buildId` to namespace persisted transformed file caches, move that value to `files.cacheKey`.
