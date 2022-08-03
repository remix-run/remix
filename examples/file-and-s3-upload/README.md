# Upload images to S3

This is a simple example of using the remix built-in [uploadHandler](https://remix.run/docs/en/v1/api/remix#uploadhandler) and Form with multipart data to upload a file with the built-in local uploader and upload an image file to S3 with a custom uploader and display it. You can test it locally by running the dev server and opening the path `/s3-upload` in your browser.

The relevent files are:

```
├── app
│   ├── routes
│   │   ├── s3-upload.tsx // upload to S3
│   └── utils
│       └── s3.server.ts  // init S3 client on server side
|── .env // holds AWS S3 credentails
```

## Steps to set up an S3 bucket

- Sign up for an [AWS account](https://portal.aws.amazon.com/billing/signup) - this will require a credit card
- Create an S3 bucket in your desired region
- Create an access key pair for an IAM user that has access to the bucket
- Copy the .env.sample to .env and fill in the S3 bucket, the region as well as the access key and secret key from the IAM user

Note: in order for the image to be displayed after being uploaded to your S3 bucket in this example, the bucket needs to have public access enabled, which is potentially dangerous.

> :warning: Lambda imposes a [limit of 6MB](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html) on the invocation payload size. If you use this example with Remix running on Lambda, you can only update files with a size smaller than 6MB.

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/file-and-s3-upload)

## Related Links

- [Handle Multiple Part Forms (File Uploads)](https://remix.run/docs/en/v1/api/remix#unstable_parsemultipartformdata-node)
- [Upload Handler](https://remix.run/docs/en/v1/api/remix#uploadhandler)
- [Custom Uploader](https://remix.run/docs/en/v1/api/remix#custom-uploadhandler)
