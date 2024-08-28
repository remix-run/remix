# multipart-parser CF Workers Example

This is a demo of how you can upload a file directly to [a Cloudflare worker](https://developers.cloudflare.com/workers/) and store it in R2.

Notice: `multipart-parser` doesn't use any node-specific APIs, so this demo does not rely on Cloudflare Workers' [`nodejs_compat` flag](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) in order to run.
