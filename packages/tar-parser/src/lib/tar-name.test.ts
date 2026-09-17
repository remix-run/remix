import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  MaxEntriesExceededError,
  MaxEntrySizeExceededError,
  MaxTotalSizeExceededError,
  parseTar,
  parseTarHeader,
  TarParser,
} from '../index.ts'
import { computeChecksum } from './utils.ts'

function createHeader(
  name: string,
  options: { prefix?: string; type?: string; size?: number; linkname?: string } = {},
): Uint8Array {
  let encoder = new TextEncoder()
  let block = new Uint8Array(512)
  block.set(encoder.encode(name))
  block.set(encoder.encode((options.size ?? 0).toString(8).padStart(11, '0')), 124)
  block.set(encoder.encode(options.type ?? '0'), 156)
  block.set(encoder.encode(options.linkname ?? ''), 157)
  block.set(encoder.encode('ustar\0' + '00'), 257)
  block.set(encoder.encode(options.prefix ?? ''), 345)
  block.set(encoder.encode(computeChecksum(block).toString(8).padStart(6, '0') + '\0 '), 148)
  return block
}

function metadata(type: string, value: string): Uint8Array[] {
  let body = new TextEncoder().encode(value)
  let padding = new Uint8Array((512 - (body.length % 512)) % 512)
  return [createHeader('metadata', { type, size: body.length }), body, padding]
}

function paxPath(value: string, type = 'x'): Uint8Array[] {
  let record = ` path=${value}\n`
  let recordLength = new TextEncoder().encode(record).length
  let length = recordLength + 1
  while (String(length).length + recordLength !== length) {
    length = String(length).length + recordLength
  }
  return metadata(type, `${length}${record}`)
}

async function assertInvalidName(chunks: Uint8Array[]): Promise<void> {
  let entries = 0
  await assert.rejects(
    () =>
      parseTar(chunks, () => {
        entries++
      }),
    { name: 'TarParseError', message: 'Invalid tar entry name' },
  )
  assert.equal(entries, 0)
}

describe('tar entry names', () => {
  it('rejects absolute names in direct header parsing', () => {
    assert.throws(() => parseTarHeader(createHeader('/outside.txt')), {
      name: 'TarParseError',
      message: 'Invalid tar entry name',
    })
  })

  it('rejects parent components in direct header parsing', () => {
    assert.throws(() => parseTarHeader(createHeader('../outside.txt')), {
      name: 'TarParseError',
      message: 'Invalid tar entry name',
    })
  })

  it('validates the combined ustar name in direct header parsing', () => {
    assert.throws(() => parseTarHeader(createHeader('outside.txt', { prefix: '../..' })), {
      name: 'TarParseError',
      message: 'Invalid tar entry name',
    })
    assert.equal(parseTarHeader(createHeader('file.txt', { prefix: 'src' })).name, 'src/file.txt')
  })

  it('rejects absolute names before invoking the handler', async () => {
    await assertInvalidName([createHeader('/outside.txt')])
  })

  it('rejects parent traversal at any depth', async () => {
    await assertInvalidName([createHeader('../outside.txt')])
    await assertInvalidName([createHeader('src/../../outside.txt')])
    await assertInvalidName([createHeader('src/../file.txt')])
    await assertInvalidName([createHeader('src/..')])
  })

  it('rejects empty names', async () => {
    await assertInvalidName([createHeader('')])
  })

  it('rejects drive-absolute and drive-relative names', async () => {
    await assertInvalidName([createHeader('C:/outside.txt')])
    await assertInvalidName([createHeader('c:outside.txt')])
    await assertInvalidName([createHeader('././C:/outside.txt')])
  })

  it('rejects backslash paths and UNC names', async () => {
    await assertInvalidName([createHeader('src\\file.txt')])
    await assertInvalidName([createHeader('..\\outside.txt')])
    await assertInvalidName([createHeader('\\\\server\\share\\file.txt')])
    await assertInvalidName([createHeader('//server/share/file.txt')])
  })

  it('rejects absolute ustar prefixes', async () => {
    await assertInvalidName([createHeader('outside.txt', { prefix: '/outside' })])
  })

  it('rejects parent components in ustar prefixes', async () => {
    await assertInvalidName([createHeader('outside.txt', { prefix: 'src/../..' })])
  })

  it('validates directory and link entry names', async () => {
    await assertInvalidName([createHeader('../directory/', { type: '5' })])
    await assertInvalidName([createHeader('../link', { type: '2', linkname: 'file.txt' })])
  })

  it('preserves nested names, dot prefixes, trailing slashes, Unicode, and newlines', async () => {
    let names = ['file.txt', './src/é.txt', './', 'src/', 'src/.../file.txt', 'src/..\n']
    let parsed: string[] = []
    await parseTar(
      names.map((name) => createHeader(name)),
      (entry) => {
        parsed.push(entry.name)
      },
    )
    assert.deepEqual(parsed, names)
  })

  it('rejects GNU long-name traversal after the override', async () => {
    await assertInvalidName([...metadata('L', '../outside.txt\0'), createHeader('file.txt')])
  })

  it('rejects embedded NULs in GNU long names', async () => {
    await assertInvalidName([...metadata('L', 'file\0.txt\0'), createHeader('file.txt')])
  })

  it('rejects empty GNU names after decoding the terminator', async () => {
    await assertInvalidName([...metadata('L', '\0'), createHeader('file.txt')])
  })

  it('decodes a split GNU long-name terminator and preserves following content', async () => {
    let name = './src/' + 'é'.repeat(100) + '.txt'
    let chunks = metadata('L', name + '\0')
    let body = chunks[1]
    chunks.splice(1, 1, body.subarray(0, body.length - 1), body.subarray(body.length - 1))
    let content = new Uint8Array(512)
    content.set(new TextEncoder().encode('ok'))
    let names: string[] = []
    await parseTar([...chunks, createHeader('file.txt', { size: 2 }), content], async (entry) => {
      names.push(entry.name)
      assert.equal(await entry.text(), 'ok')
    })
    assert.deepEqual(names, [name])
  })

  it('preserves GNU long names without a terminator', async () => {
    let names: string[] = []
    await parseTar([...metadata('L', './src/file.txt'), createHeader('file.txt')], (entry) => {
      names.push(entry.name)
    })
    assert.deepEqual(names, ['./src/file.txt'])
  })

  it('rejects local PAX traversal after overriding a valid header name', async () => {
    await assertInvalidName([...paxPath('../outside.txt'), createHeader('file.txt')])
  })

  it('rejects absolute global PAX paths without a local PAX header', async () => {
    await assertInvalidName([...paxPath('/outside.txt', 'g'), createHeader('file.txt')])
  })

  it('rejects Windows drive syntax in PAX paths', async () => {
    await assertInvalidName([...paxPath('C:/outside.txt'), createHeader('file.txt')])
  })

  it('rejects embedded and trailing NULs in PAX paths', async () => {
    await assertInvalidName([...paxPath('file\0.txt'), createHeader('file.txt')])
    await assertInvalidName([...paxPath('file.txt\0'), createHeader('file.txt')])
  })

  it('validates the final override without rejecting superseded metadata', async () => {
    let names: string[] = []
    await parseTar(
      [
        ...paxPath('../global.txt', 'g'),
        ...metadata('L', '../gnu.txt\0'),
        ...paxPath('./src/é.txt'),
        createHeader('../header.txt', { prefix: '../prefix' }),
      ],
      (entry) => {
        names.push(entry.name)
      },
    )
    assert.deepEqual(names, ['./src/é.txt'])
  })

  it('preserves PAX deletion of a path override', async () => {
    let names: string[] = []
    await parseTar(
      [...paxPath('../global.txt', 'g'), ...paxPath(''), createHeader('file.txt')],
      (entry) => {
        names.push(entry.name)
      },
    )
    assert.deepEqual(names, ['file.txt'])
  })

  it('leaves link-target validation to consumers', async () => {
    let targets: (string | null)[] = []
    await parseTar([createHeader('link', { type: '2', linkname: '../target' })], (entry) => {
      targets.push(entry.header.linkname)
    })
    assert.deepEqual(targets, ['../target'])
  })
})

