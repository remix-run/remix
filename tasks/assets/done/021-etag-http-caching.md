### ETag-based HTTP caching

Use standard HTTP caching with ETags to avoid re-sending unchanged files.

**Acceptance Criteria:**

- [x] Return `ETag` header based on file mtime
- [x] Handle `If-None-Match` request header
- [x] Return 304 Not Modified if ETag matches
- [x] Works for both source files and `/@node_modules/` requests
- [x] Remove `Cache-Control: no-store`, use appropriate caching headers
- [x] Unit tests for ETag generation and matching
