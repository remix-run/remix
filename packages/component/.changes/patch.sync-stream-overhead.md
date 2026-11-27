Skip allocating an `AbortController` and registering request abort listeners in `renderToStream()` when a tree finishes synchronously without streaming frames or async client entries.
