import * as assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it, beforeEach, afterEach } from 'node:test'
import SuperHeaders, { type SuperHeadersInit } from '@remix-run/headers'

import { createFsFileResolver } from './fs-file-resolver.ts'
import type { RequestContext } from './request-context.ts'
import { AppStorage } from './app-storage.ts'
import type { RequestMethod } from './request-methods.ts'

describe('createFsFileResolver', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-file-resolver-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function createTestFile(filename: string, content: string) {
    let filePath = path.join(tmpDir, filename)
    let dir = path.dirname(filePath)

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(filePath, content)

    return filePath
  }

  function createContext(
    path: string,
    options: {
      method?: RequestMethod
      headers?: SuperHeadersInit
    } = {},
  ): RequestContext<RequestMethod, {}> {
    let url = new URL(`http://localhost/${path}`)
    let headers = new SuperHeaders(options.headers ?? {})
    return {
      formData: undefined,
      storage: new AppStorage(),
      url: new URL(url),
      files: null,
      method: options.method || 'GET',
      request: new Request(url, {
        method: options.method || 'GET',
        headers,
      }),
      params: {},
      headers,
    }
  }

  function requestPathnameResolver(requestContext: RequestContext<'GET', {}>) {
    return new URL(requestContext.request.url).pathname.replace(/^\//, '')
  }

  describe('basic functionality', () => {
    it('resolves a file from the filesystem', async () => {
      createTestFile('test.txt', 'Hello, World!')

      let resolver = createFsFileResolver(tmpDir, requestPathnameResolver)
      let result = await resolver(createContext('test.txt'))

      assert.ok(result)
      assert.ok(result.file instanceof File)
      assert.equal(result.path, path.join(path.resolve(tmpDir), 'test.txt'))
      assert.equal(await result.file.text(), 'Hello, World!')
      assert.equal(result.file.type, 'text/plain')
    })

    it('resolves files from nested directories', async () => {
      createTestFile('dir/subdir/file.txt', 'Nested file')

      let resolver = createFsFileResolver(tmpDir, requestPathnameResolver)
      let result = await resolver(createContext('dir/subdir/file.txt'))

      assert.ok(result)
      assert.ok(result.file instanceof File)
      assert.equal(result.path, path.join(path.resolve(tmpDir), 'dir/subdir/file.txt'))
      assert.equal(await result.file.text(), 'Nested file')
    })

    it('returns null for non-existent file', async () => {
      let resolver = createFsFileResolver(tmpDir, requestPathnameResolver)
      let result = await resolver(createContext('nonexistent.txt'))

      assert.equal(result, null)
    })

    it('returns null when directory is requested', async () => {
      let dirPath = path.join(tmpDir, 'subdir')
      fs.mkdirSync(dirPath)

      let resolver = createFsFileResolver(tmpDir, requestPathnameResolver)
      let result = await resolver(createContext('subdir'))

      assert.equal(result, null)
    })

    it('returns null when path resolver returns null', async () => {
      createTestFile('test.txt', 'Hello, World!')

      let resolver = createFsFileResolver(tmpDir, () => null)
      let result = await resolver(createContext('test.txt'))

      assert.equal(result, null)
    })
  })

  describe('path resolution', () => {
    it('resolves relative root paths', async () => {
      let relativeTmpDir = path.relative(process.cwd(), tmpDir)
      createTestFile('test.txt', 'Hello')

      let resolver = createFsFileResolver(relativeTmpDir, requestPathnameResolver)
      let result = await resolver(createContext('test.txt'))

      assert.ok(result)
      assert.ok(result.file instanceof File)
      assert.equal(result.path, path.join(path.resolve(relativeTmpDir), 'test.txt'))
      assert.equal(await result.file.text(), 'Hello')
    })

    it('resolves absolute root paths', async () => {
      let absoluteTmpDir = path.resolve(tmpDir)
      createTestFile('test.txt', 'Hello')

      let resolver = createFsFileResolver(absoluteTmpDir, requestPathnameResolver)
      let result = await resolver(createContext('test.txt'))

      assert.ok(result)
      assert.ok(result.file instanceof File)
      assert.equal(result.path, path.join(absoluteTmpDir, 'test.txt'))
      assert.equal(await result.file.text(), 'Hello')
    })
  })

  describe('security', () => {
    it('prevents path traversal with .. in pathname', async () => {
      createTestFile('secret.txt', 'Secret content')

      let publicDirName = 'public'
      createTestFile(`${publicDirName}/allowed.txt`, 'Allowed content')

      let publicDir = path.join(tmpDir, publicDirName)
      let resolver = createFsFileResolver(publicDir, requestPathnameResolver)

      let result = await resolver(createContext('allowed.txt'))
      assert.ok(result)
      assert.ok(result.file instanceof File)
      assert.equal(result.path, path.join(path.resolve(publicDir), 'allowed.txt'))
      assert.equal(await result.file.text(), 'Allowed content')

      let traversalResult = await resolver(createContext('../secret.txt'))
      assert.equal(traversalResult, null)
    })

    it('does not support absolute paths in the resolved path', async () => {
      let parentDir = path.dirname(tmpDir)
      let secretFileName = 'secret-outside-root.txt'
      let secretPath = path.join(parentDir, secretFileName)
      fs.writeFileSync(secretPath, 'Secret content')

      let resolver = createFsFileResolver(tmpDir, () => secretPath)

      try {
        let result = await resolver(createContext('anything'))
        assert.equal(result, null)
      } finally {
        fs.unlinkSync(secretPath)
      }
    })
  })

  describe('error handling', () => {
    it('throws non-ENOENT errors', async () => {
      // Create a resolver with a path that will trigger a permission error or similar
      let resolver = createFsFileResolver(tmpDir, () => {
        // Return a path with invalid characters that will cause an error other than ENOENT
        return '\x00invalid'
      })

      await assert.rejects(
        async () => {
          await resolver(createContext('test'))
        },
        (error: any) => {
          return error.code !== 'ENOENT'
        },
      )
    })
  })
})
