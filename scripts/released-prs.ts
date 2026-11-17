/** Collect PRs between consecutive Remix release tags for the roadmap workflow. */
import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import { parsePrNumber } from './utils/git.ts'

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

if (import.meta.main) {
  let tag = process.env.RELEASE_TAG
  if (!tag) throw new Error('RELEASE_TAG is required.')
  let numbers = [...getReleasedPrNumbers(tag)]
  console.log(`Found ${numbers.length} PRs included in ${tag}.`)
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required.')
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `numbers=${JSON.stringify(numbers)}\n`)
}
