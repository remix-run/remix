import { get, post, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: get('/'),
  settings: post('/settings'),
  catalog: {
    category: get('/products/:category'),
    family: get('/products/:category/:family'),
    part: get('/parts/:partNumber'),
  },
  cart: route('cart', {
    index: get('/'),
    add: post('/add'),
    update: post('/update'),
    remove: post('/remove'),
  }),
  fragments: route('fragments', {
    cartSummary: get('/cart-summary'),
  }),
})

export const frames = {
  content: 'content',
  cartSummary: 'cart-summary',
} as const
