Added data-property mocking with `mock.property()` and `t.mock.property()`, including read/write records, one-access value overrides, and descriptor restoration. Added getter and setter spies through `mock.getter()`, `mock.setter()`, and the fourth `mock.method()` argument. Exported `MockTracker` as the shared type for standalone and test-context mocks.

Test-context accessor and property mocks restore in reverse installation order after cleanup callbacks, even when a test or cleanup callback fails.
