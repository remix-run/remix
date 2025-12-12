// TODO: We need to import this from the sub-export because this file is included in
// the client bundle, and if we import from the `remix` package then esbuild will
// encounter `node:*` imports within other re-exports in the root remix `index.ts`
import { del, get, post, put, route, form, resources } from 'remix/fetch-router'

export let routes = route({
  assets: '/assets/*path',
  uploads: '/uploads/*key',

  // Simple static routes
  home: '/',
  about: '/about',
  contact: form('contact'),
  search: '/search',

  // Fragments
  fragments: {
    bookCard: '/fragments/book-card/:slug',
  },

  // Public book routes
  books: {
    index: '/books',
    genre: '/books/genre/:genre',
    show: '/books/:slug',
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

    // API-style endpoints under /cart/api
    api: {
      add: post('/api/add'),
      update: put('/api/update'),
      remove: del('/api/remove'),
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

    // Full CRUD on books
    books: resources('books', { param: 'bookId' }),

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
