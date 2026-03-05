import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { css } from 'remix/component';
import { routes } from './routes.js';
import { orders, orderItemsWithBook } from './data/schema.js';
import { Layout } from './layout.js';
import { parseId } from './utils/ids.js';
import { render } from './utils/render.js';
export default {
    actions: {
        async index({ db }) {
            let allOrders = await db.findMany(orders, {
                orderBy: ['created_at', 'asc'],
                with: { items: orderItemsWithBook },
            });
            return render(_jsxs(Layout, { children: [_jsx("h1", { children: "Manage Orders" }), _jsx("p", { mix: [css({ marginBottom: '1rem' })], children: _jsx("a", { href: routes.admin.index.href(), class: "btn btn-secondary", children: "Back to Dashboard" }) }), _jsx("div", { class: "card", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Order ID" }), _jsx("th", { children: "Date" }), _jsx("th", { children: "Items" }), _jsx("th", { children: "Total" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: allOrders.map((order) => (_jsxs("tr", { children: [_jsxs("td", { children: ["#", order.id] }), _jsx("td", { children: new Date(order.created_at).toLocaleDateString() }), _jsxs("td", { children: [order.items.length, " item(s)"] }), _jsxs("td", { children: ["$", order.total.toFixed(2)] }), _jsx("td", { children: _jsx("span", { class: "badge badge-info", children: order.status }) }), _jsx("td", { children: _jsx("a", { href: routes.admin.orders.show.href({ orderId: order.id }), class: "btn btn-secondary", mix: [css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })], children: "View" }) })] }))) })] }) })] }));
        },
        async show({ db, params }) {
            let orderId = parseId(params.orderId);
            let order = orderId === undefined
                ? undefined
                : await db.find(orders, orderId, {
                    with: { items: orderItemsWithBook },
                });
            if (!order) {
                return render(_jsx(Layout, { children: _jsx("div", { class: "card", children: _jsx("h1", { children: "Order Not Found" }) }) }), { status: 404 });
            }
            let shippingAddress = JSON.parse(order.shipping_address_json);
            return render(_jsxs(Layout, { children: [_jsxs("h1", { children: ["Order #", order.id] }), _jsxs("div", { class: "card", children: [_jsxs("p", { children: [_jsx("strong", { children: "Order Date:" }), " ", new Date(order.created_at).toLocaleDateString()] }), _jsxs("p", { children: [_jsx("strong", { children: "User ID:" }), " ", order.user_id] }), _jsxs("p", { children: [_jsx("strong", { children: "Status:" }), " ", _jsx("span", { class: "badge badge-info", children: order.status })] }), _jsx("h2", { mix: [css({ marginTop: '2rem' })], children: "Items" }), _jsxs("table", { mix: [css({ marginTop: '1rem' })], children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Book" }), _jsx("th", { children: "Quantity" }), _jsx("th", { children: "Price" }), _jsx("th", { children: "Subtotal" })] }) }), _jsx("tbody", { children: order.items.map((item) => (_jsxs("tr", { children: [_jsx("td", { children: item.title }), _jsx("td", { children: item.quantity }), _jsxs("td", { children: ["$", item.unit_price.toFixed(2)] }), _jsxs("td", { children: ["$", (item.unit_price * item.quantity).toFixed(2)] })] }))) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { colSpan: 3, mix: [css({ textAlign: 'right', fontWeight: 'bold' })], children: "Total:" }), _jsxs("td", { mix: [css({ fontWeight: 'bold' })], children: ["$", order.total.toFixed(2)] })] }) })] }), _jsx("h2", { mix: [css({ marginTop: '2rem' })], children: "Shipping Address" }), _jsx("p", { children: shippingAddress.street }), _jsxs("p", { children: [shippingAddress.city, ", ", shippingAddress.state, " ", shippingAddress.zip] })] }), _jsx("p", { mix: [css({ marginTop: '1.5rem' })], children: _jsx("a", { href: routes.admin.orders.index.href(), class: "btn btn-secondary", children: "Back to Orders" }) })] }));
        },
    },
};
