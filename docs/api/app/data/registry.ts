import type { DemoDocFile } from './demos.tsx'
import type { ApiDocFile, ApiTypeKind, PackageDocFile } from './markdown.ts'
import { routes, withVersion } from '../routes.ts'

export type DocFile = ApiDocFile | PackageDocFile | DemoDocFile

const TYPE_EYEBROW: Record<ApiTypeKind, string> = {
  type: 'Type',
  interface: 'Interface',
  class: 'Class',
  function: 'Function',
  mixin: 'Mixin',
  variable: 'Variable',
}

export const HOME_PAGE_ID = '__home__'
export const NOT_FOUND_PAGE_ID = '__not-found__'

export type NavItemKind = ApiTypeKind | 'demo'

export type PageDefinition = {
  id: string
  description: string
  eyebrow: string
  navLabel: string
  path: string
  title: string
  docFile?: DocFile
  kind?: NavItemKind
  // The top-level package whose menu the sidebar shows for this page.
  packageId?: string
}

// One import path, like `remix/data-table/mysql`, and its pages.
export type NavSubpackage = {
  id: string
  label: string
  overviewPageId?: string
  pageIds: string[]
}

// One top-level package, like `data-table`, and its import paths.
export type NavPackage = {
  id: string
  label: string
  homePageId: string
  subpackages: NavSubpackage[]
}

export type DocsRegistry = {
  pages: Record<string, PageDefinition>
  packages: NavPackage[]
}

export function buildRegistry(docFiles: DocFile[], version?: string): DocsRegistry {
  let pages: Record<string, PageDefinition> = {}
  let packages = new Map<string, NavPackage>()

  pages[HOME_PAGE_ID] = {
    id: HOME_PAGE_ID,
    description: '',
    eyebrow: '',
    navLabel: 'Getting Started',
    path: withVersion(routes.home.href(), version),
    title: 'Getting Started',
  }

  let filesByPackage = new Map<string, DocFile[]>()
  for (let file of docFiles) {
    getOrSet(filesByPackage, file.package, () => []).push(file)
  }

  let sortedPackages = [...filesByPackage.keys()].sort((a, b) => a.localeCompare(b))

  for (let pkg of sortedPackages) {
    let packageId = getNavPackageId(pkg)
    let files = filesByPackage.get(pkg)!
    let subpackage: NavSubpackage = { id: pkg, label: getImportLabel(pkg), pageIds: [] }

    let addPage = (file: DocFile, page: Omit<PageDefinition, 'id' | 'path' | 'packageId'>) => {
      pages[file.urlPath] = {
        ...page,
        id: file.urlPath,
        path: getDocPath(file.urlPath, version),
        packageId,
      }
    }

    let overview = files.find((file) => file.kind === 'package')
    if (overview) {
      addPage(overview, {
        description: '',
        eyebrow: 'Package',
        navLabel: getImportLabel(pkg),
        title: pkg,
        docFile: overview,
      })
      subpackage.overviewPageId = overview.urlPath
    }

    let demos = files
      .filter((file) => file.kind === 'demo')
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    for (let file of demos) {
      addPage(file, {
        description: '',
        eyebrow: `${pkg} · Demo`,
        navLabel: file.name,
        title: file.name,
        docFile: file,
        kind: 'demo',
      })
      subpackage.pageIds.push(file.urlPath)
    }

    let apis = files
      .filter((file) => file.kind === 'api')
      .sort((a, b) => a.name.localeCompare(b.name))
    for (let file of apis) {
      addPage(file, {
        description: '',
        eyebrow: `${pkg} · ${TYPE_EYEBROW[file.type]}`,
        navLabel: file.name,
        title: file.name,
        docFile: file,
        kind: file.type,
      })
      subpackage.pageIds.push(file.urlPath)
    }

    if (packageId === undefined) continue

    let navPackage = getOrSet(packages, packageId, () => ({
      id: packageId,
      label: packageId,
      homePageId: '',
      subpackages: [],
    }))
    navPackage.subpackages.push(subpackage)
  }

  for (let navPackage of packages.values()) {
    let root = navPackage.subpackages.find((subpackage) => subpackage.label === navPackage.id)
    if (root?.overviewPageId) {
      navPackage.homePageId = root.overviewPageId
      continue
    }

    // Groups like `remix/middleware` have no exports of their own, so they get an index page
    // that links to each import path.
    let scope = navPackage.subpackages[0].id.split('/')[0]
    let id = `${scope.replace(/^@/, '')}/${navPackage.id}`
    pages[id] = {
      id,
      description: '',
      eyebrow: 'Package',
      navLabel: navPackage.id,
      path: getDocPath(id, version),
      title: `${scope}/${navPackage.id}`,
      packageId: navPackage.id,
    }
    navPackage.homePageId = id
  }

  return { pages, packages: [...packages.values()].sort((a, b) => a.id.localeCompare(b.id)) }
}

export function getHomePage(registry: DocsRegistry): PageDefinition {
  return registry.pages[HOME_PAGE_ID]
}

export function getDocPage(registry: DocsRegistry, slug: string): PageDefinition | undefined {
  return registry.pages[slug]
}

export function getNavPackage(
  registry: DocsRegistry,
  packageId: string | undefined,
): NavPackage | undefined {
  return registry.packages.find((navPackage) => navPackage.id === packageId)
}

export function buildNotFoundPage(slug: string, version?: string): PageDefinition {
  return {
    id: NOT_FOUND_PAGE_ID,
    description: `The requested document was not found: ${slug}`,
    eyebrow: 'Not Found',
    navLabel: 'Not Found',
    path: getDocPath(slug, version),
    title: 'Page not found',
  }
}

export function isPageActive(page: PageDefinition, currentPath: string) {
  return currentPath === page.path
}

// `remix/data-table/mysql` -> `data-table`, `@remix-run/ui/tabs` -> `ui`. The bare `remix`
// package isn't in the sidebar; Getting Started covers it.
function getNavPackageId(pkg: string): string | undefined {
  let label = getImportLabel(pkg)
  return label === pkg ? undefined : label.split('/')[0]
}

// The sidebar drops the scope prefix to keep labels short: `remix/assert` -> `assert`,
// `@remix-run/ui/tabs` -> `ui/tabs`. Pages still show the full import path.
function getImportLabel(pkg: string): string {
  return pkg.replace(/^(?:remix|@remix-run)\//, '')
}

function getDocPath(slug: string, version: string | undefined): string {
  return withVersion(routes.api.document.href({ slug }), version)
}

function getOrSet<key, value>(map: Map<key, value>, key: key, init: () => value): value {
  let value = map.get(key)
  if (value === undefined) {
    value = init()
    map.set(key, value)
  }
  return value
}
