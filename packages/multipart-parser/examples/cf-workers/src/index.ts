import { MultipartParseError, parseMultipartRequest } from '@mjackson/multipart-parser';

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method === 'GET') {
      return new Response(
        `
<!DOCTYPE html>
<html>
  <head>
    <title>multipart-parser CF Workers Example</title>
  </head>
  <body>
    <h1>multipart-parser CF Workers Example</h1>
    <form method="post" enctype="multipart/form-data">
      <p><input name="text1" type="text" /></p>
      <p><input name="file1" type="file" /></p>
      <p><button type="submit">Submit</button></p>
    </form>
  </body>
</html>
`,
        {
          headers: { 'Content-Type': 'text/html' },
        },
      );
    }

    if (request.method === 'POST') {
      try {
        let bucket = env.MULTIPART_UPLOADS;
        let parts = [];

        for await (let part of parseMultipartRequest(request)) {
          if (part.isFile) {
            let uniqueKey = `upload-${new Date().getTime()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`;

            // Put the file in R2.

            // Ideally we could stream part.body directly, but Cloudflare's R2
            // API requires a FixedLengthStream and unfortunately we don't know
            // the length of the stream at this point because browsers don't send
            // Content-Length headers with file uploads.
            // await bucket.put(uniqueKey, part.body);

            // So instead, we have to buffer the entire file in memory and then
            // upload it to R2.
            let bytes = await part.bytes();
            await bucket.put(uniqueKey, bytes, {
              httpMetadata: {
                contentType: part.headers.get('Content-Type')!,
              },
            });

            parts.push({
              name: part.name,
              filename: part.filename,
              mediaType: part.mediaType,
              size: bytes.byteLength,
            });
          } else {
            parts.push({
              name: part.name,
              value: await part.text(),
            });
          }
        }

        return new Response(JSON.stringify({ parts }, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        if (error instanceof MultipartParseError) {
          return new Response(`Error: ${error.message}`, { status: 400 });
        }

        console.error(error);

        return new Response('Internal Server Error', { status: 500 });
      }
    }

    return new Response('Method Not Allowed', { status: 405 });
  },
} satisfies ExportedHandler<Env>;
