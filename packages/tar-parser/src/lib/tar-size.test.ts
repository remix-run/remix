import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { parseTar, parseTarHeader, TarEntry, TarParseError } from './tar.ts'
import { computeChecksum } from './utils.ts'

function createHeader(size: number | string | Uint8Array, type = '0'): Uint8Array {
  let encoder = new TextEncoder()
  let block = new Uint8Array(512)
  block.set(encoder.encode('entry.txt'))
  block.set(
    size instanceof Uint8Array
      ? size
      : encoder.encode(typeof size === 'number' ? size.toString(8).padStart(11, '0') : size),
    124,
  )
  block.set(encoder.encode(type), 156)
  block.set(encoder.encode('ustar\0' + '00'), 257)
  setChecksum(block)
  return block
}

function setChecksum(block: Uint8Array): void {
  block.set(
    new TextEncoder().encode(computeChecksum(block).toString(8).padStart(6, '0') + '\0 '),
    148,
  )
}

function base256(size: bigint): Uint8Array {
  let field = new Uint8Array(12)
  field[0] = 0x80
  for (let i = 11; i > 0; i--) {
    field[i] = Number(size & 255n)
    size >>= 8n
  }
  return field
}

function paxSize(size: string): Uint8Array[] {
  let record = ` size=${size}\n`
  let length = record.length + 1
  while (String(length).length + record.length !== length) {
    length = String(length).length + record.length
  }
  let body = new TextEncoder().encode(`${length}${record}`)
  return [createHeader(body.length, 'x'), body, new Uint8Array(512 - body.length)]
}

async function assertInvalidArchive(chunks: Uint8Array[]): Promise<void> {
  let entries = 0
  await assert.rejects(
    () =>
      parseTar([...chunks, createHeader(0)], () => {
        entries++
      }),
    { name: 'TarParseError', message: 'Invalid tar entry size' },
  )
  assert.equal(entries, 0)
}

async function assertNoDeclaredAllocation(chunks: Uint8Array[]): Promise<void> {
  let native = Uint8Array
  let allocations: number[] = []
  let bodyResult: Promise<unknown> | undefined
  globalThis.Uint8Array = new Proxy(native, {
    construct(target, args) {
      if (typeof args[0] === 'number' && args[0] > 4096) {
        allocations.push(args[0])
        throw new Error('Unexpected allocation')
      }
      return Reflect.construct(target, args)
    },
  })

  try {
    await assert.rejects(
      () =>
        parseTar(chunks, (entry) => {
          bodyResult = entry.bytes().then(
            () => 'complete',
            (error: unknown) => error,
          )
        }),
      { name: 'TarParseError', message: 'Unexpected end of archive' },
    )
    assert.deepEqual(allocations, [])
    let error = await bodyResult
    assert.ok(error instanceof TarParseError)
    assert.equal(error.message, 'Unexpected end of archive')
  } finally {
    globalThis.Uint8Array = native
  }
}

