import * as stream from 'node:stream'
import express from 'express'

const PORT = process.env.PORT || 3000

let app = express()

app.get('/', (_req, res) => {
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
