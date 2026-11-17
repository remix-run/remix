import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { getReleasedPrNumbers } from './released-prs.ts'

function withRepository(
  run: (
    cwd: string,
    git: (...args: string[]) => string,
    change: (file: string, subject: string) => void,
  ) => void,
) {
  let cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-released-prs-'))
  function git(...args: string[]) {
    return cp.execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim()
  }
  function change(file: string, subject: string) {
    let target = path.join(cwd, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.appendFileSync(target, `${subject}\n`)
    git('add', '.')
    git('commit', '-m', subject)
  }
  try {
    git('init')
    git('config', 'user.name', 'Test Bot')
    git('config', 'user.email', 'test@example.com')
    change('README.md', 'Initial commit')
    run(cwd, git, change)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
}

describe('getReleasedPrNumbers', () => {
  it('finds package changes between Remix tags and excludes older, later, and docs-only PRs', () => {
    withRepository((cwd, git, change) => {
      change('packages/component/source.ts', 'Older component change (#100)')
      git('tag', 'remix@1.0.0')
      change('packages/ui/source.ts', 'Released UI change (#200)')
      git('tag', 'ui@1.0.0')
      change('docs/guide.md', 'Docs only (#300)')
      change('packages/component/source.ts', 'New component change (#101)')
      git('tag', 'remix@2.0.0-beta.1')
      change('packages/component/source.ts', 'Unreleased component change (#102)')
      git('tag', 'remix@2.0.0-beta.2')
      assert.deepEqual(getReleasedPrNumbers('remix@2.0.0-beta.1', cwd), new Set([101, 200]))
      assert.throws(() => getReleasedPrNumbers('remix@9.9.9', cwd))
    })
  })

  it('includes first-release history, recognizes merge PRs, and deduplicates PR numbers', () => {
    withRepository((cwd, git, change) => {
      let main = git('branch', '--show-current')
      git('checkout', '-b', 'feature')
      change('packages/component/source.ts', 'Feature implementation')
      git('checkout', main)
      git('merge', '--no-ff', 'feature', '-m', 'Merge pull request #123 from example/feature')
      change('packages/ui/source.ts', 'Shared change (#456)')
      change('packages/component/source.ts', 'Shared change (#456)')
      git('tag', 'remix@1.0.0')
      assert.deepEqual(getReleasedPrNumbers('remix@1.0.0', cwd), new Set([123, 456]))
    })
  })
})
