import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { redirect } from 'remix/response/redirect';
import { css } from 'remix/component';
import { routes } from './routes.js';
import { users } from './data/schema.js';
import { Layout } from './layout.js';
import { render } from './utils/render.js';
import { getCurrentUser } from './utils/context.js';
import { parseId } from './utils/ids.js';
import { RestfulForm } from './components/restful-form.js';
export default {
    actions: {
        async index({ db }) {
            let user = getCurrentUser();
            let allUsers = await db.findMany(users, { orderBy: ['id', 'asc'] });
            return render(_jsxs(Layout, { children: [_jsx("h1", { children: "Manage Users" }), _jsx("p", { mix: [css({ marginBottom: '1rem' })], children: _jsx("a", { href: routes.admin.index.href(), class: "btn btn-secondary", children: "Back to Dashboard" }) }), _jsx("div", { class: "card", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Name" }), _jsx("th", { children: "Email" }), _jsx("th", { children: "Role" }), _jsx("th", { children: "Created" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: allUsers.map((u) => (_jsxs("tr", { children: [_jsx("td", { children: u.name }), _jsx("td", { children: u.email }), _jsx("td", { children: _jsx("span", { class: `badge ${u.role === 'admin' ? 'badge-info' : 'badge-success'}`, children: u.role }) }), _jsx("td", { children: new Date(u.created_at).toLocaleDateString() }), _jsxs("td", { class: "actions", children: [_jsx("a", { href: routes.admin.users.edit.href({ userId: u.id }), class: "btn btn-secondary", mix: [css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })], children: "Edit" }), u.id !== user.id ? (_jsx(RestfulForm, { method: "DELETE", action: routes.admin.users.destroy.href({ userId: u.id }), mix: [css({ display: 'inline' })], children: _jsx("button", { type: "submit", class: "btn btn-danger", mix: [css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })], children: "Delete" }) })) : null] })] }))) })] }) })] }));
        },
        async show({ db, params }) {
            let userId = parseId(params.userId);
            let targetUser = userId === undefined ? undefined : await db.find(users, userId);
            if (!targetUser) {
                return render(_jsx(Layout, { children: _jsx("div", { class: "card", children: _jsx("h1", { children: "User Not Found" }) }) }), { status: 404 });
            }
            return render(_jsxs(Layout, { children: [_jsx("h1", { children: "User Details" }), _jsxs("div", { class: "card", children: [_jsxs("p", { children: [_jsx("strong", { children: "Name:" }), " ", targetUser.name] }), _jsxs("p", { children: [_jsx("strong", { children: "Email:" }), " ", targetUser.email] }), _jsxs("p", { children: [_jsx("strong", { children: "Role:" }), ' ', _jsx("span", { class: `badge ${targetUser.role === 'admin' ? 'badge-info' : 'badge-success'}`, children: targetUser.role })] }), _jsxs("p", { children: [_jsx("strong", { children: "Created:" }), " ", new Date(targetUser.created_at).toLocaleDateString()] }), _jsxs("div", { mix: [css({ marginTop: '2rem' })], children: [_jsx("a", { href: routes.admin.users.edit.href({ userId: targetUser.id }), class: "btn", children: "Edit" }), _jsx("a", { href: routes.admin.users.index.href(), class: "btn btn-secondary", mix: [css({ marginLeft: '0.5rem' })], children: "Back to List" })] })] })] }));
        },
        async edit({ db, params }) {
            let userId = parseId(params.userId);
            let targetUser = userId === undefined ? undefined : await db.find(users, userId);
            if (!targetUser) {
                return render(_jsx(Layout, { children: _jsx("div", { class: "card", children: _jsx("h1", { children: "User Not Found" }) }) }), { status: 404 });
            }
            return render(_jsxs(Layout, { children: [_jsx("h1", { children: "Edit User" }), _jsx("div", { class: "card", children: _jsxs(RestfulForm, { method: "PUT", action: routes.admin.users.update.href({ userId: targetUser.id }), children: [_jsxs("div", { class: "form-group", children: [_jsx("label", { for: "name", children: "Name" }), _jsx("input", { type: "text", id: "name", name: "name", value: targetUser.name, required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "email", children: "Email" }), _jsx("input", { type: "email", id: "email", name: "email", value: targetUser.email, required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "role", children: "Role" }), _jsxs("select", { id: "role", name: "role", children: [_jsx("option", { value: "customer", selected: targetUser.role === 'customer', children: "Customer" }), _jsx("option", { value: "admin", selected: targetUser.role === 'admin', children: "Admin" })] })] }), _jsx("button", { type: "submit", class: "btn", children: "Update User" }), _jsx("a", { href: routes.admin.users.index.href(), class: "btn btn-secondary", mix: [css({ marginLeft: '0.5rem' })], children: "Cancel" })] }) })] }));
        },
        async update({ db, get, params }) {
            let formData = get(FormData);
            let userId = parseId(params.userId);
            let targetUser = userId === undefined ? undefined : await db.find(users, userId);
            if (targetUser) {
                await db.update(users, targetUser.id, {
                    name: formData.get('name')?.toString() ?? '',
                    email: formData.get('email')?.toString() ?? '',
                    role: (formData.get('role')?.toString() ?? 'customer'),
                });
            }
            return redirect(routes.admin.users.index.href());
        },
        async destroy({ db, params }) {
            let userId = parseId(params.userId);
            let targetUser = userId === undefined ? undefined : await db.find(users, userId);
            if (targetUser) {
                await db.delete(users, targetUser.id);
            }
            return redirect(routes.admin.users.index.href());
        },
    },
};
