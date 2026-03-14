export type PageDefinition = {
  description: string
  eyebrow: string
  id: string
  navLabel: string
  path: string
  title: string
}

export type NavGroupDefinition = {
  label: string
  pages: PageDefinition[]
}

export let PAGES = {
  overview: {
    id: 'overview',
    path: '/',
    navLabel: 'Overview',
    eyebrow: 'Design System',
    title: 'RMX design system explorer',
    description:
      'The demo now shows the design system itself: theme values, semantic mixins, structural blocks, and the current default theme preset.',
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
  themeValues: {
    id: 'theme-values',
    path: '/theme-values',
    navLabel: 'Theme Values',
    eyebrow: 'Theme Contract',
    title: 'Typed theme values backed by CSS custom properties',
    description:
      'Apps and first-party components both read from the same variable contract, while themes provide the concrete values rendered into CSS.',
  },
  uiRecipes: {
    id: 'ui-recipes',
    path: '/ui-recipes',
    navLabel: 'UI Mixins',
    eyebrow: 'Semantic Mixins',
    title: 'Composable ui mixins above the token layer',
    description:
      'The `ui` surface turns raw variables into reusable styling primitives for text, cards, controls, fields, navigation, and status treatments.',
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
    eyebrow: 'Component Layer',
    title: 'Component ergonomics should sit on top of shared mixins and blocks',
    description:
      'The eventual first-party component library should feel thin and consistent because shared styling lives in the theme contract and `ui` mixins.',
  },
  layouts: {
    id: 'layouts',
    path: '/layouts',
    navLabel: 'Blocks',
    eyebrow: 'Block Layer',
    title: 'Structural blocks for application shells and surfaces',
    description:
      'The docs shell here is demo-specific, but cards, sidebars, rails, and shell compositions are useful structural blocks worth carrying forward.',
  },
} as const satisfies Record<string, PageDefinition>

export let UI_RECIPE_PAGES = [
  PAGES.uiRecipeText,
  PAGES.uiRecipeCard,
  PAGES.uiRecipeButton,
  PAGES.uiRecipeField,
  PAGES.uiRecipeItem,
  PAGES.uiRecipeNav,
  PAGES.uiRecipeLayout,
] as const

export let NAV_GROUPS: NavGroupDefinition[] = [
  {
    label: 'Themes',
    pages: [PAGES.overview, PAGES.proofSheet],
  },
  {
    label: 'API',
    pages: [PAGES.themeValues, PAGES.uiRecipes, PAGES.components, PAGES.layouts],
  },
]
