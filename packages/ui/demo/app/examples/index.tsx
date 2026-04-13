import fs from 'node:fs'
import url from 'node:url'

import type { RemixNode } from 'remix/component'

import {
  HydratedAccordionCardExample,
  HydratedAccordionMultipleExample,
  HydratedAccordionOverviewExample,
  HydratedAnchorExample,
  HydratedComboboxRemoteExample,
  HydratedComboboxOverviewExample,
  HydratedListboxControlledExample,
  HydratedListboxPopoverExample,
  HydratedListboxOverviewExample,
  HydratedListboxStaticExample,
  HydratedListboxStaticMultipleExample,
  HydratedMenuButtonBubblingExample,
  HydratedMenuButtonOverviewExample,
  HydratedPopoverOverviewExample,
  HydratedSelectDeconstructedExample,
  HydratedSelectOverviewExample,
} from '../assets/example-entries.tsx'
import CreateThemeLocalExample from './foundations/create-theme-local.tsx'
import InstallThemeExample from './foundations/install-theme.tsx'
import StartHereThemeExample from './foundations/start-here-theme.tsx'
import StartHereUiExample from './foundations/start-here-ui.tsx'
import AccordionCardExample from './components/accordion-card.tsx'
import AccordionMultipleExample from './components/accordion-multiple.tsx'
import AccordionOverviewExample from './components/accordion-overview.tsx'
import BreadcrumbsBasicExample from './components/breadcrumbs-basic.tsx'
import BreadcrumbsDecomposedExample from './components/breadcrumbs-decomposed.tsx'
import BreadcrumbsSeparatorExample from './components/breadcrumbs-separator.tsx'
import ListboxOverviewExample from './components/listbox-overview.tsx'
import MenuButtonBubblingExample from './components/menu-button-bubbling.tsx'
import MenuButtonOverviewExample from './components/menu-button-overview.tsx'
import PopoverOverviewExample from './components/popover-overview.tsx'
import SelectDeconstructedExample from './components/select-deconstructed.tsx'
import ColorRolesExample from './theme/color-roles.tsx'
import ControlSizesExample from './theme/control-sizes.tsx'
import SpaceRhythmExample from './theme/space-rhythm.tsx'
import SurfaceStackExample from './theme/surface-stack.tsx'
import TypographyScaleExample from './theme/typography-scale.tsx'
import ButtonAliasesExample from './ui-tokens/button-aliases.tsx'
import ButtonBaseSizeToneExample from './ui-tokens/button-base-size-tone.tsx'
import ButtonSizesExample from './ui-tokens/button-sizes.tsx'
import ButtonSlotsStatesExample from './ui-tokens/button-slots-states.tsx'
import CardOverviewExample from './ui-tokens/card-overview.tsx'
import CardStructuredSurfaceExample from './ui-tokens/card-structured-surface.tsx'
import FieldStackExample from './ui-tokens/field-stack.tsx'
import ItemStatusExample from './ui-tokens/item-status.tsx'
import ListboxContractExample from './ui-tokens/listbox-contract.tsx'
import MenuContractExample from './ui-tokens/menu-contract.tsx'
import NavDetailExample from './ui-tokens/nav-detail.tsx'
import NavOverviewExample from './ui-tokens/nav-overview.tsx'
import PopoverContractExample from './ui-tokens/popover-contract.tsx'
import RowStackExample from './ui-tokens/row-stack.tsx'
import TextOverviewExample from './ui-tokens/text-overview.tsx'
import TextPageTypographyExample from './ui-tokens/text-page-typography.tsx'

export type ExampleEntry = {
  code: string
  description?: string
  docsPath?: string
  id: string
  path: string
  pageIds: string[]
  preview: RemixNode
  slug: string
  title: string
}

