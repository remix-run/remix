import { createFileMatcher } from './file-matcher.ts'
import { isInjectedPackageFilePath } from './injected-packages.ts'

type AccessPolicy = {
  isDenied(filePath: string): boolean
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

  function isDenied(filePath: string): boolean {
    if (isInjectedPackageFilePath(filePath)) return false
    return denyMatchers.length > 0 && denyMatchers.some((matcher) => matcher(filePath))
  }

  return {
    isDenied,
    isAllowed(filePath) {
      if (isInjectedPackageFilePath(filePath)) return true
      if (!allowMatchers.some((matcher) => matcher(filePath))) return false
      if (isDenied(filePath)) return false
      return true
    },
  }
}
