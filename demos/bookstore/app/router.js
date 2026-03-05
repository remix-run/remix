import { createRouter } from 'remix/fetch-router';
import { asyncContext } from 'remix/async-context-middleware';
import { compression } from 'remix/compression-middleware';
import { formData } from 'remix/form-data-middleware';
import { logger } from 'remix/logger-middleware';
import { methodOverride } from 'remix/method-override-middleware';
import { session } from 'remix/session-middleware';
import { staticFiles } from 'remix/static-middleware';
import { routes } from './routes.js';
import { initializeBookstoreDatabase } from './data/setup.js';
import { sessionCookie, sessionStorage } from './utils/session.js';
import { uploadHandler } from './utils/uploads.js';
import adminController from './admin.js';
import accountController from './account.js';
import authController from './auth.js';
import booksController from './books.js';
import cartController from './cart.js';
import { toggleCart } from './cart.js';
import checkoutController from './checkout.js';
import * as marketingController from './marketing.js';
import { uploadsAction } from './uploads.js';
import fragmentsController from './fragments.js';
import { loadDatabase } from './middleware/database.js';
let middleware = [];
if (process.env.NODE_ENV === 'development') {
    middleware.push(logger());
}
middleware.push(compression());
middleware.push(staticFiles('./public', {
    cacheControl: 'no-store, must-revalidate',
    etag: false,
    lastModified: false,
}));
middleware.push(formData({ uploadHandler }));
middleware.push(methodOverride());
middleware.push(session(sessionCookie, sessionStorage));
middleware.push(asyncContext());
middleware.push(loadDatabase());
await initializeBookstoreDatabase();
export let router = createRouter({ middleware });
router.get(routes.uploads, uploadsAction);
router.map(routes.fragments, fragmentsController);
router.post(routes.api.cartToggle, toggleCart);
router.map(routes.home, marketingController.home);
router.map(routes.about, marketingController.about);
router.map(routes.contact, marketingController.contact);
router.map(routes.search, marketingController.search);
router.map(routes.books, booksController);
router.map(routes.auth, authController);
router.map(routes.cart, cartController);
router.map(routes.account, accountController);
router.map(routes.checkout, checkoutController);
router.map(routes.admin, adminController);
