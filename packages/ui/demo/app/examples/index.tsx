import fs from 'node:fs'
import url from 'node:url'

import type { RemixNode } from 'remix/component'

import ButtonAliasesExample from './ui-recipes/button-aliases.tsx'
import ButtonBaseSizeToneExample from './ui-recipes/button-base-size-tone.tsx'
import ButtonSizesExample from './ui-recipes/button-sizes.tsx'
import ButtonSlotsStatesExample from './ui-recipes/button-slots-states.tsx'
import CardOverviewExample from './ui-recipes/card-overview.tsx'
import CardStructuredSurfaceExample from './ui-recipes/card-structured-surface.tsx'
import FieldStackExample from './ui-recipes/field-stack.tsx'
import ItemStatusExample from './ui-recipes/item-status.tsx'
import NavDetailExample from './ui-recipes/nav-detail.tsx'
import NavOverviewExample from './ui-recipes/nav-overview.tsx'
import RowStackExample from './ui-recipes/row-stack.tsx'
import TextOverviewExample from './ui-recipes/text-overview.tsx'
import TextPageTypographyExample from './ui-recipes/text-page-typography.tsx'

export type ExampleEntry = {
  code: string
  docsPath?: string
  path: string
  preview: RemixNode
  title: string
}

function readSource(relativePath: string) {
  return fs.readFileSync(url.fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function createExample({
  docsPath,
  path,
  preview,
  relativePath,
  title,
}: {
  docsPath?: string
  path: string
  preview: RemixNode
  relativePath: string
  title: string
}): ExampleEntry {
  return {
    docsPath,
    code: readSource(relativePath),
    path,
    preview,
    title,
  }
}

export let EXAMPLES = {
  overviewText: createExample({
    path: '/examples/text-overview',
    relativePath: './ui-recipes/text-overview.tsx',
    preview: <TextOverviewExample />,
    title: 'Text overview',
  }),
  overviewCard: createExample({
    path: '/examples/card-overview',
    relativePath: './ui-recipes/card-overview.tsx',
    preview: <CardOverviewExample />,
    title: 'Card overview',
  }),
  buttonAliases: createExample({
    docsPath: '/ui-recipes/button',
    path: '/examples/button-aliases',
    relativePath: './ui-recipes/button-aliases.tsx',
    preview: <ButtonAliasesExample />,
    title: 'Button aliases',
  }),
  fieldStack: createExample({
    docsPath: '/ui-recipes/field',
    path: '/examples/field-stack',
    relativePath: './ui-recipes/field-stack.tsx',
    preview: <FieldStackExample />,
    title: 'Field stack',
  }),
  itemStatus: createExample({
    docsPath: '/ui-recipes/item',
    path: '/examples/item-status',
    relativePath: './ui-recipes/item-status.tsx',
    preview: <ItemStatusExample />,
    title: 'Item status',
  }),
  navOverview: createExample({
    path: '/examples/nav-overview',
    relativePath: './ui-recipes/nav-overview.tsx',
    preview: <NavOverviewExample />,
    title: 'Navigation overview',
  }),
  rowStack: createExample({
    docsPath: '/ui-recipes/layout',
    path: '/examples/row-stack',
    relativePath: './ui-recipes/row-stack.tsx',
    preview: <RowStackExample />,
    title: 'Row and stack',
  }),
  textPageTypography: createExample({
    docsPath: '/ui-recipes/text',
    path: '/examples/text-page-typography',
    relativePath: './ui-recipes/text-page-typography.tsx',
    preview: <TextPageTypographyExample />,
    title: 'Page typography',
  }),
  cardStructuredSurface: createExample({
    docsPath: '/ui-recipes/card',
    path: '/examples/card-structured-surface',
    relativePath: './ui-recipes/card-structured-surface.tsx',
    preview: <CardStructuredSurfaceExample />,
    title: 'Structured surface',
  }),
  buttonBaseSizeTone: createExample({
    docsPath: '/ui-recipes/button',
    path: '/examples/button-base-size-tone',
    relativePath: './ui-recipes/button-base-size-tone.tsx',
    preview: <ButtonBaseSizeToneExample />,
    title: 'Base, size, and tone',
  }),
  buttonSizes: createExample({
    docsPath: '/ui-recipes/button',
    path: '/examples/button-sizes',
    relativePath: './ui-recipes/button-sizes.tsx',
    preview: <ButtonSizesExample />,
    title: 'Button sizes',
  }),
  buttonSlotsStates: createExample({
    docsPath: '/ui-recipes/button',
    path: '/examples/button-slots-states',
    relativePath: './ui-recipes/button-slots-states.tsx',
    preview: <ButtonSlotsStatesExample />,
    title: 'Button slots and states',
  }),
  navDetail: createExample({
    docsPath: '/ui-recipes/navigation',
    path: '/examples/nav-detail',
    relativePath: './ui-recipes/nav-detail.tsx',
    preview: <NavDetailExample />,
    title: 'Sidebar stack',
  }),
} as const

export let EXAMPLE_PAGES = Object.values(EXAMPLES)