describe('tar entry sizes', () => {
  it('does not allocate the declared octal size', { timeout: 1000 }, async () => {
    await assertNoDeclaredAllocation([createHeader(1024 ** 3), new Uint8Array(512)])
  })

  it('does not allocate the declared base-256 size', { timeout: 1000 }, async () => {
    await assertNoDeclaredAllocation([createHeader(base256(2n ** 40n)), new Uint8Array(512)])
  })

  it('does not allocate the declared PAX size', { timeout: 1000 }, async () => {
    await assertNoDeclaredAllocation([...paxSize('9007199254740991'), createHeader(0)])
  })

  it('rejects non-octal sizes before delivering entries', async () => {
    await assertInvalidArchive([createHeader('9')])
  })

  it('rejects partially numeric octal sizes', async () => {
    assert.throws(() => parseTarHeader(createHeader('17x')), TarParseError)
  })

  it('rejects negative base-256 sizes before delivering entries', async () => {
    let size = new Uint8Array(12).fill(255)
    size[10] = 253
    await assertInvalidArchive([createHeader(size)])
  })

  it('rejects base-256 negative one instead of decoding it as zero', async () => {
    await assertInvalidArchive([createHeader(new Uint8Array(12).fill(255))])
  })

  it('rejects unsupported base-256 markers', () => {
    let size = base256(0n)
    size[0] = 0x81
    assert.throws(() => parseTarHeader(createHeader(size)), TarParseError)
  })

  it('rejects base-256 sizes outside the safe integer range', () => {
    assert.throws(() => parseTarHeader(createHeader(base256(2n ** 53n))), TarParseError)
  })

  it('rejects invalid extension header sizes', async () => {
    await assertInvalidArchive([createHeader('9', 'x')])
  })

  it('rejects nonnumeric PAX sizes', async () => {
    await assertInvalidArchive([...paxSize('unknown'), createHeader(0)])
  })

  it('rejects negative PAX sizes', async () => {
    await assertInvalidArchive([...paxSize('-512'), createHeader(0)])
  })

  it('rejects fractional PAX sizes', async () => {
    await assertInvalidArchive([...paxSize('1.5'), createHeader(0)])
  })

  it('rejects partially numeric PAX sizes', async () => {
    await assertInvalidArchive([...paxSize('12x'), createHeader(0)])
  })

  it('rejects PAX sizes outside the safe integer range', async () => {
    await assertInvalidArchive([...paxSize('9007199254740992'), createHeader(0)])
  })

  it('preserves empty and padded octal size fields', () => {
    assert.equal(parseTarHeader(createHeader('')).size, 0)
    assert.equal(parseTarHeader(createHeader('            ')).size, 0)
    assert.equal(parseTarHeader(createHeader('   0000014 ')).size, 12)
    assert.equal(parseTarHeader(createHeader('\0\0' + '14\0')).size, 12)
    assert.equal(parseTarHeader(createHeader('777777777777')).size, 0o777777777777)
  })

  it('preserves safe base-256 sizes and signed metadata', () => {
    let header = createHeader(base256(BigInt(Number.MAX_SAFE_INTEGER)))
    header.fill(255, 136, 148)
    header[147] = 253
    setChecksum(header)
    assert.equal(parseTarHeader(header).size, Number.MAX_SAFE_INTEGER)
    assert.ok(Number(parseTarHeader(header).mtime) < 0)
  })

  it('uses PAX sizes for content and padding', async () => {
    let content: string[] = []
    await parseTar(
      [
        ...paxSize('0005'),
        createHeader(0),
        new TextEncoder().encode('hello'),
        new Uint8Array(507),
        createHeader(0),
      ],
      async (entry) => {
        let index = content.length
        content.push('')
        content[index] = await entry.text()
      },
    )
    assert.deepEqual(content, ['hello', ''])
  })

  it('preserves zero PAX sizes and empty PAX size overrides', async () => {
    let sizes: number[] = []
    await parseTar(
      [...paxSize('0'), createHeader(12), ...paxSize(''), createHeader(0)],
      (entry) => {
        sizes.push(entry.size)
      },
    )
    assert.deepEqual(sizes, [0, 0])
  })

  it('uses a valid PAX size instead of the overridden header field', async () => {
    let content: string | undefined
    await parseTar(
      [
        ...paxSize('5'),
        createHeader('unknown'),
        new TextEncoder().encode('hello'),
        new Uint8Array(507),
      ],
      async (entry) => {
        content = await entry.text()
      },
    )
    assert.equal(content, 'hello')
  })

  it('validates extension header sizes even when a PAX override is pending', async () => {
    await assertInvalidArchive([...paxSize('0'), createHeader('unknown', 'L')])
  })
})

