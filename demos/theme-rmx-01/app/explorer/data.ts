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
      'The demo now shows the design system itself: theme values, semantic recipes, layout primitives, and the current default theme preset.',
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
    navLabel: 'UI Recipes',
    eyebrow: 'Semantic Recipes',
    title: 'Composable ui recipes above the token layer',
    description:
      'The `ui` surface turns raw variables into reusable styling primitives for text, cards, controls, fields, navigation, and status treatments.',
  },
  uiRecipeText: {
    id: 'ui-recipe-text',
    path: '/ui-recipes/text',
    navLabel: 'Text',
    eyebrow: 'UI Recipe',
    title: 'Text recipes',
    description:
      'Page-level text roles give the system a shared language for headings, descriptions, captions, code, and metadata.',
  },
  uiRecipeCard: {
    id: 'ui-recipe-card',
    path: '/ui-recipes/card',
    navLabel: 'Card',
    eyebrow: 'UI Recipe',
    title: 'Card recipes',
    description:
      'Card recipes define the shell, slot rhythm, and surface hierarchy used by content panels, menus, dialogs, and system showcases.',
  },
  uiRecipeButton: {
    id: 'ui-recipe-button',
    path: '/ui-recipes/button',
    navLabel: 'Button',
    eyebrow: 'UI Recipe',
    title: 'Button and control recipes',
    description:
      'Shared control shape plus tonal layers keep actions cohesive across neutral, primary, and destructive states.',
  },
  uiRecipeField: {
    id: 'ui-recipe-field',
    path: '/ui-recipes/field',
    navLabel: 'Field',
    eyebrow: 'UI Recipe',
    title: 'Field recipes',
    description:
      'Field chrome, labels, and help text should travel together so forms stay consistent across the component library.',
  },
  uiRecipeItem: {
    id: 'ui-recipe-item',
    path: '/ui-recipes/item',
    navLabel: 'Item',
    eyebrow: 'UI Recipe',
    title: 'Item and status recipes',
    description:
      'Rows and status treatments underpin menus, command lists, tabs, combobox options, and sidebar entries.',
  },
  uiRecipeNav: {
    id: 'ui-recipe-nav',
    path: '/ui-recipes/navigation',
    navLabel: 'Sidebar + Nav',
    eyebrow: 'UI Recipe',
    title: 'Sidebar and navigation recipes',
    description:
      'Sidebar and navigation primitives are useful app-level building blocks even when the full docs shell remains demo-specific.',
  },
  components: {
    id: 'components',
    path: '/components',
    navLabel: 'Components',
    eyebrow: 'Component Layer',
    title: 'Component ergonomics should sit on top of shared recipes',
    description:
      'The eventual first-party component library should feel thin and consistent because shared styling lives in the theme contract and `ui` recipes.',
  },
  layouts: {
    id: 'layouts',
    path: '/layouts',
    navLabel: 'Layouts',
    eyebrow: 'Layout Primitives',
    title: 'Sidebar and navigation patterns for application shells',
    description:
      'The docs shell here is demo-specific, but the sidebar, nav, and panel ingredients are useful application-level primitives worth carrying forward.',
  },
} as const satisfies Record<string, PageDefinition>

export let UI_RECIPE_PAGES = [
  PAGES.uiRecipeText,
  PAGES.uiRecipeCard,
  PAGES.uiRecipeButton,
  PAGES.uiRecipeField,
  PAGES.uiRecipeItem,
  PAGES.uiRecipeNav,
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
