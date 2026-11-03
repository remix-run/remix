import * as cp from 'node:child_process'
import { getTestShardWorkspaces, isTestShard, selectTestWorkspaces } from './utils/ci-tests.ts'
import { getWorkspaceInfos } from './utils/workspaces.ts'

function main() {
  let [shard, baseRef, headRef] = process.argv.slice(2)
  if (process.argv.length !== 5 || shard == null || !isTestShard(shard) || !baseRef || !headRef) {
    throw new Error('Usage: node scripts/run-ci-tests.ts <shard> <base-ref> <head-ref>')
  }

  let changedFiles = cp
    .execFileSync('git', ['diff', '--name-only', '-z', `${baseRef}...${headRef}`], {
      encoding: 'utf8',
    })
    .split('\0')
    .filter(Boolean)
  let selection = selectTestWorkspaces(changedFiles, getWorkspaceInfos(process.cwd()))

  if (selection.fullRunReasons.length > 0) {
    console.log(`Running all test workspaces because shared files changed:`)
    for (let reason of selection.fullRunReasons) console.log(`- ${reason}`)
  }

  let workspaces = getTestShardWorkspaces(selection.workspaces, shard)
  if (workspaces.length === 0) {
    console.log(`No affected tests for shard "${shard}". Skipping.`)
    return
  }

  console.log(`Running tests for shard "${shard}":`)
  for (let workspace of workspaces) console.log(`- ${workspace.dir} (${workspace.name})`)

  let args = [
    '--recursive',
    '--no-sort',
    '--workspace-concurrency=4',
    '--stream',
    ...workspaces.flatMap((workspace) => ['--filter', `./${workspace.dir}`]),
    'run',
    'test',
  ]
  let result = cp.spawnSync('pnpm', args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

main()
