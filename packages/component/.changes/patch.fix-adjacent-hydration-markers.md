Fix full-document client reloads that could leave orphaned hydration markers behind when adjacent client entries are diffed in the same parent.

This prevents later navigations from failing with `Error: End marker not found` after the live DOM ends up with mismatched `rmx:h` start and end markers.
