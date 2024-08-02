import { parseMultipartRequest } from '@mjackson/multipart-parser';

const server = Bun.serve({
  port: 3000,
  async fetch(request) {
    if (request.method === 'GET') {
      return new Response(
        `
<!DOCTYPE html>
<html>
  <head>
    <title>multipart-parser Bun Server Example</title>
  </head>
  <body>
    <h1>multipart-parser Bun Server Example</h1>
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
      let parts = [];

      for await (let part of parseMultipartRequest(request)) {
        if (part.isFile) {
          // let uniqueKey = `upload-${new Date().getTime()}-${Math.random()
          //   .toString(36)
          //   .slice(2, 8)}`;

          let bytes = await part.bytes();
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
    }

    return new Response('Method Not Allowed', { status: 405 });
  },
});

console.log(`Server listening on http://localhost:${server.port} ...`);
