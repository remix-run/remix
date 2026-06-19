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
  rootDir: string
  urlPattern: RoutePattern
  urlMatcher: Matcher
  filePattern: RoutePattern
  fileMatcher: Matcher
}

export interface CompiledRoutes {
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

  return {
    resolveUrlPathname(pathname) {
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
    },
    toUrlPathname(filePath) {
      let normalizedFilePath = normalizeFilePath(filePath)

      for (let route of compiledRoutes) {
        let relativeFilePath = getRelativeFilePath(route.rootDir, normalizedFilePath)
        let match = route.fileMatcher.match(`http://remix.run/${relativeFilePath}`)
        if (!match) continue
        return normalizePathname(createHref(route.urlPattern, match.params))
      }

      return null
    },
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
    rootDir: normalizeFilePath(options.rootDir).replace(/\/+$/, ''),
    urlPattern,
    urlMatcher: createMatcher(urlPattern),
    filePattern,
    fileMatcher: createMatcher(stripDotSegments(filePatternSource)),
  }
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
