import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { pathToFileURL } from 'node:url'

import { createDevAssetResolver } from './dev-assets.ts'
import {
  AssetNotFoundError,
  AssetVariantRequiredError,
  AssetVariantNotFoundError,
  AssetVariantUnexpectedError,
} from './errors.ts'

describe('createDevAssetResolver', () => {
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
    it('returns href as /__@assets/ URL', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({ root: tempDir })
        let entry = resolveAsset('entry.tsx')

        assert.equal(entry.href, '/__@assets/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('returns preloads as array containing only href', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({ root: tempDir })
        let entry = resolveAsset('entry.tsx')

        assert.deepEqual(entry.preloads, ['/__@assets/entry.tsx'])
      } finally {
        cleanupTempDir()
      }
    })

    it('handles nested paths', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({ root: tempDir })
        let entry = resolveAsset('components/Button.tsx')

        assert.equal(entry.href, '/__@assets/components/Button.tsx')
        assert.deepEqual(entry.preloads, ['/__@assets/components/Button.tsx'])
      } finally {
        cleanupTempDir()
      }
    })

    it('normalizes leading slashes in entry path', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({ root: tempDir })
        let entry = resolveAsset('/entry.tsx')

        assert.equal(entry.href, '/__@assets/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('normalizes multiple leading slashes', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({ root: tempDir })
        let entry = resolveAsset('///entry.tsx')

        assert.equal(entry.href, '/__@assets/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('resolves file:// URLs to /__@assets/ href (e.g. hydration roots)', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({ root: tempDir })
        let absolutePath = path.join(tempDir, 'entry.tsx')
        let fileUrl = pathToFileURL(absolutePath).href

        let entry = resolveAsset(fileUrl)

        assert.equal(entry.href, '/__@assets/entry.tsx')
        assert.deepEqual(entry.preloads, ['/__@assets/entry.tsx'])
      } finally {
        cleanupTempDir()
      }
    })

    it('resolves file:// URL for nested path (e.g. app/components/cart-button.tsx)', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({ root: tempDir })
        let absolutePath = path.join(tempDir, 'components', 'Button.tsx')
        let fileUrl = pathToFileURL(absolutePath).href

        let entry = resolveAsset(fileUrl)

        assert.equal(entry.href, '/__@assets/components/Button.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('throws AssetNotFoundError if entry file does not exist', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({ root: tempDir })

        assert.throws(() => resolveAsset('nonexistent.tsx'), AssetNotFoundError)
      } finally {
        cleanupTempDir()
      }
    })

    it('throws AssetNotFoundError for nested non-existent paths', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({ root: tempDir })

        assert.throws(() => resolveAsset('missing/file.tsx'), AssetNotFoundError)
      } finally {
        cleanupTempDir()
      }
    })

    it('works with relative root path', () => {
      setupTempDir()
      try {
        let relativePath = path.relative(process.cwd(), tempDir)
        let resolveAsset = createDevAssetResolver({ root: relativePath })
        let entry = resolveAsset('entry.tsx')

        assert.equal(entry.href, '/__@assets/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('works with absolute root path', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({ root: tempDir })
        let entry = resolveAsset('entry.tsx')

        assert.equal(entry.href, '/__@assets/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('restricts to specified scripts when provided', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({
          root: tempDir,
          source: { scripts: ['entry.tsx'] },
        })

        assert.doesNotThrow(() => resolveAsset('entry.tsx'))
        assert.throws(() => resolveAsset('components/Button.tsx'), AssetNotFoundError)
      } finally {
        cleanupTempDir()
      }
    })
  })

  describe('scripts restriction', () => {
    it('allows all files when scripts not specified', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({ root: tempDir })

        assert.doesNotThrow(() => resolveAsset('entry.tsx'))
        assert.doesNotThrow(() => resolveAsset('components/Button.tsx'))
      } finally {
        cleanupTempDir()
      }
    })

    it('restricts to specified scripts when provided', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({
          root: tempDir,
          source: { scripts: ['entry.tsx'] },
        })

        assert.doesNotThrow(() => resolveAsset('entry.tsx'))
        assert.throws(() => resolveAsset('components/Button.tsx'), AssetNotFoundError)
      } finally {
        cleanupTempDir()
      }
    })

    it('allows multiple scripts', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({
          root: tempDir,
          source: { scripts: ['entry.tsx', 'components/Button.tsx'] },
        })

        assert.doesNotThrow(() => resolveAsset('entry.tsx'))
        assert.doesNotThrow(() => resolveAsset('components/Button.tsx'))
      } finally {
        cleanupTempDir()
      }
    })

    it('normalizes leading slashes in scripts', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({
          root: tempDir,
          source: { scripts: ['entry.tsx'] },
        })

        assert.doesNotThrow(() => resolveAsset('entry.tsx'))
        assert.doesNotThrow(() => resolveAsset('/entry.tsx'))
      } finally {
        cleanupTempDir()
      }
    })

    it('throws AssetNotFoundError for non-script files even if they exist', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({
          root: tempDir,
          source: { scripts: ['entry.tsx'] },
        })

        assert.throws(() => resolveAsset('components/Button.tsx'), AssetNotFoundError)
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
        let resolveAsset = createDevAssetResolver({
          root: tempDir,
          source: {
            files: [
              {
                include: 'images/**/*.txt',
                variants: {
                  small: (data) => data,
                },
              },
            ],
          },
        })

        let entry = resolveAsset('images/logo.txt', 'small')
        assert.equal(entry.href, '/__@assets/images/logo.txt?@small')
        assert.deepEqual(entry.preloads, [])
      } finally {
        cleanupTempDir()
      }
    })

    it('throws AssetVariantRequiredError when no variant is provided and no defaultVariant is set', () => {
      setupTempDir()
      try {
        fs.mkdirSync(path.join(tempDir, 'images'))
        fs.writeFileSync(path.join(tempDir, 'images', 'logo.txt'), 'logo')
        let resolveAsset = createDevAssetResolver({
          root: tempDir,
          source: {
            files: [
              {
                include: 'images/**/*.txt',
                variants: {
                  small: (data) => data,
                },
              },
            ],
          },
        })

        assert.throws(() => resolveAsset('images/logo.txt'), AssetVariantRequiredError)
      } finally {
        cleanupTempDir()
      }
    })

    it('throws AssetVariantNotFoundError when an unknown variant is requested', () => {
      setupTempDir()
      try {
        fs.mkdirSync(path.join(tempDir, 'images'))
        fs.writeFileSync(path.join(tempDir, 'images', 'logo.txt'), 'logo')
        let resolveAsset = createDevAssetResolver({
          root: tempDir,
          source: {
            files: [
              {
                include: 'images/**/*.txt',
                variants: {
                  small: (data) => data,
                },
              },
            ],
          },
        })

        assert.throws(
          () => resolveAsset('images/logo.txt', 'large' as any),
          AssetVariantNotFoundError,
        )
      } finally {
        cleanupTempDir()
      }
    })

    it('throws AssetVariantUnexpectedError when a variant is requested on a non-variant asset', () => {
      setupTempDir()
      try {
        let resolveAsset = createDevAssetResolver({ root: tempDir })

        assert.throws(() => resolveAsset('entry.tsx', 'small' as any), AssetVariantUnexpectedError)
      } finally {
        cleanupTempDir()
      }
    })

    it('supports extensionless and @ filenames with query variant URLs', () => {
      setupTempDir()
      try {
        fs.mkdirSync(path.join(tempDir, 'images'), { recursive: true })
        fs.writeFileSync(path.join(tempDir, 'images', 'avatar@2x'), 'logo')
        let resolveAsset = createDevAssetResolver({
          root: tempDir,
          source: {
            files: [
              {
                include: 'images/**',
                variants: {
                  card: (data) => data,
                },
              },
            ],
          },
        })

        let entry = resolveAsset('images/avatar@2x', 'card')
        assert.equal(entry.href, '/__@assets/images/avatar%402x?@card')
      } finally {
        cleanupTempDir()
      }
    })
  })
})
