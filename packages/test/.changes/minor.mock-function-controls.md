Add new APIs to the mock function context:

- `mockImplementation(implementation)` changes the default implementation.
- `mockImplementationOnce(implementation, onCall?)` replaces the implementation for one call.
- `resetCalls()` clears the call history.
- `callCount()` returns the number of recorded invocations, including calls still executing.
- `restore()` restores a standalone mock's original implementation.
