import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { css } from 'remix/component';
import { CartButton } from './assets/cart-button.js';
import { CartItems } from './assets/cart-items.js';
import { getCartTotal } from './data/cart.js';
import { books } from './data/schema.js';
import { loadAuth } from './middleware/auth.js';
import { getCurrentCart, getCurrentUserSafely } from './utils/context.js';
import { parseId } from './utils/ids.js';
import { renderFragment } from './utils/render.js';
import { routes as appRoutes } from './routes.js';
export default {
    middleware: [loadAuth()],
    actions: {
        async cartButton({ db, params }) {
            let bookId = parseId(params.bookId);
            let book = bookId === undefined ? undefined : await db.find(books, bookId);
            if (!book) {
                return renderFragment(_jsx("p", { children: "Book not found" }), { status: 404 });
            }
            let cart = getCurrentCart();
            let inCart = cart.items.some((item) => item.bookId === book.id);
            return renderFragment(_jsx(CartButton, { inCart: inCart, id: book.id, slug: book.slug }));
        },
        cartItems() {
            let cart = getCurrentCart();
            let total = getCartTotal(cart);
            let user = getCurrentUserSafely();
            if (cart.items.length === 0) {
                return renderFragment(_jsxs("div", { mix: [css({ marginTop: '2rem' })], children: [_jsx("p", { children: "Your cart is empty." }), _jsx("p", { mix: [css({ marginTop: '1rem' })], children: _jsx("a", { href: appRoutes.books.index.href(), class: "btn", children: "Browse Books" }) })] }));
            }
            return renderFragment(_jsx(CartItems, { items: cart.items, total: total, canCheckout: !!user }));
        },
    },
};
