const backslashRegEx = /\\/g

export interface ImportMap {
  imports: Record<string, string | null>
  scopes: Record<string, Record<string, string | null>>
  integrity: Record<string, string>
}

export interface ImportMapJson {
  imports?: Record<string, unknown>
  scopes?: Record<string, Record<string, unknown>>
  integrity?: Record<string, string>
}

export const asURL = (url: string): string | undefined => {
  try {
    if (url.indexOf(':') !== -1) return new URL(url).href
  } catch (_) {}
}

export const resolveUrl = (relUrl: string, parentUrl: string): string => {
  let resolved =
    resolveIfNotPlainOrUrl(relUrl, parentUrl) ||
    asURL(relUrl) ||
    resolveIfNotPlainOrUrl('./' + relUrl, parentUrl)
  if (!resolved) throw new TypeError(`Unable to resolve "${relUrl}" from ${parentUrl}`)
  return resolved
}

export const resolveIfNotPlainOrUrl = (relUrl: string, parentUrl: string): string | undefined => {
  let hIdx = parentUrl.indexOf('#'),
    qIdx = parentUrl.indexOf('?')
  if (hIdx + qIdx > -2)
    parentUrl = parentUrl.slice(0, hIdx === -1 ? qIdx : qIdx === -1 || qIdx > hIdx ? hIdx : qIdx)
  if (relUrl.indexOf('\\') !== -1) relUrl = relUrl.replace(backslashRegEx, '/')
  // protocol-relative
  if (relUrl[0] === '/' && relUrl[1] === '/') {
    return parentUrl.slice(0, parentUrl.indexOf(':') + 1) + relUrl
  }
  // relative-url
  else if (
    (relUrl[0] === '.' &&
      (relUrl[1] === '/' ||
        (relUrl[1] === '.' && (relUrl[2] === '/' || (relUrl.length === 2 && (relUrl += '/')))) ||
        (relUrl.length === 1 && (relUrl += '/')))) ||
    relUrl[0] === '/'
  ) {
    let parentProtocol = parentUrl.slice(0, parentUrl.indexOf(':') + 1)
    if (parentProtocol === 'blob:') {
      throw new TypeError(
        `Failed to resolve module specifier "${relUrl}". Invalid relative url or base scheme isn't hierarchical.`,
      )
    }
    // read pathname from parent URL
    // pathname taken to be part after leading "/"
    let pathname
    if (parentUrl[parentProtocol.length + 1] === '/') {
      // resolving to a :// so we need to read out the auth and host
      if (parentProtocol !== 'file:') {
        pathname = parentUrl.slice(parentProtocol.length + 2)
        pathname = pathname.slice(pathname.indexOf('/') + 1)
      } else {
        pathname = parentUrl.slice(8)
      }
    } else {
      // resolving to :/ so pathname is the /... part
      pathname = parentUrl.slice(
        parentProtocol.length + Number(parentUrl[parentProtocol.length] === '/'),
      )
    }

    if (relUrl[0] === '/')
      return parentUrl.slice(0, parentUrl.length - pathname.length - 1) + relUrl

    // join together and split for removal of .. and . segments
    // looping the string instead of anything fancy for perf reasons
    // '../../../../../z' resolved to 'x/y' is just 'z'
    let segmented = pathname.slice(0, pathname.lastIndexOf('/') + 1) + relUrl

    let output = []
    let segmentIndex = -1
    for (let i = 0; i < segmented.length; i++) {
      // busy reading a segment - only terminate on '/'
      if (segmentIndex !== -1) {
        if (segmented[i] === '/') {
          output.push(segmented.slice(segmentIndex, i + 1))
          segmentIndex = -1
        }
        continue
      }
      // new segment - check if it is relative
      else if (segmented[i] === '.') {
        // ../ segment
        if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i + 2 === segmented.length)) {
          output.pop()
          i += 2
          continue
        }
        // ./ segment
        else if (segmented[i + 1] === '/' || i + 1 === segmented.length) {
          i += 1
          continue
        }
      }
      // it is the start of a new segment
      while (segmented[i] === '/') i++
      segmentIndex = i
    }
    // finish reading out the last segment
    if (segmentIndex !== -1) output.push(segmented.slice(segmentIndex))
    return parentUrl.slice(0, parentUrl.length - pathname.length) + output.join('')
  }
}

