import * as stream from 'node:stream'
import express from 'express'

const PORT = process.env.PORT || 3000

let app = express()

app.post('/', async (req, res) => {
  console.log(`method: ${req.method}`)

  for (let [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (let item of value) {
        console.log(`${key}: ${item}`)
      }
    } else if (value != null) {
      console.log(`${key}: ${value}`)
    }
  }

  let chunks: Buffer[] = []
  for await (let chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  console.log(`body: ${Buffer.concat(chunks).toString()}`)

  res.type('text/html')

  let body = new stream.Readable({
    read() {
      this.push('<html><body><h1>Hello, world!</h1></body></html>')
      this.push(null)
    },
  })

  body.pipe(res)
})

app.listen(PORT)
