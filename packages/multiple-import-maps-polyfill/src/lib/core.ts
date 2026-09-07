import {
  resolveAndComposeImportMap,
  resolveImportMap,
  resolveIfNotPlainOrUrl,
  asURL,
} from './resolve.ts'
import type { ImportMap } from './resolve.ts'
import {
  baseUrl as pageBaseUrl,
  dynamicImport,
  createBlob,
  throwError,
  fromParent,
  hasDocument,
  defaultFetchOpts,
} from './env.ts'
import {
  featureDetectionPromise,
  supportsImportMaps,
  supportsMultipleImportMaps,
} from './features.ts'
import * as lexer from 'es-module-lexer'
import type { ExportSpecifier, ImportSpecifier } from 'es-module-lexer'

// This source is adapted from ES Module Shims 2.8.4.
const bridgeName = `remix.importMapPolyfill.runtime:${import.meta.url}`
const bridgeKey = Symbol.for(bridgeName)
const bridgeExpression = `globalThis[Symbol.for(${JSON.stringify(bridgeName)})]`

type ModuleNamespace = Record<string, unknown>
type Analysis = readonly [
  imports: ReadonlyArray<ImportSpecifier>,
  exports: ReadonlyArray<ExportSpecifier>,
  facade: boolean,
  hasModuleSyntax: boolean,
]
type Seen = Record<string, 0 | 1>

interface ModuleMeta {
  url: string
  resolve(this: ModuleMeta, id: string, parentUrl?: string | URL): string
}

interface Load {
  u: string
  r: string
  f: Promise<Load>
  S: string | undefined
  L: Promise<void> | undefined
  a: Analysis
  d: Dependency[]
  b: string | undefined
  s: string | undefined
  n: boolean
  N: boolean
  m: ModuleMeta | null
}

interface NativeLoad {
  u: string
  b: string
  s?: never
  n?: never
  N?: never
}

interface Dependency {
  l: Load | NativeLoad
  s: boolean
}

interface ResolveResult {
  r: string
  n: boolean
  N: boolean
}

interface SourceResult {
  url: string
  source: string
}

const resolve = (id: string, parentUrl = pageBaseUrl): ResolveResult => {
  let urlResolved = resolveIfNotPlainOrUrl(id, parentUrl) || asURL(id)
  let firstResolved =
    firstImportMap && resolveImportMap(firstImportMap, urlResolved || id, parentUrl)
  let composedResolved =
    composedImportMap === firstImportMap
      ? firstResolved
      : resolveImportMap(composedImportMap, urlResolved || id, parentUrl)
  let resolved = composedResolved || firstResolved || throwUnresolved(id, parentUrl)
  // needsShim, shouldShim per load record to set on parent
  let n = false,
    N = false
  if (!supportsMultipleImportMaps) {
    // bare specifier and not resolved by first import map -> needs shim
    if (!urlResolved && !firstResolved) n = true
    // resolution doesn't match first import map -> should shim
    if (firstResolved && resolved !== firstResolved) N = true
  }
  return { r: resolved, n, N }
}

// import()
export async function importShim(
  id: string,
  opts?: string | ImportCallOptions,
  parentUrl?: string,
): Promise<ModuleNamespace> {
  if (typeof opts === 'string') {
    parentUrl = opts
    opts = undefined
  }
  let sourceType = opts?.with?.type
  await initPromise
  processImportMaps()
  legacyAcceptingImportMaps = false
  return topLevelLoad(id, parentUrl || pageBaseUrl, defaultFetchOpts, undefined, sourceType)
}

export async function preloadShim(
  ids: string | readonly string[],
  parentUrl = pageBaseUrl,
): Promise<void> {
  await initPromise
  processImportMaps()
  await importMapPromise
  await Promise.allSettled(
    (typeof ids === 'string' ? [ids] : ids).map((id) =>
      processPreload(resolve(id, parentUrl).r, defaultFetchOpts),
    ),
  )
}

const throwUnresolved = (id: string, parentUrl: string): never => {
  throw Error(`Unable to resolve specifier '${id}'${fromParent(parentUrl)}`)
}

const metaResolve = function (this: ModuleMeta, id: string, parentUrl: string | URL = this.url) {
  return resolve(id, `${parentUrl}`).r
}

const registry: Record<string, Load> = {}
const nativeModules = new Set<string>()
Reflect.set(globalThis, bridgeKey, Object.freeze({ importShim, registry }))

