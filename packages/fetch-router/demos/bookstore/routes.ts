import {
  createRoutes,
  createResources as resources,
  createResource as resource,
} from '@remix-run/fetch-router'

export const routes = createRoutes({
  // Marketing pages
  home: '/',
  about: '/about',
  contact: {
    show: { method: 'GET', pattern: '/contact' },
    action: { method: 'POST', pattern: '/contact' },
  },
  pricing: '/pricing',

  // Book catalog
  books: {
    catalog: '/books',
    details: '/books/:isbn',
    reviews: {
      show: { method: 'GET', pattern: '/books/:isbn/reviews' },
      action: { method: 'POST', pattern: '/books/:isbn/reviews' },
    },
    category: '/books/category/:category',
    author: '/books/author/:author',
  },

  // Store functionality
  store: {
    cart: '/cart',
    addToCart: { method: 'POST', pattern: '/cart/add' },
    removeFromCart: { method: 'DELETE', pattern: '/cart/:itemId' },
    checkout: {
      show: { method: 'GET', pattern: '/checkout' },
      action: { method: 'POST', pattern: '/checkout' },
    },
    orders: '/orders',
    orderDetails: '/orders/:orderId',
  },

  // Authentication
  auth: {
    login: {
      show: { method: 'GET', pattern: '/login' },
      action: { method: 'POST', pattern: '/login' },
    },
    signup: {
      show: { method: 'GET', pattern: '/signup' },
      action: { method: 'POST', pattern: '/signup' },
    },
    logout: { method: 'POST', pattern: '/logout' },
  },

  // Admin panel
  admin: {
    dashboard: '/admin',
    books: '/admin/books',
    users: '/admin/users',
    orders: '/admin/orders',
  },

  // Resource routes - use directly
  blog: resources('blog', { param: 'slug' }),
  users: resources('users'),

  // API with multiple resources
  api: {
    books: {
      ...resources('api/books'),
      author: resource('api/books/:id/author'),
    },
    orders: resources('api/orders'),
    search: '/api/search',
  },
})
