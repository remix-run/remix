import * as fsp from 'node:fs/promises'
import * as http from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'

import { createFsFileStorage } from '@remix-run/file-storage/fs'
import {
  MultipartParseError,
  MaxFileSizeExceededError,
  parseFormData,
} from '@remix-run/form-data-parser'
import { createRequestListener } from '@remix-run/node-fetch-server'

const PORT = 44100

const oneMb = 1024 * 1024
const maxFileSize = 10 * oneMb

const fileStorage = createFsFileStorage(await fsp.mkdtemp(path.join(os.tmpdir(), 'uploads-')))

/** @type (file: File) => Promise<string> */
async function getDataUrl(file) {
  let buffer = Buffer.from(await file.arrayBuffer())
  return `data:${file.type};base64,${buffer.toString('base64')}`
}

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
      )
    }

    if (request.method === 'POST') {
      try {
        let formData = await parseFormData(request, { maxFileSize }, async (upload) => {
          let file = await fileStorage.put('image-upload', upload)
          return file.size === 0 ? null : file
        })

        let text = /** @type string | null */ (formData.get('text1'))
        let image = /** @type File | null */ (formData.get('image1'))

        return new Response(
          `<!DOCTYPE html>
<html>
  <head>
    <title>form-data-parser Submitted Data</title>
  </head>
  <body>
    <h1>form-data-parser Submitted Data</h1>
    ${text ? `<p>You entered this text: ${text}</p>` : '<p>You did not enter any text.</p>'}
    ${image ? `<p>You uploaded this image:</p><p><img src="${await getDataUrl(image)}" /></p>` : '<p>You did not upload an image.</p>'}
  </body>
</html>`,
          {
            headers: {
              'Content-Type': 'text/html',
            },
          },
        )
      } catch (error) {
        if (error instanceof MaxFileSizeExceededError) {
          return new Response(error.message, { status: 413 })
        }

        if (error instanceof MultipartParseError) {
          return new Response(error.message, { status: 400 })
        }

        console.error(error)

        return new Response('Internal Server Error', { status: 500 })
      }
    }

    return new Response('Method Not Allowed', { status: 405 })
  }),
)

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT} ...`)
})
