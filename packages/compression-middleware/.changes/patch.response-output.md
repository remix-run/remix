Declare `compression()` as Response-only middleware and throw a clear `TypeError` if a downstream handler returns a non-`Response` value.
