import * as fsp from 'node:fs/promises'
import * as http from 'node:http'
import { createRequestListener } from '@remix-run/node-fetch-server'
import tmp from 'tmp'

import { MultipartParseError, parseMultipartRequest } from '@remix-run/multipart-parser'

const PORT = 44100

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handler(request) {
  if (request.method === 'GET') {
    return new Response(
      `
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
`,
      {
        headers: { 'Content-Type': 'text/html' },
      },
    )
  }

  if (request.method === 'POST') {
    try {
      /** @type any[] */
      let parts = []

      for await (let part of parseMultipartRequest(request)) {
        if (part.isFile) {
          let tmpfile = tmp.fileSync()
          await fsp.writeFile(tmpfile.name, part.body)
          let { size } = await fsp.stat(tmpfile.name)

          parts.push({
            name: part.name,
            filename: part.filename,
            mediaType: part.mediaType,
            size,
            file: tmpfile.name,
          })
        } else {
          parts.push({ name: part.name, value: await part.text() })
        }
      }

      return new Response(JSON.stringify({ parts }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      if (error instanceof MultipartParseError) {
        return new Response(`Error: ${error.message}`, {
          status: 400,
          headers: { Connection: 'close' },
        })
      }

      console.error(error)

      return new Response('Internal Server Error', { status: 500 })
    }
  }

  return new Response('Method Not Allowed', { status: 405 })
}

const server = http.createServer(createRequestListener(handler))

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT} ...`)
})
