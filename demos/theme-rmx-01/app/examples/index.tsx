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

type ExampleEntry = {
  code: string
  preview: RemixNode
}

function readSource(relativePath: string) {
  return fs.readFileSync(url.fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function createExample(relativePath: string, preview: RemixNode): ExampleEntry {
  return {
    code: readSource(relativePath),
    preview,
  }
}

export let EXAMPLES = {
  overviewText: createExample('./ui-recipes/text-overview.tsx', <TextOverviewExample />),
  overviewCard: createExample('./ui-recipes/card-overview.tsx', <CardOverviewExample />),
  buttonAliases: createExample('./ui-recipes/button-aliases.tsx', <ButtonAliasesExample />),
  fieldStack: createExample('./ui-recipes/field-stack.tsx', <FieldStackExample />),
  itemStatus: createExample('./ui-recipes/item-status.tsx', <ItemStatusExample />),
  navOverview: createExample('./ui-recipes/nav-overview.tsx', <NavOverviewExample />),
  rowStack: createExample('./ui-recipes/row-stack.tsx', <RowStackExample />),
  textPageTypography: createExample(
    './ui-recipes/text-page-typography.tsx',
    <TextPageTypographyExample />,
  ),
  cardStructuredSurface: createExample(
    './ui-recipes/card-structured-surface.tsx',
    <CardStructuredSurfaceExample />,
  ),
  buttonBaseSizeTone: createExample(
    './ui-recipes/button-base-size-tone.tsx',
    <ButtonBaseSizeToneExample />,
  ),
  buttonSizes: createExample('./ui-recipes/button-sizes.tsx', <ButtonSizesExample />),
  buttonSlotsStates: createExample(
    './ui-recipes/button-slots-states.tsx',
    <ButtonSlotsStatesExample />,
  ),
  navDetail: createExample('./ui-recipes/nav-detail.tsx', <NavDetailExample />),
} as const
