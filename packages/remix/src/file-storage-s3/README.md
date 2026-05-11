# file-storage-s3

S3 backend for [`remix/file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage).
Use this package when you want the `FileStorage` API backed by AWS S3 or an S3-compatible provider.

## Features

- **S3-Compatible API** - Works with AWS S3 and S3-compatible APIs (e.g. MinIO, LocalStack)
- **Metadata Preservation** - Preserves `File` metadata (`name`, `type`, `lastModified`)
- **Runtime-Agnostic Signing** - Uses [`aws4fetch`](https://github.com/mhart/aws4fetch) for SigV4 signing

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createS3FileStorage } from 'remix/file-storage-s3'

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

## Related Packages

- [`file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage) - Core `FileStorage` interface and filesystem/memory backends
- [`form-data-parser`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser) - Parses `multipart/form-data` uploads into `FileUpload` objects

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
