import { MultipartParseError, parseMultipartRequest } from '@remix-run/multipart-parser'
import tmp from 'tmp'

const server = Bun.serve({
  port: 44100,
  async fetch(request) {
    if (request.method === 'GET') {
      return new Response(
        `
<!DOCTYPE html>
<html>
  <head>
    <title>multipart-parser Bun Example</title>
  </head>
  <body>
    <h1>multipart-parser Bun Example</h1>
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
        let parts: any[] = []

        for await (let part of parseMultipartRequest(request)) {
          if (part.isFile) {
            let tmpfile = tmp.fileSync()
            Bun.write(tmpfile.name, part.bytes)

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

        return new Response(JSON.stringify({ parts }, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        if (error instanceof MultipartParseError) {
          return new Response(`Error: ${error.message}`, { status: 400 })
        }

        console.error(error)

        return new Response('Internal Server Error', { status: 500 })
      }
    }

    return new Response('Method Not Allowed', { status: 405 })
  },
})

console.log(`Server listening on http://localhost:${server.port} ...`)
