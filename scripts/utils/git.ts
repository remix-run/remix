import * as cp from 'node:child_process'

function execGit(args: string[], cwd?: string): string {
  return cp.execFileSync('git', args, { stdio: 'pipe', encoding: 'utf-8', cwd }).trim()
}

function parseVersionFromPackageJson(content: string): string | null {
  try {
    let parsed = JSON.parse(content) as Record<string, unknown>
    return typeof parsed.version === 'string' ? parsed.version : null
  } catch {
    return null
  }
}

function getPackageVersionAtRef(ref: string, packageJsonPath: string, cwd?: string): string | null {
  try {
    let content = execGit(['show', `${ref}:${packageJsonPath}`], cwd)
    return parseVersionFromPackageJson(content)
  } catch {
    return null
  }
}

/**
 * Finds the commit that introduced a specific version in a package.json file.
 * Returns null when the version can't be found in the available git history.
 */
export function findVersionIntroductionCommit(
  packageJsonPath: string,
  version: string,
  cwd?: string,
): string | null {
  let normalizedPath = packageJsonPath.replaceAll('\\', '/')

  let output: string
  try {
    output = execGit(['log', '--format=%H', '--', normalizedPath], cwd)
  } catch {
    return null
  }

  if (output.length === 0) {
    return null
  }

  let commits = output.split('\n').filter((line) => line.length > 0)

  for (let commit of commits) {
    let commitVersion = getPackageVersionAtRef(commit, normalizedPath, cwd)
    if (commitVersion !== version) {
      continue
    }

    let parentLine = execGit(['rev-list', '--parents', '-n', '1', commit], cwd)
    let [_commit, ...parents] = parentLine.split(' ').filter((line) => line.length > 0)

    if (parents.length === 0) {
      return commit
    }

    let introducedInCommit = false
    for (let parent of parents) {
      let parentVersion = getPackageVersionAtRef(parent, normalizedPath, cwd)
      if (parentVersion !== version) {
        introducedInCommit = true
        break
      }
    }

    if (introducedInCommit) {
      return commit
    }
  }

  return null
}

/**
 * Gets the local commit target for a tag.
 * Returns null when the tag does not exist locally.
 */
export function getLocalTagTarget(tag: string, cwd?: string): string | null {
  try {
    return execGit(['rev-parse', '--verify', `refs/tags/${tag}^{commit}`], cwd)
  } catch {
    return null
  }
}

/**
 * Gets the remote commit target for a tag from origin.
 * Returns null when the tag does not exist remotely.
 */
export function getRemoteTagTarget(tag: string): string | null {
  try {
    let output = execGit([
      'ls-remote',
      '--tags',
      'origin',
      `refs/tags/${tag}`,
      `refs/tags/${tag}^{}`,
    ])
    let lines = output.split('\n').filter((line) => line.length > 0)
    if (lines.length === 0) {
      return null
    }

    let peeledLine = lines.find((line) => line.endsWith(`refs/tags/${tag}^{}`))
    if (peeledLine) {
      return peeledLine.split('\t')[0]
    }

    return lines[0].split('\t')[0]
  } catch {
    return null
  }
}

/**
 * Check if a git tag exists
 */
export function tagExists(tag: string): boolean {
  return getLocalTagTarget(tag) !== null || getRemoteTagTarget(tag) !== null
}
