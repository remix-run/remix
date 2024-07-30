import * as http from 'node:http';

import { MultipartParseError } from '@mjackson/multipart-parser';
import { parseMultipartRequest } from '@mjackson/multipart-parser/node';

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/html',
    });
    res.end(`
<!DOCTYPE html>
<html>
  <head>
    <title>multipart-parser Node Server Example</title>
  </head>
  <body>
    <h1>multipart-parser Node Server Example</h1>
    <form method="post" enctype="multipart/form-data">
      <p><input name="text1" type="text" /></p>
      <p><input name="file1" type="file" /></p>
      <p><button type="submit">Submit</button></p>
    </form>
  </body>
</html>
`);
  } else if (req.method === 'POST') {
    try {
      /** @type any[] */
      let parts = [];

      for await (let part of parseMultipartRequest(req)) {
        if (part.isFile) {
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

      res.writeHead(200, {
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify({ parts }, null, 2));
    } catch (error) {
      console.error(error);

      if (error instanceof MultipartParseError) {
        res.writeHead(400);
        res.end('Bad Request');
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    }
  } else {
    res.writeHead(405);
    res.end('Method Not Allowed');
  }
});

server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});
