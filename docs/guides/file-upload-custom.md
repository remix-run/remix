---
title: File Uploads Custom
toc: false
---
# Customizing File Uploads in Remix with S3 and Local Storage
---
#### Upload Locally
To upload a file to a local directory use `unstable_createFileUploadHandler` and `unstable_composeUploadHandlers`

**Example:**

```tsx
export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const uploadHandler = unstable_composeUploadHandlers(
    unstable_createFileUploadHandler({
      maxPartSize: 5_000_000,
      file: ({ filename }) => filename,
      directory: './public/uploads' // defaults os.tmpdir()
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

You may want to upload the file to a remote location in which case will want to create your own `createFileUploadHandler`

#### Using the `FileUploadHandler` closure to create a custom handler
If you need to do something beyond write to disk you can compose an upload handler to do whatever you need! We'll use an AWS s3 upload as an example 

**AWS S3 Upload Example:**
``` .ts
// S3upload.server.ts
import {S3} from "aws-sdk";
import { Readable } from "stream";
import { UploadHandler} from '@remix-run/node';

export const s3UploadHandler: UploadHandler = async ({ filename, data}) => {
  // If no filename, don't handle the upload.
  if (!filename) return undefined;
  
  // Construct the Key for the S3 object. This could include a directory path.
  const Key = `uploads/${filename}`;
  
  //data is type AsyncIterable<Uint8Array> convert to Readable Stream
  const stream = Readable.from(data);

  // Upload the file to S3
  try {
    const s3Response = await s3.upload({
      Bucket: bucketname,
      Key,
      Body: stream,
    }).promise();

    
    return s3Response.Location;
  } catch (error) {
    throw new Error(`Error uploading file: ${error}`);
  }
};
```

We passed only passed the `filename` and `data` arguments from `UploadHandler` to our Custom `s3UploadHandler` but the closure can include:
- `name` 
- `filename` 
- `contentType`
- `data`

Notice that our custom `s3UploadHandler` no-longer includes safety arguments `maxPartSize` or `avoidFileConflicts`. If we want to add additional arguments to our UploadHandler we need to wrap it in another function. Lets add A `maxPartSize` argument to our example!

**AWS S3 Upload Add Arguments:**
``` ts
//... existing imports
export function createS3uploadHandler(maxPartSize: number): UploadHandler {
  return async ({ filename, data}) => {
    // If no filename, don't handle the upload.
    if (!filename) return undefined;
    if (!bucketname) return undefined;
    const Key = `uploads/${filename}`;
    
    //Use maxPartSize to check against file size
    let size = 0;
    let chunks = [];
    for await (let chunk of data) {
        size += chunk.byteLength;
        if (size > maxPartSize) {
          return undefined // Don't upload file if it is too large
        };
      };
    const stream = Readable.from(data);
    
    // Upload the file to S3
    try {
      const s3Response = await s3.upload({
        Bucket: bucketname,
        Key,
        Body: stream,
      }).promise();
      return s3Response.Location;
    } catch (error) {
      throw new Error(`Error uploading file: ${error}`);
    }
  };
};
```

But wait this method loads the file into memory and will end up Blocking!!! 😖
`data` is type `AsyncIterable<Uint8Array>` so we need to find a way to check it's size without consuming it but also without loading it into memory.

**Create a Generator Function**
```ts
//... existing imports
async function* withSizeCheck(
  data: AsyncIterable<Uint8Array>, 
  maxPartSize: number
): AsyncIterable<Uint8Array> {
  let size = 0;
  for await (const chunk of data) {
      size += chunk.byteLength;
      if (size > maxPartSize) {
          throw new Error("File too large");
      }
      yield chunk;
  }
}
//... our previous code
```
Now we just add our this generator into our `createS3UploadHandler` and the size of an upload can be limited again!

``` ts
export function createS3uploadHandler(maxPartSize: number): UploadHandler {
  return async ({ filename, data}) => {
    if (!filename) return undefined;
    if (!bucketname) return undefined;
    const Key = `uploads/${filename}`;
    
    try {
      //use our with size chack to validate file size
      const checkedData = withSizeCheck(data, maxPartSize);
      const stream = Readable.from(checkedData);  
      const s3Response = await s3.upload({
        Bucket: bucketname,
        Key,
        Body: stream,
      }).promise();
      return s3Response.Location;
    } catch (error) {
      throw new Error(`Error uploading file: ${error}`);
    }
  };
};
```