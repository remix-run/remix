import type { RemixNode } from 'remix/ui'

import { renderComponentAccordionPage } from './pages/component-accordion.tsx'
import { renderComponentButtonPage } from './pages/component-button.tsx'
import { renderComponentBreadcrumbsPage } from './pages/component-breadcrumbs.tsx'
import { renderComponentComboboxPage } from './pages/component-combobox.tsx'
import { renderComponentListboxPage } from './pages/component-listbox.tsx'
import { renderComponentMenuPage } from './pages/component-menu.tsx'
import { renderComponentPopoverPage } from './pages/component-popover.tsx'
import { renderComponentSelectPage } from './pages/component-select.tsx'
import { renderComponentsPage } from './pages/components.tsx'
import { renderCreateThemePage } from './pages/create-theme.tsx'
import { renderInstallThemePage } from './pages/install-theme.tsx'
import { renderStartHerePage } from './pages/start-here.tsx'
import { renderThemeColorsPage } from './pages/theme-colors.tsx'
import { renderThemeControlsPage } from './pages/theme-controls.tsx'
import { renderThemeSpacingPage } from './pages/theme-spacing.tsx'
import { renderThemeTypographyPage } from './pages/theme-typography.tsx'

export type ShowcasePageId =
  | 'startOverview'
  | 'installTheme'
  | 'createTheme'
  | 'uiButtons'
  | 'uiPopups'
  | 'themeColors'
  | 'themeSpacing'
  | 'themeTypography'
  | 'themeControls'
  | 'componentsOverview'
  | 'componentAccordion'
  | 'componentBreadcrumbs'
  | 'componentCombobox'
  | 'componentSelect'
  | 'componentListbox'
  | 'componentMenu'

export type ShowcasePageDefinition = {
  actionKey: string
  description: string
  eyebrow: string
  id: ShowcasePageId
  navLabel: string
  path: string
  render: () => RemixNode
  sectionId: 'start' | 'themeTokens' | 'components'
  title: string
}

