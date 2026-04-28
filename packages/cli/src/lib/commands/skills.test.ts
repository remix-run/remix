import * as assert from '@remix-run/assert'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { gzipSync } from 'node:zlib'
import { describe, it } from '@remix-run/test'

import { run as runCli } from '../../index.ts'
import type { CliRuntimeContext } from '../runtime-context.ts'
import { getSkillsCacheFilePath } from '../skills-cache.ts'

const REMIX_GITHUB_TREE_URL =
  'https://api.github.com/repos/remix-run/remix/git/trees/main?recursive=1'
const REMIX_GITHUB_ARCHIVE_URL =
  'https://codeload.github.com/remix-run/remix/tar.gz/refs/heads/main'

let testCwd: string | undefined

function run(argv: string[], context: CliRuntimeContext = {}): Promise<number> {
  return runCli(argv, { cwd: testCwd, ...context })
}

const SKILLS_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix skills <command>',
  '',
  'Manage Remix skills for the current project.',
  '',
  'Commands:',
  '  install [--dir <path>]        Install Remix skills into a local directory',
  '  list [--dir <path>] [--json]  List Remix skills and local status',
  '',
  'Examples:',
  '  remix skills install',
  '  remix skills install --dir custom/skills',
  '  remix skills list --dir custom/skills',
  '  remix skills list --json',
  '',
].join('\n')

const SKILLS_INSTALL_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix skills install [--dir <path>]',
  '',
  'Install or refresh Remix skills in .agents/skills for the current project.',
  '',
  'Options:',
  '  --dir <path>  Install skills into a custom directory relative to the project root',
  '',
  'Examples:',
  '  remix skills install',
  '  remix skills install --dir custom/skills',
  '',
].join('\n')

const SKILLS_LIST_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix skills list [--dir <path>] [--json]',
  '',
  'List Remix skills and show whether each one is installed, outdated, or missing locally.',
  '',
  'Options:',
  '  --dir <path>  Read local skills from a custom directory relative to the project root',
  '  --json        Print skill state as JSON',
  '',
  'Examples:',
  '  remix skills list',
  '  remix skills list --dir custom/skills',
  '  remix skills list --json',
  '',
].join('\n')

function getMissingOptionValueErrorText(helpText: string): string {
  return [
    'Error [RMX_MISSING_OPTION_VALUE] Missing option value',
    '--dir requires a value.',
    '',
    'Try:',
    '  Pass a value immediately after the option.',
    '',
    helpText,
  ].join('\n')
}

function getUnknownSkillsCommandErrorText(command: string): string {
  return [
    'Error [RMX_UNKNOWN_SKILLS_COMMAND] Unknown skills command',
    `Unknown skills command: ${command}`,
    '',
    'Try:',
    '  Run `remix skills --help` to see available skills commands.',
    '',
    SKILLS_COMMAND_HELP_TEXT,
  ].join('\n')
}

