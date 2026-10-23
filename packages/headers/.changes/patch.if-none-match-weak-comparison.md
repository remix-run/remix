`IfNoneMatch#matches()` now treats strong and weak entity tags with the same opaque tag as equivalent, as required for `If-None-Match` cache validation by RFC 9110 (see #12048).
