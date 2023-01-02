---
title: File Uploads
---

<docs-warning>This doc is a WIP: It was extracted from the API docs for file uploads so it's a bit out of context. We intend to re-write this as a general guide on file uploads.</docs-warning>

Most of the time, you'll probably want to proxy the file to a file host.

**Example:**

```tsx
import type { UploadHandler } from "@remix-run/{runtime}";
import {
  unstable_composeUploadHandlers,
  unstable_createMemoryUploadHandler,
} from "@remix-run/{runtime}";
// writeAsyncIterableToWritable is a Node-only utility
import { writeAsyncIterableToWritable } from "@remix-run/node";
import type {
  UploadApiOptions,
  UploadApiResponse,
  UploadStream,
} from "cloudinary";
import cloudinary from "cloudinary";

async function uploadImageToCloudinary(
  data: AsyncIterable<Uint8Array>
) {
  const uploadPromise = new Promise<UploadApiResponse>(
    async (resolve, reject) => {
      const uploadStream =
        cloudinary.v2.uploader.upload_stream(
          {
            folder: "remix",
          },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }
            resolve(result);
          }
        );
      await writeAsyncIterableToWritable(
        data,
        uploadStream
      );
    }
  );

  return uploadPromise;
}

export const action: ActionFunction = async ({
  request,
}) => {
  const userId = getUserId(request);

  const uploadHandler = unstable_composeUploadHandlers(
    // our custom upload handler
    async ({ name, contentType, data, filename }) => {
      if (name !== "img") {
        return undefined;
      }
      const uploadedImage = await uploadImageToCloudinary(
        data
      );
      return uploadedImage.secure_url;
    },
    // fallback to memory for everything else
    unstable_createMemoryUploadHandler()
  );

  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );

  const imageUrl = formData.get("avatar");

  // because our uploadHandler returns a string, that's what the imageUrl will be.
  // ... etc
};
```

The `UploadHandler` function accepts a number of parameters about the file:

| Property    | Type                      | Description                                                                  |
| ----------- | ------------------------- | ---------------------------------------------------------------------------- |
| name        | string                    | The field name (comes from your HTML form field "name" value)                |
| data        | AsyncIterable<Uint8Array> | The iterable of the file bytes                                               |
| filename    | string                    | The name of the file that the user selected for upload (like `rickroll.mp4`) |
| contentType | string                    | The content type of the file (like `videomp4`)                               |

Your job is to do whatever you need with the `data` and return a value that's a valid \[`FormData`]\[form-data] value: \[`File`]\[the-browser-file-api], `string`, or `undefined` to skip adding it to the resulting FormData.

### Upload Handler Composition

We have the built-in `unstable_createFileUploadHandler` and `unstable_createMemoryUploadHandler` and we also expect more upload handler utilities to be developed in the future. If you have a form that needs to use different upload handlers, you can compose them together with a custom handler, here's a theoretical example:

```tsx filename=file-upload-handler.server.tsx
import type { UploadHandler } from "@remix-run/node"; // or cloudflare/deno
import { unstable_createFileUploadHandler } from "@remix-run/node"; // or cloudflare/deno
import { createCloudinaryUploadHandler } from "some-handy-remix-util";

export const standardFileUploadHandler =
  unstable_createFileUploadHandler({
    directory: "public/calendar-events",
  });

export const cloudinaryUploadHandler =
  createCloudinaryUploadHandler({
    folder: "/my-site/avatars",
  });

export const fileUploadHandler: UploadHandler = (args) => {
  if (args.name === "calendarEvent") {
    return standardFileUploadHandler(args);
  } else if (args.name === "eventBanner") {
    return cloudinaryUploadHandler(args);
  }
  return undefined;
};
```
