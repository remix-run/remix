import type { DemoDocFile } from './demos.tsx'
import type { ApiDocFile, ApiTypeKind, PackageDocFile } from './markdown.ts'
import { getDocsUrlPath, routes } from '../routes.ts'

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

export type PageDefinition = {
  id: string
  description: string
  eyebrow: string
  navLabel: string
  path: string
  title: string
  docFile?: DocFile
  // The sidebar section this page is listed under in its menu.
  navSection?: NavSection
  // The import path whose sidebar menu this page belongs to.
  navId?: string
}

export type NavSection = 'Examples' | 'API' | 'Types'

// One sidebar menu: an import path like `remix/data-table/mysql` (or a group like
// `remix/middleware` with no exports of its own), its pages and the import paths nested under it.
export type NavNode = {
  id: string
  label: string
  homePageId: string
  pageIds: string[]
  children: NavNode[]
}

export type DocsRegistry = {
  pages: Record<string, PageDefinition>
  guides: GuideNavigationItem[]
  packages: NavNode[]
}

export type GuideNavigationItem = {
  order: number
  slug: string
  href: string
  title: string
  disabled: boolean
}

export function buildRegistry(
  docFiles: DocFile[],
  guides: GuideNavigationItem[] = [],
): DocsRegistry {
  let pages: Record<string, PageDefinition> = {}
  // Import path menus, grouped by top-level package (`data-table`, `middleware`, …).
  let nodesByPackage = new Map<string, NavNode[]>()
  let nodesById = new Map<string, NavNode>()
  let demos: DemoDocFile[] = []

  pages[HOME_PAGE_ID] = {
    id: HOME_PAGE_ID,
    description: '',
    eyebrow: '',
    navLabel: 'Overview',
    path: routes.home.href(),
    title: 'Overview',
  }

  let filesByPackage = new Map<string, DocFile[]>()
  for (let file of docFiles) {
    getOrSet(filesByPackage, file.package, () => []).push(file)
  }

  let sortedPackages = [...filesByPackage.keys()].sort((a, b) => a.localeCompare(b))

  for (let pkg of sortedPackages) {
    let packageId = getNavPackageId(pkg)
    let files = filesByPackage.get(pkg)!
    let node: NavNode = {
      id: pkg,
      label: getImportLabel(pkg),
      homePageId: '',
      pageIds: [],
      children: [],
    }

    let addPage = (file: DocFile, page: Omit<PageDefinition, 'id' | 'path' | 'navId'>) => {
      pages[file.urlPath] = {
        ...page,
        id: file.urlPath,
        path: getDocPath(file.urlPath),
        navId: packageId === undefined ? undefined : pkg,
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
      node.homePageId = overview.urlPath
    }

    for (let file of files) {
      if (file.kind !== 'demo') continue
      addPage(file, {
        description: '',
        eyebrow: `${pkg} · Demo`,
        navSection: 'Examples',
        navLabel: file.name,
        title: file.name,
        docFile: file,
      })
      demos.push(file)
    }

    // Runtime exports first, then type-only exports, each A–Z.
    let apis = files
      .filter((file) => file.kind === 'api')
      .sort((a, b) => Number(isTypeOnly(a)) - Number(isTypeOnly(b)) || a.name.localeCompare(b.name))
    for (let file of apis) {
      addPage(file, {
        description: '',
        eyebrow: `${pkg} · ${TYPE_EYEBROW[file.type]}`,
        navSection: isTypeOnly(file) ? 'Types' : 'API',
        navLabel: getApiNavLabel(file),
        title: file.name,
        docFile: file,
      })
      node.pageIds.push(file.urlPath)
    }

    if (packageId !== undefined) {
      getOrSet(nodesByPackage, packageId, () => []).push(node)
      nodesById.set(pkg, node)
    }
  }

  // A demo is listed in the menu of the module it shows (`ui/demos/tabs` under `ui/tabs`), or else
  // in its package's menu.
  demos.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  for (let file of demos) {
    let node = nodesById.get(`${file.package}/${file.slug}`) ?? nodesById.get(file.package)
    if (!node) continue
    pages[file.urlPath].navId = node.id
    pages[file.urlPath].eyebrow = `${node.id} · Demo`
    node.pageIds.push(file.urlPath)
  }

  let packages: NavNode[] = []
  for (let [packageId, nodes] of nodesByPackage) {
    let top = nodes.find((node) => node.label === packageId) ?? {
      id: `${nodes[0].id.split('/')[0]}/${packageId}`,
      label: packageId,
      homePageId: '',
      pageIds: [],
      children: [],
    }

    // Nest each import path under the closest one it extends: `data-table/migrations/node` goes
    // under `data-table/migrations`, and `component/dev/refresh` under `component`.
    for (let node of nodes) {
      if (node === top) continue
      let parent = nodes.reduce(
        (closest, other) =>
          node.id.startsWith(`${other.id}/`) && other.id.length > closest.id.length
            ? other
            : closest,
        top,
      )
      parent.children.push(node)
    }

    // Menus need a page to open. Groups like `remix/middleware` and the few import paths without
    // a README get an index page listing their exports and nested import paths.
    for (let node of [top, ...nodes]) {
      if (node.homePageId) continue
      let slug = getDocsUrlPath(node.id)
      pages[slug] = {
        id: slug,
        description: '',
        eyebrow: 'Package',
        navLabel: node.label,
        path: getDocPath(slug),
        title: node.id,
        navId: node.id,
      }
      node.homePageId = slug
    }

    packages.push(top)
  }

  return { guides, pages, packages: packages.sort((a, b) => a.label.localeCompare(b.label)) }
}

export function getHomePage(registry: DocsRegistry): PageDefinition {
  return registry.pages[HOME_PAGE_ID]
}

export function getDocPage(registry: DocsRegistry, slug: string): PageDefinition | undefined {
  return registry.pages[slug]
}

// The menus from the top-level package down to the one for `navId`.
export function getNavChain(registry: DocsRegistry, navId: string | undefined): NavNode[] {
  if (navId === undefined) return []
  for (let node of registry.packages) {
    let chain = findNavChain(node, navId)
    if (chain) return chain
  }
  return []
}

function findNavChain(node: NavNode, navId: string): NavNode[] | undefined {
  if (node.id === navId) return [node]
  for (let child of node.children) {
    let chain = findNavChain(child, navId)
    if (chain) return [node, ...chain]
  }
}

export function buildNotFoundPage(slug: string): PageDefinition {
  return {
    id: NOT_FOUND_PAGE_ID,
    description: `The requested document was not found: ${slug}`,
    eyebrow: 'Not Found',
    navLabel: 'Not Found',
    path: getDocPath(slug),
    title: 'Page not found',
  }
}

export function isPageActive(page: PageDefinition, currentPath: string) {
  return currentPath === page.path
}

// `remix/data-table/mysql` -> `data-table`, `@remix-run/ui/tabs` -> `ui`. The bare `remix`
// package isn't in the sidebar; Overview covers it.
function getNavPackageId(pkg: string): string | undefined {
  let label = getImportLabel(pkg)
  return label === pkg ? undefined : label.split('/')[0]
}

// The sidebar drops the scope prefix to keep labels short: `remix/assert` -> `assert`,
// `@remix-run/ui/tabs` -> `ui/tabs`. Pages still show the full import path.
function getImportLabel(pkg: string): string {
  return pkg.replace(/^(?:remix|@remix-run)\//, '')
}

function getDocPath(slug: string): string {
  return routes.reference.document.href({ slug })
}

// Functions read as calls (`createRoot()`) and components as elements (`<Frame>`).
function getApiNavLabel(file: ApiDocFile): string {
  if (file.type !== 'function') return file.name
  return /^[A-Z]/.test(file.name) ? `<${file.name}>` : `${file.name}()`
}

function isTypeOnly(file: ApiDocFile): boolean {
  return file.type === 'type' || file.type === 'interface'
}

function getOrSet<key, value>(map: Map<key, value>, key: key, init: () => value): value {
  let value = map.get(key)
  if (value === undefined) {
    value = init()
    map.set(key, value)
  }
  return value
}