export const registerNativeModule = (url: string): void => {
  nativeModules.add(url)
}

const loadAll = async (load: Load, seen: Seen): Promise<void> => {
  seen[load.u] = 1
  await load.L
  await Promise.all(
    load.d.map(({ l: dep, s: sourcePhase }) => {
      if (dep.b || seen[dep.u]) return
      if (!('r' in dep)) throw new Error(`Missing native module URL for ${dep.u}`)
      if (sourcePhase) return dep.f
      return loadAll(dep, seen)
    }),
  )
}

let firstImportMap: ImportMap | null = null
// To support polyfilling multiple import maps, we separately track the composed import map from the first import map
let composedImportMap: ImportMap = { imports: {}, scopes: {}, integrity: {} }

const initPromise = Promise.all([lexer.init, featureDetectionPromise]).then(() => {
  if (!hasDocument || !supportsImportMaps)
    throw new TypeError('The multiple import map polyfill requires native import map support.')
  attachMutationObserver()
})

const attachMutationObserver = () => {
  let observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      if (mutation.type !== 'childList') continue
      for (let node of mutation.addedNodes) {
        if (node instanceof HTMLScriptElement && node.type === 'importmap') processImportMap(node)
        else if (node instanceof Element)
          for (let script of node.querySelectorAll<HTMLScriptElement>('script[type=importmap]'))
            processImportMap(script)
      }
    }
  })
  observer.observe(document, { childList: true, subtree: true })
  processImportMaps()
}

let importMapPromise = initPromise
let legacyAcceptingImportMaps = true

async function topLevelLoad(
  url: string,
  parentUrl: string,
  fetchOpts: RequestInit,
  source?: string,
  sourceType?: string,
): Promise<ModuleNamespace> {
  await initPromise
  await importMapPromise
  url = (await resolve(url, parentUrl)).r

  if (sourceType === 'css' || sourceType === 'json') {
    source = `import m from'${url}'with{type:"${sourceType}"};export default m;`
    url += '?entry'
  }

  let load = getOrCreateLoad(url, fetchOpts, undefined, source)
  if (source) load.N = true
  linkLoad(load, fetchOpts)
  let seen: Seen = {}
  await loadAll(load, seen)
  resolveDeps(load, seen)
  let module: ModuleNamespace = await (load.n || load.N
    ? dynamicImport(getBlobUrl(load))
    : import(load.u))
  // if the top-level load is a shell, run its update function
  if (load.s) {
    let update = (await dynamicImport(load.s)).u$_
    if (typeof update !== 'function') throw new Error(`Missing cycle update for ${load.u}`)
    update(module)
  }
  revokeObjectURLs(Object.keys(seen))
  return module
}

const getBlobUrl = (load: Load): string => {
  if (!load.b) throw new Error(`Missing compiled module URL for ${load.u}`)
  return load.b
}

const revokeObjectURLs = (registryKeys: string[]): void => {
  let curIdx = 0
  let handler =
    globalThis.requestIdleCallback ||
    globalThis.requestAnimationFrame ||
    ((fn: () => void) => setTimeout(fn, 0))
  handler(cleanup)
  function cleanup() {
    for (let key of registryKeys.slice(curIdx, (curIdx += 100))) {
      let load = registry[key]
      if (load && load.b && load.b !== load.u) URL.revokeObjectURL(load.b)
    }
    if (curIdx < registryKeys.length) handler(cleanup)
  }
}

const urlJsString = (url: string): string => `'${url.replace(/'/g, "\\'")}'`

let resolvedSource = ''
let lastIndex = 0
const pushStringTo = (load: Load, originalIndex: number, dynamicImportEndStack: number[]) => {
  let source = getLoadSource(load)
  while (dynamicImportEndStack[dynamicImportEndStack.length - 1] < originalIndex) {
    let dynamicImportEnd = dynamicImportEndStack.pop()
    if (dynamicImportEnd === undefined) break
    resolvedSource += `${source.slice(lastIndex, dynamicImportEnd)}, ${urlJsString(load.r)}`
    lastIndex = dynamicImportEnd
  }
  resolvedSource += source.slice(lastIndex, originalIndex)
  lastIndex = originalIndex
}

