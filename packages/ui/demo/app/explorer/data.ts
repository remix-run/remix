export type PageDefinition = {
  description: string
  eyebrow: string
  id: string
  navLabel: string
  path: string
  title: string
}

export let PAGES = {
  overview: {
    id: 'overview',
    path: '/',
    navLabel: 'Overview',
    eyebrow: 'Design System',
    title: 'RMX design system explorer',
    description:
      'Browse the current theme, token groups, mixins, blocks, and proof sheet examples in one place.',
  },
  proofSheet: {
    id: 'proof-sheet',
    path: '/proof-sheet',
    navLabel: 'Proof Sheet',
    eyebrow: 'Theme Proof Sheet',
    title: 'RMX_01 in a realistic application frame',
    description:
      'A compact fake product view for quickly judging typography, hierarchy, controls, surfaces, and overall tone when evaluating a theme.',
  },
  themeTokenSpace: {
    id: 'theme-token-space',
    path: '/theme-tokens/space',
    navLabel: 'Space',
    eyebrow: 'Theme Token',
    title: 'Space tokens',
    description:
      'Space tokens define the shared rhythm for padding, gaps, margins, and larger layout spacing across the system.',
  },
  themeTokenRadius: {
    id: 'theme-token-radius',
    path: '/theme-tokens/radius',
    navLabel: 'Radius',
    eyebrow: 'Theme Token',
    title: 'Radius tokens',
    description:
      'Radius tokens define corner shapes from sharp utility treatments to rounded controls and pill-shaped actions.',
  },
  themeTokenTypography: {
    id: 'theme-token-typography',
    path: '/theme-tokens/typography',
    navLabel: 'Typography',
    eyebrow: 'Theme Token',
    title: 'Typography tokens',
    description:
      'Typography tokens define families, sizes, weights, line heights, and tracking so text roles share one visual language.',
  },
  themeTokenColors: {
    id: 'theme-token-colors',
    path: '/theme-tokens/colors',
    navLabel: 'Colors',
    eyebrow: 'Theme Token',
    title: 'Color tokens',
    description:
      'Color tokens stay semantic so components can choose the right role for text, surfaces, borders, actions, and statuses.',
  },
  themeTokenShadow: {
    id: 'theme-token-shadow',
    path: '/theme-tokens/shadow',
    navLabel: 'Shadow',
    eyebrow: 'Theme Token',
    title: 'Shadow tokens',
    description:
      'Shadow tokens provide a compact elevation scale for controls, surfaces, menus, and higher-emphasis layers.',
  },
  themeTokenMotion: {
    id: 'theme-token-motion',
    path: '/theme-tokens/motion',
    navLabel: 'Motion',
    eyebrow: 'Theme Token',
    title: 'Motion tokens',
    description:
      'Motion tokens define the timing and easing values that keep transitions and animations calm, consistent, and utilitarian.',
  },
  themeTokenControl: {
    id: 'theme-token-control',
    path: '/theme-tokens/control',
    navLabel: 'Control',
    eyebrow: 'Theme Token',
    title: 'Control tokens',
    description:
      'Control tokens define the shared sizing primitives used by buttons, fields, and other compact interactive UI.',
  },
  glyphs: {
    id: 'glyphs',
    path: '/glyphs',
    navLabel: 'Glyphs',
    eyebrow: 'Glyph Contract',
    title: 'Shared glyphs and icon sizing',
    description:
      'Glyphs are a sibling system to tokens: a fixed icon contract, a sprite sheet renderer, a thin `<Glyph />` wrapper, and shared icon sizing mixins.',
  },
  uiRecipeText: {
    id: 'ui-recipe-text',
    path: '/ui-recipes/text',
    navLabel: 'Text',
    eyebrow: 'UI Mixin',
    title: 'Text mixins',
    description:
      'Page-level text roles give the system a shared language for headings, descriptions, captions, code, and metadata.',
  },
  uiRecipeCard: {
    id: 'ui-recipe-card',
    path: '/ui-recipes/card',
    navLabel: 'Card',
    eyebrow: 'UI Mixin',
    title: 'Card mixins',
    description:
      'Card mixins define the shell, slot rhythm, and surface hierarchy used by content panels, menus, dialogs, and system showcases.',
  },
  uiRecipeButton: {
    id: 'ui-recipe-button',
    path: '/ui-recipes/button',
    navLabel: 'Button',
    eyebrow: 'UI Mixin',
    title: 'Button mixins',
    description:
      'Composable button layers cover shared structure, size, tone, icons, and loading patterns without wrapper-heavy component APIs.',
  },
  uiRecipeField: {
    id: 'ui-recipe-field',
    path: '/ui-recipes/field',
    navLabel: 'Field',
    eyebrow: 'UI Mixin',
    title: 'Field mixins',
    description:
      'Field chrome, labels, and help text should travel together so forms stay consistent across the component library.',
  },
  uiRecipeItem: {
    id: 'ui-recipe-item',
    path: '/ui-recipes/item',
    navLabel: 'Item',
    eyebrow: 'UI Mixin',
    title: 'Item and status mixins',
    description:
      'Rows and status treatments underpin menus, command lists, tabs, combobox options, and sidebar entries.',
  },
  uiRecipeNav: {
    id: 'ui-recipe-nav',
    path: '/ui-recipes/navigation',
    navLabel: 'Sidebar + Nav',
    eyebrow: 'UI Mixin',
    title: 'Sidebar and navigation mixins',
    description:
      'Sidebar and navigation primitives are useful app-level building blocks even when the full docs shell remains demo-specific.',
  },
  uiRecipeLayout: {
    id: 'ui-recipe-layout',
    path: '/ui-recipes/layout',
    navLabel: 'Row + Stack',
    eyebrow: 'UI Mixin',
    title: 'Row and stack layout mixins',
    description:
      'Symmetrical row and stack primitives provide reusable flex layout mechanics without falling back to demo-specific helpers.',
  },
  components: {
    id: 'components',
    path: '/components',
    navLabel: 'Components',
    eyebrow: 'Components',
    title: 'Thin first-party components',
    description:
      'First-party components should stay focused on markup, behavior, and ergonomics while styling comes from shared tokens and mixins.',
  },
  componentAccordion: {
    id: 'component-accordion',
    path: '/components/accordion',
    navLabel: 'Accordion',
    eyebrow: 'Component',
    title: 'Accordion component',
    description:
      'Accordion is the first behavior-heavy `remix/ui` component: a calm disclosure list built from shared mixins, real DOM events, and context-driven internal coordination.',
  },
  componentBreadcrumbs: {
    id: 'component-breadcrumbs',
    path: '/components/breadcrumbs',
    navLabel: 'Breadcrumbs',
    eyebrow: 'Component',
    title: 'Breadcrumbs component',
    description:
      'Breadcrumbs is a thin convenience component for common app-layout trails: good default output first, with an easy path back to plain markup and existing primitives.',
  },
  componentPopover: {
    id: 'component-popover',
    path: '/components/popover',
    navLabel: 'Popover',
    eyebrow: 'Component',
    title: 'Popover component',
    description:
      'Popover is the shared floating-surface primitive: native popover behavior where available, anchored positioning, and reusable popup surface mixins.',
  },
  componentListbox: {
    id: 'component-listbox',
    path: '/components/listbox',
    navLabel: 'Listbox',
    eyebrow: 'Component',
    title: 'Listbox component',
    description:
      'Listbox is the first popup-backed control built on the shared popover pattern, with a simple `Listbox` + `ListboxOption` API and a lower-level composed escape hatch.',
  },
  layouts: {
    id: 'layouts',
    path: '/layouts',
    navLabel: 'Blocks',
    eyebrow: 'Blocks',
    title: 'Structural blocks for shells and surfaces',
    description:
      'Use blocks for larger structural pieces like shells, sidebars, rails, and grouped surfaces.',
  },
} as const satisfies Record<string, PageDefinition>

export let COMPONENT_PAGES = [
  PAGES.componentAccordion,
  PAGES.componentBreadcrumbs,
  PAGES.componentPopover,
  PAGES.componentListbox,
] as const

export let UI_RECIPE_PAGES = [
  PAGES.uiRecipeText,
  PAGES.uiRecipeCard,
  PAGES.uiRecipeButton,
  PAGES.uiRecipeField,
  PAGES.uiRecipeItem,
  PAGES.uiRecipeNav,
  PAGES.uiRecipeLayout,
] as const

export let THEME_TOKEN_PAGES = [
  PAGES.themeTokenSpace,
  PAGES.themeTokenRadius,
  PAGES.themeTokenTypography,
  PAGES.themeTokenColors,
  PAGES.themeTokenShadow,
  PAGES.themeTokenMotion,
  PAGES.themeTokenControl,
] as const

export let PRIMARY_PAGES = [
  PAGES.overview,
  PAGES.proofSheet,
  PAGES.glyphs,
  PAGES.components,
  PAGES.layouts,
] as const
