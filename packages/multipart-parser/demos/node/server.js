import * as fs from 'node:fs'
import * as http from 'node:http'
import tmp from 'tmp'

import { MultipartParseError, parseMultipartRequest } from '@remix-run/multipart-parser/node'

const PORT = 44100

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
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
`)
    return
  }

  if (req.method === 'POST') {
    try {
      /** @type any[] */
      let parts = []

      for await (let part of parseMultipartRequest(req)) {
        if (part.isFile) {
          let tmpfile = tmp.fileSync()
          fs.writeFileSync(tmpfile.name, part.bytes, 'binary')

          parts.push({
            name: part.name,
            filename: part.filename,
            mediaType: part.mediaType,
            size: part.size,
            file: tmpfile.name,
          })
        } else {
          parts.push({ name: part.name, value: part.text })
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ parts }, null, 2))
      return
    } catch (error) {
      if (error instanceof MultipartParseError) {
        res.writeHead(400, { 'Content-Type': 'text/plain', Connection: 'close' })
        res.end(`Error: ${error.message}`)
        return
      }

      console.error(error)

      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Internal Server Error')
      return
    }
  }

  res.writeHead(405)
  res.end('Method Not Allowed')
})

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT} ...`)
})
