import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { redirect } from 'remix/response/redirect';
import { css } from 'remix/component';
import { routes } from './routes.js';
import { passwordResetTokens, users } from './data/schema.js';
import { Document } from './layout.js';
import { loadAuth } from './middleware/auth.js';
import { render } from './utils/render.js';
import { Session } from './utils/session.js';
export default {
    middleware: [loadAuth()],
    actions: {
        login: {
            actions: {
                index({ get, url }) {
                    let session = get(Session);
                    let error = session.get('error');
                    let formAction = routes.auth.login.action.href(undefined, {
                        returnTo: url.searchParams.get('returnTo'),
                    });
                    return render(_jsx(Document, { children: _jsxs("div", { class: "card", mix: [css({ maxWidth: '500px', margin: '2rem auto' })], children: [_jsx("h1", { children: "Login" }), typeof error === 'string' ? (_jsx("div", { class: "alert alert-error", mix: [css({ marginBottom: '1.5rem' })], children: error })) : null, _jsxs("form", { method: "POST", action: formAction, children: [_jsxs("div", { class: "form-group", children: [_jsx("label", { for: "email", children: "Email" }), _jsx("input", { type: "email", id: "email", name: "email", required: true, autoComplete: "email" })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "password", children: "Password" }), _jsx("input", { type: "password", id: "password", name: "password", required: true, autoComplete: "current-password" })] }), _jsx("button", { type: "submit", class: "btn", children: "Login" })] }), _jsxs("p", { mix: [css({ marginTop: '1.5rem' })], children: ["Don't have an account?", ' ', _jsx("a", { href: routes.auth.register.index.href(), children: "Register here" })] }), _jsx("p", { children: _jsx("a", { href: routes.auth.forgotPassword.index.href(), children: "Forgot password?" }) }), _jsxs("div", { mix: [
                                        css({
                                            marginTop: '2rem',
                                            padding: '1rem',
                                            background: '#f8f9fa',
                                            borderRadius: '4px',
                                        }),
                                    ], children: [_jsx("p", { mix: [css({ fontSize: '0.9rem' })], children: _jsx("strong", { children: "Demo Accounts:" }) }), _jsx("p", { mix: [css({ fontSize: '0.9rem' })], children: "Admin: admin@bookstore.com / admin123" }), _jsx("p", { mix: [css({ fontSize: '0.9rem' })], children: "Customer: customer@example.com / password123" })] })] }) }));
                },
                async action({ db, get, url }) {
                    let session = get(Session);
                    let formData = get(FormData);
                    let email = formData.get('email')?.toString() ?? '';
                    let password = formData.get('password')?.toString() ?? '';
                    let returnTo = url.searchParams.get('returnTo');
                    let user = await db.findOne(users, { where: { email: normalizeEmail(email) } });
                    if (!user || user.password !== password) {
                        session.flash('error', 'Invalid email or password. Please try again.');
                        return redirect(routes.auth.login.index.href(undefined, { returnTo }));
                    }
                    session.regenerateId(true);
                    session.set('userId', user.id);
                    return redirect(returnTo ?? routes.account.index.href());
                },
            },
        },
        register: {
            actions: {
                index() {
                    return render(_jsx(Document, { children: _jsxs("div", { class: "card", mix: [css({ maxWidth: '500px', margin: '2rem auto' })], children: [_jsx("h1", { children: "Register" }), _jsxs("form", { method: "POST", action: routes.auth.register.action.href(), children: [_jsxs("div", { class: "form-group", children: [_jsx("label", { for: "name", children: "Name" }), _jsx("input", { type: "text", id: "name", name: "name", required: true, autoComplete: "name" })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "email", children: "Email" }), _jsx("input", { type: "email", id: "email", name: "email", required: true, autoComplete: "email" })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "password", children: "Password" }), _jsx("input", { type: "password", id: "password", name: "password", required: true, autoComplete: "new-password" })] }), _jsx("button", { type: "submit", class: "btn", children: "Register" })] }), _jsxs("p", { mix: [css({ marginTop: '1.5rem' })], children: ["Already have an account? ", _jsx("a", { href: routes.auth.login.index.href(), children: "Login here" })] })] }) }));
                },
                async action({ db, get }) {
                    let session = get(Session);
                    let formData = get(FormData);
                    let name = formData.get('name')?.toString() ?? '';
                    let email = formData.get('email')?.toString() ?? '';
                    let password = formData.get('password')?.toString() ?? '';
                    // Check if user already exists
                    if (await db.findOne(users, { where: { email: normalizeEmail(email) } })) {
                        return render(_jsx(Document, { children: _jsxs("div", { class: "card", mix: [css({ maxWidth: '500px', margin: '2rem auto' })], children: [_jsx("div", { class: "alert alert-error", children: "An account with this email already exists." }), _jsxs("p", { children: [_jsx("a", { href: routes.auth.register.index.href(), class: "btn", children: "Back to Register" }), _jsx("a", { href: routes.auth.login.index.href(), class: "btn btn-secondary", mix: [css({ marginLeft: '0.5rem' })], children: "Login" })] })] }) }), { status: 400 });
                    }
                    let user = await db.create(users, {
                        email,
                        password,
                        name,
                    }, { returnRow: true });
                    session.set('userId', user.id);
                    return redirect(routes.account.index.href());
                },
            },
        },
        logout({ get }) {
            let session = get(Session);
            session.destroy();
            return redirect(routes.home.href());
        },
        forgotPassword: {
            actions: {
                index() {
                    return render(_jsx(Document, { children: _jsxs("div", { class: "card", mix: [css({ maxWidth: '500px', margin: '2rem auto' })], children: [_jsx("h1", { children: "Forgot Password" }), _jsx("p", { children: "Enter your email address and we'll send you a link to reset your password." }), _jsxs("form", { method: "POST", action: routes.auth.forgotPassword.action.href(), children: [_jsxs("div", { class: "form-group", children: [_jsx("label", { for: "email", children: "Email" }), _jsx("input", { type: "email", id: "email", name: "email", required: true, autoComplete: "email" })] }), _jsx("button", { type: "submit", class: "btn", children: "Send Reset Link" })] }), _jsx("p", { mix: [css({ marginTop: '1.5rem' })], children: _jsx("a", { href: routes.auth.login.index.href(), children: "Back to Login" }) })] }) }));
                },
                async action({ db, get }) {
                    let formData = get(FormData);
                    let email = formData.get('email')?.toString() ?? '';
                    let user = await db.findOne(users, { where: { email: normalizeEmail(email) } });
                    let token = undefined;
                    if (user) {
                        token = Math.random().toString(36).substring(2, 15);
                        await db.create(passwordResetTokens, {
                            token,
                            user_id: user.id,
                            expires_at: Date.now() + 3600000,
                        });
                    }
                    return render(_jsx(Document, { children: _jsxs("div", { class: "card", mix: [css({ maxWidth: '500px', margin: '2rem auto' })], children: [_jsx("div", { class: "alert alert-success", children: "Password reset link sent! Check your email." }), token ? (_jsxs("div", { mix: [
                                        css({
                                            marginTop: '1rem',
                                            padding: '1rem',
                                            background: '#f8f9fa',
                                            borderRadius: '4px',
                                        }),
                                    ], children: [_jsxs("p", { mix: [css({ fontSize: '0.9rem' })], children: [_jsx("strong", { children: "Demo Mode:" }), " Click the link below to reset your password"] }), _jsx("p", { mix: [css({ marginTop: '0.5rem' })], children: _jsx("a", { href: routes.auth.resetPassword.index.href({ token }), class: "btn btn-secondary", children: "Reset Password" }) })] })) : null, _jsx("p", { mix: [css({ marginTop: '1.5rem' })], children: _jsx("a", { href: routes.auth.login.index.href(), class: "btn", children: "Back to Login" }) })] }) }));
                },
            },
        },
        resetPassword: {
            actions: {
                index({ params, get }) {
                    let session = get(Session);
                    let token = params.token;
                    let error = session.get('error');
                    return render(_jsx(Document, { children: _jsxs("div", { class: "card", mix: [css({ maxWidth: '500px', margin: '2rem auto' })], children: [_jsx("h1", { children: "Reset Password" }), _jsx("p", { children: "Enter your new password below." }), typeof error === 'string' ? (_jsx("div", { class: "alert alert-error", mix: [css({ marginBottom: '1.5rem' })], children: error })) : null, _jsxs("form", { method: "POST", action: routes.auth.resetPassword.action.href({ token }), children: [_jsxs("div", { class: "form-group", children: [_jsx("label", { for: "password", children: "New Password" }), _jsx("input", { type: "password", id: "password", name: "password", required: true, autoComplete: "new-password" })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "confirmPassword", children: "Confirm Password" }), _jsx("input", { type: "password", id: "confirmPassword", name: "confirmPassword", required: true, autoComplete: "new-password" })] }), _jsx("button", { type: "submit", class: "btn", children: "Reset Password" })] })] }) }));
                },
                async action({ db, get, params }) {
                    let session = get(Session);
                    let formData = get(FormData);
                    let password = formData.get('password')?.toString() ?? '';
                    let confirmPassword = formData.get('confirmPassword')?.toString() ?? '';
                    let token = params.token;
                    if (!token) {
                        session.flash('error', 'Invalid or expired reset token.');
                        return redirect(routes.auth.forgotPassword.index.href());
                    }
                    if (password !== confirmPassword) {
                        session.flash('error', 'Passwords do not match.');
                        return redirect(routes.auth.resetPassword.index.href({ token }));
                    }
                    let tokenData = await db.find(passwordResetTokens, { token });
                    if (!tokenData || tokenData.expires_at < Date.now()) {
                        session.flash('error', 'Invalid or expired reset token.');
                        return redirect(routes.auth.resetPassword.index.href({ token }));
                    }
                    let user = await db.find(users, tokenData.user_id);
                    if (!user) {
                        session.flash('error', 'Invalid or expired reset token.');
                        return redirect(routes.auth.resetPassword.index.href({ token }));
                    }
                    await db.update(users, user.id, { password });
                    await db.delete(passwordResetTokens, { token });
                    return render(_jsx(Document, { children: _jsxs("div", { class: "card", mix: [css({ maxWidth: '500px', margin: '2rem auto' })], children: [_jsx("div", { class: "alert alert-success", children: "Password reset successfully! You can now login with your new password." }), _jsx("p", { children: _jsx("a", { href: routes.auth.login.index.href(), class: "btn", children: "Login" }) })] }) }));
                },
            },
        },
    },
};
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
