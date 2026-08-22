import {
  getRoutePatternCaptures,
  RoutePattern,
  type RoutePatternCapture,
} from '@remix-run/route-pattern'
import { createHref } from '@remix-run/route-pattern/href'
import { createMatcher, type Matcher } from '@remix-run/route-pattern/match'

import {
  getRelativeFilePath,
  isAbsoluteFilePath,
  normalizeFilePath,
  normalizePathname,
  resolveFilePath,
} from './paths.ts'

interface AssetRouteDefinition {
  urlPattern: string
  filePattern: string
}

interface RouteConfig {
  fileMap: Readonly<Record<string, string>>
  rootDir: string
}

interface CompiledRoute {
  fileMapScope: FileMapScope | null
  rootDir: string
  urlPattern: RoutePattern
  urlMatcher: Matcher
  filePattern: RoutePattern
  fileMatcher: Matcher
}

interface FileMapScope {
  wildcardName: string
}

export interface DirectoryRouteMapping {
  fileDirectory: string
  urlDirectory: string
}

export interface CompiledRoutes {
  getDirectoryRouteMapping(filePath: string): DirectoryRouteMapping | null
  resolveUrlPathname(pathname: string): string | null
  toUrlPathname(filePath: string): string | null
}

function normalizeFilePattern(pattern: string): string {
  if (isAbsoluteFilePath(pattern)) {
    throw new Error(
      `File route patterns must be relative to the asset server root.\nPattern: ${pattern}`,
    )
  }

  return normalizePathname(pattern)
}

export function compileRoutes(
  basePath: string,
  routeConfigs: readonly RouteConfig[],
): CompiledRoutes {
  if (routeConfigs.every((routeConfig) => Object.keys(routeConfig.fileMap).length === 0)) {
    throw new Error('createAssetServer() requires at least one configured fileMap entry.')
  }

  let compiledRoutes = routeConfigs.flatMap((routeConfig) =>
    Object.entries(routeConfig.fileMap).map(([urlPattern, filePattern]) =>
      compileRoute(
        {
          filePattern,
          urlPattern,
        },
        {
          basePath,
          rootDir: routeConfig.rootDir,
        },
      ),
    ),
  )

  function resolveUrlPathname(pathname: string): string | null {
    let normalizedPathname = normalizePathname(pathname)

    for (let route of compiledRoutes) {
      let match = route.urlMatcher.match(`http://remix.run${normalizedPathname}`)
      if (!match) continue
      let relativeFilePath = decodeURIComponent(
        createHref(route.filePattern, match.params),
      ).replace(/^\/+/, '')
      return resolveFilePath(route.rootDir, relativeFilePath)
    }

    return null
  }

  function toUrlPathname(filePath: string): string | null {
    let normalizedFilePath = normalizeFilePath(filePath)

    for (let route of compiledRoutes) {
      let relativeFilePath = getRelativeFilePath(route.rootDir, normalizedFilePath)
      let match = route.fileMatcher.match(`http://remix.run/${relativeFilePath}`)
      if (!match) continue
      let urlPathname = normalizePathname(createHref(route.urlPattern, match.params))
      return urlPathname
    }

    return null
  }

  return {
    getDirectoryRouteMapping(filePath) {
      let normalizedFilePath = normalizeFilePath(filePath)

      for (let routeIndex = 0; routeIndex < compiledRoutes.length; routeIndex++) {
        let route = compiledRoutes[routeIndex]
        let relativeFilePath = getRelativeFilePath(route.rootDir, normalizedFilePath)
        let match = route.fileMatcher.match(`http://remix.run/${relativeFilePath}`)
        if (!match) continue
        if (!route.fileMapScope) return null

        let urlPathname = normalizePathname(createHref(route.urlPattern, match.params))
        let scopeParams = { ...match.params, [route.fileMapScope.wildcardName]: '' }
        let urlDirectory = ensureTrailingSlash(createHref(route.urlPattern, scopeParams))
        let relativeFileDirectory = decodeURIComponent(
          createHref(route.filePattern, scopeParams),
        ).replace(/^\/+/, '')
        let fileDirectory = resolveFilePath(route.rootDir, relativeFileDirectory)

        let importerUrlDirectory = getUrlDirectory(urlPathname)
        let narrowedUrlDirectory = urlDirectory
        let hasRouteBarrier = false
        for (let otherIndex = 0; otherIndex < compiledRoutes.length; otherIndex++) {
          if (otherIndex === routeIndex) continue
          let otherRoute = compiledRoutes[otherIndex]
          if (otherRoute.fileMapScope) continue
          if (!routeCanMatchWithinDirectory(otherRoute, urlDirectory)) continue
          if (routeCanMatchWithinDirectory(otherRoute, importerUrlDirectory)) return null
          narrowedUrlDirectory = getChildUrlDirectory(urlDirectory, importerUrlDirectory)
          hasRouteBarrier = true
        }

        if (hasRouteBarrier) {
          let relativeDirectory = narrowedUrlDirectory
            .slice(urlDirectory.length)
            .replace(/\/+$/, '')
          return {
            fileDirectory: ensureTrailingSlash(resolveFilePath(fileDirectory, relativeDirectory)),
            urlDirectory: narrowedUrlDirectory,
          }
        }

        return {
          fileDirectory: ensureTrailingSlash(fileDirectory),
          urlDirectory,
        }
      }

      return null
    },
    resolveUrlPathname,
    toUrlPathname,
  }
}

