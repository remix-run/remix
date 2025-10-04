import { route, formAction, resources } from '@remix-run/fetch-router'

export let routes = route({
  // Simple static routes
  home: '/',
  about: '/about',
  contact: route('/contact', {
    index: { method: 'GET', pattern: '/' },
    action: { method: 'POST', pattern: '/' },
  }),
  search: '/search',

  // Public book routes
  books: {
    index: { method: 'GET', pattern: '/books' },
    genre: { method: 'GET', pattern: '/books/genre/:genre' },
    show: { method: 'GET', pattern: '/books/:slug' },
  },

  // Auth routes
  auth: {
    login: formAction('login'),
    register: formAction('register'),
    logout: { method: 'POST', pattern: '/logout' },
    forgotPassword: formAction('forgot-password'),
    resetPassword: formAction('reset-password/:token'),
  },

  // Account section (protected, nested routes)
  account: route('/account', {
    index: '/',
    settings: formAction('settings', {
      submitMethod: 'PUT',
      routeNames: {
        action: 'update',
      },
    }),

    // Orders as nested resources with custom param
    orders: resources('/orders', {
      param: 'orderId',
      only: ['index', 'show'], // Read-only, no create/edit/delete
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
    books: resources('/books', { param: 'bookId' }),

    // Partial CRUD on users (no create, users self-register)
    users: resources('/users', {
      param: 'userId',
      only: ['index', 'show', 'edit', 'update', 'destroy'],
    }),

    // Orders view-only
    orders: resources('/orders', {
      param: 'orderId',
      only: ['index', 'show'],
    }),
  }),
})
