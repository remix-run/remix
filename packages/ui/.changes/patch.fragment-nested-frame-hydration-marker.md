Adopt a Fragment-nested `<Frame>`'s server-rendered hydration marker at `clientEntry` boundaries

A `<Frame>` that is the first child of a bare Fragment returned by a `clientEntry` now adopts its streamed hydration marker instead of taking the fresh-insert path, which previously re-fetched `src` on the client and duplicated the streamed subtree. A `<Frame>` wrapped in a host element already hydrated cleanly.
