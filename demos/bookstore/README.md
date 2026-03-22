# Bookstore Demo

A full-featured e-commerce bookstore that demonstrates Remix application structure, controller ownership, middleware composition, authentication, shopping cart flows, admin CRUD, file uploads, and progressively enhanced UI.

## Running the Demo

```bash
cd demos/bookstore
pnpm install
pnpm start
```

Then visit http://localhost:44100

### Demo Accounts

- **Admin**: admin@bookstore.com / admin123
- **Customer**: customer@example.com / password123

## Database and Migrations

- The SQLite file is stored at `db/bookstore.sqlite`
- Migration files live in `db/migrations`
- On startup, the app loads migrations from `db/migrations` and runs pending migrations before seeding demo data

## Code Highlights

- [`app/routes.ts`](app/routes.ts) defines the route contract with `route()`, `form()`, and `resources()` helpers so controllers and UI can generate URLs from a single typed source of truth.
- [`app/router.ts`](app/router.ts) wires the full Remix request stack together: static assets, form parsing, method override, sessions, async context, uploads, database loading, and auth. It still exports `createBookstoreRouter()` so the server and tests share the same composition entrypoint.
- [`app/controllers/storefront/controller.tsx`](app/controllers/storefront/controller.tsx) owns the public storefront routes, while its page modules keep the controller thin and move the larger page JSX into feature-local files.
- [`app/controllers/books/controller.tsx`](app/controllers/books/controller.tsx), [`app/controllers/cart/controller.tsx`](app/controllers/cart/controller.tsx), and [`app/controllers/checkout/controller.tsx`](app/controllers/checkout/controller.tsx) show the same pattern for browsing, cart mutations, and checkout flows.
- [`app/controllers/auth/controller.tsx`](app/controllers/auth/controller.tsx) delegates login, registration, forgot-password, and reset-password actions to nested auth controllers under `app/controllers/auth/`.
- [`app/controllers/admin/books/controller.tsx`](app/controllers/admin/books/controller.tsx) demonstrates admin CRUD with multipart uploads while keeping forms and page rendering in feature-local `form.tsx`, `index-page.tsx`, and `show-page.tsx` files.
- [`app/controllers/render.tsx`](app/controllers/render.tsx) provides the HTML renderer and preserves server-side frame resolution for fragment-based rendering.
- [`app/controllers/ui/layout.tsx`](app/controllers/ui/layout.tsx) and [`app/controllers/ui/document.tsx`](app/controllers/ui/document.tsx) define the shared document shell, while reusable UI primitives live under `app/controllers/ui/` instead of a generic components folder.
- [`app/middleware/session.ts`](app/middleware/session.ts) configures the signed cookie and filesystem-backed session storage, and [`app/middleware/uploads.ts`](app/middleware/uploads.ts) owns the upload handler used by the router.
- [`app/middleware/database.ts`](app/middleware/database.ts) injects the initialized database into request context, and [`app/utils/context.ts`](app/utils/context.ts) shows how app code reads request-scoped services like `Database`, `Session`, and the authenticated user without prop drilling.
- [`app/data/setup.ts`](app/data/setup.ts) initializes the SQLite database, applies migrations from [`db/migrations/20260228090000_create_bookstore_schema.ts`](db/migrations/20260228090000_create_bookstore_schema.ts), and seeds the demo catalog, users, and orders.
- [`app/controllers/uploads/controller.tsx`](app/controllers/uploads/controller.tsx) serves uploaded files from storage with stable URLs and caching headers.
- [`app/controllers/ui/restful-form.tsx`](app/controllers/ui/restful-form.tsx) adds hidden `_method` support so forms can drive PUT and DELETE actions through the router's method-override middleware.
- [`app/assets/cart-button.tsx`](app/assets/cart-button.tsx), [`app/assets/cart-items.tsx`](app/assets/cart-items.tsx), and [`app/assets/image-carousel.tsx`](app/assets/image-carousel.tsx) demonstrate progressively enhanced client-side behavior on top of server-rendered flows.
