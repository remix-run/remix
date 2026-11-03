import assert from '@remix-run/assert'
import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it } from '@remix-run/test'

import { readPreviewManifest } from './preview.ts'

const script = path.resolve(import.meta.dirname, '../preview.ts')

describe('preview tarball build', () => {
  it('packs real packages with release dependencies, runs prepack once, and restores source manifests', () => {
    let fixture = createFixture()
    try {
      fixture.build()
      let preview = readPreviewManifest(
        fs.readFileSync(path.join(fixture.cwd, '.preview/preview.json'), 'utf8'),
      )
      let pkg = JSON.parse(
        fixture.exec('tar', ['-xOf', '.preview/remix.tgz', 'package/package.json']),
      )
      assert.equal(pkg.dependencies['@remix-run/headers'], preview.packages['@remix-run/headers'])
      assert.equal(pkg.exports, './dist/index.js')
      assert.equal(pkg.scripts.prepack, undefined)
      assert.equal(pkg.publishConfig, undefined)
      assert.equal(
        fs.readFileSync(path.join(fixture.cwd, 'packages/remix/dist/prepack.txt'), 'utf8'),
        'once',
      )
      assert.match(
        fixture.exec('tar', ['-xOf', '.preview/headers.tgz', 'package/dist/index.js']),
        /preview header/,
      )
      assert.equal(fixture.exec('git', ['status', '--porcelain']), '')
      assert.equal(fixture.exec('git', ['rev-parse', 'HEAD']), preview.sha)
      let githubOutput = path.join(fixture.cwd, 'github-output')
      let publication = fixture.exec('node', [script, 'publish', '--dry-run'], {
        GITHUB_OUTPUT: githubOutput,
        REMIX_PREVIEWS_PAT: '',
      })
      assert.match(publication, /Would publish/)
      assert.equal(fs.readFileSync(githubOutput, 'utf8'), 'published=false\n')
      let install = path.join(fixture.cwd, 'install')
      fs.mkdirSync(install)
      fs.writeFileSync(path.join(install, 'package.json'), '{"private":true,"type":"module"}')
      cp.execFileSync(
        'npm',
        [
          'install',
          '--ignore-scripts',
          '--package-lock=false',
          '--no-audit',
          '--no-fund',
          '--offline',
          '--cache',
          path.join(install, '.npm-cache'),
          path.join(fixture.cwd, '.preview/headers.tgz'),
        ],
        { cwd: install, stdio: 'pipe' },
      )
      assert.equal(
        cp
          .execFileSync(
            process.execPath,
            [
              '--input-type=module',
              '-e',
              "import { header } from '@remix-run/headers'; console.log(header)",
            ],
            { cwd: install, encoding: 'utf8' },
          )
          .trim(),
        'preview header',
      )
    } finally {
      fixture.dispose()
    }
  })

  it('restores original manifests when packing fails', () => {
    let fixture = createFixture()
    try {
      // An unwritable output path fails after manifests have been rewritten.
      fs.mkdirSync(path.join(fixture.cwd, '.preview'))
      fs.chmodSync(path.join(fixture.cwd, '.preview'), 0o500)
      assert.throws(() => fixture.build(), /Command failed/)
      assert.equal(fixture.exec('git', ['status', '--porcelain']), '')
    } finally {
      fixture.dispose()
    }
  })

  it('prints a dry run from a dirty checkout without writing files or requiring credentials', () => {
    let fixture = createFixture()
    try {
      fs.writeFileSync(path.join(fixture.cwd, 'uncommitted.txt'), 'work in progress')
      let output = fixture.exec('node', [script, 'build', 'main', '--dry-run'])
      assert.match(output, /Would build main-/)
      assert.equal(fs.existsSync(path.join(fixture.cwd, '.preview')), false)
      assert.equal(fs.existsSync(path.join(fixture.cwd, 'packages/remix/dist')), false)
    } finally {
      fixture.dispose()
    }
  })

  it('does not delete previews for a PR closed without merging', () => {
    let fixture = createFixture()
    try {
      let bin = path.join(fixture.cwd, 'bin')
      fs.mkdirSync(bin)
      fs.writeFileSync(
        path.join(bin, 'gh'),
        `#!${process.execPath}\nif (process.argv[3] !== 'repos/remix-run/remix/pulls/123') throw new Error('Unexpected GitHub mutation')\nconsole.log(JSON.stringify({merged:false,head:{sha:'a'.repeat(40)}}))\n`,
        { mode: 0o755 },
      )
      let output = cp.execFileSync(process.execPath, [script, 'cleanup', 'pr-123'], {
        cwd: fixture.cwd,
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_REPOSITORY: 'remix-run/remix',
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        },
      })
      assert.match(output, /Keeping previews for unmerged PR/)
    } finally {
      fixture.dispose()
    }
  })
})

function createFixture() {
  let cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-preview-build-'))
  function exec(command: string, args: string[], env: NodeJS.ProcessEnv = {}): string {
    return cp
      .execFileSync(command, args, {
        cwd,
        stdio: 'pipe',
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_REPOSITORY: 'remix-run/remix',
          REMIX_PREVIEWS_REPOSITORY: 'remix-run/previews',
          ...env,
        },
      })
      .trim()
  }
  fs.writeFileSync(path.join(cwd, '.gitignore'), '.preview/\n**/dist/\n')
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    '{"private":true,"packageManager":"pnpm@10.34.2"}',
  )
  fs.writeFileSync(path.join(cwd, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n")
  for (let name of ['remix', 'headers']) {
    let directory = path.join(cwd, 'packages', name)
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify(
        {
          name: name === 'remix' ? 'remix' : '@remix-run/headers',
          version: '1.0.0',
          type: 'module',
          files: ['dist'],
          exports: './src/index.ts',
          publishConfig: { exports: './dist/index.js' },
          dependencies: name === 'remix' ? { '@remix-run/headers': 'workspace:^' } : undefined,
          scripts: { build: 'node build.cjs', prepack: 'node prepack.cjs' },
        },
        null,
        2,
      ),
    )
    fs.writeFileSync(
      path.join(directory, 'build.cjs'),
      `const fs = require('node:fs'); fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/index.js', "export const header = 'preview header'")`,
    )
    fs.writeFileSync(
      path.join(directory, 'prepack.cjs'),
      `require('node:fs').appendFileSync('dist/prepack.txt', 'once')`,
    )
  }
  exec('git', ['init', '-b', 'main'])
  exec('git', ['config', 'user.name', 'Test'])
  exec('git', ['config', 'user.email', 'test@example.com'])
  exec('git', ['add', '.'])
  exec('git', ['commit', '-m', 'fixture'])
  return {
    cwd,
    exec,
    build() {
      return exec('node', [script, 'build', 'main'])
    },
    dispose() {
      let output = path.join(cwd, '.preview')
      if (fs.existsSync(output)) fs.chmodSync(output, 0o700)
      fs.rmSync(cwd, { recursive: true, force: true })
    },
  }
}
