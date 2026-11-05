import * as cp from 'node:child_process'

const refs = process.argv.slice(2)
if (refs.length !== 0 && refs.length !== 2) {
  throw new Error('Usage: pnpm test:browser [base-ref head-ref]')
}

const workspaces = ['packages/component', 'packages/ui', 'demos/bookstore']

if (refs.length === 2) {
  let [baseRef, headRef] = refs
  let changedFiles = cp
    .execFileSync(
      'git',
      ['diff', '--name-only', '--no-renames', '-z', `${baseRef}...${headRef}`, '--', '.'],
      {
        encoding: 'utf8',
      },
    )
    .split('\0')
    .filter(Boolean)
  let browserWorkspaceChanged = changedFiles.some((file) =>
    workspaces.some((workspace) => file.startsWith(`${workspace}/`)),
  )
  if (!browserWorkspaceChanged) {
    console.log('No browser workspace changes. Skipping browser tests.')
    process.exit(0)
  }
}

const args = ['--recursive', '--no-sort', '--workspace-concurrency=4', '--stream']
for (let workspace of workspaces) {
  args.push('--filter', `./${workspace}`)
}
args.push('run', 'test', '--type', 'browser', '--type', 'e2e')

const result = cp.spawnSync('pnpm', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
