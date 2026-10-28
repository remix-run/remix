Add new APIs to the mock function context:

- `mockImplementation(implementation)` changes the default implementation.
- `mockImplementationOnce(implementation, onCall?)` replaces the implementation for one call.
- `resetCalls()` clears the call history.
- `callCount()` returns the number of recorded invocations, including calls still executing.
- `restore()` restores a standalone mock's original implementation.

Replacement controls preserve generic and overloaded function signatures. One-call overrides can be scheduled on `Number.isSafeInteger` spies without recording extra calls. Test context mocks restore even when tests or cleanup callbacks fail, and cleanup failures retain their original stack traces.