const pushSourceURL = (
  load: Load,
  commentPrefix: string,
  commentStart: number,
  dynamicImportEndStack: number[],
) => {
  let source = getLoadSource(load)
  let urlStart = commentStart + commentPrefix.length
  let commentEnd = source.indexOf('\n', urlStart)
  let urlEnd = commentEnd !== -1 ? commentEnd : source.length
  let sourceUrl = source.slice(urlStart, urlEnd)
  try {
    sourceUrl = new URL(sourceUrl, load.r).href
  } catch (e) {}
  pushStringTo(load, urlStart, dynamicImportEndStack)
  resolvedSource += sourceUrl
  lastIndex = urlEnd
}

const getLoadSource = (load: Load): string => {
  if (load.S === undefined) throw new Error(`Missing module source for ${load.u}`)
  return load.S
}

const resolveDeps = (load: Load, seen: Seen): void => {
  if (load.b || !seen[load.u]) return
  seen[load.u] = 0

  for (let { l: dep, s: sourcePhase } of load.d) {
    if (!sourcePhase && !dep.b) {
      if (!('r' in dep)) throw new Error(`Missing native module URL for ${dep.u}`)
      resolveDeps(dep, seen)
    }
  }

  if (!load.n) load.n = load.d.some((dep) => dep.l.n)
  if (!load.N) load.N = load.d.some((dep) => dep.l.N)

  // use native loader whenever possible (n = needs shim) via executable subgraph passthrough
  // so long as the module doesn't use dynamic import or unsupported URL mappings (N = should shim)
  if (!load.n && !load.N) {
    load.b = load.u
    load.S = undefined
    return
  }

  let [imports, exports] = load.a

  // "execution"
  let source = getLoadSource(load),
    depIndex = 0,
    dynamicImportEndStack: number[] = []

  // once all deps have loaded we can inline the dependency resolution blobs
  // and define this blob
  resolvedSource = ''
  lastIndex = 0

  for (let {
    s: start,
    e: end,
    ss: statementStart,
    se: statementEnd,
    d: dynamicImportIndex,
    t,
    a,
  } of imports) {
    if (t === 4) {
      let { l: depLoad } = load.d[depIndex++]
      pushStringTo(load, start - 1, dynamicImportEndStack)
      resolvedSource += `/*${source.slice(start - 1, end + 1)}*/'${depLoad.b}'`
      lastIndex = end + 1
    } else if (t === 5 || t === 6) {
      throw new TypeError('Dynamic source imports and import defer are not supported.')
    }
    // dependency source replacements
    else if (dynamicImportIndex === -1) {
      let keepAssertion = a > 0
      let { l: depLoad } = load.d[depIndex++],
        blobUrl = depLoad.b,
        cycleShell = !blobUrl
      if (cycleShell) {
        if (!('r' in depLoad)) throw new Error(`Missing native module URL for ${depLoad.u}`)
        // circular shell creation
        if (!(blobUrl = depLoad.s)) {
          blobUrl = depLoad.s = createBlob(
            `export function u$_(m){${depLoad.a[1]
              .map(({ s, e }, i) => {
                let depSource = getLoadSource(depLoad)
                let q = depSource[s] === '"' || depSource[s] === "'"
                return `e$_${i}=m${q ? `[` : '.'}${depSource.slice(s, e)}${q ? `]` : ''}`
              })
              .join(',')}}${
              depLoad.a[1].length ? `let ${depLoad.a[1].map((_, i) => `e$_${i}`).join(',')};` : ''
            }export {${depLoad.a[1]
              .map(({ s, e }, i) => `e$_${i} as ${getLoadSource(depLoad).slice(s, e)}`)
              .join(',')}}\n//# sourceURL=${depLoad.r}?cycle`,
          )
        }
      }

      pushStringTo(load, start - 1, dynamicImportEndStack)
      resolvedSource += `/*${source.slice(start - 1, end + 1)}*/'${blobUrl}'`

      // circular shell execution
      if (!cycleShell && depLoad.s) {
        resolvedSource += `;import*as m$_${depIndex} from'${depLoad.b}';import{u$_ as u$_${depIndex}}from'${depLoad.s}';u$_${depIndex}(m$_${depIndex})`
        depLoad.s = undefined
      }
      lastIndex = keepAssertion ? end + 1 : statementEnd
    }
    // import.meta
    else if (dynamicImportIndex === -2) {
      load.m = { url: load.r, resolve: metaResolve }
      pushStringTo(load, start, dynamicImportEndStack)
      resolvedSource += `${bridgeExpression}.registry[${urlJsString(load.u)}].m`
      lastIndex = statementEnd
    }
    // dynamic import
    else {
      pushStringTo(load, statementStart, dynamicImportEndStack)
      resolvedSource += `${bridgeExpression}.importShim(`
      dynamicImportEndStack.push(statementEnd - 1)
      lastIndex = start
    }
  }

  // support progressive cycle binding updates (try statement avoids tdz errors)
  if (load.s && (imports.length === 0 || imports[imports.length - 1].d === -1))
    resolvedSource += `\n;import{u$_}from'${load.s}';try{u$_({${exports
      .filter((e) => e.ln)
      .map(({ s, e, ln }) => `${source.slice(s, e)}:${ln}`)
      .join(',')}})}catch(_){};\n`

  let sourceURLCommentStart = source.lastIndexOf(sourceURLCommentPrefix)
  let sourceMapURLCommentStart = source.lastIndexOf(sourceMapURLCommentPrefix)

  // ignore sourceMap comments before already spliced code
  if (sourceURLCommentStart < lastIndex) sourceURLCommentStart = -1
  if (sourceMapURLCommentStart < lastIndex) sourceMapURLCommentStart = -1

  // sourceURL first / only
  if (
    sourceURLCommentStart !== -1 &&
    (sourceMapURLCommentStart === -1 || sourceMapURLCommentStart > sourceURLCommentStart)
  ) {
    pushSourceURL(load, sourceURLCommentPrefix, sourceURLCommentStart, dynamicImportEndStack)
  }
  // sourceMappingURL
  if (sourceMapURLCommentStart !== -1) {
    pushSourceURL(load, sourceMapURLCommentPrefix, sourceMapURLCommentStart, dynamicImportEndStack)
    // sourceURL last
    if (sourceURLCommentStart !== -1 && sourceURLCommentStart > sourceMapURLCommentStart)
      pushSourceURL(load, sourceURLCommentPrefix, sourceURLCommentStart, dynamicImportEndStack)
  }

  pushStringTo(load, source.length, dynamicImportEndStack)

  if (sourceURLCommentStart === -1) resolvedSource += sourceURLCommentPrefix + load.r

  load.b = createBlob(resolvedSource)
  load.S = undefined
  resolvedSource = ''
}