describe('tar entry name policy', () => {
  it('enforces an explicit relative policy', async () => {
    let header = createHeader('../file.txt')
    assert.throws(() => parseTarHeader(header, { entryNamePolicy: 'relative' }), {
      name: 'TarParseError',
      message: 'Invalid tar entry name',
    })
    await assert.rejects(() => parseTar(header, { entryNamePolicy: 'relative' }, () => {}), {
      name: 'TarParseError',
      message: 'Invalid tar entry name',
    })
  })

  it('preserves combined names in direct header parsing', () => {
    let header = createHeader('file.txt', { prefix: '/etc' })
    assert.equal(parseTarHeader(header, { entryNamePolicy: 'preserve' }).name, '/etc/file.txt')
  })

  it('preserves ordinary names without relative-path restrictions', async () => {
    let names = ['/etc/file.txt', '../file.txt', 'C:/file.txt', 'src\\file.txt', '']
    let parsed: string[] = []
    await parseTar(
      names.map((name) => createHeader(name)),
      { entryNamePolicy: 'preserve' },
      (entry) => {
        parsed.push(entry.name)
      },
    )
    assert.deepEqual(parsed, names)
  })

  it('preserves final GNU and PAX names when configured on TarParser', async () => {
    let parser = new TarParser({ entryNamePolicy: 'preserve' })
    let names: string[] = []
    await parser.parse(
      [
        ...metadata('L', '../gnu\0name\0'),
        createHeader('file.txt'),
        ...paxPath('../local\0name\n'),
        createHeader('file.txt'),
        ...paxPath('/global', 'g'),
        createHeader('file.txt'),
        createHeader('next.txt'),
      ],
      (entry) => {
        names.push(entry.name)
      },
    )
    assert.deepEqual(names, ['../gnu\0name', '../local\0name\n', '/global', '/global'])
  })

  it('still validates header structure and sizes when preserving names', () => {
    let header = createHeader('/file.txt')
    header[0] = 0
    assert.throws(
      () => parseTarHeader(header, { entryNamePolicy: 'preserve' }),
      /Invalid tar header/,
    )
    assert.throws(
      () =>
        parseTarHeader(createHeader('/file.txt', { size: -1 }), { entryNamePolicy: 'preserve' }),
      { name: 'TarParseError', message: 'Invalid tar entry size' },
    )
  })

  it('still enforces archive limits when preserving names', async () => {
    await assert.rejects(
      () =>
        parseTar(
          createHeader('/file.txt', { size: 1 }),
          { entryNamePolicy: 'preserve', maxEntrySize: 0 },
          () => {},
        ),
      MaxEntrySizeExceededError,
    )
    await assert.rejects(
      () =>
        parseTar(
          createHeader('/file.txt'),
          { entryNamePolicy: 'preserve', maxTotalSize: 511 },
          () => {},
        ),
      MaxTotalSizeExceededError,
    )
    await assert.rejects(
      () =>
        parseTar(
          createHeader('/file.txt'),
          { entryNamePolicy: 'preserve', maxEntries: 0 },
          () => {},
        ),
      MaxEntriesExceededError,
    )
  })
})
