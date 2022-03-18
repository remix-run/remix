# Upload images to cloudinary

This is a simple example of using the remix buildin [uploadHandler](https://remix.run/docs/en/v1/api/remix#uploadhandler) and Form with multipart data to upload a file with the built-in local uploader and upload an image file to cloudinary with a custom uploader and display it.

The relevent files are:

```
├── app
│   ├── routes
│   │   ├── cloudinary-upload.tsx // upload to cloudinary
│   │   └── local-upload.tsx // local upload using build in [createfileuploadhandler](https://remix.run/docs/en/v1/api/remix#unstable_createfileuploadhandler)
│   └── utils
│       └── utils.server.ts  // init cloudinary nodejs client on server side
|── .env // holds cloudinary credentails
```

## Steps to set up cloudinary

- sign up a free [cloudinary account](https://cloudinary.com/)
- get the cloudname, api key and api secret from dashboard
- copy the .env.sample to .env and populate the credentials

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/file-and-cloudinary-upload)

## Related Links

- [Handle Multiple Part Forms (File Uploads)](https://remix.run/docs/en/v1/api/remix#unstable_parsemultipartformdata-node)
- [Upload Handler](https://remix.run/docs/en/v1/api/remix#uploadhandler)
- [Custom Uploader](https://remix.run/docs/en/v1/api/remix#custom-uploadhandler)