function compileRoute(
  route: AssetRouteDefinition,
  options: {
    basePath: string
    rootDir: string
  },
): CompiledRoute {
  let basePath = normalizePathname(options.basePath).replace(/\/+$/, '') || '/'
  let relativeUrlPattern = normalizePathname(route.urlPattern)
  let urlPatternSource = normalizePathname(
    `${basePath.replace(/\/+$/, '')}/${relativeUrlPattern.replace(/^\/+/, '')}`,
  )
  let filePatternSource = normalizeFilePattern(route.filePattern)

  let urlPattern = RoutePattern.parse(urlPatternSource)
  let filePattern = RoutePattern.parse(filePatternSource)

  validateNoUnnamedWildcards(urlPattern, 'URL')
  validateNoUnnamedWildcards(filePattern, 'File')
  validateRoutePatterns(urlPattern, filePattern)

  return {
    fileMapScope: getFileMapScope(urlPattern, filePattern),
    rootDir: normalizeFilePath(options.rootDir).replace(/\/+$/, ''),
    urlPattern,
    urlMatcher: createMatcher(urlPattern),
    filePattern,
    fileMatcher: createMatcher(stripDotSegments(filePatternSource)),
  }
}

function getFileMapScope(urlPattern: RoutePattern, filePattern: RoutePattern): FileMapScope | null {
  let urlCaptures = getPathnameCaptures(urlPattern)
  let fileCaptures = getPathnameCaptures(filePattern)
  let finalCapture = urlCaptures[urlCaptures.length - 1]
  if (!finalCapture || finalCapture.type !== '*' || finalCapture.optional) return null

  let wildcardSuffix = `*${finalCapture.name}`
  let urlPathname = urlPattern.toJSON().pathname
  let filePathname = filePattern.toJSON().pathname
  if (!urlPathname.endsWith(wildcardSuffix) || !filePathname.endsWith(wildcardSuffix)) return null

  let urlPrefix = urlPathname.slice(0, -wildcardSuffix.length)
  let filePrefix = filePathname.slice(0, -wildcardSuffix.length)
  if (!isSegmentBoundary(urlPrefix) || !isSegmentBoundary(filePrefix)) return null

  return { wildcardName: finalCapture.name }
}

function isSegmentBoundary(prefix: string): boolean {
  return prefix === '' || prefix.endsWith('/')
}

function routeCanMatchWithinDirectory(route: CompiledRoute, directory: string): boolean {
  let pathname = route.urlPattern.toJSON().pathname
  let dynamicIndex = pathname.search(/[:*(]/)
  let staticPrefix = normalizePathname(
    dynamicIndex === -1 ? pathname : pathname.slice(0, dynamicIndex),
  )
  return (
    ensureTrailingSlash(staticPrefix).startsWith(directory) ||
    directory.startsWith(ensureTrailingSlash(staticPrefix))
  )
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`
}

function getUrlDirectory(pathname: string): string {
  return ensureTrailingSlash(pathname.slice(0, pathname.lastIndexOf('/') + 1))
}

function getChildUrlDirectory(parentDirectory: string, descendantDirectory: string): string {
  let relativePathname = descendantDirectory.slice(parentDirectory.length)
  let firstSlashIndex = relativePathname.indexOf('/')
  let firstSegment =
    firstSlashIndex === -1 ? relativePathname : relativePathname.slice(0, firstSlashIndex)
  return `${parentDirectory}${firstSegment}/`
}

function stripDotSegments(pattern: string): string {
  let segments: string[] = []

  for (let segment of pattern.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }

  return segments.join('/')
}

function validateRoutePatterns(urlPattern: RoutePattern, filePattern: RoutePattern): void {
  let urlCaptures = getPathnameCaptures(urlPattern)
  let fileCaptures = getPathnameCaptures(filePattern)
  if (urlCaptures.length !== fileCaptures.length) {
    throw new Error(
      `Route patterns must have matching capture structure.\nURL: ${urlPattern}\nFile: ${filePattern}`,
    )
  }

  for (let i = 0; i < urlCaptures.length; i++) {
    let urlCapture = urlCaptures[i]
    let fileCapture = fileCaptures[i]
    if (urlCapture.type !== fileCapture.type || urlCapture.name !== fileCapture.name) {
      throw new Error(
        `Route patterns must have matching capture structure.\nURL: ${urlPattern}\nFile: ${filePattern}`,
      )
    }
  }
}

function validateNoUnnamedWildcards(pattern: RoutePattern, label: string): void {
  if (
    getRoutePatternCaptures(pattern).some(
      (capture) => capture.part === 'pathname' && capture.type === '*' && capture.name === '*',
    )
  ) {
    throw new Error(
      `${label} route patterns must use named wildcards for reversible mapping.\nPattern: ${pattern}`,
    )
  }
}

type PathnameCapture = RoutePatternCapture & { readonly part: 'pathname' }

function getPathnameCaptures(pattern: RoutePattern): Array<PathnameCapture> {
  return getRoutePatternCaptures(pattern).filter(
    (capture): capture is PathnameCapture => capture.part === 'pathname',
  )
}
