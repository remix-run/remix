# form-data-parser

`form-data-parser` is a wrapper around `request.formData()` that provides pluggable support for file upload handling. This is useful in server contexts where large files should be streamed to disk or some cloud storage service like [AWS S3](https://aws.amazon.com/s3/) or [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) instead of being buffered in memory.

## Features

- Drop-in replacement for `request.formData()` with support for streaming file uploads
- Built on the standard [web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) and [File API](https://developer.mozilla.org/en-US/docs/Web/API/File)
- Does not buffer any content, minimal memory usage
- Automatically falls back to native `request.formData()` implementation for non-`multipart/form-data` requests

## The Problem

The web fetch API's built-in [`request.formData()` method](https://developer.mozilla.org/en-US/docs/Web/API/Request/formData) is not a great fit for server environments because it doesn't provide a way to stream file uploads. This means that when you call `request.formData()` in a server environment on a request that was submitted by a `<form enctype="multipart/form-data">`, any file uploads contained in the request are buffered in memory. For small files this may not be an issue, but it's a total non-starter for large files that exceed the server's memory capacity.

`form-data-parser` fixes this issue by providing an API to handle streaming file data.

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @mjackson/form-data-parser
```

## Usage

```ts
import { LocalFileStorage } from "@mjackson/file-storage";
import { type FileUpload, parseFormData } from "@mjackson/form-data-parser";

const fileStorage = new LocalFileStorage("/uploads/user-avatars");

async function uploadHandler(fileUpload: FileUpload) {
  // Is this file upload from the <input type="file" name="user-avatar"> field?
  if (fileUpload.fieldName === "user-avatar") {
    let storageKey = `user-${user.id}-avatar`;

    // FileUpload objects are not meant to stick around for very long (they are
    // streaming data from the request.body!) so we should store them as soon as
    // possible.
    await fileStorage.put(storageKey, fileUpload);

    // Return a File for the FormData object. This is a LazyFile that knows how
    // to access the file's content if needed (using e.g. file.stream()) but
    // waits until it is requested to actually read anything.
    return fileStorage.get(storageKey);
  }

  // Ignore any files we don't recognize the name of...
}

async function requestHandler(request: Request) {
  let formData = await parseFormData(request, uploadHandler);

  let file = formData.get("user-avatar"); // File (LazyFile)
  file.name; // "my-avatar.jpg" (name of the file on the user's computer)
  file.size; // number
  file.type; // "image/jpeg"
}
```

## Related Packages

- [`multipart-parser`](https://github.com/mjackson/multipart-parser) - The parser used internally
  for parsing `multipart/form-data` HTTP messages
- [`file-storage`](https://github.com/mjackson/file-storage) - A simple interface for storing
  `FileUpload` objects you get from the parser

## License

See [LICENSE](https://github.com/mjackson/form-data-parser/blob/main/LICENSE)
