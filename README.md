# form-data-parser

`form-data-parser` is a wrapper around `request.formData()` that provides pluggable support for file upload handling. This is useful in server contexts where large files should be streamed to disk or some cloud storage service like [AWS S3](https://aws.amazon.com/s3/) or [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) instead of being buffered in memory.

## The Problem

The web fetch API's built-in [`request.formData()` API](https://developer.mozilla.org/en-US/docs/Web/API/Request/formData) is not a great fit for server environments because it doesn't provide a way to stream file uploads. This means that when you call `request.formData()` in a server environment on a request that was submitted by a `<form enctype="multipart/form-data">`, any file uploads contained in the request are buffered in memory. For small files this may not be an issue, but it's a total non-starter for large files that exceed the server's memory capacity.

`form-data-parser` fixes this issue by providing an API to handle streaming file data.

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @mjackson/form-data-parser
```

## Usage

```ts
import { LocalFileStorage } from "@mjackson/file-storage";
import { parseFormData } from "@mjackson/form-data-parser";

const fileStorage = new LocalFileStorage("/uploads/user-avatars");

async function handleRequest(request: Request) {
  let formData = await parseFormData(request, async fileUpload => {
    // Is this file upload from the <input type="file" name="user-avatar"> in our <form>?
    if (fileUpload.fieldName === "user-avatar") {
      let storageKey = `user-${user.id}-avatar`;

      // Save the file to storage
      await fileStorage.put(storageKey, fileUpload);

      // Return an instance of the file from storage for the FormData object
      return fileStorage.get(storageKey);
    }

    // Ignore any files we don't recognize the name of...
  });

  let file = formData.get("user-avatar"); // File
  file.name; // "my-avatar.jpg" (name of the file on the user's computer)
  file.size; // number
  file.type; // "image/jpeg"
}
```

## License

See [LICENSE](https://github.com/mjackson/form-data-parser/blob/main/LICENSE)
