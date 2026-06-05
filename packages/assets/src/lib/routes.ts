import { RoutePattern } from '@remix-run/route-pattern'
import { createHref } from '@remix-run/route-pattern/href'
import { createMatcher, type Matcher } from '@remix-run/route-pattern/match'
import type { MatchParams } from '@remix-run/route-pattern/match'

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
  basePathPattern: RoutePattern
  rootDir: string
  urlPattern: RoutePattern
  urlMatcher: Matcher
  relativeUrlPattern: RoutePattern
  filePattern: RoutePattern
  fileMatcher: Matcher
}

export interface CompiledRoutes {
  basePathname: string
  resolveUrlPathname(pathname: string): ResolvedUrlPathname | null
  toBasePathname(params?: BasePathParams): string
  toUrlPathname(filePath: string, options?: ToUrlPathnameOptions): string | null
}

export interface ResolvedUrlPathname {
  basePathname: string
  filePath: string
}

export type BasePathParams<basePath extends string = string> = string extends basePath
  ? Record<string, string | number | null | undefined>
  : Partial<MatchParams<basePath>>

export interface ToUrlPathnameOptions<basePath extends string = string> {
  basePathname?: string
  params?: BasePathParams<basePath>
}

function normalizeFilePattern(pattern: string): string {
  if (isAbsoluteFilePath(pattern)) {
    throw new Error(
      `File route patterns must be relative to the asset server root.\nPattern: ${pattern}`,
    )
  }

  return normalizePathname(pattern)
}

export function compileRoutes<const basePath extends string>(
  basePath: basePath,
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
  let basePathname = normalizePathname(createHref(compiledRoutes[0].basePathPattern, {}))

  return {
    basePathname,
    resolveUrlPathname(pathname) {
      let normalizedPathname = normalizePathname(pathname)

      for (let route of compiledRoutes) {
        let match = route.urlMatcher.match(`http://remix.run${normalizedPathname}`)
        if (!match) continue
        let relativeFilePath = createHref(route.filePattern, match.params).replace(/^\/+/, '')
        return {
          basePathname: normalizePathname(createHref(route.basePathPattern, match.params)),
          filePath: resolveFilePath(route.rootDir, relativeFilePath),
        }
      }

      return null
    },
    toBasePathname(params) {
      return normalizePathname(createHref(compiledRoutes[0].basePathPattern, params))
    },
    toUrlPathname(filePath, options) {
      let normalizedFilePath = normalizeFilePath(filePath)

      for (let route of compiledRoutes) {
        let relativeFilePath = getRelativeFilePath(route.rootDir, normalizedFilePath)
        let match = route.fileMatcher.match(`http://remix.run/${relativeFilePath}`)
        if (!match) continue
        let relativeUrlPathname = createHref(route.relativeUrlPattern, match.params)
        let basePathname =
          options?.basePathname ??
          normalizePathname(createHref(route.basePathPattern, options?.params))
        return normalizePathname(`${basePathname}/${relativeUrlPathname}`)
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

  let basePathPattern = RoutePattern.parse(basePath)
  let relativeUrlPatternParsed = RoutePattern.parse(relativeUrlPattern)
  let urlPattern = RoutePattern.parse(urlPatternSource)
  let filePattern = RoutePattern.parse(filePatternSource)

  validateNoUnnamedWildcards(basePathPattern, 'Base path')
  validateNoUnnamedWildcards(relativeUrlPatternParsed, 'URL')
  validateNoUnnamedWildcards(urlPattern, 'URL')
  validateNoUnnamedWildcards(filePattern, 'File')
  validateRoutePatterns(relativeUrlPatternParsed, filePattern)
  validateBasePathPattern(basePathPattern)

  return {
    basePathPattern,
    rootDir: normalizeFilePath(options.rootDir).replace(/\/+$/, ''),
    urlPattern,
    urlMatcher: createMatcher(urlPattern),
    relativeUrlPattern: relativeUrlPatternParsed,
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

function validateBasePathPattern(basePathPattern: RoutePattern): void {
  for (let basePathParam of getPathnameParams(basePathPattern)) {
    if (basePathParam.optional) continue

    throw new Error(`Base path params must be optional.\nBase path: ${basePathPattern}`)
  }
}

function validateRoutePatterns(urlPattern: RoutePattern, filePattern: RoutePattern): void {
  let urlParams = getPathnameParams(urlPattern)
  let fileParams = getPathnameParams(filePattern)

  let fileParamIndex = 0
  for (let urlParam of urlParams) {
    let fileParam = fileParams[fileParamIndex]
    if (fileParam && urlParam.type === fileParam.type && urlParam.name === fileParam.name) {
      fileParamIndex += 1
      continue
    }

    if (!urlParam.optional) {
      throw new Error(
        `Route patterns must have matching capture structure.\nURL: ${urlPattern}\nFile: ${filePattern}`,
      )
    }
  }

  if (fileParamIndex !== fileParams.length) {
    throw new Error(
      `Route patterns must have matching capture structure.\nURL: ${urlPattern}\nFile: ${filePattern}`,
    )
  }
}

function validateNoUnnamedWildcards(pattern: RoutePattern, label: string): void {
  if (pattern.pathname.tokens.some((token) => token.type === '*' && token.name === '*')) {
    throw new Error(
      `${label} route patterns must use named wildcards for reversible mapping.\nPattern: ${pattern}`,
    )
  }
}

type PathnameToken = RoutePattern['pathname']['tokens'][number]
type PathnameParamToken = Extract<PathnameToken, { type: ':' | '*' }>
type PathnameParam = PathnameParamToken & {
  optional: boolean
}

function getPathnameParams(pattern: RoutePattern): Array<PathnameParam> {
  let optionalRanges = Array.from(pattern.pathname.optionals)
  let params: PathnameParam[] = []

  pattern.pathname.tokens.forEach((token, index) => {
    if (token.type !== ':' && token.type !== '*') return

    params.push({
      ...token,
      optional: optionalRanges.some(([start, end]) => index > start && index < end),
    })
  })

  return params
}
