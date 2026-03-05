import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { redirect } from 'remix/response/redirect';
import { css } from 'remix/component';
import { routes } from './routes.js';
import { requireAuth } from './middleware/auth.js';
import { clearCart, getCartTotal } from './data/cart.js';
import { itemsByOrder, orders, orderItemsWithBook } from './data/schema.js';
import { Layout } from './layout.js';
import { render } from './utils/render.js';
import { getCurrentUser, getCurrentCart } from './utils/context.js';
import { parseId } from './utils/ids.js';
import { Session } from './utils/session.js';
export default {
    middleware: [requireAuth()],
    actions: {
        index() {
            let cart = getCurrentCart();
            let total = getCartTotal(cart);
            if (cart.items.length === 0) {
                return render(_jsx(Layout, { children: _jsxs("div", { class: "card", children: [_jsx("h1", { children: "Checkout" }), _jsx("p", { children: "Your cart is empty. Add some books before checking out." }), _jsx("p", { mix: [css({ marginTop: '1rem' })], children: _jsx("a", { href: routes.books.index.href(), class: "btn", children: "Browse Books" }) })] }) }));
            }
            return render(_jsxs(Layout, { children: [_jsx("h1", { children: "Checkout" }), _jsxs("div", { class: "card", children: [_jsx("h2", { children: "Order Summary" }), _jsxs("table", { mix: [css({ marginTop: '1rem' })], children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Book" }), _jsx("th", { children: "Quantity" }), _jsx("th", { children: "Price" }), _jsx("th", { children: "Subtotal" })] }) }), _jsx("tbody", { children: cart.items.map((item) => (_jsxs("tr", { children: [_jsx("td", { children: item.title }), _jsx("td", { children: item.quantity }), _jsxs("td", { children: ["$", item.price.toFixed(2)] }), _jsxs("td", { children: ["$", (item.price * item.quantity).toFixed(2)] })] }))) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { colSpan: 3, mix: [css({ textAlign: 'right', fontWeight: 'bold' })], children: "Total:" }), _jsxs("td", { mix: [css({ fontWeight: 'bold' })], children: ["$", total.toFixed(2)] })] }) })] })] }), _jsxs("div", { class: "card", mix: [css({ marginTop: '1.5rem' })], children: [_jsx("h2", { children: "Shipping Information" }), _jsxs("form", { method: "POST", action: routes.checkout.action.href(), children: [_jsxs("div", { class: "form-group", children: [_jsx("label", { for: "street", children: "Street Address" }), _jsx("input", { type: "text", id: "street", name: "street", required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "city", children: "City" }), _jsx("input", { type: "text", id: "city", name: "city", required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "state", children: "State" }), _jsx("input", { type: "text", id: "state", name: "state", required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "zip", children: "ZIP Code" }), _jsx("input", { type: "text", id: "zip", name: "zip", required: true })] }), _jsx("button", { type: "submit", class: "btn", children: "Place Order" }), _jsx("a", { href: routes.cart.index.href(), class: "btn btn-secondary", mix: [css({ marginLeft: '0.5rem' })], children: "Back to Cart" })] })] })] }));
        },
        async action({ db, get }) {
            let session = get(Session);
            let formData = get(FormData);
            let user = getCurrentUser();
            let cart = getCurrentCart();
            if (cart.items.length === 0) {
                return redirect(routes.cart.index.href());
            }
            let shippingAddress = {
                street: formData.get('street')?.toString() || '',
                city: formData.get('city')?.toString() || '',
                state: formData.get('state')?.toString() || '',
                zip: formData.get('zip')?.toString() || '',
            };
            let total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            let order = await db.transaction(async (tx) => {
                let createdOrder = await tx.create(orders, {
                    user_id: user.id,
                    total,
                    shipping_address_json: JSON.stringify(shippingAddress),
                }, { returnRow: true });
                await tx.createMany(itemsByOrder.targetTable, cart.items.map((item) => ({
                    order_id: createdOrder.id,
                    book_id: item.bookId,
                    title: item.title,
                    unit_price: item.price,
                    quantity: item.quantity,
                })));
                let created = await tx.find(orders, createdOrder.id, {
                    with: { items: orderItemsWithBook },
                });
                if (!created) {
                    throw new Error('Failed to load created order');
                }
                return created;
            });
            session.set('cart', clearCart(cart));
            return redirect(routes.checkout.confirmation.href({ orderId: order.id }));
        },
        async confirmation({ db, params }) {
            let user = getCurrentUser();
            let orderId = parseId(params.orderId);
            let order = orderId === undefined
                ? undefined
                : await db.find(orders, orderId, {
                    with: { items: orderItemsWithBook },
                });
            if (!order || order.user_id !== user.id) {
                return render(_jsx(Layout, { children: _jsxs("div", { class: "card", children: [_jsx("h1", { children: "Order Not Found" }), _jsx("p", { children: _jsx("a", { href: routes.account.orders.index.href(), class: "btn", children: "View My Orders" }) })] }) }), { status: 404 });
            }
            return render(_jsxs(Layout, { children: [_jsxs("div", { class: "alert alert-success", children: [_jsx("h1", { mix: [css({ marginBottom: '0.5rem' })], children: "Order Confirmed!" }), _jsx("p", { children: "Thank you for your purchase. Your order has been placed successfully." })] }), _jsxs("div", { class: "card", children: [_jsxs("h2", { children: ["Order #", order.id] }), _jsxs("p", { children: [_jsx("strong", { children: "Order Date:" }), " ", new Date(order.created_at).toLocaleDateString()] }), _jsxs("p", { children: [_jsx("strong", { children: "Total:" }), " $", order.total.toFixed(2)] }), _jsxs("p", { children: [_jsx("strong", { children: "Status:" }), " ", _jsx("span", { class: "badge badge-info", children: order.status })] }), _jsx("p", { mix: [css({ marginTop: '2rem' })], children: "We'll send you a confirmation email shortly. You can track your order status in your account." }), _jsxs("div", { mix: [css({ marginTop: '2rem' })], children: [_jsx("a", { href: routes.account.orders.show.href({ orderId: order.id }), class: "btn", children: "View Order Details" }), _jsx("a", { href: routes.books.index.href(), class: "btn btn-secondary", mix: [css({ marginLeft: '0.5rem' })], children: "Continue Shopping" })] })] })] }));
        },
    },
};