const sourceURLCommentPrefix = '\n//# sourceURL='
const sourceMapURLCommentPrefix = '\n//# sourceMappingURL='

// restrict in-flight fetches to a pool of 100
const p: Array<() => void> = []
let c = 0
const pushFetchPool = (): Promise<void> | undefined => {
  if (++c > 100) return new Promise((resolve) => p.push(resolve))
}
const popFetchPool = () => {
  c--
  let next = p.shift()
  if (next) next()
}

const doFetch = async (url: string, fetchOpts: RequestInit, parent?: string): Promise<Response> => {
  let res,
    poolQueue = pushFetchPool()
  if (poolQueue) await poolQueue
  try {
    res = await fetch(url, fetchOpts)
  } catch (e) {
    let error = e instanceof Error ? e : new Error(String(e))
    error.message =
      `Unable to fetch ${url}${fromParent(parent)} - see network log for details.\n` + error.message
    throw error
  } finally {
    popFetchPool()
  }

  if (!res.ok) {
    throw Object.assign(
      new TypeError(`${res.status} ${res.statusText} ${res.url}${fromParent(parent)}`),
      { response: res },
    )
  }
  return res
}

async function defaultSourceHook(
  url: string,
  fetchOpts: RequestInit,
  parent?: string,
): Promise<SourceResult> {
  let res = await doFetch(url, fetchOpts, parent),
    contentType = res.headers.get('Content-Type') || ''
  if (!/^(?:text|application)\/(?:x-)?(?:java|type)script(?:;|$)/i.test(contentType)) {
    throw Error(
      `Unsupported Content-Type "${contentType}" loading ${url}${fromParent(parent)}. Only JavaScript modules are supported and must be served with a valid MIME type like application/javascript.`,
    )
  }
  return { url: res.url, source: await res.text() }
}

const fetchModule = async (
  reqUrl: string,
  fetchOpts: RequestInit,
  parent?: string,
): Promise<SourceResult> => {
  let mapIntegrity = composedImportMap.integrity[reqUrl]
  fetchOpts =
    mapIntegrity && !fetchOpts.integrity ? { ...fetchOpts, integrity: mapIntegrity } : fetchOpts
  let { url = reqUrl, source } = await defaultSourceHook(reqUrl, fetchOpts, parent)
  return { url, source }
}

