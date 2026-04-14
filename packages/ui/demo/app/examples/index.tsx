import fs from 'node:fs'

import { discoverExampleFiles, humanizeExampleSlug, toExampleId } from './discovery.ts'

type ExampleCopy = {
  description?: string
  id?: string
  slug?: string
  title?: string
}

export type ExampleEntry = ReturnType<typeof createExampleEntry>

const EXAMPLE_COPY_BY_SLUG = {
  'accordion-overview': {
    description:
      'The default Accordion shows how a first-party component can stay focused on behavior while visual structure comes from shared tokens and mixins.',
    title: 'Accordion overview',
  },
  'accordion-card': {
    description: 'Accordion still feels on-system when it sits inside another shared surface.',
    title: 'Accordion in a card',
  },
  'accordion-multiple': {
    description: 'Multiple mode and per-item disabled state reuse the same visual contract.',
    title: 'Accordion multiple mode',
  },
  anchor: {
    title: 'Anchor utility',
  },
  'breadcrumbs-basic': {
    description:
      'A thin convenience component can stay valuable when the markup is common and the defaults are good.',
    title: 'Breadcrumbs basic',
  },
  'breadcrumbs-separator': {
    description:
      'You can change the visual language without giving up the convenience of the component.',
    title: 'Breadcrumbs custom separator',
  },
  'popover-overview': {
    description:
      'Use the low-level popover primitive for anchored, dismissible panels like filters, inspectors, and view options.',
    title: 'Popover overview',
  },
  'combobox-overview': {
    description:
      'Combobox keeps focus on the input while filtering visible options and committing one value from a popup-backed list.',
    title: 'Combobox overview',
  },
  'listbox-overview': {
    description:
      'Listbox shows the current headless value-picker surface: app-owned selected state with library-owned focus movement, typeahead, and option semantics.',
    title: 'Listbox overview',
  },
  'select-overview': {
    description:
      'Select wraps the ordinary single-select popup pattern into one component with a trigger label and optional hidden input.',
    title: 'Select overview',
  },
  'select-deconstructed': {
    description:
      'Compose select directly from `select.Context`, `select.triggerStyle`, `select.trigger()`, an inner `popover.Context`, `select.popover()`, `select.list()`, and `select.option(...)`.',
    title: 'Select deconstructed',
  },
  'menu-button-overview': {
    description:
      'Menu is the action-oriented sibling to Listbox, with the same popup foundation but different semantics.',
    title: 'Menu button overview',
  },
  'menu-button-bubbling': {
    description:
      '`onMenuSelect(...)` keeps action handling flexible at the item, menu, or app level.',
    title: 'Item and parent events',
  },
  'start-here-theme': {
    description:
      'Theme is the shared value contract for spacing, color, typography, surfaces, and control sizing.',
    title: 'Theme values',
  },
  'start-here-ui': {
    description:
      'Component modules give you `Context`, mixins, `*Style` exports, and convenience wrappers so you can pick the right level of control.',
    title: 'Component building blocks',
  },
  'install-theme': {
    description:
      'Render the theme and glyph sheet once in the document, then build the rest of the app on the shared surface.',
    title: 'Installing a theme',
  },
  'create-theme-local': {
    description:
      'Create a scoped theme from a local values object, then let the same `theme` values and styling namespaces resolve inside that container.',
    title: 'Local theme preview',
  },
  'surface-stack': {
    description:
      'The surface scale should make hierarchy visible immediately without hand-picked fills.',
    id: 'themeSurfaceStack',
    slug: 'theme-surface-stack',
    title: 'Surface stack',
  },
  'space-rhythm': {
    description:
      'Space tokens are the shared rhythm behind padding, gaps, and dense layout decisions.',
    id: 'themeSpaceRhythm',
    slug: 'theme-space-rhythm',
    title: 'Space rhythm',
  },
  'typography-scale': {
    description:
      'Type tokens should shift hierarchy and density without every component carrying its own scale.',
    id: 'themeTypographyScale',
    slug: 'theme-typography-scale',
    title: 'Typography scale',
  },
  'color-roles': {
    description: 'Color roles stay semantic so text and actions still feel related.',
    id: 'themeColorRoles',
    slug: 'theme-color-roles',
    title: 'Color roles',
  },
  'control-sizes': {
    description: 'Control sizes align buttons, fields, menus, and other compact interactions.',
    id: 'themeControlSizes',
    slug: 'theme-control-sizes',
    title: 'Control sizes',
  },
  'button-aliases': {
    description: 'The Button wrapper is the fast path to ordinary actions.',
    title: 'Button wrapper',
  },
  'button-base-tone': {
    description: 'The button model is composable: base and tone stay visible in the code.',
    title: 'Base and tone',
  },
  'button-slots-states': {
    title: 'Button slots and states',
  },
  'popover-contract': {
    description: 'The popup surface token stays separate from higher-level popup behavior.',
    title: 'Popover surface',
  },
  'menu-contract': {
    description:
      'Menus own their own styling contract so themes can override menu structure without coupling it to listbox or popover consumers.',
    title: 'Menu tokens',
  },
  'listbox-contract': {
    description:
      'Listbox keeps its own popup value-control contract without re-introducing a broad shared card, text, or navigation layer.',
    title: 'Listbox tokens',
  },
} satisfies Record<string, ExampleCopy>

