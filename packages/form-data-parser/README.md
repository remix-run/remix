# form-data-parser

A streaming `multipart/form-data` parser that solves memory issues with file uploads in server environments. Built as an enhanced replacement for the native `request.formData()` API, it enables efficient handling of large file uploads by streaming directly to disk or cloud storage services like [AWS S3](https://aws.amazon.com/s3/) or [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/), preventing server crashes from memory exhaustion.

## Features

- **Drop-in replacement** for `request.formData()` with streaming file upload support
- **Minimal buffering** - processes file upload streams with minimal memory footprint
- **Standards-based** - built on the [web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) and [File API](https://developer.mozilla.org/en-US/docs/Web/API/File)
- **Smart fallback** - automatically uses native `request.formData()` for non-`multipart/form-data` requests
- **Storage agnostic** - works with any storage backend (local disk, S3, R2, etc.)

## Why You Need This

The native [`request.formData()` method](https://developer.mozilla.org/en-US/docs/Web/API/Request/formData) has a few major flaws in server environments:

- It buffers all file uploads in memory
- It does not provide fine-grained control over file upload handling
- It does not prevent DoS attacks from malicious requests

In normal usage, this makes it difficult to process requests with large file uploads because they can exhaust your server's RAM and crash the application.

For attackers, this creates an attack vector where malicious actors can overwhelm your server's memory by sending large payloads with many files.

`form-data-parser` solves this by handling file uploads as they arrive in the request body stream, allowing you to safely store files and use either a) the `File` directly or b) a unique identifier for that file in the returned `FormData` object.

## Installation

```sh
npm i remix
```

## Usage

The `parseFormData` interface allows you to define an "upload handler" function for fine-grained control of handling file uploads.

```ts
import * as fsp from 'node:fs/promises'
import type { FileUpload } from 'remix/form-data-parser'
import { parseFormData } from 'remix/form-data-parser'

// Define how to handle incoming file uploads
async function uploadHandler(fileUpload: FileUpload) {
  // Is this file upload from the <input type="file" name="user-avatar"> field?
  if (fileUpload.fieldName === 'user-avatar') {
    let filename = `/uploads/user-${user.id}-avatar.bin`

    // Store the file safely on disk
    await fsp.writeFile(filename, fileUpload.bytes)

    // Return the file name to use in the FormData object so we don't
    // keep the file contents around in memory.
    return filename
  }

  // Ignore unrecognized fields
}

// Handle form submissions with file uploads
async function requestHandler(request: Request) {
  // Parse the form data from the request.body stream, passing any files
  // through your upload handler as they are parsed from the stream
  let formData = await parseFormData(request, uploadHandler)

  let avatarFilename = formData.get('user-avatar')

  if (avatarFilename != null) {
    console.log(`User avatar uploaded to ${avatarFilename}`)
  } else {
    console.log(`No user avatar file was uploaded`)
  }
}
```

To limit the maximum size of files that are uploaded, or the maximum number of files that may be uploaded in a single request, use the `maxFileSize` and `maxFiles` options.

```ts
import { MaxFilesExceededError, MaxFileSizeExceededError } from 'remix/form-data-parser'

const oneKb = 1024
const oneMb = 1024 * oneKb

try {
  let formData = await parseFormData(request, {
    maxFiles: 5,
    maxFileSize: 10 * oneMb,
  })
} catch (error) {
  if (error instanceof MaxFilesExceededError) {
    console.error(`Request may not contain more than 5 files`)
  } else if (error instanceof MaxFileSizeExceededError) {
    console.error(`Files may not be larger than 10 MiB`)
  } else {
    console.error(`An unknown error occurred:`, error)
  }
}
```

If you're looking for a more flexible storage solution for `File` objects that are uploaded, this library pairs really well with [the `file-storage` library](https://github.com/remix-run/remix/tree/main/packages/file-storage) for keeping files in various storage backends.

```ts
import { LocalFileStorage } from 'remix/file-storage/local'
import type { FileUpload } from 'remix/form-data-parser'
import { parseFormData } from 'remix/form-data-parser'

// Set up storage for uploaded files
const fileStorage = new LocalFileStorage('/uploads/user-avatars')

// Define how to handle incoming file uploads
async function uploadHandler(fileUpload: FileUpload) {
  // Is this file upload from the <input type="file" name="user-avatar"> field?
  if (fileUpload.fieldName === 'user-avatar') {
    let storageKey = `user-${user.id}-avatar`

    // Put the file in storage
    await fileStorage.set(storageKey, fileUpload)

    // Return a lazy File object that can access the stored file when needed
    return fileStorage.get(storageKey)
  }

  // Ignore unrecognized fields
}
```

## Demos

The [`demos` directory](https://github.com/remix-run/remix/tree/main/packages/form-data-parser/demos) contains working demos:

- [`demos/node`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser/demos/node) - using form-data-parser with file-storage in Node.js

## Related Packages

- [`file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage) - A simple key/value interface for storing `FileUpload` objects you get from the parser
- [`multipart-parser`](https://github.com/remix-run/remix/tree/main/packages/multipart-parser) - The parser used internally for parsing `multipart/form-data` HTTP messages

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
