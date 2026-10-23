# file-storage-s3

S3 backend for [`remix/file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage). Use this package when you want the `FileStorage` API backed by AWS S3 or an S3-compatible provider.

## Features

- **S3-Compatible API** - Works with AWS S3 and S3-compatible APIs (e.g. MinIO, LocalStack)
- **Streaming Uploads** - Streams large files to S3 with multipart uploads, so they don't have to fit in memory
- **Metadata Preservation** - Preserves `File` metadata (`name`, `type`, `size`, `lastModified`)
- **Runtime-Agnostic Signing** - Uses [`aws4fetch`](https://github.com/mhart/aws4fetch) for SigV4 signing

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createS3FileStorage } from 'remix/file-storage/s3'

let storage = createS3FileStorage({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  bucket: 'my-app-uploads',
  region: 'us-east-1',
})

await storage.set(
  'uploads/hello.txt',
  new File(['hello world'], 'hello.txt', { type: 'text/plain' }),
)
let file = await storage.get('uploads/hello.txt')
await storage.remove('uploads/hello.txt')
```

For S3-compatible providers such as MinIO and LocalStack, set `endpoint` and `forcePathStyle: true`.

## Large Files

`storage.set()` streams files to S3 instead of reading them into memory first. Files larger than one part are sent with an [S3 multipart upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html), so only about two parts are held in memory per upload. Smaller files are sent with a single `PUT`.

Set `partSize` to change the part size. It defaults to 8 MiB and must be at least 5 MiB. S3 allows up to 10,000 parts, so the default supports files up to about 78 GiB.

```ts
let storage = createS3FileStorage({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  bucket: 'my-app-uploads',
  region: 'us-east-1',
  partSize: 16 * 1024 * 1024,
})
```

Anything with the shape of a `File` works, including streaming sources that can only be read with `stream()` and don't know their `size` up front, such as a file upload read straight from a request. Those are sent to S3 as they're read, without being buffered.

If an upload fails, it is aborted so S3 doesn't keep its parts. It's still a good idea to add a [lifecycle rule](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html) that removes incomplete multipart uploads, in case a process exits before it can abort one.

`storage.put()` uses the same upload path, but it holds the whole file in memory because it returns a `File` with the stored contents. Use `set()` for large files.

## Related Packages

- [`file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage) - Core `FileStorage` interface and filesystem/memory backends
- [`form-data-parser`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser) - Parses `multipart/form-data` uploads into `FileUpload` objects

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
