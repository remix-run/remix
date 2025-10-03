import { createRoutes, createResources } from '@remix-run/fetch-router'

export let routes = createRoutes({
  // Simple static routes
  home: '/',
  about: '/about',
  contact: { method: 'GET', pattern: '/contact' },
  contactSubmit: { method: 'POST', pattern: '/contact' },

  // Search (query params showcase)
  search: '/search',

  // Public book routes (read-only)
  books: {
    index: { method: 'GET', pattern: '/books' },
    show: { method: 'GET', pattern: '/books/:slug' },
  },

  // Genre browsing (nested under books to show hierarchy)
  genres: createRoutes('/books/genre', {
    show: { method: 'GET', pattern: '/:genre' },
  }),

  // Auth routes (custom routes, not resources)
  auth: {
    login: { method: 'GET', pattern: '/login' },
    loginSubmit: { method: 'POST', pattern: '/login' },
    register: { method: 'GET', pattern: '/register' },
    registerSubmit: { method: 'POST', pattern: '/register' },
    logout: { method: 'POST', pattern: '/logout' },
    forgotPassword: { method: 'GET', pattern: '/forgot-password' },
    forgotPasswordSubmit: { method: 'POST', pattern: '/forgot-password' },
    resetPassword: { method: 'GET', pattern: '/reset-password/:token' },
    resetPasswordSubmit: { method: 'POST', pattern: '/reset-password/:token' },
  },

  // Account section (protected, nested routes)
  account: createRoutes('/account', {
    index: { method: 'GET', pattern: '/' },
    settings: { method: 'GET', pattern: '/settings' },
    settingsUpdate: { method: 'PUT', pattern: '/settings' },

    // Orders as nested resources with custom param
    orders: createResources('/orders', {
      param: 'orderId',
      only: ['index', 'show'], // Read-only, no create/edit/delete
    }),
  }),

  // Cart and shopping
  cart: createRoutes('/cart', {
    index: { method: 'GET', pattern: '/' },

    // API-style endpoints under /cart/api
    api: {
      add: { method: 'POST', pattern: '/api/add' },
      update: { method: 'PUT', pattern: '/api/update' },
      remove: { method: 'DELETE', pattern: '/api/remove' },
    },
  }),

  // Checkout flow
  checkout: createRoutes('/checkout', {
    index: { method: 'GET', pattern: '/' },
    submit: { method: 'POST', pattern: '/' },
    confirmation: { method: 'GET', pattern: '/:orderId/confirmation' },
  }),

  // Admin section (protected, showcases full CRUD on multiple resources)
  admin: createRoutes('/admin', {
    index: { method: 'GET', pattern: '/' },

    // Full CRUD on books
    books: createResources('/books', { param: 'bookId' }),

    // Partial CRUD on users (no create, users self-register)
    users: createResources('/users', {
      param: 'userId',
      only: ['index', 'show', 'edit', 'update', 'destroy'],
    }),

    // Orders view-only
    orders: createResources('/orders', {
      param: 'orderId',
      only: ['index', 'show'],
    }),
  }),
})
