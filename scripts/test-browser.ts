import * as cp from 'node:child_process'

const refs = process.argv.slice(2)
if (refs.length !== 0 && refs.length !== 2) {
  throw new Error('Usage: pnpm test:browser [base-ref head-ref]')
}

const workspaces = ['packages/component', 'packages/ui', 'demos/bookstore']

let selectedWorkspaces = workspaces

if (refs.length === 2) {
  // check-pr.yml runs
  let changedFiles = cp
    .execFileSync(
      'git',
      ['diff', '--name-only', '--no-renames', '-z', `${refs[0]}...${refs[1]}`, '--', '.'],
      { encoding: 'utf8' },
    )
    .split('\0')
    .filter(Boolean)

  selectedWorkspaces = selectedWorkspaces.filter((workspace) =>
    changedFiles.some((file) => file.startsWith(`${workspace}/`)),
  )
}

if (selectedWorkspaces.length === 0) {
  console.log('No browser workspaces selected. Skipping browser tests.')
  process.exit(0)
}

const args = ['--recursive', '--no-sort', '--workspace-concurrency=4', '--stream']
for (let workspace of selectedWorkspaces) {
  args.push('--filter', `./${workspace}`)
}
args.push('run', 'test', '--type', 'browser', '--type', 'e2e')

const result = cp.spawnSync('pnpm', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
