---
"@remix-run/server-runtime": minor
---

Add optional `handleError` export for custom server-side error processing. This is a new optional export from your `entry.server.tsx` that will be called with any encountered error on the Remix server (loader, action, or render error):

```ts
// entry.server.tsx
export function handleError(
  error: unknown,
  { request, params, context }: DataFunctionArgs
): void {
  if (error instanceof Error) {
    sendErrorToBugReportingService(error);
    console.error(formatError(error));
  } else {
    let unknownError = new Error("Unknown Server Error");
    sendErrorToBugReportingService(unknownError);
    console.error(unknownError);
  }
}
```
