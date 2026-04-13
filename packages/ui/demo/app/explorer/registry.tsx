import type { RemixNode } from 'remix/component'

import { renderComponentAccordionPage } from './pages/component-accordion.tsx'
import { renderComponentBreadcrumbsPage } from './pages/component-breadcrumbs.tsx'
import { renderComponentComboboxPage } from './pages/component-combobox.tsx'
import { renderComponentListboxPage } from './pages/component-listbox.tsx'
import { renderComponentMenuPage } from './pages/component-menu.tsx'
import { renderComponentPopoverPage } from './pages/component-popover.tsx'
import { renderComponentSelectPage } from './pages/component-select.tsx'
import { renderComponentsPage } from './pages/components.tsx'
import { renderCreateThemePage } from './pages/create-theme.tsx'
import { renderInstallThemePage } from './pages/install-theme.tsx'
import { renderProofSheetPage } from './pages/proof-sheet.tsx'
import { renderStartHerePage } from './pages/start-here.tsx'
import { renderThemeColorsPage } from './pages/theme-colors.tsx'
import { renderThemeControlsPage } from './pages/theme-controls.tsx'
import { renderThemeSpacingPage } from './pages/theme-spacing.tsx'
import { renderThemeTypographyPage } from './pages/theme-typography.tsx'
import { renderUiButtonsPage } from './pages/ui-buttons.tsx'
import { renderUiCardsPage } from './pages/ui-cards.tsx'
import { renderUiFieldsPage } from './pages/ui-fields.tsx'
import { renderUiItemsPage } from './pages/ui-items.tsx'
import { renderUiLayoutPage } from './pages/ui-layout.tsx'
import { renderUiNavigationPage } from './pages/ui-navigation.tsx'
import { renderUiPopupsPage } from './pages/ui-popups.tsx'
import { renderUiTypographyPage } from './pages/ui-typography.tsx'

export type ShowcasePageId =
  | 'startOverview'
  | 'installTheme'
  | 'createTheme'
  | 'proofSheet'
  | 'uiCards'
  | 'uiButtons'
  | 'uiTypography'
  | 'uiFields'
  | 'uiNavigation'
  | 'uiLayout'
  | 'uiItems'
  | 'uiPopups'
  | 'themeColors'
  | 'themeSpacing'
  | 'themeTypography'
  | 'themeControls'
  | 'componentsOverview'
  | 'componentAccordion'
  | 'componentBreadcrumbs'
  | 'componentCombobox'
  | 'componentPopover'
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
  sectionId: 'start' | 'uiTokens' | 'themeTokens' | 'components'
  title: string
}

