export function requestMethodCanHaveBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD'
}

export function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return bufferToBytes(buffer).buffer
}

export function bufferToBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  let bytes = new Uint8Array(buffer.byteLength)
  bytes.set(buffer)
  return bytes
}

export function bodyUnusable(): TypeError {
  return new TypeError('Body is unusable: Body has already been read')
}
