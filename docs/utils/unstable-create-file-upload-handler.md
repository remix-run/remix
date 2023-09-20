---
title: unstable_createFileUploadHandler
toc: false
---

# `unstable_createFileUploadHandler`

A Node.js upload handler that will write parts with a filename to disk to keep them out of memory, parts without a filename will not be parsed. Should be composed with another upload handler.

**Example:**

```tsx
export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const uploadHandler = unstable_composeUploadHandlers(
    unstable_createFileUploadHandler({
      maxPartSize: 5_000_000,
      file: ({ filename }) => filename,
    }),
    // parse everything else into memory
    unstable_createMemoryUploadHandler()
  );
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );

  const file = formData.get("avatar");

  // file is a "NodeOnDiskFile" which implements the "File" API
  // ... etc
};
```

**Options:**

| Property           | Type               | Default                         | Description                                                                                                                                                     |
| ------------------ | ------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| avoidFileConflicts | boolean            | true                            | Avoid file conflicts by appending a timestamp on the end of the filename if it already exists on disk                                                           |
| directory          | string \| Function | os.tmpdir()                     | The directory to write the upload.                                                                                                                              |
| file               | Function           | () => `upload_${random}.${ext}` | The name of the file in the directory. Can be a relative path, the directory structure will be created if it does not exist.                                    |
| maxPartSize        | number             | 3000000                         | The maximum upload size allowed (in bytes). If the size is exceeded a MaxPartSizeExceededError will be thrown.                                                  |
| filter             | Function           | OPTIONAL                        | A function you can write to prevent a file upload from being saved based on filename, content type, or field name. Return `false` and the file will be ignored. |

The function API for `file` and `directory` are the same. They accept an `object` and return a `string`. The object it accepts has `filename`, `name`, and `contentType` (all strings). The `string` returned is the path.

The `filter` function accepts an `object` and returns a `boolean` (or a promise that resolves to a `boolean`). The object it accepts has the `filename`, `name`, and `contentType` (all strings). The `boolean` returned is `true` if you want to handle that file stream.
