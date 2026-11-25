import * as stream from 'node:stream'
import express from 'express'

const PORT = process.env.PORT || 3000

let app = express()

app.post('/', async (req, res) => {
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
  let html = `<html><body><h1>${req.method} ${headerBytes} ${body.length}</h1></body></html>`

  res.type('text/html')

  let responseBody = new stream.Readable({
    read() {
      this.push(html)
      this.push(null)
    },
  })

  responseBody.pipe(res)
})

app.listen(PORT)
