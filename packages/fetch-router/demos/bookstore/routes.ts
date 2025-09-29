import {
  createRoutes,
  createResources as resources,
  createResource as resource,
} from '@remix-run/fetch-router'

export const routes = createRoutes({
  // Marketing pages
  home: '/',
  about: '/about',
  contact: { methods: ['GET', 'POST'], pattern: '/contact' },
  pricing: '/pricing',

  // Book catalog
  books: {
    catalog: '/books',
    details: '/books/:isbn',
    reviews: { methods: ['GET', 'POST'], pattern: '/books/:isbn/reviews' },
    category: '/books/category/:category',
    author: '/books/author/:author',
  },

  // Store functionality
  store: {
    cart: '/cart',
    addToCart: { method: 'POST', pattern: '/cart/add' },
    removeFromCart: { method: 'DELETE', pattern: '/cart/:itemId' },
    checkout: { methods: ['GET', 'POST'], pattern: '/checkout' },
    orders: '/orders',
    orderDetails: '/orders/:orderId',
  },

  // Authentication
  auth: {
    login: { methods: ['GET', 'POST'], pattern: '/login' },
    signup: { methods: ['GET', 'POST'], pattern: '/signup' },
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
      ...resources('books', { base: '/api' }),
      author: resource('author', { base: '/api/books/:id' }),
    },
    orders: resources('orders', { base: '/api' }),
    search: '/api/search',
  },
})
