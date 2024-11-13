---
title: unstable_parseMultipartFormData
---

# `unstable_parseMultipartFormData`

Allows you to handle multipart forms (file uploads) for your app.

Would be useful to understand [the Browser File API][the-browser-file-api] to know how to use this API.

It's to be used in place of `request.formData()`.

```diff
- const formData = await request.formData();
+ const formData = await unstable_parseMultipartFormData(request, uploadHandler);
```

For example:

```tsx lines=[4-7,12,25]
export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler // <-- we'll look at this deeper next
  );

  // the returned value for the file field is whatever our uploadHandler returns.
  // Let's imagine we're uploading the avatar to s3,
  // so our uploadHandler returns the URL.
  const avatarUrl = formData.get("avatar");

  // update the currently logged in user's avatar in our database
  await updateUserAvatar(request, avatarUrl);

  // success! Redirect to account page
  return redirect("/account");
};

export default function AvatarUploadRoute() {
  return (
    <Form method="post" encType="multipart/form-data">
      <label htmlFor="avatar-input">Avatar</label>
      <input id="avatar-input" type="file" name="avatar" />
      <button>Upload</button>
    </Form>
  );
}
```

To read the contents of an uploaded file, use one of the methods it inherits from [the Blob API][the-blob-api]. For example, `.text()` asynchronously returns the text contents of the file, and `.arrayBuffer()` returns the binary contents.

### `uploadHandler`

The `uploadHandler` is the key to the whole thing. It's responsible for what happens to the multipart/form-data parts as they are being streamed from the client. You can save it to disk, store it in memory, or act as a proxy to send it somewhere else (like a file storage provider).

Remix has two utilities to create `uploadHandler`s for you:

- `unstable_createFileUploadHandler`
- `unstable_createMemoryUploadHandler`

These are fully featured utilities for handling fairly simple use cases. It's not recommended to load anything but quite small files into memory. Saving files to disk is a reasonable solution for many use cases. But if you want to upload the file to a file hosting provider, then you'll need to write your own.

Other handlers than `unstable_createMemoryUploadHandler` can't store non-file values as `string` objects. You should combine them by `unstable_composeUploadHandlers` if there're non-file entries in the request.

[the-browser-file-api]: https://developer.mozilla.org/en-US/docs/Web/API/File
[the-blob-api]: https://developer.mozilla.org/en-US/docs/Web/API/Blob
