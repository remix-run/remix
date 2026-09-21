import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isMap, isSeq, parseDocument } from 'yaml'

const workflow = parseDocument(
  readFileSync(new URL('../.github/workflows/generate-remix.yaml', import.meta.url), 'utf8'),
)
const job = workflow.getIn(['jobs', 'generate-remix'])
assert.ok(isMap(job))
const steps = job.get('steps')
assert.ok(isSeq(steps))
const workflowSteps = steps.items.filter(isMap)

function getStep(name: string) {
  let step = workflowSteps.find((step) => step.get('name') === name)
  assert.ok(step, `Missing workflow step: ${name}`)
  return step
}

function getScript(name: string) {
  let script = getStep(name).get('run')
  assert.ok(typeof script === 'string')
  return script
}

function withRepository(run: (directory: string, git: (...args: string[]) => string) => void) {
  let directory = mkdtempSync(join(tmpdir(), 'remix-workflow-'))
  let env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: join(directory, 'global-config'),
    GIT_CONFIG_NOSYSTEM: '1',
  }
  function git(...args: string[]) {
    return execFileSync('git', args, {
      cwd: directory,
      env,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim()
  }

  try {
    git('init', '--initial-branch=generated-updates')
    git('config', 'user.name', 'Test Bot')
    git('config', 'user.email', 'test@example.com')
    git('commit', '--allow-empty', '-m', 'initial')
    run(directory, git)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

describe('generate-remix workflow', () => {
  it('checks out both event branches without persisting credentials or using the PAT', () => {
    let checkouts = workflowSteps.filter((step) => step.get('uses') === 'actions/checkout@v6')
    assert.equal(checkouts.length, 2)
    for (let checkout of checkouts) {
      assert.equal(checkout.getIn(['with', 'persist-credentials']), false)
      assert.equal(checkout.getIn(['with', 'token']), undefined)
    }
  })

  it('finishes installation, generation, and committing before introducing the PAT', () => {
    let commit = getStep('Commit changes')
    let push = getStep('Push changes')
    let pushIndex = workflowSteps.indexOf(push)
    assert.ok(workflowSteps.indexOf(commit) < pushIndex)
    assert.ok(getScript('Commit changes').includes('pnpm install --no-frozen-lockfile'))
    assert.ok(getScript('Commit changes').includes('git commit'))
    assert.ok(!String(workflow.get('env')).includes('GH_REMIX_PAT'))
    assert.ok(!String(job.get('env')).includes('GH_REMIX_PAT'))
    for (let step of workflowSteps.slice(0, pushIndex)) {
      assert.ok(!step.toString().includes('GH_REMIX_PAT'))
    }
    assert.equal(push.getIn(['env', 'GH_TOKEN']), '${{ secrets.GH_REMIX_PAT }}')
    assert.equal(push.get('if'), "steps.commit.outputs.new_sha != ''")
    assert.equal(
      getStep('Comment on PR').get('if'),
      "github.event_name == 'pull_request' && steps.commit.outputs.new_sha != ''",
    )
    assert.deepEqual(
      workflowSteps.slice(pushIndex + 1).map((step) => step.get('name')),
      ['Comment on PR'],
    )
  })

  it('skips the push when generation leaves the working tree unchanged', () => {
    withRepository((directory) => {
      let output = join(directory, 'output')
      let result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', getScript('Commit changes')], {
        cwd: directory,
        env: { ...process.env, GITHUB_OUTPUT: output },
        encoding: 'utf8',
      })
      assert.equal(result.status, 0, result.stderr)
      assert.ok(result.stdout.includes('no updates'))
      assert.ok(!existsSync(output))
    })
  })

  it('pushes the generated commit to the tracked branch without persisting authentication', () => {
    withRepository((directory, git) => {
      let remote = join(directory, 'remote.git')
      git('init', '--bare', remote)
      git('remote', 'add', 'origin', remote)
      git('push', '--set-upstream', 'origin', 'generated-updates')
      git('commit', '--allow-empty', '-m', 'generated update')
      let config = readFileSync(join(directory, '.git/config'), 'utf8')
      // A pre-push hook must not run after the write credential is introduced.
      git('config', 'core.hooksPath', '.git/hooks')
      writeFileSync(join(directory, '.git/hooks/pre-push'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })

      let result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', getScript('Push changes')], {
        cwd: directory,
        env: {
          ...process.env,
          GH_TOKEN: 'workflow-test-token',
          GITHUB_REPOSITORY: 'remix-run/remix',
        },
        encoding: 'utf8',
      })
      assert.equal(result.status, 0, result.stderr)
      assert.equal(
        git('--git-dir', remote, 'rev-parse', 'generated-updates'),
        git('rev-parse', 'HEAD'),
      )
      git('config', '--unset', 'core.hooksPath')
      assert.equal(readFileSync(join(directory, '.git/config'), 'utf8'), config)
      assert.ok(result.stdout.includes('pushed updates'))
    })
  })

  it('fails without reporting a successful update when the push fails', () => {
    withRepository((directory) => {
      let config = readFileSync(join(directory, '.git/config'), 'utf8')
      let result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', getScript('Push changes')], {
        cwd: directory,
        env: {
          ...process.env,
          GH_TOKEN: 'workflow-test-token',
          GITHUB_REPOSITORY: 'remix-run/remix',
        },
        encoding: 'utf8',
      })
      assert.notEqual(result.status, 0)
      assert.ok(!result.stdout.includes('pushed updates'))
      assert.equal(readFileSync(join(directory, '.git/config'), 'utf8'), config)
    })
  })
})
