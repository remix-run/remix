import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { Frame } from 'remix/component';
import { redirect } from 'remix/response/redirect';
import { routes } from './routes.js';
import { books } from './data/schema.js';
import { addToCart, removeFromCart, updateCartItem } from './data/cart.js';
import { Layout } from './layout.js';
import { loadAuth } from './middleware/auth.js';
import { getCurrentCart } from './utils/context.js';
import { parseId } from './utils/ids.js';
import { render } from './utils/render.js';
import { Session } from './utils/session.js';
export default {
    middleware: [loadAuth()],
    actions: {
        index() {
            return render(_jsxs(Layout, { children: [_jsx("h1", { children: "Shopping Cart" }), _jsx("div", { class: "card", children: _jsx(Frame, { name: "cart", src: routes.fragments.cartItems.href() }) })] }));
        },
        api: {
            actions: {
                async add({ db, get }) {
                    let session = get(Session);
                    let formData = get(FormData);
                    if (process.env.NODE_ENV !== 'test') {
                        // Simulate network latency
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                    }
                    let bookId = parseId(formData.get('bookId'));
                    let book = bookId === undefined ? undefined : await db.find(books, bookId);
                    if (!book) {
                        return new Response('Book not found', { status: 404 });
                    }
                    session.set('cart', addToCart(getCurrentCart(), book.id, book.slug, book.title, book.price, 1));
                    if (formData.get('redirect') === 'none') {
                        return new Response(null, { status: 204 });
                    }
                    return redirect(routes.cart.index.href());
                },
                async update({ db, get }) {
                    let session = get(Session);
                    let formData = get(FormData);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    let bookId = parseId(formData.get('bookId'));
                    let book = bookId === undefined ? undefined : await db.find(books, bookId);
                    if (!book) {
                        return new Response('Book not found', { status: 404 });
                    }
                    let quantity = parseInt(formData.get('quantity')?.toString() ?? '1', 10);
                    session.set('cart', updateCartItem(getCurrentCart(), book.id, quantity));
                    if (formData.get('redirect') === 'none') {
                        return new Response(null, { status: 204 });
                    }
                    return redirect(routes.cart.index.href());
                },
                async remove({ db, get }) {
                    let session = get(Session);
                    let formData = get(FormData);
                    if (process.env.NODE_ENV !== 'test') {
                        // Simulate network latency
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                    }
                    let bookId = parseId(formData.get('bookId'));
                    let book = bookId === undefined ? undefined : await db.find(books, bookId);
                    if (!book) {
                        return new Response('Book not found', { status: 404 });
                    }
                    session.set('cart', removeFromCart(getCurrentCart(), book.id));
                    if (formData.get('redirect') === 'none') {
                        return new Response(null, { status: 204 });
                    }
                    return redirect(routes.cart.index.href());
                },
            },
        },
    },
};
export async function toggleCart({ db, get }) {
    let session = get(Session);
    let formData = get(FormData);
    let bookId = parseId(formData.get('bookId'));
    let book = bookId === undefined ? undefined : await db.find(books, bookId);
    if (!book) {
        return new Response('Book not found', { status: 404 });
    }
    let cart = getCurrentCart();
    let inCart = cart.items.some((item) => item.bookId === book.id);
    let next = inCart
        ? removeFromCart(cart, book.id)
        : addToCart(cart, book.id, book.slug, book.title, book.price, 1);
    session.set('cart', next);
    return new Response(null, { status: 204 });
}
