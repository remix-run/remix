# Error boundaries are a built-in component with marked DOM ranges

`<ErrorBoundary fallback>` is a built-in component, like `<Frame>`, that the server renderer and the browser reconciler both recognize. It renders its children until they throw during setup or render, then renders `fallback` in their place. A fallback is content or a function that receives the thrown value and a `retry()` function.

The motivating case was [#12328](https://github.com/remix-run/remix/pull/12328): a component that throws while rendering any part of a page fails the whole shell, so `render()` rejects and the user gets the app's 500 page. Router-level error handling covers that failure for the whole response. A boundary covers a failure in one region of an otherwise useful page.

## Why a built-in component instead of a handle API

Components are closures with no lifecycle hooks, so there is no `componentDidCatch` equivalent to attach. A `handle.catch()` API would need every component to opt into catching for its subtree and would make each component a potential boundary. A dedicated component keeps catching visible in JSX, needs no new handle surface, and maps directly to a server segment and a browser DOM range.

The fallback receives `retry` as an argument instead of reading it from a handle because the boundary owns the error state. Users never hold a reference to the boundary instance.

## Why the browser boundary owns comment markers

The reconciler writes the DOM while it renders. When a descendant throws partway through a render, siblings rendered before it are already in the DOM, and new component instances and mixins have run setup without being committed to the vnode tree. A boundary can only recover if it knows which DOM belongs to it and which instances the failed render created.

- DOM: every boundary owns `<!-- rmx:eb -->` and `<!-- /rmx:eb -->` markers, the same way frames and client entries own their ranges. A failed render clears everything between the markers. The markers move with the boundary in keyed lists and are removed with it.
- Instances: while rendering inside a boundary, the reconciler records new component instances, hosts with mixin state, frames, and client entry boundaries. A failed render disposes them, which aborts `handle.signal` and runs mixin `remove` events. Successful renders hand their records to the enclosing boundary so it can dispose them if a later sibling fails.

The server writes the same markers, with `<!-- rmx:eb:error -->` when it rendered the fallback. Hydration uses them to know where server content ends and whether to hydrate the children or the fallback.

## Hydrating a server fallback without retrying

When the server rendered a fallback, the browser hydrates the fallback and does not render the children. Rendering the children again would replace server HTML right after the first paint, report the error a second time when it fails again, and most server render failures (a database or a service the browser can't reach) fail the same way on retry. An app that wants an automatic browser retry can call `retry()` from a component in its fallback.

The server does not serialize the error. The hydrated fallback receives a generic `Error`, so server error messages never reach the browser through the runtime. The server fallback still receives the real error, and apps decide what to render from it.

## Reporting caught errors

On the server, caught errors go to `renderToStream()`'s `onError`, which apps already use for logging. The stream does not reject, so `render()` middleware keeps the response status.

In the browser, caught errors are logged with `console.error()` but not dispatched as root `error` events. Apps use that event to report fatal failures and to replace broken UI, so dispatching handled errors would make a contained failure look like a crashed runtime.

## What is not caught

- Event handlers, queued tasks, and mixin lifecycle events run after commit. They have no partially rendered tree to replace, and the component that owns the work can catch errors and render them from state.
- Frames with a `fallback` stream after the first chunk is sent. The server can't replace HTML it already sent, so these keep the existing behavior: the frame fallback stays and the error goes to `onError`. Blocking frames resolve before the shell is sent, so a boundary around one can replace it.
- Frame reloads in the browser reject `frame.reload()` and dispatch root errors as before.

## When to revisit

1. Apps need browser telemetry for caught errors without a component in the fallback. An `onError` prop or an event on the root would cover it.
2. A boundary should retry when its parent passes new props, as React's `resetKeys` pattern does. Today a boundary keeps its fallback until `retry()` or a `key` change.
3. Queued task errors should replace the owning region. The runtime would need to map tasks to their nearest boundary.
