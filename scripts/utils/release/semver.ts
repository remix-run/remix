export type ReleaseType = 'major' | 'minor' | 'patch' | 'prerelease'

type ParsedVersion = {
  major: number
  minor: number
  patch: number
  prerelease: Array<string | number>
}

const semverPattern =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

function parse(version: string): ParsedVersion | null {
  let match = semverPattern.exec(version)
  if (match == null) {
    return null
  }

  let prerelease = match[4]
    ? match[4]
        .split('.')
        .filter(Boolean)
        .map((part) => (/^\d+$/.test(part) ? Number(part) : part))
    : []

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  }
}

function format(version: ParsedVersion): string {
  let base = `${version.major}.${version.minor}.${version.patch}`

  if (version.prerelease.length === 0) {
    return base
  }

  return `${base}-${version.prerelease.join('.')}`
}

export function major(version: string): number {
  let parsed = parse(version)
  if (parsed == null) {
    throw new Error(`Invalid semver version: ${version}`)
  }

  return parsed.major
}

export function prerelease(version: string): Array<string | number> | null {
  let parsed = parse(version)
  if (parsed == null) {
    throw new Error(`Invalid semver version: ${version}`)
  }

  return parsed.prerelease.length > 0 ? parsed.prerelease : null
}

export function inc(version: string, releaseType: ReleaseType, identifier?: string): string | null {
  let parsed = parse(version)
  if (parsed == null) {
    return null
  }

  if (releaseType === 'major') {
    return format({
      major: parsed.major + 1,
      minor: 0,
      patch: 0,
      prerelease: [],
    })
  }

  if (releaseType === 'minor') {
    return format({
      major: parsed.major,
      minor: parsed.minor + 1,
      patch: 0,
      prerelease: [],
    })
  }

  if (releaseType === 'patch') {
    return format({
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch + 1,
      prerelease: [],
    })
  }

  if (identifier == null || identifier.trim() === '') {
    return null
  }

  let nextPrerelease = [...parsed.prerelease]

  if (nextPrerelease.length === 0 || nextPrerelease[0] !== identifier) {
    nextPrerelease = [identifier, 0]
  } else {
    let lastIndex = nextPrerelease.length - 1
    let lastPart = nextPrerelease[lastIndex]

    if (typeof lastPart === 'number') {
      nextPrerelease[lastIndex] = lastPart + 1
    } else {
      nextPrerelease.push(0)
    }
  }

  return format({
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch,
    prerelease: nextPrerelease,
  })
}