const EXAMPLE_COPY_LOOKUP: Record<string, ExampleCopy> = EXAMPLE_COPY_BY_SLUG

function createExampleEntry(
  exampleFile: ReturnType<typeof discoverExampleFiles>[number],
  copy: ExampleCopy = {},
) {
  let slug = copy.slug ?? exampleFile.slug

  return {
    ...exampleFile,
    contentPath: `/examples/${slug}/content`,
    description: copy.description,
    id: copy.id ?? toExampleId(slug),
    path: `/examples/${slug}`,
    slug,
    title: copy.title ?? humanizeExampleSlug(slug),
  }
}

function createExampleEntries() {
  let discoveredExamples = discoverExampleFiles()
  let exampleEntries = discoveredExamples.map((exampleFile) =>
    createExampleEntry(exampleFile, EXAMPLE_COPY_LOOKUP[exampleFile.slug]),
  )
  let discoveredSlugs = new Set(discoveredExamples.map((example) => example.slug))

  for (let slug of Object.keys(EXAMPLE_COPY_BY_SLUG)) {
    if (!discoveredSlugs.has(slug)) {
      throw new Error(`Configured example copy for missing example "${slug}"`)
    }
  }

  return exampleEntries
}

function createExamplesBySlug() {
  return Object.fromEntries(
    createExampleEntries().map((example) => [example.slug, example]),
  ) as Record<string, ExampleEntry>
}

export let EXAMPLE_LIST = createExampleEntries()
export let EXAMPLES_BY_SLUG = createExamplesBySlug()
export let EXAMPLES = Object.fromEntries(
  EXAMPLE_LIST.map((example) => [example.id, example]),
) as Record<string, ExampleEntry>

export function findExample(slug: string) {
  return createExamplesBySlug()[slug]
}

export function getExample(slug: string) {
  let example = findExample(slug)

  if (!example) {
    throw new Error(`Unknown example "${slug}"`)
  }

  return example
}

export function getExampleContentHref(
  example: Pick<ExampleEntry, 'contentPath'>,
  options?: {
    description?: string
    standalone?: boolean
    title?: string
  },
) {
  let searchParams = new URLSearchParams()

  if (options?.title != null) {
    searchParams.set('title', options.title)
  }

  if (options?.description != null) {
    searchParams.set('description', options.description)
  }

  if (options?.standalone) {
    searchParams.set('standalone', '1')
  }

  let search = searchParams.toString()
  return search ? `${example.contentPath}?${search}` : example.contentPath
}

export function readExampleSource(example: Pick<ExampleEntry, 'absolutePath'>) {
  return fs.readFileSync(example.absolutePath, 'utf8')
}

export async function loadExampleModule(example: Pick<ExampleEntry, 'importHref' | 'slug'>) {
  let version = fs.statSync(new URL(example.importHref)).mtimeMs.toString(36)
  let mod = await import(`${example.importHref}?v=${version}`)

  if (typeof mod.default !== 'function') {
    throw new Error(`Example "${example.slug}" must default export a component function`)
  }

  return mod.default
}
