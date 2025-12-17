Added `reset()` method to all header utility classes, allowing instances to be updated in place from a string or object, or reset to empty values. This mirrors the constructor behavior on an existing instance, enabling stable object identity when header values change via standard `.set()`, `.append()`, and `.delete()` header methods.

All header value classes now extend an abstract `HeaderValue<Init>` base class which enforces that `reset()` accepts the same types as the constructor. The `HeaderValue` class and `HeaderValueInit` interface are now exported from the package.
