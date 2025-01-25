import * as fsp from 'node:fs/promises';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { LocalFileStorage } from '@mjackson/file-storage/local';
import { parseFormData } from '@mjackson/form-data-parser';
import { MultipartParseError, MaxFileSizeExceededError } from '@mjackson/multipart-parser';
import { createRequestListener } from '@mjackson/node-fetch-server';

const PORT = 3000;
const oneMb = 1024 * 1024;

const fileStorage = new LocalFileStorage(
  await fsp.mkdtemp(path.join(os.tmpdir(), 'form-data-parser-')),
);

const server = http.createServer(
  createRequestListener(async (request) => {
    if (request.method === 'GET') {
      return new Response(
        `<!DOCTYPE html>
<html>
  <head>
    <title>form-data-parser Node Example</title>
  </head>
  <body>
    <h1>form-data-parser Node Example</h1>
    <form method="post" enctype="multipart/form-data">
      <p>Enter some text: <input name="text1" type="text" /></p>
      <p>Select an image (max size 10MB): <input name="image1" type="file" accept="image/*" /></p>
      <p><button type="submit">Submit</button></p>
    </form>
  </body>
</html>`,
        {
          headers: {
            'Content-Type': 'text/html',
          },
        },
      );
    }

    if (request.method === 'POST') {
      try {
        let formData = await parseFormData(request, { maxFileSize: 10 * oneMb }, async (upload) => {
          let file = await fileStorage.put('image-upload', upload);
          return file.size === 0 ? null : file;
        });

        let text1 = formData.get('text1');
        let image1 = formData.get('image1');

        let dataUrl = '';
        if (image1) {
          let imageFile = /** @type File */ (image1);
          let buffer = Buffer.from(await imageFile.arrayBuffer());
          dataUrl = `data:${imageFile.type};base64,${buffer.toString('base64')}`;
        }

        return new Response(
          `<!DOCTYPE html>
<html>
  <head>
    <title>form-data-parser Submitted Data</title>
  </head>
  <body>
    <h1>form-data-parser Submitted Data</h1>
    ${text1 ? `<p>You entered this text: ${text1}</p>` : '<p>You did not enter any text.</p>'}
    ${image1 ? `<p>You uploaded this image:</p><p><img src="${dataUrl}" /></p>` : '<p>You did not upload an image.</p>'}
  </body>
</html>`,
          {
            headers: {
              'Content-Type': 'text/html',
            },
          },
        );
      } catch (error) {
        if (error instanceof MaxFileSizeExceededError) {
          return new Response(error.message, { status: 413 });
        }

        if (error instanceof MultipartParseError) {
          return new Response(error.message, { status: 400 });
        }

        console.error(error);

        return new Response('Internal Server Error', { status: 500 });
      }
    }

    return new Response('Method Not Allowed', { status: 405 });
  }),
);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT} ...`);
});
