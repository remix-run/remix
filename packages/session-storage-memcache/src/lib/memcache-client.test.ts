import * as assert from 'node:assert/strict'
import * as net from 'node:net'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { createMemcacheClient } from './memcache-client.ts'

type FakeMemcacheServer = {
  address: string
  close: () => Promise<void>
}

type FakeMemcacheServerOptions = {
  malformedGetResponse?: string
  getResponseKey?: string
  setResponse?: string
  deleteResponse?: string
}

describe('memcache client', () => {
  let server: FakeMemcacheServer

  beforeEach(async () => {
    server = await startFakeMemcacheServer()
  })

  afterEach(async () => {
    await server.close()
  })

  it('reads and writes values', async () => {
    let client = createMemcacheClient(server.address)

    await client.set('test-key', 'hello', 0)
    let value = await client.get('test-key')

    assert.equal(value, 'hello')
  })

  it('returns null for unknown keys', async () => {
    let client = createMemcacheClient(server.address)
    let value = await client.get('missing-key')
    assert.equal(value, null)
  })

  it('deletes keys', async () => {
    let client = createMemcacheClient(server.address)

    await client.set('test-key', 'hello', 0)
    await client.delete('test-key')
    let value = await client.get('test-key')

    assert.equal(value, null)
  })

  it('treats missing keys as a successful delete', async () => {
    let client = createMemcacheClient(server.address)
    await client.delete('missing-key')
  })

  it('throws for invalid server addresses', () => {
    assert.throws(() => createMemcacheClient('127.0.0.1/path'), /Expected format "host:port"/)
  })

  it('throws when memcache returns an invalid get response', async () => {
    await server.close()
    server = await startFakeMemcacheServer({ malformedGetResponse: 'BROKEN\r\n' })

    let client = createMemcacheClient(server.address)

    await assert.rejects(() => client.get('test-key'), /Invalid Memcache get response: BROKEN/)
  })

  it('throws when get returns data for an unexpected key', async () => {
    await server.close()
    server = await startFakeMemcacheServer({ getResponseKey: 'different-key' })

    let client = createMemcacheClient(server.address)
    await client.set('test-key', 'hello', 0)

    await assert.rejects(
      () => client.get('test-key'),
      /Memcache returned value for unexpected key: different-key/,
    )
  })

  it('throws when set fails', async () => {
    await server.close()
    server = await startFakeMemcacheServer({ setResponse: 'NOT_STORED' })

    let client = createMemcacheClient(server.address)

    await assert.rejects(
      () => client.set('test-key', 'hello', 0),
      /Memcache set failed: NOT_STORED/,
    )
  })

  it('throws when delete fails', async () => {
    await server.close()
    server = await startFakeMemcacheServer({ deleteResponse: 'ERROR' })

    let client = createMemcacheClient(server.address)

    await assert.rejects(() => client.delete('test-key'), /Memcache delete failed: ERROR/)
  })
})

async function startFakeMemcacheServer(
  options?: FakeMemcacheServerOptions,
): Promise<FakeMemcacheServer> {
  return await new Promise((resolve, reject) => {
    let store = new Map<string, Buffer>()

    let server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0)
      let pendingSet: { key: string; bytes: number } | undefined

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk])

        while (true) {
          if (pendingSet) {
            let expected = pendingSet.bytes + 2

            if (buffer.length < expected) {
              return
            }

            let value = buffer.subarray(0, pendingSet.bytes)
            let suffix = buffer.subarray(pendingSet.bytes, expected)
            buffer = buffer.subarray(expected)

            if (!suffix.equals(Buffer.from('\r\n'))) {
              socket.write('CLIENT_ERROR bad data chunk\r\n')
              socket.end()
              return
            }

            store.set(pendingSet.key, Buffer.from(value))
            pendingSet = undefined
            socket.write(`${options?.setResponse ?? 'STORED'}\r\n`)
            continue
          }

          let lineEnd = buffer.indexOf('\r\n')
          if (lineEnd === -1) {
            return
          }

          let line = buffer.subarray(0, lineEnd).toString('utf8')
          buffer = buffer.subarray(lineEnd + 2)

          let getMatch = /^get (\S+)$/.exec(line)
          if (getMatch) {
            if (options?.malformedGetResponse) {
              socket.write(options.malformedGetResponse)
              continue
            }

            let key = getMatch[1]
            let value = store.get(key)

            if (value == null) {
              socket.write('END\r\n')
              continue
            }

            let responseKey = options?.getResponseKey ?? key
            let header = `VALUE ${responseKey} 0 ${value.byteLength}\r\n`
            socket.write(Buffer.concat([Buffer.from(header), value, Buffer.from('\r\nEND\r\n')]))
            continue
          }

          let setMatch = /^set (\S+) (\d+) (\d+) (\d+)$/.exec(line)
          if (setMatch) {
            let bytes = Number(setMatch[4])

            if (!Number.isInteger(bytes) || bytes < 0) {
              socket.write('CLIENT_ERROR bad command line format\r\n')
              continue
            }

            pendingSet = {
              key: setMatch[1],
              bytes,
            }
            continue
          }

          let deleteMatch = /^delete (\S+)$/.exec(line)
          if (deleteMatch) {
            if (options?.deleteResponse) {
              socket.write(`${options.deleteResponse}\r\n`)
              continue
            }

            let deleted = store.delete(deleteMatch[1])
            socket.write(deleted ? 'DELETED\r\n' : 'NOT_FOUND\r\n')
            continue
          }

          socket.write('ERROR\r\n')
        }
      })
    })

    server.once('error', (error) => {
      reject(error)
    })

    server.listen(0, '127.0.0.1', () => {
      let address = server.address()

      if (address == null || typeof address === 'string') {
        reject(new Error('Failed to resolve fake Memcache server address'))
        return
      }

      resolve({
        address: `127.0.0.1:${address.port}`,
        close: async () => {
          await new Promise<void>((resolveClose, rejectClose) => {
            server.close((error) => {
              if (error) {
                rejectClose(error)
                return
              }

              resolveClose()
            })
          })
        },
      })
    })
  })
}
