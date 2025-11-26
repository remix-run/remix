import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { fixtures, readFixture } from '../../test/utils.ts'

import { type TarHeader, parseTar } from './tar.ts'

async function bufferBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer>> {
  let chunks: Uint8Array[] = []
  let length = 0

  for await (let chunk of stream) {
    chunks.push(chunk)
    length += chunk.byteLength
  }

  let result = new Uint8Array(length)
  let offset = 0

  for (let chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }

  return result
}

async function bufferString(
  stream: ReadableStream<Uint8Array>,
  encoding = 'utf-8',
): Promise<string> {
  let decoder = new TextDecoder(encoding)
  let string = ''

  for await (let chunk of stream) {
    string += decoder.decode(chunk, { stream: true })
  }

  string += decoder.decode()

  return string
}

async function computeHash(
  buffer: Uint8Array<ArrayBuffer>,
  algorithm = 'SHA-256',
): Promise<string> {
  let digest = await crypto.subtle.digest(algorithm, buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 8)
}

describe('TarParser', () => {
  it('parses express-4.21.1.tgz', async () => {
    let entries: Record<string, string> = {}
    await parseTar(readFixture(fixtures.expressNpmPackage), async (entry) => {
      let hash = await computeHash(await bufferBytes(entry.body))
      entries[entry.name] = hash
    })

    assert.deepEqual(entries, {
      'package/LICENSE': '95a57628',
      'package/lib/application.js': '5901b32f',
      'package/lib/express.js': '2f25585c',
      'package/index.js': '4d2f5afc',
      'package/lib/router/index.js': '19c5ca9b',
      'package/lib/middleware/init.js': '48c1d12f',
      'package/lib/router/layer.js': 'c90709dc',
      'package/lib/middleware/query.js': '6edce396',
      'package/lib/request.js': '64ac1075',
      'package/lib/response.js': '4b5c338c',
      'package/lib/router/route.js': '86db1235',
      'package/lib/utils.js': '9035c6d9',
      'package/lib/view.js': 'ec627880',
      'package/package.json': '774eaac2',
      'package/History.md': 'ca257313',
      'package/Readme.md': '016f344e',
    })
  })

  it('parses fetch-proxy-0.1.0.tar.gz', async () => {
    let count = 0
    await parseTar(readFixture(fixtures.fetchProxyGithubArchive), async (entry) => {
      // Drain the body stream to avoid memory accumulation
      for await (let _ of entry.body) {
      }
      count++
    })

    assert.equal(count, 192)
  })

  it('parses lodash-4.17.21.tgz', async () => {
    let count = 0
    await parseTar(readFixture(fixtures.lodashNpmPackage), async (entry) => {
      // Drain the body stream to avoid memory accumulation
      for await (let _ of entry.body) {
      }
      count++
    })

    assert.equal(count, 1054)
  })

  it('parses npm-11.0.0.tgz', async () => {
    let count = 0
    await parseTar(readFixture(fixtures.npmNpmPackage), async (entry) => {
      // Drain the body stream to avoid memory accumulation
      for await (let _ of entry.body) {
      }
      count++
    })

    assert.equal(count, 2368)
  })
})

