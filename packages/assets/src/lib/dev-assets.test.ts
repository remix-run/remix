import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { pathToFileURL } from 'node:url'

import { createDevAssets } from './dev-assets.ts'

describe('createDevAssets', () => {
  let tempDir: string

  function setupTempDir() {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-test-'))
    fs.writeFileSync(path.join(tempDir, 'entry.tsx'), 'export default function App() {}')
    fs.mkdirSync(path.join(tempDir, 'components'))
    fs.writeFileSync(path.join(tempDir, 'components', 'Button.tsx'), 'export function Button() {}')
  }

  function cleanupTempDir() {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }

  describe('get()', () => {
    it('returns href as source path with leading slash', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir })
        let entry = assets.get('entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry!.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('returns chunks as array containing only href', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir })
        let entry = assets.get('entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.deepEqual(entry!.chunks, ['/entry.tsx'])
      } finally {
        cleanupTempDir()
      }
    })

    it('handles nested paths', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir })
        let entry = assets.get('components/Button.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry!.href, '/components/Button.tsx')
        assert.deepEqual(entry!.chunks, ['/components/Button.tsx'])
      } finally {
        cleanupTempDir()
      }
    })

    it('normalizes leading slashes in entry path', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir })
        let entry = assets.get('/entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry!.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('normalizes multiple leading slashes', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir })
        let entry = assets.get('///entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry!.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('resolves file:// URLs to root-relative href (e.g. hydration roots)', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir })
        let absolutePath = path.join(tempDir, 'entry.tsx')
        let fileUrl = pathToFileURL(absolutePath).href

        let entry = assets.get(fileUrl)

        assert.ok(entry, 'entry should not be null for file:// URL under root')
        assert.equal(entry!.href, '/entry.tsx')
        assert.deepEqual(entry!.chunks, ['/entry.tsx'])
      } finally {
        cleanupTempDir()
      }
    })

    it('resolves file:// URL for nested path (e.g. app/components/cart-button.tsx)', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir })
        let absolutePath = path.join(tempDir, 'components', 'Button.tsx')
        let fileUrl = pathToFileURL(absolutePath).href

        let entry = assets.get(fileUrl)

        assert.ok(entry, 'entry should not be null for file:// URL under root')
        assert.equal(entry!.href, '/components/Button.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('returns null if entry file does not exist', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir })

        assert.equal(assets.get('nonexistent.tsx'), null)
      } finally {
        cleanupTempDir()
      }
    })

    it('returns null for nested non-existent paths', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir })

        assert.equal(assets.get('missing/file.tsx'), null)
      } finally {
        cleanupTempDir()
      }
    })

    it('works with relative root path', () => {
      setupTempDir()
      try {
        let relativePath = path.relative(process.cwd(), tempDir)
        let assets = createDevAssets({ root: relativePath })
        let entry = assets.get('entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry!.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('works with absolute root path', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir })
        let entry = assets.get('entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry!.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('restricts to specified scripts when provided', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir, scripts: ['entry.tsx'] })

        assert.ok(assets.get('entry.tsx'), 'entry.tsx should be accessible')
        assert.equal(
          assets.get('components/Button.tsx'),
          null,
          'components/Button.tsx should not be accessible',
        )
      } finally {
        cleanupTempDir()
      }
    })
  })

  describe('scripts restriction', () => {
    it('allows all files when scripts not specified', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir })

        assert.ok(assets.get('entry.tsx'), 'entry.tsx should be accessible')
        assert.ok(assets.get('components/Button.tsx'), 'components/Button.tsx should be accessible')
      } finally {
        cleanupTempDir()
      }
    })

    it('restricts to specified scripts when provided', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir, scripts: ['entry.tsx'] })

        assert.ok(assets.get('entry.tsx'), 'entry.tsx should be accessible')
        assert.equal(
          assets.get('components/Button.tsx'),
          null,
          'components/Button.tsx should not be accessible',
        )
      } finally {
        cleanupTempDir()
      }
    })

    it('allows multiple scripts', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({
          root: tempDir,
          scripts: ['entry.tsx', 'components/Button.tsx'],
        })

        assert.ok(assets.get('entry.tsx'), 'entry.tsx should be accessible')
        assert.ok(assets.get('components/Button.tsx'), 'components/Button.tsx should be accessible')
      } finally {
        cleanupTempDir()
      }
    })

    it('normalizes leading slashes in scripts', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir, scripts: ['entry.tsx'] })

        assert.ok(assets.get('entry.tsx'), 'without leading slash should work')
        assert.ok(assets.get('/entry.tsx'), 'with leading slash should work')
      } finally {
        cleanupTempDir()
      }
    })

    it('returns null for non-script files even if they exist', () => {
      setupTempDir()
      try {
        let assets = createDevAssets({ root: tempDir, scripts: ['entry.tsx'] })

        assert.equal(assets.get('components/Button.tsx'), null)
      } finally {
        cleanupTempDir()
      }
    })
  })

  describe('file variants', () => {
    it('returns file asset URL for matching rule with required variant', () => {
      setupTempDir()
      try {
        fs.mkdirSync(path.join(tempDir, 'images'))
        fs.writeFileSync(path.join(tempDir, 'images', 'logo.txt'), 'logo')
        let assets = createDevAssets({
          root: tempDir,
          files: [
            {
              include: 'images/**/*.txt',
              variants: {
                small: (data) => data,
              },
            },
          ],
        })

        let entry = assets.get('images/logo.txt', 'small')
        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/__@files/images/logo.txt?@small')
      } finally {
        cleanupTempDir()
      }
    })

    it('returns null for missing required variant', () => {
      setupTempDir()
      try {
        fs.mkdirSync(path.join(tempDir, 'images'))
        fs.writeFileSync(path.join(tempDir, 'images', 'logo.txt'), 'logo')
        let assets = createDevAssets({
          root: tempDir,
          files: [
            {
              include: 'images/**/*.txt',
              variants: {
                small: (data) => data,
              },
            },
          ],
        })

        assert.equal(assets.get('images/logo.txt'), null)
      } finally {
        cleanupTempDir()
      }
    })

    it('supports extensionless and @ filenames with query variant URLs', () => {
      setupTempDir()
      try {
        fs.mkdirSync(path.join(tempDir, 'images'), { recursive: true })
        fs.writeFileSync(path.join(tempDir, 'images', 'avatar@2x'), 'logo')
        let assets = createDevAssets({
          root: tempDir,
          files: [
            {
              include: 'images/**',
              variants: {
                card: (data) => data,
              },
            },
          ],
        })

        let entry = assets.get('images/avatar@2x', 'card')
        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/__@files/images/avatar%402x?@card')
      } finally {
        cleanupTempDir()
      }
    })
  })
})
