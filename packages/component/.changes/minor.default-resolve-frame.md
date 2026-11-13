Customize frame requests and rendering with `defaultResolveFrame` and its `{ fetch, commit }` overrides

- Previously, adding a custom `resolveFrame` required you to take _full_ control and re-implement core logic from the default `resolveFrame` implementation
- `defaultResolveFrame` provides the internal default implementation with targeted `fetch` and `commit` hooks
- `fetch` allows you to override just the `fetch` call for the frame (set custom fetch options/headers, implement an in-memory cache, etc.)
- `commit` allows you to control the DOM update (trigger a view transition, etc.)
- `resolveFrame` now receives `options.transition` representing the browser navigation transition for navigation-driven frame reloads, allowing you to differentiate navigation versus imperative `frame.reload()` calls
- See [Resolving Frames](https://github.com/remix-run/remix/tree/main/packages/component#resolving-frames) for more information and the [bookstore demo](https://github.com/remix-run/remix/tree/main/demos/bookstore#view-transitions) for example usages
