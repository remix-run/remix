export interface ModuleRecord {
  filePath: string
  hmr: {
    acceptedDeps: string[]
    selfAccepting: boolean
    usesImportMetaHot: boolean
  }
  url: string
}

export interface HotUpdateBoundary {
  acceptedDependencyUrl: string
  invalidatedUrls: Record<string, number>
  updateHandlerUrl: string
}

export interface ModuleStore {
  addDependency(importerUrl: string, dependencyUrl: string): void
  findHotUpdateBoundaries(url: string, timestamp: number): HotUpdateBoundary[] | null
  findHotUpdateBoundariesFromImporters(url: string, timestamp: number): HotUpdateBoundary[] | null
  getModule(url: string): ModuleRecord | undefined
  getModulesForFile(filePath: string): readonly ModuleRecord[]
  getReachableFilePaths(entryUrl: string): ReadonlySet<string>
  reset(): void
  setAcceptedDependencies(url: string, acceptedDependencies: string[]): void
  setModule(module: ModuleRecord): void
}

export function createModuleStore(): ModuleStore {
  let modulesByUrl = new Map<string, ModuleRecord>()
  let modulesByFilePath = new Map<string, Map<string, ModuleRecord>>()
  let dependenciesByImporterUrl = new Map<string, Set<string>>()
  let importersByDependencyUrl = new Map<string, Set<string>>()

  return {
    addDependency(importerUrl, dependencyUrl) {
      addToIndexedSet(dependenciesByImporterUrl, importerUrl, dependencyUrl)
      addToIndexedSet(importersByDependencyUrl, dependencyUrl, importerUrl)
    },

    findHotUpdateBoundaries(url, timestamp) {
      return findPropagation(url, timestamp)
    },

    findHotUpdateBoundariesFromImporters(url, timestamp) {
      return findPropagationFromImporters(url, timestamp, new Set([url]), [url])
    },

    getModule(url) {
      return modulesByUrl.get(url)
    },

    getModulesForFile(filePath) {
      return [...(modulesByFilePath.get(filePath)?.values() ?? [])]
    },

    getReachableFilePaths(entryUrl) {
      let reachableFilePaths = new Set<string>()
      let visitedUrls = new Set<string>()
      visit(entryUrl)
      return reachableFilePaths

      function visit(url: string): void {
        if (visitedUrls.has(url)) return

        let module = modulesByUrl.get(url)
        if (module === undefined) return

        visitedUrls.add(url)
        reachableFilePaths.add(module.filePath)
        for (let dependencyUrl of dependenciesByImporterUrl.get(url) ?? []) {
          visit(dependencyUrl)
        }
      }
    },

    reset() {
      modulesByUrl = new Map()
      modulesByFilePath = new Map()
      dependenciesByImporterUrl = new Map()
      importersByDependencyUrl = new Map()
    },

    setAcceptedDependencies(url, acceptedDependencies) {
      let module = modulesByUrl.get(url)
      if (module !== undefined) {
        module.hmr.acceptedDeps = acceptedDependencies
      }
    },

    setModule(module) {
      let previousModule = modulesByUrl.get(module.url)
      if (previousModule !== undefined) {
        removeModuleFromFileIndex(previousModule)
      }
      removeImporterDependencies(module.url)

      modulesByUrl.set(module.url, module)
      let fileModules = modulesByFilePath.get(module.filePath) ?? new Map()
      fileModules.set(module.url, module)
      modulesByFilePath.set(module.filePath, fileModules)
    },
  }

  function removeModuleFromFileIndex(module: ModuleRecord): void {
    let fileModules = modulesByFilePath.get(module.filePath)
    if (fileModules === undefined) return

    fileModules.delete(module.url)
    if (fileModules.size === 0) {
      modulesByFilePath.delete(module.filePath)
    }
  }

  function removeImporterDependencies(importerUrl: string): void {
    let dependencies = dependenciesByImporterUrl.get(importerUrl)
    if (dependencies === undefined) return

    for (let dependencyUrl of dependencies) {
      removeFromIndexedSet(importersByDependencyUrl, dependencyUrl, importerUrl)
    }
    dependenciesByImporterUrl.delete(importerUrl)
  }

  function findPropagation(
    url: string,
    timestamp: number,
    traversedUrls: ReadonlySet<string> = new Set(),
    invalidatedUrls: string[] = [url],
  ): HotUpdateBoundary[] | null {
    if (traversedUrls.has(url)) return null

    let nextTraversedUrls = new Set(traversedUrls)
    nextTraversedUrls.add(url)

    let module = modulesByUrl.get(url)
    if (module === undefined) return null

    if (module.hmr.selfAccepting) {
      return [createHotUpdateBoundary(url, url, invalidatedUrls, timestamp)]
    }

    return findPropagationFromImporters(url, timestamp, nextTraversedUrls, invalidatedUrls)
  }

  function findPropagationFromImporters(
    url: string,
    timestamp: number,
    traversedUrls: ReadonlySet<string>,
    invalidatedUrls: string[],
  ): HotUpdateBoundary[] | null {
    let importerUrls = importersByDependencyUrl.get(url)
    if (importerUrls === undefined || importerUrls.size === 0) return null

    let importers = [...importerUrls]
      .map((importerUrl) => modulesByUrl.get(importerUrl))
      .filter((importer): importer is ModuleRecord => importer !== undefined)
    if (importers.length === 0) return null

    let boundaries: HotUpdateBoundary[] = []
    for (let importer of importers) {
      if (importer.hmr.acceptedDeps.includes(url)) {
        boundaries.push(createHotUpdateBoundary(url, importer.url, invalidatedUrls, timestamp))
        continue
      }

      let importerUpdates = findPropagation(importer.url, timestamp, traversedUrls, [
        ...invalidatedUrls,
        importer.url,
      ])
      if (importerUpdates === null) return null
      boundaries.push(...importerUpdates)
    }

    return deduplicateHotUpdateBoundaries(boundaries)
  }
}

function createHotUpdateBoundary(
  acceptedDependencyUrl: string,
  updateHandlerUrl: string,
  invalidatedUrls: readonly string[],
  timestamp: number,
): HotUpdateBoundary {
  let invalidationTimestamps: Record<string, number> = {}
  for (let invalidatedUrl of invalidatedUrls) {
    invalidationTimestamps[invalidatedUrl] = timestamp
  }

  return {
    acceptedDependencyUrl,
    invalidatedUrls: invalidationTimestamps,
    updateHandlerUrl,
  }
}

function deduplicateHotUpdateBoundaries(
  boundaries: readonly HotUpdateBoundary[],
): HotUpdateBoundary[] {
  let boundaryByKey = new Map<string, HotUpdateBoundary>()
  let result: HotUpdateBoundary[] = []
  for (let boundary of boundaries) {
    let key = `${boundary.updateHandlerUrl}\0${boundary.acceptedDependencyUrl}`
    let existingBoundary = boundaryByKey.get(key)
    if (existingBoundary !== undefined) {
      Object.assign(existingBoundary.invalidatedUrls, boundary.invalidatedUrls)
      continue
    }
    boundaryByKey.set(key, boundary)
    result.push(boundary)
  }
  return result
}

function addToIndexedSet(map: Map<string, Set<string>>, key: string, value: string): void {
  let values = map.get(key) ?? new Set()
  values.add(value)
  map.set(key, values)
}

function removeFromIndexedSet(map: Map<string, Set<string>>, key: string, value: string): void {
  let values = map.get(key)
  if (values === undefined) return
  values.delete(value)
  if (values.size === 0) {
    map.delete(key)
  }
}
