import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

import { resolvedPathToUrl, type ResolveContext } from './resolve.ts'

describe('resolvedPathToUrl', () => {
  it('uses workspace allow patterns (not app) for paths under workspace root', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-test-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      let workspacePkgDir = path.join(tmpDir, 'packages', 'pkg')
      await fsp.mkdir(path.join(appDir), { recursive: true })
      await fsp.mkdir(path.join(workspacePkgDir), { recursive: true })
      await fsp.writeFile(path.join(appDir, 'entry.ts'), '')
      await fsp.writeFile(path.join(workspacePkgDir, 'index.ts'), '')

      let workspaceRoot = tmpDir
      let absolutePath = path.join(workspacePkgDir, 'index.ts')

      let ctx: ResolveContext = {
        root: appDir,
        workspaceRoot,
        allowPatterns: ['app/**'], // App allow - does NOT match packages/pkg/index.ts
        denyPatterns: [],
        workspaceAllowPatterns: ['packages/**'], // Workspace allow - matches
        workspaceDenyPatterns: [],
      }

      let url = resolvedPathToUrl(absolutePath, ctx)

      assert.ok(
        url.startsWith('/__@workspace/'),
        `Expected /__@workspace/ URL, got: ${url}. ` +
          `(Bug: using app allow for workspace paths would emit absolute path)`,
      )
      assert.ok(url.includes('packages/pkg/index.ts'), `Expected path in URL, got: ${url}`)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