export let PAGES = {
  startOverview: {
    actionKey: 'index',
    description:
      'See the current split between theme tokens, reusable UI tokens, and thin first-party components.',
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
      'Use `createTheme(...)` and `RMX_01_VALUES` to define a theme once, then keep consuming the same shared contracts.',
    eyebrow: 'Start',
    id: 'createTheme',
    navLabel: 'Creating a Theme',
    path: '/create-theme',
    render: renderCreateThemePage,
    sectionId: 'start',
    title: 'Creating a theme',
  },
  proofSheet: {
    actionKey: 'proofSheet',
    description:
      'A realistic application frame for judging whether the current theme and UI layer feel shippable.',
    eyebrow: 'Start',
    id: 'proofSheet',
    navLabel: 'Proof Sheet',
    path: '/proof-sheet',
    render: renderProofSheetPage,
    sectionId: 'start',
    title: 'Proof sheet',
  },
  uiCards: {
    actionKey: 'uiCards',
    description: 'Card mixins define recurring surface structure, spacing rhythm, and tone.',
    eyebrow: 'UI Token',
    id: 'uiCards',
    navLabel: 'Cards',
    path: '/ui-tokens/cards',
    render: renderUiCardsPage,
    sectionId: 'uiTokens',
    title: 'Cards',
  },
  uiButtons: {
    actionKey: 'uiButtons',
    description: 'Button mixins should cover everyday actions and deliberate composition.',
    eyebrow: 'UI Token',
    id: 'uiButtons',
    navLabel: 'Buttons',
    path: '/ui-tokens/buttons',
    render: renderUiButtonsPage,
    sectionId: 'uiTokens',
    title: 'Buttons',
  },
  uiTypography: {
    actionKey: 'uiTypography',
    description: 'Text mixins keep the system voice consistent across pages and surfaces.',
    eyebrow: 'UI Token',
    id: 'uiTypography',
    navLabel: 'Typography',
    path: '/ui-tokens/typography',
    render: renderUiTypographyPage,
    sectionId: 'uiTokens',
    title: 'Typography',
  },
  uiFields: {
    actionKey: 'uiFields',
    description: 'Field tokens keep form chrome, labels, and help text aligned with the system.',
    eyebrow: 'UI Token',
    id: 'uiFields',
    navLabel: 'Fields',
    path: '/ui-tokens/fields',
    render: renderUiFieldsPage,
    sectionId: 'uiTokens',
    title: 'Fields',
  },
  uiNavigation: {
    actionKey: 'uiNavigation',
    description: 'Navigation tokens are shared building blocks for sidebars and compact app rails.',
    eyebrow: 'UI Token',
    id: 'uiNavigation',
    navLabel: 'Navigation',
    path: '/ui-tokens/navigation',
    render: renderUiNavigationPage,
    sectionId: 'uiTokens',
    title: 'Navigation',
  },
  uiLayout: {
    actionKey: 'uiLayout',
    description: 'Rows and stacks cover common flex mechanics without wrapper sprawl.',
    eyebrow: 'UI Token',
    id: 'uiLayout',
    navLabel: 'Layout',
    path: '/ui-tokens/layout',
    render: renderUiLayoutPage,
    sectionId: 'uiTokens',
    title: 'Layout',
  },
  uiItems: {
    actionKey: 'uiItems',
    description: 'Item rows and status treatments underpin menus, command UI, and compact lists.',
    eyebrow: 'UI Token',
    id: 'uiItems',
    navLabel: 'Items',
    path: '/ui-tokens/items',
    render: renderUiItemsPage,
    sectionId: 'uiTokens',
    title: 'Items',
  },
  uiPopups: {
    actionKey: 'uiPopups',
    description: 'Popup token families stay separate even when they share the same theme values.',
    eyebrow: 'UI Token',
    id: 'uiPopups',
    navLabel: 'Popups',
    path: '/ui-tokens/popups',
    render: renderUiPopupsPage,
    sectionId: 'uiTokens',
    title: 'Popups',
  },
  themeColors: {
    actionKey: 'themeColors',
    description: 'Color tokens define surfaces, text hierarchy, action tone, and status meaning.',
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
    description: 'A quick overview of the current first-party component surface.',
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
  componentPopover: {
    actionKey: 'componentPopover',
    description:
      'Popover is the shared floating-surface primitive used by anchored, non-modal UI.',
    eyebrow: 'Primitive',
    id: 'componentPopover',
    navLabel: 'Popover',
    path: '/components/popover',
    render: renderComponentPopoverPage,
    sectionId: 'components',
    title: 'Popover',
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
      'Listbox is the first popup-backed value control built on the shared surface model.',
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
      'Menu is the action-oriented popup sibling to Listbox with bubbling `Menu.select` events.',
    eyebrow: 'Component',
    id: 'componentMenu',
    navLabel: 'Menu',
    path: '/components/menu',
    render: renderComponentMenuPage,
    sectionId: 'components',
    title: 'Menu',
  },
} as const satisfies Record<ShowcasePageId, ShowcasePageDefinition>

export let PAGE_LIST = Object.values(PAGES)

export let NAV_SECTIONS = [
  {
    id: 'start',
    label: 'Start',
    pageIds: ['startOverview', 'installTheme', 'createTheme', 'proofSheet'],
  },
  {
    id: 'uiTokens',
    label: 'UI Tokens',
    pageIds: [
      'uiCards',
      'uiButtons',
      'uiTypography',
      'uiFields',
      'uiNavigation',
      'uiLayout',
      'uiItems',
      'uiPopups',
    ],
  },
  {
    id: 'themeTokens',
    label: 'Theme Tokens',
    pageIds: [
      'themeColors',
      'themeSpacing',
      'themeTypography',
      'themeControls',
    ],
  },
  {
    id: 'components',
    label: 'Components',
    pageIds: [
      'componentAccordion',
      'componentBreadcrumbs',
      'componentCombobox',
      'componentListbox',
      'componentPopover',
      'componentSelect',
      'componentMenu',
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
