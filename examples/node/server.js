import * as fs from 'node:fs';
import * as http from 'node:http';
import tmp from 'tmp';

import { MultipartParseError } from '@mjackson/multipart-parser';
import { parseMultipartRequest } from '@mjackson/multipart-parser/node';

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/html',
    });
    res.end(`
<!DOCTYPE html>
<html>
  <head>
    <title>multipart-parser Node Example</title>
  </head>
  <body>
    <h1>multipart-parser Node Example</h1>
    <form method="post" enctype="multipart/form-data">
      <p><input name="text1" type="text" /></p>
      <p><input name="file1" type="file" /></p>
      <p><button type="submit">Submit</button></p>
    </form>
  </body>
</html>
`);
    return;
  }

  if (req.method === 'POST') {
    try {
      let parts = [];

      for await (let part of parseMultipartRequest(req)) {
        if (part.isFile) {
          let tmpfile = tmp.fileSync();
          let byteLength = await writeFile(tmpfile.name, part.body);

          // Or, if you'd prefer to buffer you can do it like this:
          // let bytes = await part.bytes();
          // fs.writeFileSync(tmpfile.name, bytes, 'binary');
          // let byteLength = bytes.byteLength;

          parts.push({
            name: part.name,
            filename: part.filename,
            mediaType: part.mediaType,
            size: byteLength,
            file: tmpfile.name,
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
      return;
    } catch (error) {
      console.error(error);

      if (error instanceof MultipartParseError) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
      }

      res.writeHead(500);
      res.end('Internal Server Error');
      return;
    }
  }

  res.writeHead(405);
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT} ...`);
});

// Some lil' helpers

/** @type (filename: string, stream: ReadableStream<Uint8Array>) => Promise<number> */
async function writeFile(filename, stream) {
  let fileStream = fs.createWriteStream(filename);
  let bytesWritten = 0;

  await readStream(stream, (chunk) => {
    fileStream.write(chunk);
    bytesWritten += chunk.byteLength;
  });

  fileStream.end();

  return bytesWritten;
}

/** @type <T>(stream: ReadableStream<T>, callback: (value: T) => void) => Promise<void> */
async function readStream(stream, callback) {
  let reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      callback(value);
    }
  } finally {
    reader.releaseLock();
  }
}
