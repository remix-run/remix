import { SetCookie, Cookie } from 'remix/headers';
/**
 * Extract a specific cookie value from Set-Cookie headers
 */
export function getCookie(response, name) {
    let setCookieHeaders = response.headers.getSetCookie();
    for (let header of setCookieHeaders) {
        let setCookie = new SetCookie(header);
        if (setCookie.name === name) {
            return setCookie.value ?? null;
        }
    }
    return null;
}
/**
 * Extract session cookie from Set-Cookie headers
 */
export function getSessionCookie(response) {
    return getCookie(response, 'session');
}
/**
 * Create a request with a session cookie
 */
export function requestWithSession(url, sessionCookie, init) {
    let cookie = new Cookie({ session: sessionCookie });
    return new Request(url, {
        ...init,
        headers: {
            ...init?.headers,
            Cookie: cookie.toString(),
        },
    });
}
/**
 * Assert that HTML contains a substring
 */
export function assertContains(html, text) {
    if (!html.includes(text)) {
        throw new Error(`Expected HTML to contain "${text}"`);
    }
}
/**
 * Assert that HTML does not contain a substring
 */
export function assertNotContains(html, text) {
    if (html.includes(text)) {
        throw new Error(`Expected HTML to not contain "${text}"`);
    }
}
/**
 * Login and return the session cookie
 */
export async function login(router, email, password) {
    let loginResponse = await router.fetch('https://remix.run/login', {
        method: 'POST',
        body: new URLSearchParams({ email, password }),
        redirect: 'manual',
    });
    let sessionId = getSessionCookie(loginResponse);
    if (!sessionId) {
        throw new Error('Failed to get session cookie from login response');
    }
    return sessionId;
}
/**
 * Login as admin and return the session cookie
 */
export function loginAsAdmin(router) {
    return login(router, 'admin@bookstore.com', 'admin123');
}
/**
 * Login as customer and return the session cookie
 */
export function loginAsCustomer(router) {
    return login(router, 'customer@example.com', 'password123');
}
