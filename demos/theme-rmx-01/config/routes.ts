import { get, route } from 'remix/fetch-router/routes'

export let routes = {
  explorer: route('/', {
    index: get('/'),
    proofSheet: get('proof-sheet'),
    themeValues: get('theme-values'),
    uiRecipes: route('ui-recipes', {
      index: get('/'),
      text: get('text'),
      card: get('card'),
      button: get('button'),
      field: get('field'),
      item: get('item'),
      navigation: get('navigation'),
    }),
    components: get('components'),
    layouts: get('layouts'),
  }),
}