describe('skills command', () => {
  it('prints skills command help', async () => {
    let result = await captureOutput(() => run(['skills', '--help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, SKILLS_COMMAND_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('prints skills subcommand help', async () => {
    let installHelp = await captureOutput(() => run(['skills', 'install', '--help']))
    let listHelp = await captureOutput(() => run(['skills', 'list', '--help']))

    assert.equal(installHelp.exitCode, 0)
    assert.equal(installHelp.stdout, SKILLS_INSTALL_COMMAND_HELP_TEXT)
    assert.equal(installHelp.stderr, '')
    assert.equal(listHelp.exitCode, 0)
    assert.equal(listHelp.stdout, SKILLS_LIST_COMMAND_HELP_TEXT)
    assert.equal(listHelp.stderr, '')
  })

  it('does not treat help as a skills subcommand', async () => {
    let result = await captureOutput(() => run(['skills', 'help']))

    assert.equal(result.exitCode, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, getUnknownSkillsCommandErrorText('help'))
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
      let fetchMock = createGitHubSkillsFetchMock(remoteSkills)

      let result = await withIsolatedSkillsCache(() =>
        withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        ),
      )

      assert.equal(result.exitCode, 0)
      assert.match(result.stderr, /• Resolve project root\.\.\./)
      assert.match(result.stderr, /✓ Resolve project root/)
      assert.match(result.stderr, /• Fetch Remix skills metadata from GitHub\.\.\./)
      assert.match(result.stderr, /✓ Fetch Remix skills metadata from GitHub/)
      assert.match(result.stderr, /• Read local skills cache\.\.\./)
      assert.match(result.stderr, /✓ Read local skills cache/)
      assert.match(result.stderr, /• Compare local skills\.\.\./)
      assert.match(result.stderr, /✓ Compare local skills/)
      assert.match(result.stderr, /• Download Remix skills archive\.\.\./)
      assert.match(result.stderr, /✓ Download Remix skills archive/)
      assert.match(result.stderr, /• Write updated skills\.\.\./)
      assert.match(result.stderr, /✓ Write updated skills/)
      assert.match(result.stderr, /✓ Write updated skills\n\n$/)
      assert.equal(fetchMock.requests.metadata, 1)
      assert.equal(fetchMock.requests.archive, 1)
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
      let fetchMock = createGitHubSkillsFetchMock(remoteSkills)

      let result = await withIsolatedSkillsCache(() =>
        withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        ),
      )

      assert.equal(result.exitCode, 0)
      assert.equal(fetchMock.requests.metadata, 1)
      assert.equal(fetchMock.requests.archive, 1)
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

  it('rejects remote skill names that resolve outside the skills directory', async () => {
    let remoteSkills = {
      '..': {
        'SKILL.md': '# Escape\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      await writeFiles(path.join(tmpDir, '.agents'), {
        'sentinel.txt': 'keep\n',
      })
      let fetchMock = createGitHubSkillsFetchMock(remoteSkills)

      let result = await withIsolatedSkillsCache(() =>
        withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        ),
      )

      assert.equal(result.exitCode, 1)
      assert.equal(fetchMock.requests.metadata, 1)
      assert.equal(fetchMock.requests.archive, 0)
      assert.match(
        result.stderr,
        /GitHub returned an invalid Remix skill path: skills\/\.\.\/SKILL\.md/,
      )
      assert.equal(
        await fs.readFile(path.join(tmpDir, '.agents', 'sentinel.txt'), 'utf8'),
        'keep\n',
      )
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('rejects remote skill file paths that resolve outside the skill directory', async () => {
    let remoteSkills = {
      'remix-ui': {
        'SKILL.md': '# UI\n',
        '../../escaped.txt': 'owned\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      let fetchMock = createGitHubSkillsFetchMock(remoteSkills)

      let result = await withIsolatedSkillsCache(() =>
        withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        ),
      )

      assert.equal(result.exitCode, 1)
      assert.equal(fetchMock.requests.metadata, 1)
      assert.equal(fetchMock.requests.archive, 0)
      assert.match(
        result.stderr,
        /GitHub returned an invalid Remix skill path: skills\/remix-ui\/\.\.\/\.\.\/escaped\.txt/,
      )
      await assertPathMissing(path.join(tmpDir, '.agents', 'escaped.txt'))
      await assertPathMissing(path.join(tmpDir, 'escaped.txt'))
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('rejects archive skill file paths that resolve outside the skill directory', async () => {
    let remoteSkills = {
      'remix-ui': {
        'SKILL.md': '# UI\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      let fetchMock = createGitHubSkillsFetchMock(remoteSkills, {
        archiveSkills: {
          'remix-ui': {
            '../SKILL.md': '# UI\n',
          },
        },
      })

      let result = await withIsolatedSkillsCache(() =>
        withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        ),
      )

      assert.equal(result.exitCode, 1)
      assert.equal(fetchMock.requests.metadata, 1)
      assert.equal(fetchMock.requests.archive, 1)
      assert.match(
        result.stderr,
        /GitHub returned an invalid Remix skill path: remix-ui\/\.\.\/SKILL\.md/,
      )
      await assertPathMissing(path.join(tmpDir, '.agents', 'skills', 'SKILL.md'))
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
      let fetchMock = createGitHubSkillsFetchMock(remoteSkills)

      let result = await withIsolatedSkillsCache(() =>
        withFetchMock(fetchMock.fetch, () =>
          withCwd(nestedDir, () =>
            captureOutput(() => run(['skills', 'install', '--dir', 'custom/skills'])),
          ),
        ),
      )
      let displayPath = path.relative(nestedDir, path.join(tmpDir, 'custom', 'skills'))

      assert.equal(result.exitCode, 0)
      assert.equal(fetchMock.requests.metadata, 1)
      assert.equal(fetchMock.requests.archive, 1)
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
      let fetchMock = createGitHubSkillsFetchMock(remoteSkills)

      let result = await withIsolatedSkillsCache(() =>
        withFetchMock(fetchMock.fetch, () =>
          withCwd(nestedDir, () => captureOutput(() => run(['skills', 'install']))),
        ),
      )
      let displayPath = path.relative(nestedDir, path.join(demoDir, '.agents', 'skills'))

      assert.equal(result.exitCode, 0)
      assert.equal(fetchMock.requests.metadata, 1)
      assert.equal(fetchMock.requests.archive, 1)
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
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, getMissingOptionValueErrorText(SKILLS_INSTALL_COMMAND_HELP_TEXT))
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
      let fetchMock = createGitHubSkillsFetchMock(remoteSkills)

      let result = await withIsolatedSkillsCache(async () => {
        await withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        )
        fetchMock.requests.archive = 0
        fetchMock.requests.metadata = 0

        return withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        )
      })

      assert.equal(result.exitCode, 0)
      assert.equal(fetchMock.requests.metadata, 1)
      assert.equal(fetchMock.requests.archive, 0)
      assert.match(result.stderr, /• Read local skills cache\.\.\./)
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

  it('uses a deterministic cache file path for each skills directory', () => {
    let firstPath = path.join('/tmp', 'app-one', '.agents', 'skills')
    let secondPath = path.join('/tmp', 'app-two', '.agents', 'skills')

    assert.equal(getSkillsCacheFilePath(firstPath), getSkillsCacheFilePath(firstPath))
    assert.notEqual(getSkillsCacheFilePath(firstPath), getSkillsCacheFilePath(secondPath))
  })

  it('marks manually edited skills as outdated even when the remote metadata is unchanged', async () => {
    let remoteSkills = {
      'remix-ui': {
        'SKILL.md': '# UI\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      let fetchMock = createGitHubSkillsFetchMock(remoteSkills)

      let result = await withIsolatedSkillsCache(async () => {
        await withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        )
        await fs.writeFile(
          path.join(tmpDir, '.agents', 'skills', 'remix-ui', 'SKILL.md'),
          '# Edited UI\n',
        )
        fetchMock.requests.archive = 0
        fetchMock.requests.metadata = 0

        return withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list']))),
        )
      })

      assert.equal(result.exitCode, 0)
      assert.equal(fetchMock.requests.metadata, 1)
      assert.equal(fetchMock.requests.archive, 0)
      assert.match(
        result.stdout,
        new RegExp(
          `Checked Remix skills against ${escapeRegExp(path.join('.agents', 'skills'))}: 1 outdated\\.`,
        ),
      )
      assert.match(result.stdout, /• remix-ui \[outdated\]/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('rebuilds a missing cache manifest on install', async () => {
    let remoteSkills = {
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      let fetchMock = createGitHubSkillsFetchMock(remoteSkills)
      let skillsDir = path.join(tmpDir, '.agents', 'skills')

      let result = await withIsolatedSkillsCache(async () => {
        await withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        )
        let cacheFile = await findWrittenSkillsCacheFile(skillsDir)
        await fs.rm(cacheFile, { force: true })

        fetchMock.requests.archive = 0
        fetchMock.requests.metadata = 0
        let beforeRepair = await withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list']))),
        )
        assert.match(beforeRepair.stdout, /1 outdated\./)

        fetchMock.requests.archive = 0
        fetchMock.requests.metadata = 0
        let installResult = await withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        )
        assert.equal(installResult.exitCode, 0)
        assert.equal(fetchMock.requests.metadata, 1)
        assert.equal(fetchMock.requests.archive, 1)

        fetchMock.requests.archive = 0
        fetchMock.requests.metadata = 0
        let repaired = await withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list']))),
        )
        await assertPathExists(await findWrittenSkillsCacheFile(skillsDir))
        return repaired
      })

      assert.equal(result.exitCode, 0)
      assert.match(result.stdout, /1 installed\./)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('ignores a corrupted cache manifest and rebuilds it on install', async () => {
    let remoteSkills = {
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
      },
    }

    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      let fetchMock = createGitHubSkillsFetchMock(remoteSkills)
      let skillsDir = path.join(tmpDir, '.agents', 'skills')

      let result = await withIsolatedSkillsCache(async () => {
        await withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        )
        let cacheFile = await findWrittenSkillsCacheFile(skillsDir)
        await fs.writeFile(cacheFile, '{not valid json', 'utf8')

        fetchMock.requests.archive = 0
        fetchMock.requests.metadata = 0
        let beforeRepair = await withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list']))),
        )
        assert.match(beforeRepair.stdout, /1 outdated\./)

        fetchMock.requests.archive = 0
        fetchMock.requests.metadata = 0
        return withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        )
      })

      assert.equal(result.exitCode, 0)
      assert.equal(fetchMock.requests.metadata, 1)
      assert.equal(fetchMock.requests.archive, 1)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails when skills list --dir is missing a value', async () => {
    let result = await captureOutput(() => run(['skills', 'list', '--dir']))

    assert.equal(result.exitCode, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, getMissingOptionValueErrorText(SKILLS_LIST_COMMAND_HELP_TEXT))
  })

  it('fails for the removed skills status command', async () => {
    let result = await captureOutput(() => run(['skills', 'status']))

    assert.equal(result.exitCode, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, getUnknownSkillsCommandErrorText('status'))
  })

  it('lists Remix skills from a nested directory with inline status tags', async () => {
    let initialRemoteSkills = {
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
        'templates/route.md': 'Route template\n',
      },
      'remix-ui': {
        'SKILL.md': '# Old UI\n',
      },
    }
    let currentRemoteSkills = {
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
      let nestedDir = path.join(tmpDir, 'app', 'routes')
      await fs.mkdir(nestedDir, { recursive: true })
      let installFetchMock = createGitHubSkillsFetchMock(initialRemoteSkills)
      let listFetchMock = createGitHubSkillsFetchMock(currentRemoteSkills)

      let result = await withIsolatedSkillsCache(async () => {
        await withFetchMock(installFetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        )
        await writeFiles(path.join(tmpDir, '.agents', 'skills'), {
          'custom-helper/SKILL.md': '# Custom helper\n',
        })
        return withFetchMock(listFetchMock.fetch, () =>
          withCwd(nestedDir, () => captureOutput(() => run(['skills', 'list']))),
        )
      })

      assert.equal(result.exitCode, 0)
      assert.match(result.stderr, /• Resolve project root\.\.\./)
      assert.match(result.stderr, /✓ Resolve project root/)
      assert.match(result.stderr, /• Fetch Remix skills metadata from GitHub\.\.\./)
      assert.match(result.stderr, /✓ Fetch Remix skills metadata from GitHub/)
      assert.match(result.stderr, /• Read local skills cache\.\.\./)
      assert.match(result.stderr, /✓ Read local skills cache/)
      assert.match(result.stderr, /• Compare local skills\.\.\./)
      assert.match(result.stderr, /✓ Compare local skills\n\n$/)
      assert.equal(listFetchMock.requests.metadata, 1)
      assert.equal(listFetchMock.requests.archive, 0)
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
    let initialRemoteSkills = {
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
      },
    }
    let currentRemoteSkills = {
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
      let nestedDir = path.join(tmpDir, 'app', 'routes')
      await fs.mkdir(nestedDir, { recursive: true })
      let installFetchMock = createGitHubSkillsFetchMock(initialRemoteSkills)
      let listFetchMock = createGitHubSkillsFetchMock(currentRemoteSkills)

      let result = await withIsolatedSkillsCache(async () => {
        await withFetchMock(installFetchMock.fetch, () =>
          withCwd(nestedDir, () =>
            captureOutput(() => run(['skills', 'install', '--dir', 'custom/skills'])),
          ),
        )
        return withFetchMock(listFetchMock.fetch, () =>
          withCwd(nestedDir, () =>
            captureOutput(() => run(['skills', 'list', '--dir', 'custom/skills'])),
          ),
        )
      })
      let displayPath = path.relative(nestedDir, path.join(tmpDir, 'custom', 'skills'))

      assert.equal(result.exitCode, 0)
      assert.equal(listFetchMock.requests.metadata, 1)
      assert.equal(listFetchMock.requests.archive, 0)
      assert.match(
        result.stdout,
        new RegExp(
          `Checked Remix skills against ${escapeRegExp(displayPath)}: 1 installed, 1 missing\\.`,
        ),
      )
      assert.match(result.stdout, /• remix-project-layout/)
      assert.match(result.stdout, /• remix-auth \[missing\]/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('colors missing and outdated tags in list output when stdout is a tty', async () => {
    let initialRemoteSkills = {
      'remix-ui': {
        'SKILL.md': '# Old UI\n',
      },
    }
    let currentRemoteSkills = {
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
      let installFetchMock = createGitHubSkillsFetchMock(initialRemoteSkills)
      let listFetchMock = createGitHubSkillsFetchMock(currentRemoteSkills)

      let result = await withIsolatedSkillsCache(async () => {
        await withFetchMock(installFetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        )
        return withTtyState({ stdout: true, stderr: true }, () =>
          withFetchMock(listFetchMock.fetch, () =>
            withCwd(tmpDir, () =>
              captureOutput(() => run(['skills', 'list'], { remixVersion: '9.9.9' })),
            ),
          ),
        )
      })

      assert.equal(result.exitCode, 0)
      assert.equal(listFetchMock.requests.metadata, 1)
      assert.equal(listFetchMock.requests.archive, 0)
      assert.match(result.stderr, /v9\.9\.9 - skills list/)
      assert.match(result.stdout, /• remix-auth \u001B\[91m\[missing\]\u001B\[0m/)
      assert.match(result.stdout, /• remix-ui \u001B\[93m\[outdated\]\u001B\[0m/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('prints list output as json', async () => {
    let initialRemoteSkills = {
      'remix-project-layout': {
        'SKILL.md': '# Layout\n',
      },
    }
    let currentRemoteSkills = {
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
      let installFetchMock = createGitHubSkillsFetchMock(initialRemoteSkills)
      let listFetchMock = createGitHubSkillsFetchMock(currentRemoteSkills)
      let realProjectRoot = await fs.realpath(tmpDir)

      let result = await withIsolatedSkillsCache(async () => {
        await withFetchMock(installFetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        )
        return withFetchMock(listFetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list', '--json']))),
        )
      })

      assert.equal(result.exitCode, 0)
      assert.equal(result.stderr, '')
      assert.equal(listFetchMock.requests.metadata, 1)
      assert.equal(listFetchMock.requests.archive, 0)

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
      let fetchMock = createGitHubSkillsFetchMock(remoteSkills)

      let result = await withIsolatedSkillsCache(async () => {
        await withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'install']))),
        )
        fetchMock.requests.archive = 0
        fetchMock.requests.metadata = 0
        return withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list']))),
        )
      })

      assert.equal(result.exitCode, 0)
      assert.equal(fetchMock.requests.metadata, 1)
      assert.equal(fetchMock.requests.archive, 0)
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
      let fetchMock = createGitHubSkillsFetchMock({})
      let result = await withIsolatedSkillsCache(() =>
        withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list']))),
        ),
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
      let fetchMock = createGitHubSkillsFetchMock({}, { treeStatus: 500 })

      let result = await withIsolatedSkillsCache(() =>
        withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list']))),
        ),
      )

      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /Could not fetch Remix skills metadata from GitHub\./)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails when GitHub returns invalid skill data', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))
      let fetchMock = createGitHubSkillsFetchMock({}, { malformedTree: true })

      let result = await withIsolatedSkillsCache(() =>
        withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list']))),
        ),
      )

      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /Received an invalid Remix skills listing from GitHub\./)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('shows a rate-limit-specific GitHub error when the metadata request is rejected', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-'))
    try {
      await fs.mkdir(path.join(tmpDir, '.git'))

      let fetchMock = {
        fetch: (async (input: RequestInfo | URL) => {
          if (toUrlString(input) === REMIX_GITHUB_TREE_URL) {
            return new Response('rate limited', {
              headers: {
                'x-ratelimit-remaining': '0',
                'x-ratelimit-reset': '1711600000',
              },
              status: 403,
              statusText: 'Forbidden',
            })
          }

          return new Response('Not found', { status: 404, statusText: 'Not Found' })
        }) as typeof fetch,
      }

      let result = await withIsolatedSkillsCache(() =>
        withFetchMock(fetchMock.fetch, () =>
          withCwd(tmpDir, () => captureOutput(() => run(['skills', 'list']))),
        ),
      )

      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /GitHub API rate limit exceeded/)
      assert.match(result.stderr, /GITHUB_TOKEN or GH_TOKEN/)
      assert.match(result.stderr, /2024-03-28T04:26:40\.000Z/)
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
  let previousCwd = testCwd
  testCwd = cwd

  try {
    return await callback()
  } finally {
    testCwd = previousCwd
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

async function withIsolatedSkillsCache<T>(callback: () => Promise<T>): Promise<T> {
  let tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-skills-cache-'))
  let originalHome = process.env.HOME
  let originalLocalAppData = process.env.LOCALAPPDATA
  let originalXdgCacheHome = process.env.XDG_CACHE_HOME

  if (process.platform === 'win32') {
    process.env.LOCALAPPDATA = path.join(tempHome, 'AppData', 'Local')
  } else if (process.platform === 'darwin') {
    process.env.HOME = tempHome
  } else {
    process.env.XDG_CACHE_HOME = path.join(tempHome, '.cache')
  }

  try {
    return await callback()
  } finally {
    if (originalHome == null) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }

    if (originalLocalAppData == null) {
      delete process.env.LOCALAPPDATA
    } else {
      process.env.LOCALAPPDATA = originalLocalAppData
    }

    if (originalXdgCacheHome == null) {
      delete process.env.XDG_CACHE_HOME
    } else {
      process.env.XDG_CACHE_HOME = originalXdgCacheHome
    }

    await fs.rm(tempHome, { recursive: true, force: true })
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

async function findWrittenSkillsCacheFile(skillsDir: string): Promise<string> {
  let cacheDir = path.dirname(getSkillsCacheFilePath(skillsDir))
  let entries = (await fs.readdir(cacheDir)).filter((entry) => entry.endsWith('.json'))

  assert.equal(entries.length, 1)
  return path.join(cacheDir, entries[0]!)
}

function createGitHubSkillsFetchMock(
  remoteSkills: Record<string, Record<string, string>>,
  options: {
    archiveSkills?: Record<string, Record<string, string>>
    archiveStatus?: number
    malformedTree?: boolean
    treeStatus?: number
  } = {},
): {
  fetch: typeof fetch
  requests: { archive: number; metadata: number }
} {
  let requests = { archive: 0, metadata: 0 }
  let treeEntries = Object.entries(remoteSkills).flatMap(([skillName, files]) =>
    Object.entries(files).map(([filePath, content]) => ({
      path: `skills/${skillName}/${filePath}`,
      sha: computeGitBlobSha(Buffer.from(content, 'utf8')),
      type: 'blob',
    })),
  )
  let archive = buildTarGzArchive(options.archiveSkills ?? remoteSkills)

  let fetchMock = (async (input: RequestInfo | URL) => {
    let url = toUrlString(input)
    if (url === REMIX_GITHUB_TREE_URL) {
      requests.metadata += 1

      if (options.treeStatus != null) {
        return new Response('boom', { status: options.treeStatus, statusText: 'Server Error' })
      }

      if (options.malformedTree) {
        return jsonResponse({ tree: {} })
      }

      return jsonResponse({ tree: treeEntries, truncated: false })
    }

    if (url === REMIX_GITHUB_ARCHIVE_URL) {
      requests.archive += 1

      if (options.archiveStatus != null) {
        return new Response('boom', { status: options.archiveStatus, statusText: 'Server Error' })
      }

      return new Response(Buffer.from(archive), {
        headers: { 'Content-Type': 'application/gzip' },
        status: 200,
      })
    }

    return new Response('Not found', { status: 404, statusText: 'Not Found' })
  }) as typeof fetch

  return { fetch: fetchMock, requests }
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

function buildTarGzArchive(remoteSkills: Record<string, Record<string, string>>): Uint8Array {
  let chunks: Buffer[] = []

  for (let [skillName, files] of Object.entries(remoteSkills).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    for (let [filePath, content] of Object.entries(files).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      let name = `remix-run-remix-main/skills/${skillName}/${filePath}`
      let body = Buffer.from(content, 'utf8')
      chunks.push(createTarHeader(name, body.length), body, createTarPadding(body.length))
    }
  }

  chunks.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(chunks))
}

function createTarHeader(name: string, size: number): Buffer {
  let header = Buffer.alloc(512)
  writeTarString(header, 0, 100, name)
  writeTarOctal(header, 100, 8, 0o644)
  writeTarOctal(header, 108, 8, 0)
  writeTarOctal(header, 116, 8, 0)
  writeTarOctal(header, 124, 12, size)
  writeTarOctal(header, 136, 12, 0)
  header.fill(0x20, 148, 156)
  header[156] = '0'.charCodeAt(0)
  writeTarString(header, 257, 6, 'ustar')
  writeTarString(header, 263, 2, '00')

  let checksum = header.reduce((sum, byte) => sum + byte, 0)
  let encoded = checksum.toString(8).padStart(6, '0')
  header.write(encoded, 148, 6, 'ascii')
  header[154] = 0
  header[155] = 0x20

  return header
}

function createTarPadding(size: number): Buffer {
  let remainder = size % 512
  return remainder === 0 ? Buffer.alloc(0) : Buffer.alloc(512 - remainder)
}

function writeTarOctal(buffer: Buffer, offset: number, size: number, value: number): void {
  let encoded = value.toString(8).padStart(size - 1, '0')
  buffer.write(encoded.slice(-(size - 1)), offset, size - 1, 'ascii')
  buffer[offset + size - 1] = 0
}

function writeTarString(buffer: Buffer, offset: number, size: number, value: string): void {
  buffer.write(value.slice(0, size), offset, 'utf8')
}

function computeGitBlobSha(bytes: Uint8Array): string {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
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

async function assertPathMissing(filePath: string): Promise<void> {
  await assert.rejects(fs.access(filePath), (error: unknown) => {
    let nodeError = error as NodeJS.ErrnoException
    return nodeError.code === 'ENOENT'
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')
}