describe('TarEntry body readers', () => {
  it('buffers received bytes independently of the header size', async () => {
    let body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
        controller.enqueue(new Uint8Array([3]))
        controller.close()
      },
    })
    let entry = new TarEntry(parseTarHeader(createHeader(10)), body)
    assert.equal(entry.bodyUsed, false)
    let result = entry.bytes()
    assert.equal(entry.bodyUsed, true)
    assert.deepEqual(await result, new Uint8Array([1, 2, 3]))
    await assert.rejects(() => entry.bytes(), /Body is already consumed/)
  })

  it('returns an exact independent array buffer', async () => {
    let chunk = new Uint8Array([0, 1, 2, 0])
    let body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk.subarray(1, 3))
        controller.close()
      },
    })
    let entry = new TarEntry(parseTarHeader(createHeader(2)), body)
    let result = await entry.arrayBuffer()
    chunk.fill(9)
    assert.ok(result instanceof ArrayBuffer)
    assert.equal(result.byteLength, 2)
    assert.deepEqual(new Uint8Array(result), new Uint8Array([1, 2]))
    await assert.rejects(() => entry.text(), /Body is already consumed/)
  })

  it('copies each chunk before reading from a stream that reuses its buffer', async () => {
    let chunk = new Uint8Array([1, 2])
    let reads = 0
    let body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          if (reads === 0) {
            controller.enqueue(chunk)
          } else if (reads === 1) {
            chunk.set([3, 4])
            controller.enqueue(chunk)
          } else {
            controller.close()
          }
          reads++
        },
      },
      { highWaterMark: 0 },
    )
    let entry = new TarEntry(parseTarHeader(createHeader(4)), body)
    assert.deepEqual(await entry.bytes(), new Uint8Array([1, 2, 3, 4]))
  })

  it('decodes UTF-8 split across chunks', async () => {
    let bytes = new TextEncoder().encode('héllo')
    let values: string[] = []
    await parseTar(
      [
        createHeader(bytes.length),
        bytes.subarray(0, 2),
        bytes.subarray(2),
        new Uint8Array(512 - bytes.length),
      ],
      async (entry) => {
        values.push(await entry.text())
      },
    )
    assert.deepEqual(values, ['héllo'])
  })

  it('returns empty content for directories with a nonzero size', async () => {
    await parseTar(createHeader(12, '5'), async (entry) => {
      assert.equal(entry.size, 12)
      assert.equal((await entry.bytes()).byteLength, 0)
    })
  })

  it(
    'rejects both parsing and reading a truncated buffered archive',
    { timeout: 1000 },
    async () => {
      let result: Promise<unknown> | undefined
      await assert.rejects(
        () =>
          parseTar(createHeader(12), (entry) => {
            result = entry.text().catch((error: unknown) => error)
          }),
        /Unexpected end of archive/,
      )
      assert.ok((await result) instanceof TarParseError)
    },
  )

  it('rejects an unfinished reader when the source fails', { timeout: 1000 }, async () => {
    let error = new Error('Source failed')
    let result: Promise<unknown> | undefined
    async function* source() {
      yield createHeader(12)
      yield new Uint8Array([1, 2])
      throw error
    }
    await assert.rejects(
      () =>
        parseTar(source(), (entry) => {
          result = entry.arrayBuffer().catch((error: unknown) => error)
        }),
      /Source failed/,
    )
    assert.equal(await result, error)
  })

  it('settles a handler reading a truncated source stream', { timeout: 1000 }, async () => {
    let source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(createHeader(12))
        controller.enqueue(new Uint8Array([1, 2]))
        controller.close()
      },
    })
    let result: Promise<void> | undefined
    await assert.rejects(
      () =>
        parseTar(source, (entry) => {
          result = assert.rejects(() => entry.bytes(), /Unexpected end of archive/)
          return result
        }),
      /Unexpected end of archive/,
    )
    await result
  })

  it('rejects missing padding after delivering the complete body', async () => {
    let result: Promise<string> | undefined
    await assert.rejects(
      () =>
        parseTar([createHeader(5), new TextEncoder().encode('hello')], (entry) => {
          result = entry.text()
        }),
      /Unexpected end of archive/,
    )
    assert.equal(await result, 'hello')
  })

  it('observes rejected handlers while waiting for more input', async () => {
    let error = new Error('Handler failed')
    async function* source() {
      yield createHeader(0)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    await assert.rejects(
      () =>
        parseTar(source(), async () => {
          throw error
        }),
      /Handler failed/,
    )
  })

  it('streams entry bytes before the archive finishes', { timeout: 1000 }, async () => {
    let received = Promise.withResolvers<void>()
    let chunks: number[][] = []
    async function* source() {
      yield createHeader(4)
      yield new Uint8Array([1, 2])
      await received.promise
      yield new Uint8Array([3, 4])
      yield new Uint8Array(508)
    }
    await parseTar(source(), async (entry) => {
      for await (let chunk of entry.body) {
        chunks.push(Array.from(chunk))
        received.resolve()
      }
    })
    assert.deepEqual(chunks, [
      [1, 2],
      [3, 4],
    ])
  })
})