describe('tar-stream test cases', () => {
  it('parses one-file.tar', async () => {
    let entries: [TarHeader, string][] = []
    await parseTar(readFixture(fixtures.oneFile), async (entry) => {
      entries.push([entry.header, await bufferString(entry.body)])
    })

    assert.deepEqual(entries, [
      [
        {
          name: 'test.txt',
          mode: 0o644,
          uid: 501,
          gid: 20,
          size: 12,
          mtime: 1387580181,
          type: 'file',
          linkname: null,
          uname: 'maf',
          gname: 'staff',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'hello world\n',
      ],
    ])
  })

  it('parses multi-file.tar', async () => {
    let entries: [TarHeader, string][] = []
    await parseTar(readFixture(fixtures.multiFile), async (entry) => {
      entries.push([entry.header, await bufferString(entry.body)])
    })

    assert.deepEqual(entries, [
      [
        {
          name: 'file-1.txt',
          mode: 0o644,
          uid: 501,
          gid: 20,
          size: 12,
          mtime: 1387580181,
          type: 'file',
          linkname: null,
          uname: 'maf',
          gname: 'staff',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'i am file-1\n',
      ],
      [
        {
          name: 'file-2.txt',
          mode: 0o644,
          uid: 501,
          gid: 20,
          size: 12,
          mtime: 1387580181,
          type: 'file',
          linkname: null,
          uname: 'maf',
          gname: 'staff',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'i am file-2\n',
      ],
    ])
  })

  it('parses pax.tar', async () => {
    let entries: [TarHeader, string][] = []
    await parseTar(readFixture(fixtures.pax), async (entry) => {
      entries.push([entry.header, await bufferString(entry.body)])
    })

    assert.deepEqual(entries, [
      [
        {
          name: 'pax.txt',
          mode: 0o644,
          uid: 501,
          gid: 20,
          size: 12,
          mtime: 1387580181,
          type: 'file',
          linkname: null,
          uname: 'maf',
          gname: 'staff',
          devmajor: 0,
          devminor: 0,
          pax: {
            path: 'pax.txt',
            special: 'sauce',
          },
        },
        'hello world\n',
      ],
    ])
  })

  it('parses types.tar', async () => {
    let headers: TarHeader[] = []
    await parseTar(readFixture(fixtures.types), async (entry) => {
      headers.push(entry.header)
    })

    assert.deepEqual(headers, [
      {
        name: 'directory',
        mode: 0o755,
        uid: 501,
        gid: 20,
        size: 0,
        mtime: 1387580181,
        type: 'directory',
        linkname: null,
        uname: 'maf',
        gname: 'staff',
        devmajor: 0,
        devminor: 0,
        pax: null,
      },
      {
        name: 'directory-link',
        mode: 0o755,
        uid: 501,
        gid: 20,
        size: 0,
        mtime: 1387580181,
        type: 'symlink',
        linkname: 'directory',
        uname: 'maf',
        gname: 'staff',
        devmajor: 0,
        devminor: 0,
        pax: null,
      },
    ])
  })

  it('parses long-name.tar', async () => {
    let entries: [TarHeader, string][] = []
    await parseTar(readFixture(fixtures.longName), async (entry) => {
      entries.push([entry.header, await bufferString(entry.body)])
    })

    assert.deepEqual(entries, [
      [
        {
          name: 'my/file/is/longer/than/100/characters/and/should/use/the/prefix/header/foobarbaz/foobarbaz/foobarbaz/foobarbaz/foobarbaz/foobarbaz/filename.txt',
          mode: 0o644,
          uid: 501,
          gid: 20,
          size: 16,
          mtime: 1387580181,
          type: 'file',
          linkname: null,
          uname: 'maf',
          gname: 'staff',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'hello long name\n',
      ],
    ])
  })

  it('parses unicode-bsd.tar', async () => {
    let headers: TarHeader[] = []
    await parseTar(readFixture(fixtures.unicodeBsd), async (entry) => {
      headers.push(entry.header)
    })

    assert.deepEqual(headers, [
      {
        name: 'høllø.txt',
        mode: 0o644,
        uid: 501,
        gid: 20,
        size: 4,
        mtime: 1387588646,
        type: 'file',
        linkname: null,
        uname: 'maf',
        gname: 'staff',
        devmajor: 0,
        devminor: 0,
        pax: {
          'SCHILY.dev': '16777217',
          'SCHILY.ino': '3599143',
          'SCHILY.nlink': '1',
          atime: '1387589077',
          ctime: '1387588646',
          path: 'høllø.txt',
        },
      },
    ])
  })

  it('parses unicode.tar', async () => {
    let headers: TarHeader[] = []
    await parseTar(readFixture(fixtures.unicode), async (entry) => {
      headers.push(entry.header)
    })

    assert.deepEqual(headers, [
      {
        name: 'høstål.txt',
        mode: 0o644,
        uid: 501,
        gid: 20,
        size: 8,
        mtime: 1387580181,
        type: 'file',
        linkname: null,
        uname: 'maf',
        gname: 'staff',
        devmajor: 0,
        devminor: 0,
        pax: { path: 'høstål.txt' },
      },
    ])
  })

  it('parses name-is-100.tar', async () => {
    let entries: [number, string][] = []
    await parseTar(readFixture(fixtures.nameIs100), async (entry) => {
      entries.push([entry.header.name.length, await bufferString(entry.body)])
    })

    assert.deepEqual(entries, [[100, 'hello\n']])
  })

  it('parses space.tar', async () => {
    let entries: [TarHeader, string][] = []
    await parseTar(readFixture(fixtures.space), async (entry) => {
      entries.push([entry.header, await bufferString(entry.body)])
    })

    assert.equal(entries.length, 4)
  })

  it('parses gnu-long-path.tar', async () => {
    let entries: [TarHeader, string][] = []
    await parseTar(readFixture(fixtures.gnuLongPath), async (entry) => {
      entries.push([entry.header, await bufferString(entry.body)])
    })

    assert.equal(entries.length, 1)
  })

  it('parses base-256-uid-gid.tar', async () => {
    let headers: TarHeader[] = []
    await parseTar(readFixture(fixtures.base256UidGid), async (entry) => {
      headers.push(entry.header)
    })

    assert.equal(headers.length, 1)
    assert.equal(headers[0].uid, 116435139)
    assert.equal(headers[0].gid, 1876110778)
  })

  it('parses base-256-size.tar', async () => {
    let headers: TarHeader[] = []
    await parseTar(readFixture(fixtures.base256Size), async (entry) => {
      headers.push(entry.header)
    })

    assert.deepEqual(headers, [
      {
        name: 'test.txt',
        mode: 0o644,
        uid: 501,
        gid: 20,
        size: 12,
        mtime: 1387580181,
        type: 'file',
        linkname: null,
        uname: 'maf',
        gname: 'staff',
        devmajor: 0,
        devminor: 0,
        pax: null,
      },
    ])
  })

  it('parses latin1.tar', async () => {
    let entries: [TarHeader, string][] = []
    await parseTar(readFixture(fixtures.latin1), { filenameEncoding: 'latin1' }, async (entry) => {
      entries.push([entry.header, await bufferString(entry.body)])
    })

    assert.deepEqual(entries, [
      [
        {
          name: "En français, s'il vous plaît?.txt",
          mode: 0o644,
          uid: 0,
          gid: 0,
          size: 14,
          mtime: 1495941034,
          type: 'file',
          linkname: null,
          uname: 'root',
          gname: 'root',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'Hello, world!\n',
      ],
    ])
  })

  it('throws when parsing incomplete.tar', async () => {
    await assert.rejects(
      async () => {
        await parseTar(readFixture(fixtures.incomplete), () => {})
      },
      {
        name: 'TarParseError',
        message: 'Unexpected end of archive',
      },
    )
  })

  it('parses gnu.tar', async () => {
    let entries: [TarHeader, string][] = []
    await parseTar(readFixture(fixtures.gnu), async (entry) => {
      entries.push([entry.header, await bufferString(entry.body)])
    })

    assert.deepEqual(entries, [
      [
        {
          name: 'test.txt',
          mode: 0o644,
          uid: 12345,
          gid: 67890,
          size: 14,
          mtime: 1559239869,
          type: 'file',
          linkname: null,
          uname: 'myuser',
          gname: 'mygroup',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'Hello, world!\n',
      ],
    ])
  })

  it('parses gnu-incremental.tar', async () => {
    let entries: [TarHeader, string][] = []
    await parseTar(readFixture(fixtures.gnuIncremental), async (entry) => {
      entries.push([entry.header, await bufferString(entry.body)])
    })

    assert.deepEqual(entries, [
      [
        {
          name: 'test.txt',
          mode: 0o644,
          uid: 12345,
          gid: 67890,
          size: 14,
          mtime: 1559239869,
          type: 'file',
          linkname: null,
          uname: 'myuser',
          gname: 'mygroup',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'Hello, world!\n',
      ],
    ])
  })
})
