Cancel a pending frame request with `frame.reload({ signal })`. The caller's signal applies until `resolveFrame` returns, so rendering and streamed content finish even if the reload removes the calling component. Custom resolvers should forward `options.signal` to `fetch()`.

Already-aborted signals skip the request without interrupting an active reload. Cancellation resolves with an aborted signal; other errors reject. A newer reload or frame disposal still cancels the entire reload.
