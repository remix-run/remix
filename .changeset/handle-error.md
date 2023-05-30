---
"@remix-run/server-runtime": minor
---

Add optional `handleError` export to entry.server for custom server-side error processing.  This is a new optional export from your `entry.server.tsx` that will be called with any encountered error on the Remix server (loader, action, or render error):

```tsx
// entry.server.tsx
export function handleError(
  error: unknown,
  { request, context }: DataFunctionArgs
): void {
  if (isRouteErrorResponse(error)) {
    console.error(error);
    sendErrorResponseToBugReportingService(error);
  } else if (error instanceof Error) {
    console.error(error);
    sendErrorToBugReportingService(error);
  } else {
    console.error("Unknown Server Error");
    sendUnknownErrorToBugReportingService(error);
  }
}
```