const getOrCreateLoad = (
  url: string,
  fetchOpts: RequestInit,
  parent?: string,
  source?: string,
): Load => {
  let load = registry[url]
  if (load) return load
  registry[url] = load = {
    // url
    u: url,
    // response url
    r: url,
    // fetchPromise
    f: Promise.resolve().then(() => load),
    // source
    S: source,
    // linkPromise
    L: undefined,
    // analysis
    a: [[], [], false, false],
    // deps
    d: [],
    // blobUrl
    b: undefined,
    // shellUrl
    s: undefined,
    // needsShim: does it fail execution in the current native loader?
    n: false,
    // shouldShim: does it need to be loaded by the polyfill loader?
    N: false,
    // meta
    m: null,
  }
  load.f = (async () => {
    if (load.S === undefined) {
      // preload fetch options override fetch options (race)
      ;({ url: load.r, source: load.S } = await (fetchCache[url] ||
        fetchModule(url, fetchOpts, parent)))
    }
    try {
      load.a = lexer.parse(getLoadSource(load), load.u)
    } catch (e) {
      throwError(e)
      load.a = [[], [], false, false]
    }
    return load
  })()
  return load
}

const linkLoad = (load: Load, fetchOpts: RequestInit): void => {
  if (load.L) return
  load.L = load.f.then(() => {
    let dependencies = load.a[0].map(({ n, d, t, a, se }): Dependency | undefined => {
      let phaseImport = t >= 4
      let sourcePhase = phaseImport && t < 6
      if (phaseImport && t !== 4)
        throw new TypeError('Dynamic source imports and import defer are not supported.')
      // Unlike ESMS's automatic polyfill mode, this explicit loader must retain control of nested
      // dynamic imports even when the currently linked graph can otherwise pass through natively.
      if (d >= 0) {
        load.N = true
        return
      }
      if (d !== -1 || !n) return
      let resolved = resolve(n, load.r || load.u)
      if (resolved.n) load.n = true
      if (resolved.N) load.N = true
      let source = sourcePhase ? '' : undefined
      if (a > 0) {
        let assertion = getLoadSource(load).slice(a, se - 1)
        if (assertion.includes('json') || assertion.includes('css')) source = ''
      }
      // The ESM wrapper lazily imports this core. Loading the wrapper through the core would
      // recurse and create a second copy of modules that import the wrapper.
      if (nativeModules.has(resolved.r)) return { l: { u: resolved.r, b: resolved.r }, s: false }
      let childFetchOpts = fetchOpts.integrity ? { ...fetchOpts, integrity: undefined } : fetchOpts
      let child = {
        l: getOrCreateLoad(resolved.r, childFetchOpts, load.r, source),
        s: sourcePhase,
      }
      if (source === '') child.l.b = child.l.u
      if (!child.s) linkLoad(child.l, childFetchOpts)
      return child
    })
    load.d = dependencies.filter((dependency): dependency is Dependency => dependency !== undefined)
  })
}

const processedImportMaps = new WeakSet<HTMLScriptElement>()

const processImportMaps = () => {
  for (let script of document.querySelectorAll<HTMLScriptElement>('script[type=importmap]'))
    processImportMap(script)
}

const processImportMap = (script: HTMLScriptElement): void => {
  if (processedImportMaps.has(script)) return
  processedImportMaps.add(script)
  // External import maps are not supported natively and remain outside this polyfill's scope.
  if (script.src) return
  importMapPromise = importMapPromise
    .then(() => {
      composedImportMap = resolveAndComposeImportMap(
        JSON.parse(script.innerHTML),
        script.baseURI,
        composedImportMap,
      )
    })
    .catch((e) => {
      if (e instanceof SyntaxError)
        e = new Error(`Unable to parse import map ${e.message} in: ${script.innerHTML}`)
      throwError(e)
    })
  if (!firstImportMap && legacyAcceptingImportMaps)
    importMapPromise.then(() => (firstImportMap = composedImportMap))
  legacyAcceptingImportMaps = false
}

const fetchCache: Record<string, Promise<SourceResult> | undefined> = {}
const processPreload = (url: string, fetchOpts: RequestInit): Promise<SourceResult> =>
  initPromise.then(() => {
    if (fetchCache[url]) return fetchCache[url]
    return (fetchCache[url] = fetchModule(url, fetchOpts))
  })
