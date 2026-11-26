import * as http from 'node:http'
import * as stream from 'node:stream'

const PORT = process.env.PORT || 3000

let server = http.createServer(async (req, res) => {
  let method = req.method ?? 'GET'
  let headerBytes = 0
  for (let [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (let item of value) {
        headerBytes += key.length + item.length
      }
    } else if (value != null) {
      headerBytes += key.length + value.length
    }
  }

  let chunks: Buffer[] = []
  for await (let chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  let body = Buffer.concat(chunks).toString()
  let html = `<html><body><h1>${method} ${headerBytes} ${body.length}</h1></body></html>`

  res.writeHead(200, { 'Content-Type': 'text/html' })

  let responseBody = new stream.Readable({
    read() {
      this.push(html)
      this.push(null)
    },
  })

  responseBody.pipe(res)
})

server.listen(PORT)
