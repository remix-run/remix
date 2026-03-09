import * as assert from 'node:assert/strict'
import * as net from 'node:net'
import { afterEach, beforeEach, describe, it } from 'node:test'

import type { SessionStorage } from '@remix-run/session'
import { createMemcacheSessionStorage } from './memcache-storage.ts'

type FakeMemcacheServer = {
  address: string
  close: () => Promise<void>
}

describe('memcache session storage', () => {
  let server: FakeMemcacheServer

  beforeEach(async () => {
    server = await startFakeMemcacheServer()
  })

  afterEach(async () => {
    await server.close()
  })

  it('does not use unknown session IDs by default', async () => {
    let storage = createMemcacheSessionStorage(server.address)
    let session = await storage.read('unknown')
    assert.notEqual(session.id, 'unknown')
  })

  it('uses unknown session IDs if enabled', async () => {
    let storage = createMemcacheSessionStorage(server.address, { useUnknownIds: true })
    let session = await storage.read('unknown')
    assert.equal(session.id, 'unknown')
  })

  it('persists session data across requests', async () => {
    let storage = createMemcacheSessionStorage(server.address)
    let requests = createRequestHelpers(storage)

    let response1 = await requests.requestIndex()
    assert.equal(response1.session.get('count'), 1)

    let response2 = await requests.requestIndex(response1.cookie)
    assert.equal(response2.session.get('count'), 2)

    let response3 = await requests.requestIndex(response2.cookie)
    assert.equal(response3.session.get('count'), 3)
  })

  it('clears session data when the session is destroyed', async () => {
    let storage = createMemcacheSessionStorage(server.address)
    let requests = createRequestHelpers(storage)

    let response1 = await requests.requestIndex()
    assert.equal(response1.session.get('count'), 1)

    let response2 = await requests.requestIndex(response1.cookie)
    assert.equal(response2.session.get('count'), 2)

    let response3 = await requests.requestDestroy(response2.cookie)
    assert.ok(response3.session.destroyed)

    let response4 = await requests.requestIndex(response3.cookie)
    assert.equal(response4.session.get('count'), 1)
    assert.notEqual(response4.session.id, response3.session.id)
  })

  it('does not set a cookie when session data is not changed', async () => {
    let storage = createMemcacheSessionStorage(server.address)
    let requests = createRequestHelpers(storage)

    let response = await requests.requestSession()
    assert.equal(response.session.dirty, false)
    assert.equal(response.cookie, null)
  })

  it('makes flash data available only on the next request', async () => {
    let storage = createMemcacheSessionStorage(server.address)
    let requests = createRequestHelpers(storage)

    let response1 = await requests.requestSession()
    assert.equal(response1.session.get('message'), undefined)

    let response2 = await requests.requestFlash(response1.cookie)
    assert.equal(response2.session.get('message'), undefined)

    let response3 = await requests.requestSession(response2.cookie)
    assert.equal(response3.session.get('message'), 'success!')

    let response4 = await requests.requestSession(response3.cookie)
    assert.equal(response4.session.get('message'), undefined)
  })

  it('leaves old session data in storage by default when the id is regenerated', async () => {
    let storage = createMemcacheSessionStorage(server.address)
    let requests = createRequestHelpers(storage)

    let response1 = await requests.requestIndex()
    assert.equal(response1.session.get('count'), 1)

    let response2 = await requests.requestLogin(response1.cookie)
    assert.notEqual(response2.session.id, response1.session.id)

    let response3 = await requests.requestIndex(response2.cookie)
    assert.equal(response3.session.get('count'), 2)

    let response4 = await requests.requestIndex(response1.cookie)
    assert.equal(response4.session.get('count'), 2, 'old session data should still be in storage')
  })

  it('deletes old session data when the id is regenerated and the deleteOldSession option is true', async () => {
    let storage = createMemcacheSessionStorage(server.address)
    let requests = createRequestHelpers(storage)

    let response1 = await requests.requestIndex()
    assert.equal(response1.session.get('count'), 1)

    let response2 = await requests.requestLoginAndDeleteOldSession(response1.cookie)
    assert.notEqual(response2.session.id, response1.session.id)

    let response3 = await requests.requestIndex(response2.cookie)
    assert.equal(response3.session.get('count'), 2)

    let response4 = await requests.requestIndex(response1.cookie)
    assert.equal(response4.session.get('count'), 1, 'old session data should be deleted')
  })

  it('throws for invalid configuration', () => {
    assert.throws(
      () => createMemcacheSessionStorage(server.address, { ttlSeconds: -1 }),
      /ttlSeconds must be a non-negative integer/,
    )

    assert.throws(
      () => createMemcacheSessionStorage(server.address, { keyPrefix: 'invalid prefix' }),
      /keyPrefix may only contain printable ASCII characters without spaces/,
    )
  })
})

function createRequestHelpers(storage: SessionStorage) {
  return {
    async requestSession(cookie: string | null = null) {
      let session = await storage.read(cookie)
      return {
        cookie: await storage.save(session),
        session,
      }
    },
    async requestIndex(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.set('count', Number(session.get('count') ?? 0) + 1)
      return {
        cookie: await storage.save(session),
        session,
      }
    },
    async requestFlash(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.flash('message', 'success!')
      return {
        cookie: await storage.save(session),
        session,
      }
    },
    async requestDestroy(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.destroy()
      return {
        cookie: await storage.save(session),
        session,
      }
    },
    async requestLogin(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.regenerateId()
      return {
        cookie: await storage.save(session),
        session,
      }
    },
    async requestLoginAndDeleteOldSession(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.regenerateId(true)
      return {
        cookie: await storage.save(session),
        session,
      }
    },
  }
}

async function startFakeMemcacheServer(): Promise<FakeMemcacheServer> {
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
            socket.write('STORED\r\n')
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
            let key = getMatch[1]
            let value = store.get(key)

            if (value == null) {
              socket.write('END\r\n')
              continue
            }

            let header = `VALUE ${key} 0 ${value.byteLength}\r\n`
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
