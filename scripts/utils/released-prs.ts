/** Collect PRs between consecutive Remix release tags. */
import * as cp from 'node:child_process'
import { parsePrNumber } from './git.ts'

export function getReleasedPrNumbers(tag: string, cwd?: string): Set<number> {
  if (!tag.startsWith('remix@')) throw new Error(`Expected a Remix release tag, got ${tag}.`)
  function git(...args: string[]) {
    return cp.execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim()
  }

  let ref = `refs/tags/${tag}`
  let [, parent] = git('rev-list', '--parents', '-n', '1', ref).split(' ')
  let previousTag: string | undefined
  if (parent && git('tag', '--merged', parent, '--list', 'remix@*') !== '') {
    previousTag = git('describe', '--tags', '--abbrev=0', '--match', 'remix@*', parent)
  }
  let range = previousTag ? `refs/tags/${previousTag}..${ref}` : ref
  let subjects = git('log', '--first-parent', '--format=%s', range, '--', 'packages')
  let numbers = new Set<number>()
  for (let subject of subjects.split('\n')) {
    let number = parsePrNumber(subject)
    if (number !== null) numbers.add(number)
  }
  return numbers
}
