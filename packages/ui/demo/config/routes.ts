import { get, route } from 'remix/fetch-router/routes'

export let routes = {
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
