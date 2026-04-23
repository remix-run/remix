import { createFileMatcher } from './file-matcher.ts'

type AccessPolicy = {
  isAllowed(filePath: string): boolean
}

export function createAccessPolicy(options: {
  allow: readonly string[]
  deny?: readonly string[]
  rootDir: string
}): AccessPolicy {
  let allowMatchers = options.allow.map((pattern) => createFileMatcher(pattern, options.rootDir))
  let denyMatchers = (options.deny ?? []).map((pattern) =>
    createFileMatcher(pattern, options.rootDir),
  )

  return {
    isAllowed(filePath) {
      if (!allowMatchers.some((matcher) => matcher(filePath))) return false
      if (denyMatchers.length > 0 && denyMatchers.some((matcher) => matcher(filePath))) return false
      return true
    },
  }
}
