---
title: unstable_createMemoryUploadHandler
toc: false
---

# `unstable_createMemoryUploadHandler`

**Example:**

```tsx
export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const uploadHandler = unstable_createMemoryUploadHandler({
    maxPartSize: 500_000,
  });
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );

  const file = formData.get("avatar");

  // file is a "File" (https://mdn.io/File) polyfilled for node
  // ... etc
};
```

**Options:** The only options supported are `maxPartSize` and `filter` which work the same as in `unstable_createFileUploadHandler` above. This API is not recommended for anything at scale, but is a convenient utility for simple use cases and as a fallback for another handler.
