# form-data-parser

A streaming multipart/form-data parser that solves memory issues with file uploads in server environments. Built as an enhanced replacement for the native `request.formData()` API, it enables efficient handling of large file uploads by streaming directly to disk or cloud storage services like [AWS S3](https://aws.amazon.com/s3/) or [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/), preventing server crashes from memory exhaustion.

## Features

- **Drop-in replacement** for `request.formData()` with streaming file upload support
- **Minimal buffering** - processes file upload streams with minimal memory footprint
- **Standards-based** - built on the [web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) and [File API](https://developer.mozilla.org/en-US/docs/Web/API/File)
- **Smart fallback** - automatically uses native `request.formData()` for non-`multipart/form-data` requests
- **Storage agnostic** - works with any storage backend (local disk, S3, R2, etc.)

## Why You Need This

The native [`request.formData()` method](https://developer.mozilla.org/en-US/docs/Web/API/Request/formData) has a major flaw in server environments: it buffers all file uploads in memory. When your users upload large files, this can quickly exhaust your server's RAM and crash your application.

`form-data-parser` solves this by handling file uploads as they arrive in the request body stream, allowing the user to safely put the file in storage, and use some other value (like a unique identifier for that file) in the returned `FormData` object.

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @mjackson/form-data-parser
```

## Usage

This library pairs really well with [the `file-storage` library](https://github.com/mjackson/remix-the-web/tree/main/packages/file-storage) for keeping files in various storage backends.

```ts
import { LocalFileStorage } from '@mjackson/file-storage/local';
import type { FileUpload } from '@mjackson/form-data-parser';
import { parseFormData } from '@mjackson/form-data-parser';

// Set up storage for uploaded files
const fileStorage = new LocalFileStorage('/uploads/user-avatars');

// Define how to handle incoming file uploads
async function uploadHandler(fileUpload: FileUpload) {
  // Is this file upload from the <input type="file" name="user-avatar"> field?
  if (fileUpload.fieldName === 'user-avatar') {
    let storageKey = `user-${user.id}-avatar`;

    // Put the file in storage
    await fileStorage.set(storageKey, fileUpload);

    // Return a lazy File object that can access the stored file when needed
    return fileStorage.get(storageKey);

    // Note: You could also just return the `storageKey` here if
    // that's the value you want to show up in the `FormData` object
    // at the "user-avatar" key.
  }

  // Ignore unrecognized fields
}

// Handle form submissions with file uploads
async function requestHandler(request: Request) {
  // Parse the form data, streaming any files through your upload handler
  let formData = await parseFormData(request, uploadHandler);

  // Access uploaded files just like with native FormData
  let file = formData.get('user-avatar'); // File object
  file.name; // "my-avatar.jpg" (original filename)
  file.size; // File size in bytes
  file.type; // "image/jpeg" (MIME type)
}
```

## Related Packages

- [`file-storage`](https://github.com/mjackson/remix-the-web/tree/main/packages/file-storage) - A simple key/value interface for storing `FileUpload` objects you get from the parser
- [`multipart-parser`](https://github.com/mjackson/remix-the-web/tree/main/packages/multipart-parser) - The parser used internally for parsing `multipart/form-data` HTTP messages

## License

See [LICENSE](https://github.com/mjackson/remix-the-web/blob/main/LICENSE)