export const resolveAndComposeImportMap = (
  json: ImportMapJson,
  baseUrl: string,
  parentMap: ImportMap,
): ImportMap => {
  let outMap = {
    imports: { ...parentMap.imports },
    scopes: Object.fromEntries(
      Object.entries(parentMap.scopes).map(([scope, imports]) => [scope, { ...imports }]),
    ),
    integrity: { ...parentMap.integrity },
  }

  if (json.imports) resolveAndComposePackages(json.imports, outMap.imports, baseUrl, parentMap)

  if (json.scopes)
    for (let s in json.scopes) {
      let resolvedScope = resolveUrl(s, baseUrl)
      resolveAndComposePackages(
        json.scopes[s],
        outMap.scopes[resolvedScope] || (outMap.scopes[resolvedScope] = {}),
        baseUrl,
        parentMap,
      )
    }

  if (json.integrity) resolveAndComposeIntegrity(json.integrity, outMap.integrity, baseUrl)

  return outMap
}

const getMatch = <value>(path: string, matchObj: Record<string, value>): string | undefined => {
  if (matchObj[path]) return path
  let sepIndex = path.length
  do {
    let segment = path.slice(0, sepIndex + 1)
    if (segment in matchObj) return segment
  } while ((sepIndex = path.lastIndexOf('/', sepIndex - 1)) !== -1)
}

const applyPackages = (id: string, packages: Record<string, string | null>): string | undefined => {
  let pkgName = getMatch(id, packages)
  if (pkgName) {
    let pkg = packages[pkgName]
    if (pkg === null) return
    return pkg + id.slice(pkgName.length)
  }
}

export const resolveImportMap = (
  importMap: ImportMap,
  resolvedOrPlain: string,
  parentUrl: string,
): string | undefined => {
  let scopeUrl = parentUrl && getMatch(parentUrl, importMap.scopes)
  while (scopeUrl) {
    let packageResolution = applyPackages(resolvedOrPlain, importMap.scopes[scopeUrl])
    if (packageResolution) return packageResolution
    scopeUrl = getMatch(scopeUrl.slice(0, scopeUrl.lastIndexOf('/')), importMap.scopes)
  }
  let packageResolution = applyPackages(resolvedOrPlain, importMap.imports)
  return packageResolution || (resolvedOrPlain.indexOf(':') !== -1 ? resolvedOrPlain : undefined)
}

const resolveAndComposePackages = (
  packages: Record<string, unknown>,
  outPackages: Record<string, string | null>,
  baseUrl: string,
  parentMap: ImportMap,
): void => {
  for (let p in packages) {
    let resolvedLhs = resolveIfNotPlainOrUrl(p, baseUrl) || p
    if (outPackages[resolvedLhs] && outPackages[resolvedLhs] !== packages[resolvedLhs]) {
      console.warn(
        `remix/multiple-import-maps-polyfill: Rejected map override "${resolvedLhs}" from ${outPackages[resolvedLhs]} to ${packages[resolvedLhs]}.`,
      )
      continue
    }
    let target = packages[p]
    if (typeof target !== 'string') continue
    let mapped = resolveImportMap(
      parentMap,
      resolveIfNotPlainOrUrl(target, baseUrl) || target,
      baseUrl,
    )
    if (mapped) {
      outPackages[resolvedLhs] = mapped
      continue
    }
    console.warn(
      `remix/multiple-import-maps-polyfill: Mapping "${p}" -> "${packages[p]}" does not resolve`,
    )
  }
}

const resolveAndComposeIntegrity = (
  integrity: Record<string, string>,
  outIntegrity: Record<string, string>,
  baseUrl: string,
): void => {
  for (let p in integrity) {
    let resolvedLhs = resolveIfNotPlainOrUrl(p, baseUrl) || p
    if (outIntegrity[resolvedLhs] && outIntegrity[resolvedLhs] !== integrity[resolvedLhs]) {
      console.warn(
        `remix/multiple-import-maps-polyfill: Rejected map integrity override "${resolvedLhs}" from ${outIntegrity[resolvedLhs]} to ${integrity[resolvedLhs]}.`,
      )
    }
    outIntegrity[resolvedLhs] = integrity[p]
  }
}
