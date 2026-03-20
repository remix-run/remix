import * as assert from '@remix-run/assert'
import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { it } from '@remix-run/test'
import { findVersionIntroductionCommit, getLocalTagTarget } from './git.ts'

function execGit(args: string[], cwd: string): string {
  return cp.execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf-8' }).trim()
}

it('findVersionIntroductionCommit returns the commit where the target version was introduced', () => {
  let tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-git-test-'))
  let packageJsonPath = 'packages/example/package.json'

  try {
    execGit(['init'], tempDir)
    execGit(['config', 'user.name', 'Test Bot'], tempDir)
    execGit(['config', 'user.email', 'test@example.com'], tempDir)

    fs.mkdirSync(path.join(tempDir, path.dirname(packageJsonPath)), { recursive: true })
    fs.writeFileSync(
      path.join(tempDir, packageJsonPath),
      `${JSON.stringify({ name: '@remix-run/example', version: '1.0.0' }, null, 2)}\n`,
    )
    execGit(['add', '.'], tempDir)
    execGit(['commit', '-m', 'initial release'], tempDir)
    let initialCommit = execGit(['rev-parse', 'HEAD'], tempDir)

    fs.writeFileSync(path.join(tempDir, 'README.md'), 'hello\n')
    execGit(['add', 'README.md'], tempDir)
    execGit(['commit', '-m', 'docs change'], tempDir)

    fs.writeFileSync(
      path.join(tempDir, packageJsonPath),
      `${JSON.stringify({ name: '@remix-run/example', version: '1.1.0' }, null, 2)}\n`,
    )
    execGit(['add', packageJsonPath], tempDir)
    execGit(['commit', '-m', 'bump version'], tempDir)
    let versionBumpCommit = execGit(['rev-parse', 'HEAD'], tempDir)

    fs.writeFileSync(
      path.join(tempDir, packageJsonPath),
      `${JSON.stringify(
        {
          name: '@remix-run/example',
          version: '1.1.0',
          description: 'metadata only',
        },
        null,
        2,
      )}\n`,
    )
    execGit(['add', packageJsonPath], tempDir)
    execGit(['commit', '-m', 'metadata tweak'], tempDir)

    assert.equal(
      findVersionIntroductionCommit(packageJsonPath, '1.1.0', tempDir),
      versionBumpCommit,
    )
    assert.equal(findVersionIntroductionCommit(packageJsonPath, '1.0.0', tempDir), initialCommit)
    assert.equal(findVersionIntroductionCommit(packageJsonPath, '9.9.9', tempDir), null)

    execGit(['tag', 'example@1.1.0', versionBumpCommit], tempDir)
    assert.equal(getLocalTagTarget('example@1.1.0', tempDir), versionBumpCommit)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})
