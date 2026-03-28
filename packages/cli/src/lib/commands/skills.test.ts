import * as assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { describe, it } from 'node:test'

import { run } from '../../index.ts'

const REMIX_GITHUB_TREE_URL =
  'https://api.github.com/repos/remix-run/remix/git/trees/main?recursive=1'

describe('skills command', () => {
  it('prints skills command help', async () => {
    let result = await captureOutput(() => run(['skills', '--help']))

    assert.equal(result.exitCode, 0)
    assert.match(result.stdout, /Usage:\s+remix skills <command>/)
    assert.match(result.stdout, /install \[--dir <path>\]/)
    assert.match(result.stdout, /list \[--dir <path>\] \[--json\]/)
    assert.match(result.stdout, /remix skills install --dir custom\/skills/)
    assert.match(result.stdout, /remix skills list --dir custom\/skills/)
    assert.match(result.stdout, /remix skills list --json/)
    assert.match(result.stdout, /list/)
    assert.equal(result.stderr, '')
  })

  it('prints skills subcommand help', async () => {
    let installHelp = await captureOutput(() => run(['skills', 'install', '--help']))
    let listHelp = await captureOutput(() => run(['skills', 'list', '--help']))

    assert.equal(installHelp.exitCode, 0)
    assert.match(installHelp.stdout, /Usage:\s+remix skills install \[--dir <path>\]/)
    assert.match(installHelp.stdout, /--dir <path>/)
    assert.match(installHelp.stdout, /remix skills install --dir custom\/skills/)
    assert.equal(listHelp.exitCode, 0)
    assert.match(listHelp.stdout, /Usage:\s+remix skills list \[--dir <path>\] \[--json\]/)
    assert.match(listHelp.stdout, /--dir <path>/)
    assert.match(listHelp.stdout, /--json/)
    assert.match(listHelp.stdout, /remix skills list --dir custom\/skills/)
    assert.match(listHelp.stdout, /remix skills list --json/)
  })

  it('does not treat help as a skills subcommand', async () => {
    let result = await captureOutput(() => run(['skills', 'help']))

    assert.equal(result.exitCode, 1)
    assert.match(result.stderr, /Unknown skills command: help/)
    assert.match(result.stderr, /Usage:\s+remix skills <command>/)
  })

  it('installs remote skills into .agents/skills and creates the directory', async () => {
    let remoteSkills = {
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
        'templates/route.md': 'Route template\n',
      },
      'remix-ui': {
        'SKILL.md': '# UI\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))

      let result = await withFetchMock(createGitHubSkillsFetchMock(remoteSkills), () =>
        withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
      )

      assert.equal(result.exitCode, 0)
      assert.match(result.stderr, /• Resolve project root\.\.\./)
      assert.match(result.stderr, /✓ Resolve project root/)
      assert.match(result.stderr, /• Fetch Remix skills from GitHub\.\.\./)
      assert.match(result.stderr, /✓ Fetch Remix skills from GitHub/)
      assert.match(result.stderr, /• Compare local skills\.\.\./)
      assert.match(result.stderr, /✓ Compare local skills/)
      assert.match(result.stderr, /• Write updated skills\.\.\./)
      assert.match(result.stderr, /✓ Write updated skills/)
      assert.match(result.stderr, /✓ Write updated skills\n\n$/)
      assert.match(
        result.stdout,
        new RegExp(`Synced Remix skills into ${escapeRegExp(path.join('.agents', 'skills'))}:`),
      )
      assert.match(result.stdout, /• remix-project-layout/)
      assert.match(result.stdout, /• remix-ui/)
      await assertPathExists(
        path.join(tmpDir, '.agents', 'skills', 'remix-project-layout', 'SKILL.md'),
      )
      await assertPathExists(
        path.join(tmpDir, '.agents', 'skills', 'remix-project-layout', 'templates', 'route.md'),
      )
      await assertPathExists(path.join(tmpDir, '.agents', 'skills', 'remix-ui', 'SKILL.md'))
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('replaces matching local skills and preserves unrelated local skills', async () => {
    let remoteSkills = {
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
      },
      'remix-ui': {
        'SKILL.md': '# New UI\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      await writeFiles(path.join(tmpDir, '.agents', 'skills'), {
        'custom/SKILL.md': '# Local skill\n',
        'remix-ui/SKILL.md': '# Old UI\n',
      })

      let result = await withFetchMock(createGitHubSkillsFetchMock(remoteSkills), () =>
        withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
      )

      assert.equal(result.exitCode, 0)
      assert.match(result.stderr, /• Write updated skills\.\.\./)
      assert.match(result.stdout, /• replaced remix-ui/)
      assert.equal(
        await fs.readFile(path.join(tmpDir, '.agents', 'skills', 'remix-ui', 'SKILL.md'), 'utf8'),
        '# New UI\n',
      )
      assert.equal(
        await fs.readFile(path.join(tmpDir, '.agents', 'skills', 'custom', 'SKILL.md'), 'utf8'),
        '# Local skill\n',
      )
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('installs remote skills into a custom directory relative to the project root', async () => {
    let remoteSkills = {
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
      },
      'remix-ui': {
        'SKILL.md': '# UI\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      let nestedDir = path.join(tmpDir, 'app', 'routes')
      await fs.mkdir(nestedDir, { recursive: true })

      let result = await withFetchMock(createGitHubSkillsFetchMock(remoteSkills), () =>
        withCwd(nestedDir, () =>
          captureOutput(() => run(['skills', 'install', '--dir', 'custom/skills'])),
        ),
      )
      let displayPath = path.relative(nestedDir, path.join(tmpDir, 'custom', 'skills'))

      assert.equal(result.exitCode, 0)
      assert.match(result.stderr, /✓ Resolve project root/)
      assert.match(
        result.stdout,
        new RegExp(`Synced Remix skills into ${escapeRegExp(displayPath)}:`),
      )
      await assertPathExists(
        path.join(tmpDir, 'custom', 'skills', 'remix-project-layout', 'SKILL.md'),
      )
      await assertPathExists(path.join(tmpDir, 'custom', 'skills', 'remix-ui', 'SKILL.md'))
      await assert.rejects(fs.access(path.join(tmpDir, '.agents', 'skills')), (error: unknown) => {
        let nodeError = error as NodeJS.ErrnoException
        return nodeError.code === 'ENOENT'
      })
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('prefers the nearest package root over an outer git repo root', async () => {
    let remoteSkills = {
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
      },
      'remix-ui': {
        'SKILL.md': '# UI\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      let demoDir = path.join(tmpDir, 'demos', 'bookstore')
      let nestedDir = path.join(demoDir, 'app', 'controllers')
      await fs.mkdir(nestedDir, { recursive: true })
      await fs.writeFile(
        path.join(demoDir, 'package.json'),
        JSON.stringify({ name: 'bookstore-demo', private: true, type: 'module' }, null, 2),
      )

      let result = await withFetchMock(createGitHubSkillsFetchMock(remoteSkills), () =>
        withCwd(nestedDir, () => captureOutput(() => run(['skills', 'install']))),
      )
      let displayPath = path.relative(nestedDir, path.join(demoDir, '.agents', 'skills'))

      assert.equal(result.exitCode, 0)
      assert.match(result.stderr, /✓ Resolve project root/)
      assert.match(
        result.stdout,
        new RegExp(`Synced Remix skills into ${escapeRegExp(displayPath)}:`),
      )
      await assertPathExists(
        path.join(demoDir, '.agents', 'skills', 'remix-project-layout', 'SKILL.md'),
      )
      await assertPathExists(path.join(demoDir, '.agents', 'skills', 'remix-ui', 'SKILL.md'))
      await assert.rejects(fs.access(path.join(tmpDir, '.agents', 'skills')), (error: unknown) => {
        let nodeError = error as NodeJS.ErrnoException
        return nodeError.code === 'ENOENT'
      })
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails when skills install --dir is missing a value', async () => {
    let result = await captureOutput(() => run(['skills', 'install', '--dir']))

    assert.equal(result.exitCode, 1)
    assert.match(result.stderr, /--dir requires a value\./)
  })

  it('reports write-updated-skills as skipped when install has no changes', async () => {
    let remoteSkills = {
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      await writeFiles(path.join(tmpDir, '.agents', 'skills'), {
        'remix-project-layout/SKILL.md': '# Layout\n',
      })

      let result = await withFetchMock(createGitHubSkillsFetchMock(remoteSkills), () =>
        withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
      )

      assert.equal(result.exitCode, 0)
      assert.match(result.stderr, /• Write updated skills \(skipped: No changes\.\)\n\n$/)
      assert.match(
        result.stdout,
        new RegExp(
          `No changes\\. ${escapeRegExp(path.join('.agents', 'skills'))} is up to date\\.`,
        ),
      )
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails when skills list --dir is missing a value', async () => {
    let result = await captureOutput(() => run(['skills', 'list', '--dir']))

    assert.equal(result.exitCode, 1)
    assert.match(result.stderr, /--dir requires a value\./)
    assert.match(result.stderr, /Usage:\s+remix skills list \[--dir <path>\]/)
  })

  it('fails for the removed skills status command', async () => {
    let result = await captureOutput(() => run(['skills', 'status']))

    assert.equal(result.exitCode, 1)
    assert.match(result.stderr, /Unknown skills command: status/)
    assert.match(result.stderr, /Usage:\s+remix skills <command>/)
  })

  it('lists Remix skills from a nested directory with inline status tags', async () => {
    let remoteSkills = {
      'remix-auth': {
        'SKILL.md': '# Auth\n',
      },
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
        'templates/route.md': 'Route template\n',
      },
      'remix-ui': {
        'SKILL.md': '# UI\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      await writeFiles(path.join(tmpDir, '.agents', 'skills'), {
        'custom-helper/SKILL.md': '# Custom helper\n',
        'remix-project-layout/SKILL.md': '# Layout\n',
        'remix-project-layout/templates/route.md': 'Route template\n',
        'remix-ui/SKILL.md': '# Old UI\n',
      })
      let nestedDir = path.join(tmpDir, 'app', 'routes')
      await fs.mkdir(nestedDir, { recursive: true })

      let result = await withFetchMock(createGitHubSkillsFetchMock(remoteSkills), () =>
        withCwd(nestedDir, () => captureOutput(() => run(['skills', 'list']))),
      )

      assert.equal(result.exitCode, 0)
      assert.match(result.stderr, /• Resolve project root\.\.\./)
      assert.match(result.stderr, /✓ Resolve project root/)
      assert.match(result.stderr, /• Fetch Remix skills from GitHub\.\.\./)
      assert.match(result.stderr, /✓ Fetch Remix skills from GitHub/)
      assert.match(result.stderr, /• Compare local skills\.\.\./)
      assert.match(result.stderr, /✓ Compare local skills\n\n$/)
      assert.match(
        result.stdout,
        new RegExp(
          `Checked Remix skills against ${escapeRegExp(path.join('..', '..', '.agents', 'skills'))}: 1 installed, 1 outdated, 1 missing\\.`,
        ),
      )
      assert.match(result.stdout, /• remix-project-layout/)
      assert.match(result.stdout, /• remix-ui \[outdated\]/)
      assert.match(result.stdout, /• remix-auth \[missing\]/)
      assert.doesNotMatch(result.stdout, /custom-helper/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('lists local skill state from a custom directory relative to the project root', async () => {
    let remoteSkills = {
      'remix-auth': {
        'SKILL.md': '# Auth\n',
      },
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      await writeFiles(path.join(tmpDir, 'custom', 'skills'), {
        'remix-project-layout/SKILL.md': '# Layout\n',
      })
      let nestedDir = path.join(tmpDir, 'app', 'routes')
      await fs.mkdir(nestedDir, { recursive: true })

      let result = await withFetchMock(createGitHubSkillsFetchMock(remoteSkills), () =>
        withCwd(nestedDir, () =>
          captureOutput(() => run(['skills', 'list', '--dir', 'custom/skills'])),
        ),
      )
      let displayPath = path.relative(nestedDir, path.join(tmpDir, 'custom', 'skills'))

      assert.equal(result.exitCode, 0)
      assert.match(
        result.stdout,
        new RegExp(`Checked Remix skills against ${escapeRegExp(displayPath)}: 1 installed, 1 missing\\.`),
      )
      assert.match(result.stdout, /• remix-project-layout/)
      assert.match(result.stdout, /• remix-auth \[missing\]/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('colors missing and outdated tags in list output when stdout is a tty', async () => {
    let remoteSkills = {
      'remix-auth': {
        'SKILL.md': '# Auth\n',
      },
      'remix-ui': {
        'SKILL.md': '# UI\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      await writeFiles(path.join(tmpDir, '.agents', 'skills'), {
        'remix-ui/SKILL.md': '# Old UI\n',
      })

      let result = await withTtyState({ stdout: true, stderr: true }, () =>
        withFetchMock(createGitHubSkillsFetchMock(remoteSkills), () =>
          withCwd(tmpDir, () =>
            captureOutput(() => run(['skills', 'list'], { remixVersion: '9.9.9' })),
          ),
        ),
      )

      assert.equal(result.exitCode, 0)
      assert.match(result.stderr, /v9\.9\.9 - skills list/)
      assert.match(result.stdout, /• remix-auth \u001B\[91m\[missing\]\u001B\[0m/)
      assert.match(result.stdout, /• remix-ui \u001B\[93m\[outdated\]\u001B\[0m/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('prints list output as json', async () => {
    let remoteSkills = {
      'remix-auth': {
        'SKILL.md': '# Auth\n',
      },
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      await writeFiles(path.join(tmpDir, '.agents', 'skills'), {
        'remix-project-layout/SKILL.md': '# Layout\n',
      })
      let realProjectRoot = await fs.realpath(tmpDir)

      let result = await withFetchMock(createGitHubSkillsFetchMock(remoteSkills), () =>
        withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list', '--json']))),
      )

      assert.equal(result.exitCode, 0)
      assert.equal(result.stderr, '')

      let payload = JSON.parse(result.stdout) as {
        entries: Array<{ name: string; state: string }>
        projectRoot: string
        skillsDir: string
      }

      assert.equal(await fs.realpath(payload.projectRoot), realProjectRoot)
      assert.equal(
        await fs.realpath(payload.skillsDir),
        await fs.realpath(path.join(realProjectRoot, '.agents', 'skills')),
      )
      assert.deepEqual(payload.entries, [
        { name: 'remix-auth', state: 'missing' },
        { name: 'remix-project-layout', state: 'installed' },
      ])
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('lists installed skills without status tags when everything is up to date', async () => {
    let remoteSkills = {
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
      },
      'remix-ui': {
        'SKILL.md': '# UI\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      await writeFiles(path.join(tmpDir, '.agents', 'skills'), {
        'remix-project-layout/SKILL.md': '# Layout\n',
        'remix-ui/SKILL.md': '# UI\n',
      })

      let result = await withFetchMock(createGitHubSkillsFetchMock(remoteSkills), () =>
        withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list']))),
      )

      assert.equal(result.exitCode, 0)
      assert.match(
        result.stdout,
        new RegExp(
          `Checked Remix skills against ${escapeRegExp(path.join('.agents', 'skills'))}: 2 installed\\.`,
        ),
      )
      assert.match(result.stdout, /• remix-project-layout/)
      assert.match(result.stdout, /• remix-ui/)
      assert.doesNotMatch(result.stdout, /\[outdated\]/)
      assert.doesNotMatch(result.stdout, /\[missing\]/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails when no project root can be found', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      let result = await withFetchMock(createGitHubSkillsFetchMock({}), () =>
        withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list']))),
      )

      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /Could not find a project root/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails when GitHub returns a non-ok response', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))

      let result = await withFetchMock(createGitHubSkillsFetchMock({}, { treeStatus: 500 }), () =>
        withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list']))),
      )

      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /Could not fetch Remix skills from GitHub\./)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails when GitHub returns invalid skill data', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))

      let result = await withFetchMock(
        createGitHubSkillsFetchMock({}, { malformedTree: true }),
        () => withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list']))),
      )

      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /Received an invalid Remix skills listing from GitHub\./)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})

async function captureOutput(
  callback: () => Promise<number>,
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  let stderr = ''
  let stdout = ''
  let originalStdoutWrite = process.stdout.write
  let originalStderrWrite = process.stderr.write

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stdout.write

  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stderr.write

  try {
    let exitCode = await callback()
    return { exitCode, stderr, stdout }
  } finally {
    process.stdout.write = originalStdoutWrite
    process.stderr.write = originalStderrWrite
  }
}

async function withCwd<T>(cwd: string, callback: () => Promise<T>): Promise<T> {
  let previousCwd = process.cwd()
  process.chdir(cwd)

  try {
    return await callback()
  } finally {
    process.chdir(previousCwd)
  }
}

async function withFetchMock<T>(fetchMock: typeof fetch, callback: () => Promise<T>): Promise<T> {
  let originalFetch = globalThis.fetch
  globalThis.fetch = fetchMock

  try {
    return await callback()
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function withTtyState<T>(
  options: { stderr?: boolean; stdout?: boolean },
  callback: () => Promise<T>,
): Promise<T> {
  let originalIsTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
  let originalStderrIsTTY = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY')
  let originalTerm = process.env.TERM
  let originalNoColor = process.env.NO_COLOR

  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value: options.stdout ?? false,
  })
  Object.defineProperty(process.stderr, 'isTTY', {
    configurable: true,
    value: options.stderr ?? false,
  })
  process.env.TERM = 'xterm-256color'
  delete process.env.NO_COLOR

  try {
    return await callback()
  } finally {
    if (originalIsTTY == null) {
      Reflect.deleteProperty(process.stdout as object, 'isTTY')
    } else {
      Object.defineProperty(process.stdout, 'isTTY', originalIsTTY)
    }

    if (originalStderrIsTTY == null) {
      Reflect.deleteProperty(process.stderr as object, 'isTTY')
    } else {
      Object.defineProperty(process.stderr, 'isTTY', originalStderrIsTTY)
    }

    if (originalTerm == null) {
      delete process.env.TERM
    } else {
      process.env.TERM = originalTerm
    }

    if (originalNoColor == null) {
      delete process.env.NO_COLOR
    } else {
      process.env.NO_COLOR = originalNoColor
    }
  }
}

function createGitHubSkillsFetchMock(
  remoteSkills: Record<string, Record<string, string>>,
  options: { malformedTree?: boolean; treeStatus?: number } = {},
): typeof fetch {
  let blobResponses = new Map<string, string>()
  let treeEntries = Object.entries(remoteSkills).flatMap(([skillName, files]) =>
    Object.entries(files).map(([filePath, content]) => {
      let blobUrl = `https://api.github.com/repos/remix-run/remix/git/blobs/${encodeURIComponent(`${skillName}/${filePath}`)}`
      blobResponses.set(blobUrl, content)

      return {
        path: `skills/${skillName}/${filePath}`,
        type: 'blob',
        url: blobUrl,
      }
    }),
  )

  return (async (input: RequestInfo | URL) => {
    let url = toUrlString(input)
    if (url === REMIX_GITHUB_TREE_URL) {
      if (options.treeStatus != null) {
        return new Response('boom', { status: options.treeStatus, statusText: 'Server Error' })
      }

      if (options.malformedTree) {
        return jsonResponse({ tree: {} })
      }

      return jsonResponse({ tree: treeEntries, truncated: false })
    }

    let blobContent = blobResponses.get(url)
    if (blobContent != null) {
      return jsonResponse({
        content: Buffer.from(blobContent, 'utf8').toString('base64'),
        encoding: 'base64',
      })
    }

    return new Response('Not found', { status: 404, statusText: 'Not Found' })
  }) as typeof fetch
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

function toUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

async function writeFiles(rootDir: string, files: Record<string, string>): Promise<void> {
  for (let [relativePath, content] of Object.entries(files)) {
    let filePath = path.join(rootDir, relativePath)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, 'utf8')
  }
}

async function assertPathExists(filePath: string): Promise<void> {
  await fs.access(filePath)
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')
}
