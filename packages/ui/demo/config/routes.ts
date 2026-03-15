import { get, route } from 'remix/fetch-router/routes'

export let routes = {
  examples: route('/examples', {
    textOverview: get('text-overview'),
    cardOverview: get('card-overview'),
    buttonAliases: get('button-aliases'),
    fieldStack: get('field-stack'),
    itemStatus: get('item-status'),
    navOverview: get('nav-overview'),
    rowStack: get('row-stack'),
    textPageTypography: get('text-page-typography'),
    cardStructuredSurface: get('card-structured-surface'),
    buttonBaseSizeTone: get('button-base-size-tone'),
    buttonSizes: get('button-sizes'),
    buttonSlotsStates: get('button-slots-states'),
    navDetail: get('nav-detail'),
  }),
  explorer: route('/', {
    index: get('/'),
    proofSheet: get('proof-sheet'),
    glyphs: get('glyphs'),
    themeTokens: route('theme-tokens', {
      space: get('space'),
      radius: get('radius'),
      typography: get('typography'),
      colors: get('colors'),
      shadow: get('shadow'),
      motion: get('motion'),
      control: get('control'),
    }),
    uiRecipes: route('ui-recipes', {
      text: get('text'),
      card: get('card'),
      button: get('button'),
      field: get('field'),
      item: get('item'),
      layout: get('layout'),
      navigation: get('navigation'),
    }),
    components: get('components'),
    layouts: get('layouts'),
  }),
}
