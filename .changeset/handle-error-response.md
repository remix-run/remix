---
"@remix-run/server-runtime": patch
---

Fix `handleError` method to correctly receive `ErrorResponse` instances on `?_data` and resource route requests. It now receives the `ErrorResponse` instance the same way a document request would.  Users can leverage `isRouteErrorResponse`to detect these error instances and log accordingly.
