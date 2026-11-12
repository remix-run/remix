Permit more advanced application control over prefetching logic

- The new `defaultPrefetch` API allows applications to wrap custom logic around standard behavior
- Customize the underlying frame fetch through `defaultPrefetch(src, options, { fetch })`
- Customize frame asset discovery/prefetching through `defaultPrefetch(src, options, { frame })`
- See [Prefetching](https://github.com/remix-run/remix/blob/main/packages/component/README.md#prefetching) for usage
