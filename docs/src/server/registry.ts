import { css } from 'node_modules/@remix-run/ui/src/style/css-mixin.ts'
import { theme } from '@remix-run/ui/theme'
import type { ApiDocFile, ApiTypeKind, DocFile } from './markdown.ts'
import { routes } from './routes.ts'

const TYPE_LABEL: Record<ApiTypeKind, string> = {
  type: 'Types',
  interface: 'Interfaces',
  class: 'Classes',
  function: 'Functions',
}

const TYPE_EYEBROW: Record<ApiTypeKind, string> = {
  type: 'Type',
  interface: 'Interface',
  class: 'Class',
  function: 'Function',
}

const TYPE_ORDER: ApiTypeKind[] = ['type', 'interface', 'class', 'function']

export const HOME_PAGE_ID = '__home__'
export const NOT_FOUND_PAGE_ID = '__not-found__'

export type PageDefinition = {
  id: string
  description: string
  eyebrow: string
  navLabel: string
  path: string
  sectionId: string
  title: string
  docFile?: DocFile
  css?: ReturnType<typeof css>
}

export type NavGroup = {
  id: string
  label?: string
  pageIds: string[]
}

export type NavSection = {
  id: string
  label: string
  groups: NavGroup[]
}

export type DocsRegistry = {
  pages: Record<string, PageDefinition>
  sections: NavSection[]
}

export function buildRegistry(docFiles: DocFile[], version?: string): DocsRegistry {
  let pages: Record<string, PageDefinition> = {}
  let sections: NavSection[] = []

  let homePage: PageDefinition = {
    id: HOME_PAGE_ID,
    description: '',
    eyebrow: '',
    navLabel: 'Overview',
    path: routes.home.href({ version }),
    sectionId: 'start',
    title: '',
    css: homePageCss,
  }
  pages[HOME_PAGE_ID] = homePage

  let packageGroups = new Map<string, Map<ApiTypeKind, ApiDocFile[]>>()
  let packageOverviews = new Map<string, DocFile>()
  for (let file of docFiles) {
    if (file.kind === 'package') {
      packageOverviews.set(file.package, file)
      continue
    }

    let typeMap = getOrSet(packageGroups, file.package, () => new Map())
    getOrSet(typeMap, file.type, () => []).push(file)
  }

  let sortedPackages = Array.from(
    new Set([...packageGroups.keys(), ...packageOverviews.keys()]),
  ).sort(comparePackages)

  for (let pkg of sortedPackages) {
    let typeMap = packageGroups.get(pkg)
    let groups: NavGroup[] = []
    let overview = packageOverviews.get(pkg)
    if (overview) {
      let page: PageDefinition = {
        id: overview.urlPath,
        description: '',
        eyebrow: 'Package',
        navLabel: 'Overview',
        path: routes.docs.href({ version, slug: overview.urlPath }),
        sectionId: pkg,
        title: pkg,
        docFile: overview,
      }
      pages[overview.urlPath] = page
      groups.push({ id: `${pkg}::overview`, pageIds: [overview.urlPath] })
    }

    for (let kind of TYPE_ORDER) {
      let files = typeMap?.get(kind)
      if (!files || files.length === 0) continue
      let groupId = `${pkg}::${kind}`
      let sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name))
      let pageIds: string[] = []
      for (let file of sortedFiles) {
        let page: PageDefinition = {
          id: file.urlPath,
          description: '',
          eyebrow: `${pkg} · ${TYPE_EYEBROW[kind]}`,
          navLabel: file.name,
          path: routes.docs.href({ version, slug: file.urlPath }),
          sectionId: pkg,
          title: file.name,
          docFile: file,
        }
        pages[file.urlPath] = page
        pageIds.push(file.urlPath)
      }
      groups.push({ id: groupId, label: TYPE_LABEL[kind], pageIds })
    }
    if (groups.length > 0) {
      sections.push({ id: pkg, label: pkg, groups })
    }
  }

  return { pages, sections }
}

export function getHomePage(registry: DocsRegistry): PageDefinition {
  return registry.pages[HOME_PAGE_ID]
}

export function getDocPage(registry: DocsRegistry, slug: string): PageDefinition | undefined {
  return registry.pages[slug]
}

export function buildNotFoundPage(slug: string, version?: string): PageDefinition {
  return {
    id: NOT_FOUND_PAGE_ID,
    description: `The requested document was not found: ${slug}`,
    eyebrow: 'Not Found',
    navLabel: 'Not Found',
    path: routes.docs.href({ version, slug }),
    sectionId: 'start',
    title: 'Page not found',
  }
}

export function isPageActive(page: PageDefinition, currentPath: string) {
  return currentPath === page.path
}

function comparePackages(a: string, b: string): number {
  if (a === 'remix' && b.startsWith('remix/')) return -1
  if (b === 'remix' && a.startsWith('remix/')) return 1
  if (a.startsWith('remix/') && b.startsWith('remix/')) return a.localeCompare(b)
  if (a === 'remix' || a.startsWith('remix/')) return -1
  if (b === 'remix' || b.startsWith('remix/')) return 1
  return a.localeCompare(b)
}

function getOrSet<key, value>(map: Map<key, value>, key: key, init: () => value): value {
  let value = map.get(key)
  if (value === undefined) {
    value = init()
    map.set(key, value)
  }
  return value
}

const homePageCss = css({
  '& > p': {
    marginTop: `${theme.space.sm} !important`,
    marginBottom: `${theme.space.sm} !important`,
  },
  '& > ol > li + li': {
    marginTop: theme.space.md,
  },
})
