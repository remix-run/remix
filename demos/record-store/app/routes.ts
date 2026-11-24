import { get, post, patch, del, route, form, resources } from 'remix/routes'

export const assetsBase = '/assets'

export const routes = route({
  assets: `${assetsBase}/*path`,
  uploads: '/uploads/*key',
  fragments: route('fragments', {
    cartButton: get('/cart-button/:albumId'),
    cartToggle: post('/cart-button/:albumId'),
  }),

  // Simple static routes
  home: '/',
  about: '/about',
  contact: form('contact'),
  search: '/search',

  // Public album routes
  albums: {
    index: '/albums',
    genre: '/albums/genre/:genre',
    show: '/albums/:slug',
    related: '/albums/:slug/related',
  },

  // Auth routes
  auth: {
    login: form('login'),
    register: form('register'),
    logout: post('logout'),
    forgotPassword: form('forgot-password'),
    resetPassword: form('reset-password/:token'),
  },

  // Account section (protected, nested routes)
  account: route('account', {
    index: '/',
    settings: form('settings', {
      formMethod: 'PUT',
      names: {
        action: 'update',
      },
    }),

    // Orders as nested resources with custom param
    orders: resources('orders', {
      only: ['index', 'show'], // Read-only, no create/edit/delete
      param: 'orderId',
    }),
  }),

  // Cart and shopping
  cart: route('cart', {
    index: get('/'),

    fragments: {
      items: get('/items'),
      itemsRestore: post('/items'),
      itemsUpdate: patch('/items'),
      itemsRemove: del('/items'),
    },

    // API-style endpoints under /cart/api
    api: {
      add: post('/api/add'),
    },
  }),

  // Checkout flow
  checkout: route('checkout', {
    index: get('/'),
    action: post('/'),
    confirmation: get('/:orderId/confirmation'),
  }),

  // Admin section (protected, showcases full CRUD on multiple resources)
  admin: route('admin', {
    index: get('/'),

    // Full CRUD on albums
    albums: resources('albums', { param: 'albumId' }),

    // Partial CRUD on users (no create, users self-register)
    users: resources('users', {
      only: ['index', 'show', 'edit', 'update', 'destroy'],
      param: 'userId',
    }),

    // Orders view-only
    orders: resources('orders', {
      only: ['index', 'show'],
      param: 'orderId',
    }),
  }),
})
