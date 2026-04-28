// better-sqlite3 can crash on Windows when many worker threads open demo databases.
// Import the server tests through one entrypoint so remix-test runs them in one worker.
await import('./router.test.ts')
await import('./data/setup.test.ts')
await import('./controllers/home.test.ts')
await import('./controllers/uploads.test.ts')
await import('./controllers/contact/controller.test.ts')
await import('./controllers/checkout/controller.test.ts')
await import('./controllers/cart/controller.test.ts')
await import('./controllers/books/controller.test.ts')
await import('./controllers/auth/controller.test.ts')
await import('./controllers/admin/controller.test.ts')
await import('./controllers/admin/books/controller.test.ts')
await import('./controllers/account/controller.test.ts')

export {}
