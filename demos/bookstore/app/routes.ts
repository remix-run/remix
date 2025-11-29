import { route, form, resources } from '@remix-run/fetch-router'

export let routes = route({
  assets: '/assets/*path',
  uploads: '/uploads/*key',

  // Simple static routes
  home: '/',
  about: '/about',
  contact: route('/contact', {
    index: { method: 'GET', pattern: '/' },
    action: { method: 'POST', pattern: '/' },
  }),
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
    logout: { method: 'POST', pattern: '/logout' },
    forgotPassword: form('forgot-password'),
    resetPassword: form('reset-password/:token'),
  },

  // Account section (protected, nested routes)
  account: route('/account', {
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
  cart: route('/cart', {
    index: { method: 'GET', pattern: '/' },

    // API-style endpoints under /cart/api
    api: {
      add: { method: 'POST', pattern: '/api/add' },
      update: { method: 'PUT', pattern: '/api/update' },
      remove: { method: 'DELETE', pattern: '/api/remove' },
    },
  }),

  // Checkout flow
  checkout: route('/checkout', {
    index: { method: 'GET', pattern: '/' },
    action: { method: 'POST', pattern: '/' },
    confirmation: { method: 'GET', pattern: '/:orderId/confirmation' },
  }),

  // Admin section (protected, showcases full CRUD on multiple resources)
  admin: route('/admin', {
    index: { method: 'GET', pattern: '/' },

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
