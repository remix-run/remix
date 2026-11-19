/** Collect PRs since the previous stable Remix release tag. */
import * as cp from 'node:child_process'
import { parsePrNumber } from './git.ts'

export function getReleasedPrNumbers(tag: string, cwd?: string): Set<number> {
  if (!tag.startsWith('remix@')) throw new Error(`Expected a Remix release tag, got ${tag}.`)
  function git(...args: string[]) {
    return cp.execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim()
  }

  let ref = `refs/tags/${tag}`
  let [, parent] = git('rev-list', '--parents', '-n', '1', ref).split(' ')
  let previousTag = parent
    ? git(
        'describe',
        '--tags',
        '--abbrev=0',
        '--match=remix@*',
        '--exclude=remix@*-*',
        '--always',
        parent,
      )
    : ''
  // Without an earlier stable tag, git describe returns a commit hash.
  let range = previousTag.startsWith('remix@') ? `refs/tags/${previousTag}..${ref}` : ref
  let subjects = git('log', '--first-parent', '--format=%s', range)
  let numbers = new Set<number>()
  for (let subject of subjects.split('\n')) {
    let number = parsePrNumber(subject)
    if (number !== null) numbers.add(number)
  }
  return numbers
}
