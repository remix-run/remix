import * as net from 'node:net'

const CRLF = '\r\n'
const CRLF_BUFFER = Buffer.from(CRLF)
const END_RESPONSE = Buffer.from(`END${CRLF}`)
const DEFAULT_PORT = 11211
const SOCKET_TIMEOUT_MS = 5_000

type MemcacheAddress = {
  host: string
  port: number
}

export interface MemcacheClient {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, ttlSeconds: number) => Promise<void>
  delete: (key: string) => Promise<void>
}

export function createMemcacheClient(server: string): MemcacheClient {
  let address = parseMemcacheServer(server)

  return {
    async get(key) {
      return await getMemcacheValue(address, key)
    },
    async set(key, value, ttlSeconds) {
      await setMemcacheValue(address, key, value, ttlSeconds)
    },
    async delete(key) {
      await deleteMemcacheValue(address, key)
    },
  }
}

async function getMemcacheValue(address: MemcacheAddress, key: string): Promise<string | null> {
  let response = await sendMemcacheCommand(address, `get ${key}${CRLF}`, isGetResponseComplete)

  if (response.equals(END_RESPONSE)) {
    return null
  }

  let lineEnd = response.indexOf(CRLF)
  if (lineEnd === -1) {
    throw new Error(`Invalid Memcache get response: ${response.toString('utf8')}`)
  }

  let firstLine = response.subarray(0, lineEnd).toString('utf8')
  let match = /^VALUE (\S+) (\d+) (\d+)$/.exec(firstLine)
  if (match == null) {
    throw new Error(`Invalid Memcache get response: ${response.toString('utf8')}`)
  }
  if (match[1] !== key) {
    throw new Error(`Memcache returned value for unexpected key: ${match[1]}`)
  }

  let bytes = Number(match[3])
  if (!Number.isInteger(bytes) || bytes < 0) {
    throw new Error(`Invalid Memcache value length: ${match[3]}`)
  }

  let valueStart = lineEnd + CRLF_BUFFER.length
  let valueEnd = valueStart + bytes
  let expectedLength = valueEnd + CRLF_BUFFER.length + END_RESPONSE.length

  if (response.length !== expectedLength) {
    throw new Error(`Invalid Memcache get response length: ${response.toString('utf8')}`)
  }
  if (!response.subarray(valueEnd, valueEnd + CRLF_BUFFER.length).equals(CRLF_BUFFER)) {
    throw new Error('Invalid Memcache get response: missing value terminator')
  }
  if (!response.subarray(valueEnd + CRLF_BUFFER.length).equals(END_RESPONSE)) {
    throw new Error('Invalid Memcache get response: missing END terminator')
  }

  return response.subarray(valueStart, valueEnd).toString('utf8')
}

async function setMemcacheValue(
  address: MemcacheAddress,
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  let valueBuffer = Buffer.from(value, 'utf8')
  let commandBuffer = Buffer.from(
    `set ${key} 0 ${ttlSeconds} ${valueBuffer.byteLength}${CRLF}`,
    'utf8',
  )
  let payload = Buffer.concat([commandBuffer, valueBuffer, CRLF_BUFFER])

  let response = await sendMemcacheCommand(address, payload, isLineResponseComplete)
  let status = parseSingleLineResponse(response, 'set')

  if (status !== 'STORED') {
    throw new Error(`Memcache set failed: ${status}`)
  }
}

async function deleteMemcacheValue(address: MemcacheAddress, key: string): Promise<void> {
  let response = await sendMemcacheCommand(address, `delete ${key}${CRLF}`, isLineResponseComplete)
  let status = parseSingleLineResponse(response, 'delete')

  if (status === 'DELETED' || status === 'NOT_FOUND') {
    return
  }

  throw new Error(`Memcache delete failed: ${status}`)
}

async function sendMemcacheCommand(
  address: MemcacheAddress,
  command: string | Buffer,
  isComplete: (response: Buffer) => boolean,
): Promise<Buffer> {
  let socket = await connectToMemcache(address)

  try {
    await writeToSocket(socket, command)
    return await readFromSocket(socket, isComplete)
  } finally {
    socket.destroy()
  }
}

