Add new APIs to the mock function context for both `mock` and `t.mock`:

- `mockImplementation(implementation)` changes the default implementation.
- `mockImplementationOnce(implementation, onCall?)` replaces one call at a zero-based index, defaulting to the next call.
- `resetCalls()` clears the call history.
- `callCount()` returns the number of recorded invocations, including calls still executing.
- `restore()` restores a standalone mock's original implementation.

Replacement controls preserve generic and overloaded function signatures. Test context mocks restore in registration order alongside cleanup callbacks, even after failures. Cleanup errors retain their original stack traces and are reported alongside test failures.
