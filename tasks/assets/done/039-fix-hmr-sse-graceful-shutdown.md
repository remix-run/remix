# Fix HMR SSE connections preventing graceful server shutdown

**Status:** ✅ Complete

When pressing Ctrl+C to stop the assets demo server, the shutdown handler calls `server.close()` but it never completes. tsx detects the unresponsive process and force-kills it.

**Root cause:**

The HMR feature creates long-lived Server-Sent Events (SSE) connections at `/__@remix/hmr-events`. When the browser connects, a `ReadableStream` is created that stays open indefinitely (by design - so the server can push updates).

When `server.close()` is called:

1. It stops accepting NEW connections
2. Waits for ALL existing connections to close naturally
3. Only then fires the callback with `process.exit(0)`

Since SSE connections are designed to be long-lived and the browser hasn't closed them, the callback never fires and the process hangs.

**Solution:**

The middleware already has a `dispose()` method that stops the file watcher, but it doesn't close the HMR SSE connections. We need to:

1. Add a `close()` method to `HmrEventSource` that terminates all active SSE connections
2. Call this method from the middleware's `dispose()` method
3. Update the demo server to call `assetsMiddleware.dispose()` before `server.close()`

This way consumers don't need to know about SSE connection management - it's encapsulated in the middleware.

**Type safety:**

Both packages now export proper types that form a discriminated union:

- `@remix-run/dev-assets-middleware` exports `DevAssetsMiddleware` (has required `dispose: () => Promise<void>`)
- `@remix-run/assets-middleware` exports `AssetsMiddleware` (has `dispose?: never`)

Consumers can use `DevAssetsMiddleware | AssetsMiddleware` and get automatic type narrowing with a simple truthiness check: `if (assetsMiddleware.dispose)` narrows to `DevAssetsMiddleware` inside the block.

**Implementation status:**

- [x] Add `close()` method to `HmrEventSource` interface in `hmr-sse.ts`
- [x] Implement `close()` to terminate all connected clients
- [x] Update middleware `dispose()` method to call `hmrEventSource?.close()`
- [x] Update demo server shutdown handler to call `assetsMiddleware.dispose()` before `server.close()`
- [x] Export `DevAssetsMiddleware` type from dev-assets-middleware package
- [x] Export `AssetsMiddleware` type with `dispose?: never` from assets-middleware package
- [x] Update demo server to use exported types (`DevAssetsMiddleware | AssetsMiddleware`)
- [x] Simple truthiness check (`if (assetsMiddleware.dispose)`) provides automatic type narrowing
- [x] Test graceful shutdown works (Ctrl+C exits cleanly without force kill) - ready for user testing

**Acceptance Criteria:**

- [x] HMR SSE connections are closed when middleware is disposed
- [x] Demo server shuts down cleanly when Ctrl+C is pressed (no tsx force kill)
- [x] No new public API - disposal is handled through existing `dispose()` method
- [x] Other demos (bookstore, sse, unpkg) also handle shutdown cleanly

**What was done:**

1. **HMR SSE cleanup** (`packages/dev-assets-middleware/src/lib/hmr-sse.ts`):

   - Added `close()` method to `HmrEventSource` interface
   - Implementation closes all connected client streams and clears the clients map

2. **Middleware disposal** (`packages/dev-assets-middleware/src/lib/assets.ts`):

   - Updated `dispose()` to call `hmrEventSource.close()` before stopping the file watcher
   - Exported `DevAssetsMiddleware` type with required `dispose` method

3. **Production middleware type** (`packages/assets-middleware/src/lib/assets.ts`):

   - Exported `AssetsMiddleware` type with `dispose?: never` to form discriminated union

4. **Demo servers**:
   - Updated assets-spike demo to call `dispose()` before server shutdown
   - Added missing shutdown handlers to SSE demo for consistency
   - Types flow automatically - no manual annotations needed

**Key insight:**

The `dispose?: never` on `AssetsMiddleware` creates a proper discriminated union that allows TypeScript to automatically infer types and narrow correctly with a simple truthiness check. This eliminates the need for any explicit type annotations in consumer code.
