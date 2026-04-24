import { createRequestListener } from '@remix-run/node-fetch-server'
import * as http from 'node:http'

export interface CreateServerFunction {
  (handler: (req: Request) => Promise<Response>): Promise<{
    baseUrl: string
    close(): Promise<void>
  }>
}

export function createServer(handler: (req: Request) => Promise<Response>): Promise<{
  baseUrl: string
  close(): Promise<void>
}> {
  return new Promise((resolve, reject) => {
    let server = http.createServer(createRequestListener(handler))

    server.listen(0, '127.0.0.1', () => {
      let addr = server.address() as { port: number }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((r, rj) => server.close((e) => (e ? rj(e) : r()))),
      })
    })

    server.on('error', reject)
  })
}
