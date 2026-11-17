Customize prefetching with `defaultPrefetch` and its `{ fetch, processFrame }` overrides

- Previously, adding a custom `prefetch` required you to take _full_ control and re-implement core logic from the default `prefetch` implementation
- `defaultPrefetch` provides the internal default implementation with targeted `fetch` and `processFrame` hooks
- `fetch` allows you to override just the `fetch` call for the prefetched frame (set custom fetch options/headers, implement an in-memory cache, etc.)
- `processFrame` allows you to control subsequent asset prefetching - allowing Remix to discover, but you own control of what gets prefetched and in what order (includes scripts, stylesheets, images, and even nested frames based on their `fallback`/`loading` behaviors)
- The incoming frame `fragment` allows you to query the inert DOM of the prefetched frame to discover additional assets and implement your own custom prefetching behaviors
- See [Prefetching](https://github.com/remix-run/remix/blob/main/packages/component/README.md#prefetching) for usage
