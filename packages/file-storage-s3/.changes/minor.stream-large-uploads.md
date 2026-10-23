`storage.set()` now streams files to S3 instead of reading the whole file into memory first. Files larger than one part are sent with an S3 multipart upload, so memory use stays at about two parts per upload no matter how large the file is. Smaller files are still sent with a single `PUT`. This pairs with `@remix-run/form-data-parser/future`, whose `FileUpload` streams straight from the request, so a large upload can go from the client to S3 without being buffered.

Use the new `partSize` option to set the part size, which defaults to 8 MiB and must be at least 5 MiB, the S3 minimum. If a multipart upload fails, it is aborted so S3 does not keep the uploaded parts. Consider also adding a bucket lifecycle rule that removes incomplete multipart uploads, in case a process exits before it can abort one.

```ts
let storage = createS3FileStorage({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  bucket: 'my-app-uploads',
  region: 'us-east-1',
  partSize: 16 * 1024 * 1024,
})
```

`storage.put()` uses the same upload path, but it still holds the whole file in memory because it returns a `File` with the stored contents. Use `set()` for large files.