async function connectToMemcache(address: MemcacheAddress): Promise<net.Socket> {
  return await new Promise((resolve, reject) => {
    let socket = net.createConnection({ host: address.host, port: address.port })
    let settled = false

    socket.setNoDelay(true)
    socket.setTimeout(SOCKET_TIMEOUT_MS)

    function finalize(error?: Error): void {
      if (settled) {
        return
      }

      settled = true
      socket.off('connect', onConnect)
      socket.off('error', onError)
      socket.off('timeout', onTimeout)

      if (error) {
        socket.destroy()
        reject(error)
        return
      }

      resolve(socket)
    }

    function onConnect(): void {
      finalize()
    }

    function onError(error: Error): void {
      finalize(
        new Error(
          `Failed to connect to Memcache ${address.host}:${address.port}: ${error.message}`,
        ),
      )
    }

    function onTimeout(): void {
      finalize(new Error(`Timed out connecting to Memcache ${address.host}:${address.port}`))
    }

    socket.on('connect', onConnect)
    socket.on('error', onError)
    socket.on('timeout', onTimeout)
  })
}

async function writeToSocket(socket: net.Socket, command: string | Buffer): Promise<void> {
  await new Promise((resolve, reject) => {
    socket.write(command, (error) => {
      if (error) {
        reject(new Error(`Failed to write Memcache command: ${error.message}`))
        return
      }

      resolve(undefined)
    })
  })
}

async function readFromSocket(
  socket: net.Socket,
  isComplete: (response: Buffer) => boolean,
): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    let chunks: Buffer[] = []
    let totalLength = 0
    let settled = false

    function finalize(response?: Buffer, error?: Error): void {
      if (settled) {
        return
      }

      settled = true
      socket.off('data', onData)
      socket.off('error', onError)
      socket.off('end', onEnd)
      socket.off('timeout', onTimeout)

      if (error) {
        reject(error)
        return
      }

      resolve(response as Buffer)
    }

    function onData(chunk: Buffer): void {
      chunks.push(chunk)
      totalLength += chunk.length

      let response = Buffer.concat(chunks, totalLength)
      if (isComplete(response)) {
        finalize(response)
      }
    }

    function onError(error: Error): void {
      finalize(undefined, new Error(`Memcache request failed: ${error.message}`))
    }

    function onEnd(): void {
      finalize(
        undefined,
        new Error('Memcache server closed the connection before response completed'),
      )
    }

    function onTimeout(): void {
      finalize(undefined, new Error('Timed out waiting for Memcache response'))
    }

    socket.on('data', onData)
    socket.on('error', onError)
    socket.on('end', onEnd)
    socket.on('timeout', onTimeout)
  })
}

function isLineResponseComplete(response: Buffer): boolean {
  return response.indexOf(CRLF) !== -1
}

function parseSingleLineResponse(response: Buffer, command: string): string {
  let lineEnd = response.indexOf(CRLF)
  if (lineEnd === -1) {
    throw new Error(`Invalid Memcache ${command} response: ${response.toString('utf8')}`)
  }
  if (lineEnd + CRLF_BUFFER.length !== response.length) {
    throw new Error(`Invalid Memcache ${command} response: ${response.toString('utf8')}`)
  }

  return response.subarray(0, lineEnd).toString('utf8')
}

function isGetResponseComplete(response: Buffer): boolean {
  if (response.length < END_RESPONSE.length) {
    return false
  }

  if (response.equals(END_RESPONSE)) {
    return true
  }

  let lineEnd = response.indexOf(CRLF)
  if (lineEnd === -1) {
    return false
  }

  let firstLine = response.subarray(0, lineEnd).toString('utf8')
  let match = /^VALUE \S+ \d+ (\d+)$/.exec(firstLine)
  if (match == null) {
    return true
  }

  let bytes = Number(match[1])
  if (!Number.isInteger(bytes) || bytes < 0) {
    return true
  }

  let expectedLength =
    lineEnd + CRLF_BUFFER.length + bytes + CRLF_BUFFER.length + END_RESPONSE.length
  return response.length >= expectedLength
}

function parseMemcacheServer(server: string): MemcacheAddress {
  let url: URL

  try {
    url = new URL(`memcache://${server}`)
  } catch {
    throw new Error(`Invalid Memcache server "${server}". Expected format "host:port".`)
  }

  if (url.hostname === '') {
    throw new Error(`Invalid Memcache server "${server}": host is required.`)
  }
  if (
    url.username ||
    url.password ||
    (url.pathname !== '' && url.pathname !== '/') ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Invalid Memcache server "${server}". Expected format "host:port".`)
  }

  let port = url.port === '' ? DEFAULT_PORT : Number(url.port)

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid Memcache port in "${server}": ${url.port || '(empty)'}`)
  }

  return {
    host: url.hostname,
    port,
  }
}
