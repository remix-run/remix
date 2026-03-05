import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { redirect } from 'remix/response/redirect';
import { css } from 'remix/component';
import { routes } from './routes.js';
import { Layout } from './layout.js';
import { requireAuth } from './middleware/auth.js';
import { orders, orderItemsWithBook, users } from './data/schema.js';
import { getCurrentUser } from './utils/context.js';
import { parseId } from './utils/ids.js';
import { render } from './utils/render.js';
import { RestfulForm } from './components/restful-form.js';
export default {
    middleware: [requireAuth()],
    actions: {
        index() {
            let user = getCurrentUser();
            return render(_jsxs(Layout, { children: [_jsx("h1", { children: "My Account" }), _jsxs("div", { class: "card", children: [_jsx("h2", { children: "Account Information" }), _jsxs("p", { children: [_jsx("strong", { children: "Name:" }), " ", user.name] }), _jsxs("p", { children: [_jsx("strong", { children: "Email:" }), " ", user.email] }), _jsxs("p", { children: [_jsx("strong", { children: "Role:" }), " ", user.role] }), _jsxs("p", { children: [_jsx("strong", { children: "Member Since:" }), " ", new Date(user.created_at).toLocaleDateString()] }), _jsx("p", { mix: [css({ marginTop: '1.5rem' })], children: _jsx("a", { href: routes.account.settings.index.href(), class: "btn", children: "Edit Settings" }) })] }), _jsxs("div", { class: "card", mix: [css({ marginTop: '1.5rem' })], children: [_jsx("h2", { children: "Quick Links" }), _jsxs("p", { children: [_jsx("a", { href: routes.account.orders.index.href(), class: "btn btn-secondary", children: "View Orders" }), _jsx("a", { href: routes.books.index.href(), class: "btn btn-secondary", mix: [css({ marginLeft: '0.5rem' })], children: "Browse Books" })] })] })] }));
        },
        settings: {
            actions: {
                index() {
                    let user = getCurrentUser();
                    return render(_jsxs(Layout, { children: [_jsx("h1", { children: "Account Settings" }), _jsx("div", { class: "card", children: _jsxs(RestfulForm, { method: "PUT", action: routes.account.settings.update.href(), children: [_jsxs("div", { class: "form-group", children: [_jsx("label", { for: "name", children: "Name" }), _jsx("input", { type: "text", id: "name", name: "name", value: user.name, required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "email", children: "Email" }), _jsx("input", { type: "email", id: "email", name: "email", value: user.email, required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "password", children: "New Password (leave blank to keep current)" }), _jsx("input", { type: "password", id: "password", name: "password", autoComplete: "new-password" })] }), _jsx("button", { type: "submit", class: "btn", children: "Update Settings" }), _jsx("a", { href: routes.account.index.href(), class: "btn btn-secondary", mix: [css({ marginLeft: '0.5rem' })], children: "Cancel" })] }) })] }));
                },
                async update({ db, get }) {
                    let formData = get(FormData);
                    let user = getCurrentUser();
                    let name = formData.get('name')?.toString() ?? '';
                    let email = formData.get('email')?.toString() ?? '';
                    let password = formData.get('password')?.toString() ?? '';
                    let updateData = { name, email };
                    if (password) {
                        updateData.password = password;
                    }
                    await db.update(users, user.id, updateData);
                    return redirect(routes.account.index.href());
                },
            },
        },
        orders: {
            actions: {
                async index({ db }) {
                    let user = getCurrentUser();
                    let userOrders = await db.findMany(orders, {
                        where: { user_id: user.id },
                        orderBy: ['created_at', 'asc'],
                        with: { items: orderItemsWithBook },
                    });
                    return render(_jsxs(Layout, { children: [_jsx("h1", { children: "My Orders" }), _jsx("div", { class: "card", children: userOrders.length > 0 ? (_jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Order ID" }), _jsx("th", { children: "Date" }), _jsx("th", { children: "Items" }), _jsx("th", { children: "Total" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: userOrders.map((order) => (_jsxs("tr", { children: [_jsxs("td", { children: ["#", order.id] }), _jsx("td", { children: new Date(order.created_at).toLocaleDateString() }), _jsxs("td", { children: [order.items.length, " item(s)"] }), _jsxs("td", { children: ["$", order.total.toFixed(2)] }), _jsx("td", { children: _jsx("span", { class: "badge badge-info", children: order.status }) }), _jsx("td", { children: _jsx("a", { href: routes.account.orders.show.href({ orderId: order.id }), class: "btn btn-secondary", mix: [css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })], children: "View" }) })] }))) })] })) : (_jsx("p", { children: "You have no orders yet." })) }), _jsx("p", { mix: [css({ marginTop: '1.5rem' })], children: _jsx("a", { href: routes.account.index.href(), class: "btn btn-secondary", children: "Back to Account" }) })] }));
                },
                async show({ db, params }) {
                    let user = getCurrentUser();
                    let orderId = parseId(params.orderId);
                    let order = orderId === undefined
                        ? undefined
                        : await db.find(orders, orderId, {
                            with: { items: orderItemsWithBook },
                        });
                    if (!order || order.user_id !== user.id) {
                        return render(_jsx(Layout, { children: _jsxs("div", { class: "card", children: [_jsx("h1", { children: "Order Not Found" }), _jsx("p", { children: _jsx("a", { href: routes.account.orders.index.href(), class: "btn", children: "Back to Orders" }) })] }) }), { status: 404 });
                    }
                    let shippingAddress = JSON.parse(order.shipping_address_json);
                    return render(_jsxs(Layout, { children: [_jsxs("h1", { children: ["Order #", order.id] }), _jsxs("div", { class: "card", children: [_jsxs("p", { children: [_jsx("strong", { children: "Order Date:" }), " ", new Date(order.created_at).toLocaleDateString()] }), _jsxs("p", { children: [_jsx("strong", { children: "Status:" }), " ", _jsx("span", { class: "badge badge-info", children: order.status })] }), _jsx("h2", { mix: [css({ marginTop: '2rem' })], children: "Items" }), _jsxs("table", { mix: [css({ marginTop: '1rem' })], children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Book" }), _jsx("th", { children: "Quantity" }), _jsx("th", { children: "Price" }), _jsx("th", { children: "Subtotal" })] }) }), _jsx("tbody", { children: order.items.map((item) => (_jsxs("tr", { children: [_jsx("td", { children: item.title }), _jsx("td", { children: item.quantity }), _jsxs("td", { children: ["$", item.unit_price.toFixed(2)] }), _jsxs("td", { children: ["$", (item.unit_price * item.quantity).toFixed(2)] })] }))) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { colSpan: 3, mix: [css({ textAlign: 'right', fontWeight: 'bold' })], children: "Total:" }), _jsxs("td", { mix: [css({ fontWeight: 'bold' })], children: ["$", order.total.toFixed(2)] })] }) })] }), _jsx("h2", { mix: [css({ marginTop: '2rem' })], children: "Shipping Address" }), _jsx("p", { children: shippingAddress.street }), _jsxs("p", { children: [shippingAddress.city, ", ", shippingAddress.state, " ", shippingAddress.zip] })] }), _jsx("p", { mix: [css({ marginTop: '1.5rem' })], children: _jsx("a", { href: routes.account.orders.index.href(), class: "btn btn-secondary", children: "Back to Orders" }) })] }));
                },
            },
        },
    },
};
