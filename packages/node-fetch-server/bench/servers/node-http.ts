import * as http from 'node:http'
import * as stream from 'node:stream'

const PORT = process.env.PORT || 3000

let server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })

  let body = new stream.Readable({
    read() {
      this.push('<html><body><h1>Hello, world!</h1></body></html>')
      this.push(null)
    },
  })

  body.pipe(res)
})

server.listen(PORT)