function readSource(relativePath: string) {
  return fs.readFileSync(url.fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function createExample({
  description,
  docsPath,
  id,
  pageIds,
  preview,
  relativePath,
  slug,
  title,
}: {
  description?: string
  docsPath?: string
  id: string
  pageIds: string[]
  preview: RemixNode
  relativePath: string
  slug: string
  title: string
}): ExampleEntry {
  return {
    description,
    docsPath,
    id,
    code: readSource(relativePath),
    pageIds,
    path: `/examples/${slug}`,
    preview,
    slug,
    title,
  }
}

export let EXAMPLES = {
  accordionOverview: createExample({
    description:
      'The default Accordion shows how a first-party component can stay focused on behavior while visual structure comes from shared tokens and mixins.',
    docsPath: '/components/accordion',
    id: 'accordionOverview',
    pageIds: ['componentAccordion'],
    relativePath: './components/accordion-overview.tsx',
    preview: <HydratedAccordionOverviewExample />,
    slug: 'accordion-overview',
    title: 'Accordion overview',
  }),
  accordionCard: createExample({
    description: 'Accordion still feels on-system when it sits inside another shared surface.',
    docsPath: '/components/accordion',
    id: 'accordionCard',
    pageIds: ['componentAccordion'],
    relativePath: './components/accordion-card.tsx',
    preview: <HydratedAccordionCardExample />,
    slug: 'accordion-card',
    title: 'Accordion in a card',
  }),
  accordionMultiple: createExample({
    description: 'Multiple mode and per-item disabled state reuse the same visual contract.',
    docsPath: '/components/accordion',
    id: 'accordionMultiple',
    pageIds: ['componentAccordion'],
    relativePath: './components/accordion-multiple.tsx',
    preview: <HydratedAccordionMultipleExample />,
    slug: 'accordion-multiple',
    title: 'Accordion multiple mode',
  }),
  anchor: createExample({
    id: 'anchor',
    pageIds: [],
    relativePath: './components/anchor.tsx',
    preview: <HydratedAnchorExample />,
    slug: 'anchor',
    title: 'Anchor utility',
  }),
  breadcrumbsBasic: createExample({
    description:
      'A thin convenience component can stay valuable when the markup is common and the defaults are good.',
    docsPath: '/components/breadcrumbs',
    id: 'breadcrumbsBasic',
    pageIds: ['startOverview', 'componentBreadcrumbs'],
    relativePath: './components/breadcrumbs-basic.tsx',
    preview: <BreadcrumbsBasicExample />,
    slug: 'breadcrumbs-basic',
    title: 'Breadcrumbs basic',
  }),
  breadcrumbsSeparator: createExample({
    description:
      'You can change the visual language without giving up the convenience of the component.',
    docsPath: '/components/breadcrumbs',
    id: 'breadcrumbsSeparator',
    pageIds: ['componentBreadcrumbs'],
    relativePath: './components/breadcrumbs-separator.tsx',
    preview: <BreadcrumbsSeparatorExample />,
    slug: 'breadcrumbs-separator',
    title: 'Breadcrumbs custom separator',
  }),
  breadcrumbsDecomposed: createExample({
    description:
      'When app code needs something custom, the component should decompose back into plain markup and primitives.',
    docsPath: '/components/breadcrumbs',
    id: 'breadcrumbsDecomposed',
    pageIds: ['componentBreadcrumbs'],
    relativePath: './components/breadcrumbs-decomposed.tsx',
    preview: <BreadcrumbsDecomposedExample />,
    slug: 'breadcrumbs-decomposed',
    title: 'Breadcrumbs decomposed',
  }),
  popoverOverview: createExample({
    description:
      'Use the floating-surface primitive for anchored UI that should stay visually related to the rest of the system.',
    docsPath: '/components/popover',
    id: 'popoverOverview',
    pageIds: ['componentPopover'],
    relativePath: './components/popover-overview.tsx',
    preview: <HydratedPopoverOverviewExample />,
    slug: 'popover-overview',
    title: 'Popover overview',
  }),
  listboxOverview: createExample({
    description: 'Listbox shows the popup-backed value-control pattern with a small default API.',
    docsPath: '/components/listbox',
    id: 'listboxOverview',
    pageIds: ['componentListbox'],
    relativePath: './components/listbox-overview.tsx',
    preview: <HydratedListboxOverviewExample />,
    slug: 'listbox-overview',
    title: 'Listbox overview',
  }),
  listboxPopover: createExample({
    description:
      'Compose listbox directly inside a popover surface, then close on `listbox.change` with a surface ref.',
    docsPath: '/components/listbox',
    id: 'listboxPopover',
    pageIds: ['componentListbox'],
    relativePath: './components/listbox-popover.tsx',
    preview: <HydratedListboxPopoverExample />,
    slug: 'listbox-popover',
    title: 'Listbox in a popover',
  }),
  listboxControlled: createExample({
    description:
      'Controlled usage should feel ordinary and consistent with the rest of the library.',
    docsPath: '/components/listbox',
    id: 'listboxControlled',
    pageIds: ['componentListbox'],
    relativePath: './components/listbox-controlled.tsx',
    preview: <HydratedListboxControlledExample />,
    slug: 'listbox-controlled',
    title: 'Listbox controlled value',
  }),
  listboxStatic: createExample({
    description:
      'Single-select static scaffold with list-root focus and aria-activedescendant navigation.',
    docsPath: '/components/listbox',
    id: 'listboxStatic',
    pageIds: ['componentListbox'],
    relativePath: './components/listbox-static.tsx',
    preview: <HydratedListboxStaticExample />,
    slug: 'listbox-static',
    title: 'Listbox static single',
  }),
  listboxStaticMultiple: createExample({
    description:
      'Multi-select static scaffold with selection order tracking, Space toggles, and Enter replace behavior.',
    docsPath: '/components/listbox',
    id: 'listboxStaticMultiple',
    pageIds: ['componentListbox'],
    relativePath: './components/listbox-static-multiple.tsx',
    preview: <HydratedListboxStaticMultipleExample />,
    slug: 'listbox-static-multiple',
    title: 'Listbox static multiple',
  }),
  comboboxOverview: createExample({
    description:
      'Combobox keeps focus on the input while filtering visible options and committing one value from a popup-backed list.',
    docsPath: '/components/combobox',
    id: 'comboboxOverview',
    pageIds: ['componentCombobox', 'componentsOverview'],
    relativePath: './components/combobox-overview.tsx',
    preview: <HydratedComboboxOverviewExample />,
    slug: 'combobox-overview',
    title: 'Combobox overview',
  }),
  comboboxRemote: createExample({
    description:
      'Copied from the overview example so remote-data combobox experiments can evolve without disturbing the baseline.',
    docsPath: '/components/combobox',
    id: 'comboboxRemote',
    pageIds: ['componentCombobox', 'componentsOverview'],
    relativePath: './components/combobox-remote.tsx',
    preview: <HydratedComboboxRemoteExample />,
    slug: 'combobox-remote',
    title: 'Combobox remote',
  }),
  selectOverview: createExample({
    description:
      'Select wraps the listbox-in-popover pattern into a single-select component with a trigger label and optional hidden input.',
    docsPath: '/components/select',
    id: 'selectOverview',
    pageIds: ['componentSelect', 'componentsOverview'],
    relativePath: './components/select-overview.tsx',
    preview: <HydratedSelectOverviewExample />,
    slug: 'select-overview',
    title: 'Select overview',
  }),
  selectDeconstructed: createExample({
    description:
      'Compose select directly from `select.context`, `select.button()`, `select.popover()`, `select.list()`, and `select.option(...)`.',
    docsPath: '/components/select',
    id: 'selectDeconstructed',
    pageIds: ['componentSelect'],
    relativePath: './components/select-deconstructed.tsx',
    preview: <HydratedSelectDeconstructedExample />,
    slug: 'select-deconstructed',
    title: 'Select deconstructed',
  }),
  menuButtonOverview: createExample({
    description:
      'Menu is the action-oriented sibling to Listbox, with the same popup foundation but different semantics.',
    docsPath: '/components/menu',
    id: 'menuButtonOverview',
    pageIds: ['componentMenu'],
    relativePath: './components/menu-button-overview.tsx',
    preview: <HydratedMenuButtonOverviewExample />,
    slug: 'menu-button-overview',
    title: 'Menu button overview',
  }),
  menuButtonBubbling: createExample({
    description:
      '`Menu.select` bubbling keeps action handling flexible at the item, menu, or app level.',
    docsPath: '/components/menu',
    id: 'menuButtonBubbling',
    pageIds: ['componentMenu'],
    relativePath: './components/menu-button-bubbling.tsx',
    preview: <HydratedMenuButtonBubblingExample />,
    slug: 'menu-button-bubbling',
    title: 'Item and parent events',
  }),
  startHereTheme: createExample({
    description:
      'Use raw theme tokens when you need direct values rather than a reusable styling role.',
    docsPath: '/',
    id: 'startHereTheme',
    pageIds: ['startOverview'],
    preview: <StartHereThemeExample />,
    relativePath: './foundations/start-here-theme.tsx',
    slug: 'start-here-theme',
    title: 'Theme responsibility',
  }),
  startHereUi: createExample({
    description: 'UI mixins turn recurring styling decisions into a smaller shared vocabulary.',
    docsPath: '/',
    id: 'startHereUi',
    pageIds: ['startOverview'],
    preview: <StartHereUiExample />,
    relativePath: './foundations/start-here-ui.tsx',
    slug: 'start-here-ui',
    title: 'UI responsibility',
  }),
  installTheme: createExample({
    description:
      'Render the theme and glyph sheet once in the document, then build the rest of the app on the shared surface.',
    docsPath: '/installing-theme',
    id: 'installTheme',
    pageIds: ['installTheme'],
    preview: <InstallThemeExample />,
    relativePath: './foundations/install-theme.tsx',
    slug: 'install-theme',
    title: 'Installing a theme',
  }),
  createThemeLocal: createExample({
    description:
      'Create a scoped theme from `RMX_01_VALUES`, then let the same `theme` and `ui` references resolve inside that container.',
    docsPath: '/create-theme',
    id: 'createThemeLocal',
    pageIds: ['createTheme'],
    preview: <CreateThemeLocalExample />,
    relativePath: './foundations/create-theme-local.tsx',
    slug: 'create-theme-local',
    title: 'Local theme preview',
  }),
  themeSurfaceStack: createExample({
    description:
      'The surface scale should make hierarchy visible immediately without hand-picked fills.',
    docsPath: '/theme-tokens/colors',
    id: 'themeSurfaceStack',
    pageIds: ['themeColors'],
    preview: <SurfaceStackExample />,
    relativePath: './theme/surface-stack.tsx',
    slug: 'theme-surface-stack',
    title: 'Surface stack',
  }),
  themeSpaceRhythm: createExample({
    description:
      'Space tokens are the shared rhythm behind padding, gaps, and dense layout decisions.',
    docsPath: '/theme-tokens/spacing',
    id: 'themeSpaceRhythm',
    pageIds: ['themeSpacing'],
    preview: <SpaceRhythmExample />,
    relativePath: './theme/space-rhythm.tsx',
    slug: 'theme-space-rhythm',
    title: 'Space rhythm',
  }),
  themeTypographyScale: createExample({
    description:
      'Type tokens should shift hierarchy and density without every component carrying its own scale.',
    docsPath: '/theme-tokens/typography',
    id: 'themeTypographyScale',
    pageIds: ['themeTypography'],
    preview: <TypographyScaleExample />,
    relativePath: './theme/typography-scale.tsx',
    slug: 'theme-typography-scale',
    title: 'Typography scale',
  }),
  themeColorRoles: createExample({
    description:
      'Color roles stay semantic so text, actions, and status treatments still feel related.',
    docsPath: '/theme-tokens/colors',
    id: 'themeColorRoles',
    pageIds: ['themeColors'],
    preview: <ColorRolesExample />,
    relativePath: './theme/color-roles.tsx',
    slug: 'theme-color-roles',
    title: 'Color roles',
  }),
  themeControlSizes: createExample({
    description: 'Control sizes align buttons, fields, menus, and other compact interactions.',
    docsPath: '/theme-tokens/control-sizes',
    id: 'themeControlSizes',
    pageIds: ['themeControls'],
    preview: <ControlSizesExample />,
    relativePath: './theme/control-sizes.tsx',
    slug: 'theme-control-sizes',
    title: 'Control sizes',
  }),
  overviewText: createExample({
    docsPath: '/ui-tokens/typography',
    id: 'overviewText',
    pageIds: ['uiTypography'],
    relativePath: './ui-tokens/text-overview.tsx',
    preview: <TextOverviewExample />,
    slug: 'text-overview',
    title: 'Text overview',
  }),
  overviewCard: createExample({
    docsPath: '/ui-tokens/cards',
    id: 'overviewCard',
    pageIds: ['uiCards'],
    relativePath: './ui-tokens/card-overview.tsx',
    preview: <CardOverviewExample />,
    slug: 'card-overview',
    title: 'Card overview',
  }),
  buttonAliases: createExample({
    description: 'The alias layer is the fast path to ordinary actions.',
    docsPath: '/ui-tokens/buttons',
    id: 'buttonAliases',
    pageIds: ['uiButtons'],
    relativePath: './ui-tokens/button-aliases.tsx',
    preview: <ButtonAliasesExample />,
    slug: 'button-aliases',
    title: 'Button aliases',
  }),
  fieldStack: createExample({
    description: 'Field chrome, labels, and help text should travel together.',
    docsPath: '/ui-tokens/fields',
    id: 'fieldStack',
    pageIds: ['uiFields'],
    relativePath: './ui-tokens/field-stack.tsx',
    preview: <FieldStackExample />,
    slug: 'field-stack',
    title: 'Field stack',
  }),
  itemStatus: createExample({
    docsPath: '/ui-tokens/items',
    id: 'itemStatus',
    pageIds: ['uiItems'],
    relativePath: './ui-tokens/item-status.tsx',
    preview: <ItemStatusExample />,
    slug: 'item-status',
    title: 'Item status',
  }),
  navOverview: createExample({
    docsPath: '/ui-tokens/navigation',
    id: 'navOverview',
    pageIds: ['uiNavigation'],
    relativePath: './ui-tokens/nav-overview.tsx',
    preview: <NavOverviewExample />,
    slug: 'nav-overview',
    title: 'Navigation overview',
  }),
  rowStack: createExample({
    docsPath: '/ui-tokens/layout',
    id: 'rowStack',
    pageIds: ['uiLayout'],
    relativePath: './ui-tokens/row-stack.tsx',
    preview: <RowStackExample />,
    slug: 'row-stack',
    title: 'Row and stack',
  }),
  textPageTypography: createExample({
    description:
      'Text roles should give the system a shared page voice without component-specific typography sprawl.',
    docsPath: '/ui-tokens/typography',
    id: 'textPageTypography',
    pageIds: ['uiTypography'],
    relativePath: './ui-tokens/text-page-typography.tsx',
    preview: <TextPageTypographyExample />,
    slug: 'text-page-typography',
    title: 'Page typography',
  }),
  cardStructuredSurface: createExample({
    description: 'Cards prove how structure and tone can stay separate in the shared UI layer.',
    docsPath: '/ui-tokens/cards',
    id: 'cardStructuredSurface',
    pageIds: ['uiCards'],
    relativePath: './ui-tokens/card-structured-surface.tsx',
    preview: <CardStructuredSurfaceExample />,
    slug: 'card-structured-surface',
    title: 'Structured surface',
  }),
  buttonBaseSizeTone: createExample({
    description:
      'The button model is composable: base, size, and tone each stay visible in the code.',
    docsPath: '/ui-tokens/buttons',
    id: 'buttonBaseSizeTone',
    pageIds: ['uiButtons'],
    relativePath: './ui-tokens/button-base-size-tone.tsx',
    preview: <ButtonBaseSizeToneExample />,
    slug: 'button-base-size-tone',
    title: 'Base, size, and tone',
  }),
  buttonSizes: createExample({
    docsPath: '/ui-tokens/buttons',
    id: 'buttonSizes',
    pageIds: ['uiButtons'],
    relativePath: './ui-tokens/button-sizes.tsx',
    preview: <ButtonSizesExample />,
    slug: 'button-sizes',
    title: 'Button sizes',
  }),
  buttonSlotsStates: createExample({
    docsPath: '/ui-tokens/buttons',
    id: 'buttonSlotsStates',
    pageIds: ['uiButtons'],
    relativePath: './ui-tokens/button-slots-states.tsx',
    preview: <ButtonSlotsStatesExample />,
    slug: 'button-slots-states',
    title: 'Button slots and states',
  }),
  navDetail: createExample({
    description: 'Sidebar and nav primitives should be reusable outside the docs shell itself.',
    docsPath: '/ui-tokens/navigation',
    id: 'navDetail',
    pageIds: ['uiNavigation'],
    relativePath: './ui-tokens/nav-detail.tsx',
    preview: <NavDetailExample />,
    slug: 'nav-detail',
    title: 'Sidebar stack',
  }),
  popoverContract: createExample({
    description: 'The popup surface token stays separate from higher-level popup behavior.',
    docsPath: '/ui-tokens/popups',
    id: 'popoverContract',
    pageIds: ['uiPopups'],
    preview: <PopoverContractExample />,
    relativePath: './ui-tokens/popover-contract.tsx',
    slug: 'popover-contract',
    title: 'Popover surface',
  }),
  menuContract: createExample({
    description:
      'Menus own their own styling contract so themes can override menu structure without coupling it to listbox or popover consumers.',
    docsPath: '/ui-tokens/popups',
    id: 'menuContract',
    pageIds: ['uiPopups'],
    preview: <MenuContractExample />,
    relativePath: './ui-tokens/menu-contract.tsx',
    slug: 'menu-contract',
    title: 'Menu tokens',
  }),
  listboxContract: createExample({
    description:
      'Listbox owns a separate popup value-control contract while still sharing the same underlying theme values.',
    docsPath: '/ui-tokens/popups',
    id: 'listboxContract',
    pageIds: ['uiPopups'],
    preview: <ListboxContractExample />,
    relativePath: './ui-tokens/listbox-contract.tsx',
    slug: 'listbox-contract',
    title: 'Listbox tokens',
  }),
} as const

export type ExampleId = keyof typeof EXAMPLES

export let EXAMPLE_LIST = Object.values(EXAMPLES)
export let EXAMPLE_PAGES = EXAMPLE_LIST

export function getExamplesForPage(pageId: string) {
  return EXAMPLE_LIST.filter((example) => example.pageIds.includes(pageId))
}
