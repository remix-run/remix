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
  return pax('path', value, type)
}

function pax(key: string, value: string, type = 'x'): Uint8Array[] {
  let record = ` ${key}=${value}\n`
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

async function assertInvalidLink(chunks: Uint8Array[]): Promise<void> {
  let entries = 0
  await assert.rejects(
    () =>
      parseTar(chunks, () => {
        entries++
      }),
    { name: 'TarParseError', message: 'Invalid tar link target' },
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
    await assertInvalidName([createHeader('.//./C:/outside.txt')])
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
})

describe('tar link paths', () => {
  it('rejects absolute targets in direct header parsing', () => {
    assert.throws(() => parseTarHeader(createHeader('link', { type: '2', linkname: '/outside' })), {
      name: 'TarParseError',
      message: 'Invalid tar link target',
    })
    assert.throws(() => parseTarHeader(createHeader('link', { type: '1', linkname: '/outside' })), {
      name: 'TarParseError',
      message: 'Invalid tar link target',
    })
  })

  it('validates symlink targets relative to the combined ustar parent', () => {
    let header = createHeader('current', { prefix: 'lib', type: '2', linkname: '../shared/v2' })
    assert.equal(parseTarHeader(header).linkname, '../shared/v2')
    assert.throws(
      () => parseTarHeader(createHeader('current', { type: '2', linkname: '../shared/v2' })),
      { name: 'TarParseError', message: 'Invalid tar link target' },
    )
  })

  it('rejects absolute targets before invoking the handler', async () => {
    await assertInvalidLink([createHeader('link', { type: '2', linkname: '/outside' })])
    await assertInvalidLink([createHeader('link', { type: '1', linkname: '/outside' })])
  })

  it('rejects missing link targets', async () => {
    await assertInvalidLink([createHeader('link', { type: '2' })])
    await assertInvalidLink([createHeader('link', { type: '1' })])
  })

  it('rejects Windows drive prefixes, backslashes, and UNC targets', async () => {
    await assertInvalidLink([createHeader('link', { type: '2', linkname: 'C:/outside' })])
    await assertInvalidLink([createHeader('link', { type: '1', linkname: 'c:outside' })])
    await assertInvalidLink([createHeader('link', { type: '2', linkname: './/./C:/outside' })])
    await assertInvalidLink([createHeader('link', { type: '2', linkname: '..\\outside' })])
    await assertInvalidLink([createHeader('link', { type: '1', linkname: '\\\\server\\share' })])
    await assertInvalidLink([createHeader('link', { type: '2', linkname: '//server/share' })])
  })

  it('rejects symlink targets that traverse above the archive root', async () => {
    await assertInvalidLink([createHeader('link', { type: '2', linkname: '../outside' })])
    await assertInvalidLink([createHeader('lib/link', { type: '2', linkname: '../../outside' })])
    await assertInvalidLink([createHeader('link', { type: '2', linkname: '../lib/file' })])
  })

  it('does not count dots, repeated separators, or trailing slashes as parent directories', async () => {
    await assertInvalidLink([createHeader('./link', { type: '2', linkname: '../outside' })])
    await assertInvalidLink([createHeader('lib//link', { type: '2', linkname: '../../outside' })])
    await assertInvalidLink([createHeader('lib/./link', { type: '2', linkname: '../../outside' })])
    await assertInvalidLink([createHeader('lib/link/', { type: '2', linkname: '../../outside' })])
  })

  it('preserves symlink targets that stay within the archive', async () => {
    let targets: (string | null)[] = []
    await parseTar(
      [
        createHeader('lib/current', { type: '2', linkname: '../shared/v2' }),
        createHeader('./lib//current', { type: '2', linkname: './v1/../é\n' }),
        createHeader('lib/current', { type: '2', linkname: '..' }),
        createHeader('current', { type: '2', linkname: '.' }),
      ],
      (entry) => {
        targets.push(entry.header.linkname)
      },
    )
    assert.deepEqual(targets, ['../shared/v2', './v1/../é\n', '..', '.'])
  })

  it('resolves hard-link targets from the archive root, not the link parent', async () => {
    await assertInvalidLink([createHeader('lib/current', { type: '1', linkname: '../shared/v2' })])
    let targets: (string | null)[] = []
    await parseTar(
      [createHeader('lib/current', { type: '1', linkname: './shared/../file.txt' })],
      (entry) => {
        targets.push(entry.header.linkname)
      },
    )
    assert.deepEqual(targets, ['./shared/../file.txt'])
  })

  it('rejects GNU long-link traversal after overriding a safe header target', async () => {
    await assertInvalidLink([
      ...metadata('K', '../outside\0'),
      createHeader('link', { type: '2', linkname: 'file.txt' }),
    ])
  })

  it('rejects empty and embedded-NUL GNU link targets', async () => {
    await assertInvalidLink([
      ...metadata('K', '\0'),
      createHeader('link', { type: '2', linkname: 'file.txt' }),
    ])
    await assertInvalidLink([
      ...metadata('K', 'file\0.txt\0'),
      createHeader('link', { type: '1', linkname: 'file.txt' }),
    ])
  })

  it('decodes a fragmented GNU link terminator and clears the override for the next entry', async () => {
    let target = '../shared/' + 'é'.repeat(100)
    let chunks = metadata('K', target + '\0')
    let body = chunks[1]
    chunks.splice(1, 1, body.subarray(0, body.length - 2), body.subarray(body.length - 2))
    let targets: (string | null)[] = []
    await parseTar(
      [
        ...chunks,
        createHeader('lib/current', { type: '2' }),
        createHeader('next', { type: '2', linkname: 'local' }),
      ],
      (entry) => {
        targets.push(entry.header.linkname)
      },
    )
    assert.deepEqual(targets, [target, 'local'])
  })

  it('preserves GNU link targets without a terminator', async () => {
    let targets: (string | null)[] = []
    await parseTar(
      [...metadata('K', './file.txt'), createHeader('link', { type: '1' })],
      (entry) => {
        targets.push(entry.header.linkname)
      },
    )
    assert.deepEqual(targets, ['./file.txt'])
  })

  it('rejects local and global PAX link targets after overrides', async () => {
    await assertInvalidLink([
      ...pax('linkpath', '../outside'),
      createHeader('link', { type: '2', linkname: 'file.txt' }),
    ])
    await assertInvalidLink([
      ...pax('linkpath', '/outside', 'g'),
      createHeader('link', { type: '1', linkname: 'file.txt' }),
    ])
  })

  it('rejects embedded and trailing NULs in PAX link targets', async () => {
    await assertInvalidLink([...pax('linkpath', 'file\0.txt'), createHeader('link', { type: '2' })])
    await assertInvalidLink([...pax('linkpath', 'file.txt\0'), createHeader('link', { type: '1' })])
  })

  it('uses the final GNU and PAX entry names to locate the symlink parent', async () => {
    let targets: (string | null)[] = []
    await parseTar(
      [
        ...metadata('L', 'lib/current\0'),
        createHeader('current', { type: '2', linkname: '../shared' }),
        ...paxPath('lib/current'),
        createHeader('current', { type: '2', linkname: '../shared' }),
      ],
      (entry) => {
        targets.push(entry.header.linkname)
      },
    )
    assert.deepEqual(targets, ['../shared', '../shared'])
    await assertInvalidLink([
      ...paxPath('current'),
      createHeader('lib/current', { type: '2', linkname: '../shared' }),
    ])
  })

  it('validates the final link target without rejecting superseded metadata', async () => {
    let targets: (string | null)[] = []
    await parseTar(
      [
        ...pax('linkpath', '/global', 'g'),
        ...metadata('K', '../gnu\0'),
        ...pax('linkpath', './file.txt'),
        createHeader('link', { type: '2', linkname: '/header' }),
      ],
      (entry) => {
        targets.push(entry.header.linkname)
      },
    )
    assert.deepEqual(targets, ['./file.txt'])
  })

  it('preserves PAX deletion of a link target override', async () => {
    let targets: (string | null)[] = []
    await parseTar(
      [
        ...pax('linkpath', '/global', 'g'),
        ...pax('linkpath', ''),
        createHeader('link', { type: '2', linkname: 'file.txt' }),
      ],
      (entry) => {
        targets.push(entry.header.linkname)
      },
    )
    assert.deepEqual(targets, ['file.txt'])
  })
})

describe('tar path policy', () => {
  it('enforces an explicit relative policy', async () => {
    let header = createHeader('../file.txt')
    assert.throws(() => parseTarHeader(header, { pathPolicy: 'relative' }), {
      name: 'TarParseError',
      message: 'Invalid tar entry name',
    })
    await assert.rejects(() => parseTar(header, { pathPolicy: 'relative' }, () => {}), {
      name: 'TarParseError',
      message: 'Invalid tar entry name',
    })
    let link = createHeader('link', { type: '2', linkname: '/outside' })
    assert.throws(() => parseTarHeader(link, { pathPolicy: 'relative' }), {
      name: 'TarParseError',
      message: 'Invalid tar link target',
    })
    await assert.rejects(() => parseTar(link, { pathPolicy: 'relative' }, () => {}), {
      name: 'TarParseError',
      message: 'Invalid tar link target',
    })
  })

  it('preserves combined names in direct header parsing', () => {
    let header = createHeader('file.txt', { prefix: '/etc' })
    assert.equal(parseTarHeader(header, { pathPolicy: 'preserve' }).name, '/etc/file.txt')
  })

  it('preserves entry names and link targets together in all parsing APIs', async () => {
    let header = createHeader('link', { prefix: '/etc', type: '2', linkname: '../outside' })
    let parsed = parseTarHeader(header, { pathPolicy: 'preserve' })
    assert.equal(parsed.name, '/etc/link')
    assert.equal(parsed.linkname, '../outside')
    let paths: (string | null)[][] = []
    await parseTar(header, { pathPolicy: 'preserve' }, (entry) => {
      paths.push([entry.name, entry.header.linkname])
    })
    let parser = new TarParser({ pathPolicy: 'preserve' })
    await parser.parse(header, (entry) => {
      paths.push([entry.name, entry.header.linkname])
    })
    assert.deepEqual(paths, [
      ['/etc/link', '../outside'],
      ['/etc/link', '../outside'],
    ])
  })

  it('preserves unrestricted GNU and PAX link targets while decoding GNU terminators', async () => {
    let targets: (string | null)[] = []
    await parseTar(
      [
        ...metadata('K', '../gnu\0target\0'),
        createHeader('link', { type: '2' }),
        ...metadata('K', '\0'),
        createHeader('link', { type: '2', linkname: 'fallback' }),
        ...pax('linkpath', '/pax\0target\0', 'g'),
        createHeader('link', { type: '1' }),
      ],
      { pathPolicy: 'preserve' },
      (entry) => {
        targets.push(entry.header.linkname)
      },
    )
    assert.deepEqual(targets, ['../gnu\0target', '', '/pax\0target\0'])
  })

  it('preserves ordinary names without relative-path restrictions', async () => {
    let names = ['/etc/file.txt', '../file.txt', 'C:/file.txt', 'src\\file.txt', '']
    let parsed: string[] = []
    await parseTar(
      names.map((name) => createHeader(name)),
      { pathPolicy: 'preserve' },
      (entry) => {
        parsed.push(entry.name)
      },
    )
    assert.deepEqual(parsed, names)
  })

  it('preserves final GNU and PAX names when configured on TarParser', async () => {
    let parser = new TarParser({ pathPolicy: 'preserve' })
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
    assert.throws(() => parseTarHeader(header, { pathPolicy: 'preserve' }), /Invalid tar header/)
    assert.throws(
      () => parseTarHeader(createHeader('/file.txt', { size: -1 }), { pathPolicy: 'preserve' }),
      { name: 'TarParseError', message: 'Invalid tar entry size' },
    )
  })

  it('still enforces archive limits when preserving names', async () => {
    await assert.rejects(
      () =>
        parseTar(
          createHeader('/file.txt', { size: 1 }),
          { pathPolicy: 'preserve', maxEntrySize: 0 },
          () => {},
        ),
      MaxEntrySizeExceededError,
    )
    await assert.rejects(
      () =>
        parseTar(
          createHeader('/file.txt'),
          { pathPolicy: 'preserve', maxTotalSize: 511 },
          () => {},
        ),
      MaxTotalSizeExceededError,
    )
    await assert.rejects(
      () =>
        parseTar(createHeader('/file.txt'), { pathPolicy: 'preserve', maxEntries: 0 }, () => {}),
      MaxEntriesExceededError,
    )
  })
})
