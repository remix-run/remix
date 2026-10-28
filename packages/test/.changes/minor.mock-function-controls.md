Add new APIs to the mock function context:

- `mockImplementation(implementation)` changes the default implementation.
- `mockImplementationOnce(implementation, onCall?)` replaces the implementation for one call.
- `resetCalls()` clears the call history.
- `callCount()` counts calls that have returned or thrown since the last reset.
- `restore()` restores a standalone mock's original implementation.