export const PAGES = {
  startOverview: {
    actionKey: 'index',
    description:
      'Learn the two big ideas in Remix UI: theme values, and component modules built from context, mixins, styles, and optional wrappers.',
    eyebrow: 'Start',
    id: 'startOverview',
    navLabel: 'Conceptual Overview',
    path: '/',
    render: renderStartHerePage,
    sectionId: 'start',
    title: 'Conceptual overview',
  },
  installTheme: {
    actionKey: 'installTheme',
    description:
      'Install the package, render the theme and glyph sheet once, and let the rest of the app consume the shared surface.',
    eyebrow: 'Start',
    id: 'installTheme',
    navLabel: 'Installing a Theme',
    path: '/installing-theme',
    render: renderInstallThemePage,
    sectionId: 'start',
    title: 'Installing a theme',
  },
  createTheme: {
    actionKey: 'createTheme',
    description:
      'Use `createTheme(...)` and a values object to define a theme once, then keep consuming the same shared contracts.',
    eyebrow: 'Start',
    id: 'createTheme',
    navLabel: 'Creating a Theme',
    path: '/create-theme',
    render: renderCreateThemePage,
    sectionId: 'start',
    title: 'Creating a theme',
  },
  uiButtons: {
    actionKey: 'uiButtons',
    description:
      'Buttons are the one broad alias family we intentionally keep today, with both fast aliases and composable pieces.',
    eyebrow: 'Component',
    id: 'uiButtons',
    navLabel: 'Button',
    path: '/components/button',
    render: renderComponentButtonPage,
    sectionId: 'components',
    title: 'Button',
  },
  uiPopups: {
    actionKey: 'uiPopups',
    description:
      'Popup-backed pieces keep separate `popover.*Style`, `menu.*Style`, and `listbox.*Style` contracts even when they share theme values.',
    eyebrow: 'Primitive',
    id: 'uiPopups',
    navLabel: 'Popover',
    path: '/components/popover',
    render: renderComponentPopoverPage,
    sectionId: 'components',
    title: 'Popover',
  },
  themeColors: {
    actionKey: 'themeColors',
    description: 'Color tokens define surfaces, text hierarchy, and action tone.',
    eyebrow: 'Theme Token',
    id: 'themeColors',
    navLabel: 'Colors',
    path: '/theme-tokens/colors',
    render: renderThemeColorsPage,
    sectionId: 'themeTokens',
    title: 'Colors',
  },
  themeSpacing: {
    actionKey: 'themeSpacing',
    description: 'Spacing tokens create the shared rhythm for gaps, padding, and density.',
    eyebrow: 'Theme Token',
    id: 'themeSpacing',
    navLabel: 'Spacing',
    path: '/theme-tokens/spacing',
    render: renderThemeSpacingPage,
    sectionId: 'themeTokens',
    title: 'Spacing',
  },
  themeTypography: {
    actionKey: 'themeTypography',
    description: 'Typography tokens define the type scale, emphasis, and readability of the theme.',
    eyebrow: 'Theme Token',
    id: 'themeTypography',
    navLabel: 'Typography',
    path: '/theme-tokens/typography',
    render: renderThemeTypographyPage,
    sectionId: 'themeTokens',
    title: 'Typography',
  },
  themeControls: {
    actionKey: 'themeControls',
    description: 'Control size tokens align compact interactive UI across the library.',
    eyebrow: 'Theme Token',
    id: 'themeControls',
    navLabel: 'Control Sizes',
    path: '/theme-tokens/control-sizes',
    render: renderThemeControlsPage,
    sectionId: 'themeTokens',
    title: 'Control sizes',
  },
  componentsOverview: {
    actionKey: 'componentsOverview',
    description: 'A quick overview of the public component surface that is worth judging today.',
    eyebrow: 'Components',
    id: 'componentsOverview',
    navLabel: 'Overview',
    path: '/components',
    render: renderComponentsPage,
    sectionId: 'components',
    title: 'Components overview',
  },
  componentAccordion: {
    actionKey: 'componentAccordion',
    description:
      'Accordion is the clearest current proof point for the intended split between shared visuals and owned behavior.',
    eyebrow: 'Component',
    id: 'componentAccordion',
    navLabel: 'Accordion',
    path: '/components/accordion',
    render: renderComponentAccordionPage,
    sectionId: 'components',
    title: 'Accordion',
  },
  componentBreadcrumbs: {
    actionKey: 'componentBreadcrumbs',
    description:
      'Breadcrumbs is a compact convenience component that should stay easy to reach for and easy to decompose.',
    eyebrow: 'Component',
    id: 'componentBreadcrumbs',
    navLabel: 'Breadcrumbs',
    path: '/components/breadcrumbs',
    render: renderComponentBreadcrumbsPage,
    sectionId: 'components',
    title: 'Breadcrumbs',
  },
  componentCombobox: {
    actionKey: 'componentCombobox',
    description:
      'Combobox is the input-first popup-backed value picker, with draft text filtering and committed selection kept separate.',
    eyebrow: 'Component',
    id: 'componentCombobox',
    navLabel: 'Combobox',
    path: '/components/combobox',
    render: renderComponentComboboxPage,
    sectionId: 'components',
    title: 'Combobox',
  },
  componentSelect: {
    actionKey: 'componentSelect',
    description:
      'Select is the first convenience control that packages the ordinary popup-backed value-picker shape.',
    eyebrow: 'Component',
    id: 'componentSelect',
    navLabel: 'Select',
    path: '/components/select',
    render: renderComponentSelectPage,
    sectionId: 'components',
    title: 'Select',
  },
  componentListbox: {
    actionKey: 'componentListbox',
    description:
      'Listbox is the current headless value-picker primitive beneath the popup-backed controls.',
    eyebrow: 'Component',
    id: 'componentListbox',
    navLabel: 'Listbox',
    path: '/components/listbox',
    render: renderComponentListboxPage,
    sectionId: 'components',
    title: 'Listbox',
  },
  componentMenu: {
    actionKey: 'componentMenu',
    description:
      'Menu is the action-oriented popup sibling to Listbox with bubbling `onMenuSelect(...)` events.',
    eyebrow: 'Component',
    id: 'componentMenu',
    navLabel: 'Menu',
    path: '/components/menu',
    render: renderComponentMenuPage,
    sectionId: 'components',
    title: 'Menu',
  },
} as const satisfies Record<ShowcasePageId, ShowcasePageDefinition>

export const PAGE_LIST = Object.values(PAGES)

export const NAV_SECTIONS = [
  {
    id: 'start',
    label: 'Start',
    pageIds: ['startOverview', 'installTheme', 'createTheme'],
  },
  {
    id: 'themeTokens',
    label: 'Theme Tokens',
    pageIds: ['themeColors', 'themeSpacing', 'themeTypography', 'themeControls'],
  },
  {
    id: 'components',
    label: 'Components',
    pageIds: [
      'componentAccordion',
      'componentBreadcrumbs',
      'uiButtons',
      'componentCombobox',
      'componentListbox',
      'componentMenu',
      'uiPopups',
      'componentSelect',
    ],
  },
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  pageIds: ShowcasePageId[]
}>

export function isPageActive(page: ShowcasePageDefinition, currentPath: string) {
  return currentPath === page.path
}
