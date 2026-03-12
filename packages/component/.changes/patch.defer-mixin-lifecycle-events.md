Run mixin `insert`, `remove`, and `reclaimed` lifecycle events in the scheduler's commit phase instead of dispatching them inline during DOM diffing.

This lets `ref(...)` and other insert-driven mixins safely call `handle.update()` during initial mount, and it makes mixin lifecycle timing line up with commit-phase DOM state before normal queued tasks run.
