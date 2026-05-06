import { Accept } from "./accept.js";
import { AcceptEncoding } from "./accept-encoding.js";
import { AcceptLanguage } from "./accept-language.js";
import { CacheControl } from "./cache-control.js";
import { ContentDisposition } from "./content-disposition.js";
import { ContentRange } from "./content-range.js";
import { ContentType } from "./content-type.js";
import { Cookie } from "./cookie.js";
import {} from "./header-value.js";
import { IfMatch } from "./if-match.js";
import { IfNoneMatch } from "./if-none-match.js";
import { IfRange } from "./if-range.js";
import { Range } from "./range.js";
import { SetCookie } from "./set-cookie.js";
import { Vary } from "./vary.js";
import { isIterable, quoteEtag } from "./utils.js";
const SetCookieKey = 'set-cookie';
const ArrayMutatingMethods = new Set([
    'copyWithin',
    'fill',
    'pop',
    'push',
    'reverse',
    'shift',
    'sort',
    'splice',
    'unshift',
]);
const ObjectHeaderDescriptors = [
    objectHeader('accept', 'Accept', (value) => Accept.from(value), [
        'clear',
        'delete',
        'set',
    ]),
    objectHeader('acceptEncoding', 'Accept-Encoding', (value) => AcceptEncoding.from(value), ['clear', 'delete', 'set']),
    objectHeader('acceptLanguage', 'Accept-Language', (value) => AcceptLanguage.from(value), ['clear', 'delete', 'set']),
    objectHeader('cacheControl', 'Cache-Control', (value) => CacheControl.from(value)),
    objectHeader('contentDisposition', 'Content-Disposition', (value) => ContentDisposition.from(value)),
    objectHeader('contentRange', 'Content-Range', (value) => ContentRange.from(value)),
    objectHeader('contentType', 'Content-Type', (value) => ContentType.from(value)),
    objectHeader('cookie', 'Cookie', (value) => Cookie.from(value), [
        'clear',
        'delete',
        'set',
    ]),
    objectHeader('ifMatch', 'If-Match', (value) => IfMatch.from(value)),
    objectHeader('ifNoneMatch', 'If-None-Match', (value) => IfNoneMatch.from(value)),
    objectHeader('ifRange', 'If-Range', (value) => IfRange.from(value)),
    objectHeader('range', 'Range', (value) => Range.from(value)),
    objectHeader('vary', 'Vary', (value) => Vary.from(value), [
        'add',
        'clear',
        'delete',
    ]),
];
const StringHeaderDescriptors = [
    stringHeader('acceptCharset', 'Accept-Charset', true),
    stringHeader('acceptPatch', 'Accept-Patch', true),
    stringHeader('acceptPost', 'Accept-Post', true),
    stringHeader('acceptRanges', 'Accept-Ranges', true),
    stringHeader('accessControlAllowCredentials', 'Access-Control-Allow-Credentials'),
    stringHeader('accessControlAllowHeaders', 'Access-Control-Allow-Headers', true),
    stringHeader('accessControlAllowMethods', 'Access-Control-Allow-Methods', true),
    stringHeader('accessControlAllowOrigin', 'Access-Control-Allow-Origin'),
    stringHeader('accessControlExposeHeaders', 'Access-Control-Expose-Headers', true),
    stringHeader('accessControlRequestHeaders', 'Access-Control-Request-Headers', true),
    stringHeader('accessControlRequestMethod', 'Access-Control-Request-Method'),
    stringHeader('allow', 'Allow', true),
    stringHeader('authorization', 'Authorization'),
    stringHeader('connection', 'Connection', true),
    stringHeader('contentEncoding', 'Content-Encoding', true),
    stringHeader('contentLanguage', 'Content-Language', true),
    stringHeader('contentLocation', 'Content-Location'),
    stringHeader('contentSecurityPolicy', 'Content-Security-Policy'),
    stringHeader('contentSecurityPolicyReportOnly', 'Content-Security-Policy-Report-Only'),
    stringHeader('crossOriginEmbedderPolicy', 'Cross-Origin-Embedder-Policy'),
    stringHeader('crossOriginEmbedderPolicyReportOnly', 'Cross-Origin-Embedder-Policy-Report-Only'),
    stringHeader('crossOriginOpenerPolicy', 'Cross-Origin-Opener-Policy'),
    stringHeader('crossOriginOpenerPolicyReportOnly', 'Cross-Origin-Opener-Policy-Report-Only'),
    stringHeader('crossOriginResourcePolicy', 'Cross-Origin-Resource-Policy'),
    stringHeader('etag', 'ETag', false, quoteEtag),
    stringHeader('expect', 'Expect'),
    stringHeader('forwarded', 'Forwarded'),
    stringHeader('from', 'From'),
    stringHeader('host', 'Host'),
    stringHeader('idempotencyKey', 'Idempotency-Key'),
    stringHeader('keepAlive', 'Keep-Alive'),
    stringHeader('link', 'Link', true),
    stringHeader('location', 'Location'),
    stringHeader('origin', 'Origin'),
    stringHeader('permissionsPolicy', 'Permissions-Policy', true),
    stringHeader('pragma', 'Pragma', true),
    stringHeader('prefer', 'Prefer', true),
    stringHeader('preferenceApplied', 'Preference-Applied', true),
    stringHeader('referer', 'Referer'),
    stringHeader('referrerPolicy', 'Referrer-Policy'),
    stringHeader('refresh', 'Refresh'),
    stringHeader('retryAfter', 'Retry-After'),
    stringHeader('server', 'Server'),
    stringHeader('strictTransportSecurity', 'Strict-Transport-Security'),
    stringHeader('traceparent', 'Traceparent'),
    stringHeader('tracestate', 'Tracestate', true),
    stringHeader('userAgent', 'User-Agent'),
    stringHeader('via', 'Via', true),
    stringHeader('wwwAuthenticate', 'WWW-Authenticate', true),
    stringHeader('xContentTypeOptions', 'X-Content-Type-Options'),
    stringHeader('xForwardedFor', 'X-Forwarded-For', true),
    stringHeader('xForwardedHost', 'X-Forwarded-Host'),
    stringHeader('xForwardedProto', 'X-Forwarded-Proto'),
    stringHeader('xFrameOptions', 'X-Frame-Options'),
    stringHeader('xPoweredBy', 'X-Powered-By'),
    stringHeader('xRobotsTag', 'X-Robots-Tag', true),
];
const NumberHeaderDescriptors = [
    numberHeader('accessControlMaxAge', 'Access-Control-Max-Age'),
    numberHeader('age', 'Age'),
    numberHeader('contentLength', 'Content-Length'),
    numberHeader('maxForwards', 'Max-Forwards'),
    numberHeader('upgradeInsecureRequests', 'Upgrade-Insecure-Requests'),
];
const DateHeaderDescriptors = [
    dateHeader('date', 'Date'),
    dateHeader('expires', 'Expires'),
    dateHeader('ifModifiedSince', 'If-Modified-Since'),
    dateHeader('ifUnmodifiedSince', 'If-Unmodified-Since'),
    dateHeader('lastModified', 'Last-Modified'),
];
const SetCookieHeaderDescriptor = {
    kind: 'set-cookie',
    property: 'setCookie',
    name: 'Set-Cookie',
};
const HeaderDescriptors = [
    ...ObjectHeaderDescriptors,
    ...StringHeaderDescriptors,
    ...NumberHeaderDescriptors,
    ...DateHeaderDescriptors,
    SetCookieHeaderDescriptor,
];
const HeaderDescriptorByProperty = new Map(HeaderDescriptors.map((descriptor) => [descriptor.property, descriptor]));
/**
 * An enhanced JavaScript `Headers` interface with lazy, type-safe property accessors.
 */
export class SuperHeaders extends Headers {
    #cache = new Map();
    #revisions = new Map();
    #setCookieCache;
    constructor(init) {
        super();
        if (init !== undefined) {
            this.#initialize(init);
        }
    }
    append(name, value) {
        Headers.prototype.append.call(this, name, value);
        this.#invalidate(name);
    }
    delete(name) {
        Headers.prototype.delete.call(this, name);
        this.#invalidate(name);
    }
    set(name, value) {
        Headers.prototype.set.call(this, name, value);
        this.#invalidate(name);
    }
    #initialize(init) {
        if (typeof init === 'string') {
            throw new TypeError('SuperHeaders does not parse raw header strings; use parse() instead');
        }
        if (isIterable(init)) {
            for (let [name, value] of init) {
                Headers.prototype.append.call(this, name, value);
            }
            return;
        }
        for (let name of Object.getOwnPropertyNames(init)) {
            let value = init[name];
            let descriptor = HeaderDescriptorByProperty.get(name);
            if (descriptor) {
                this.#setHeaderDescriptorValue(descriptor, value);
            }
            else if (value != null) {
                Headers.prototype.set.call(this, name, String(value));
            }
        }
    }
    #getHeaderDescriptorValue(descriptor) {
        switch (descriptor.kind) {
            case 'object':
                return this.#getObjectHeaderValue(descriptor);
            case 'string':
                return this.#getStringHeaderValue(descriptor);
            case 'number':
                return this.#getNumberHeaderValue(descriptor);
            case 'date':
                return this.#getDateHeaderValue(descriptor);
            case 'set-cookie':
                return this.#getSetCookieHeaderValue();
        }
    }
    #setHeaderDescriptorValue(descriptor, value) {
        switch (descriptor.kind) {
            case 'object':
                this.#setObjectHeaderValue(descriptor, value);
                break;
            case 'string':
                this.#setStringHeaderValue(descriptor, value);
                break;
            case 'number':
                this.#setNumberHeaderValue(descriptor, value);
                break;
            case 'date':
                this.#setDateHeaderValue(descriptor, value);
                break;
            case 'set-cookie':
                this.#setSetCookieHeaderValue(value);
                break;
        }
    }
    #getObjectHeaderValue(descriptor) {
        let key = descriptor.name.toLowerCase();
        let raw = Headers.prototype.get.call(this, descriptor.name);
        let revision = this.#getRevision(key);
        let cached = this.#cache.get(key);
        if (cached && cached.raw === raw && cached.revision === revision) {
            return cached.value;
        }
        let value = descriptor.from(raw);
        let observed = observeMutations(value, descriptor.mutatingMethods, () => {
            this.#syncObjectHeaderValue(descriptor, value, revision);
        });
        this.#cache.set(key, {
            raw,
            revision,
            value: observed,
        });
        return observed;
    }
    #setObjectHeaderValue(descriptor, value) {
        if (value == null) {
            Headers.prototype.delete.call(this, descriptor.name);
        }
        else if (typeof value === 'string') {
            Headers.prototype.set.call(this, descriptor.name, value);
        }
        else {
            let headerValue = descriptor.from(value);
            let stringValue = headerValue.toString();
            if (stringValue === '') {
                Headers.prototype.delete.call(this, descriptor.name);
            }
            else {
                Headers.prototype.set.call(this, descriptor.name, stringValue);
            }
        }
        this.#invalidate(descriptor.name);
    }
    #syncObjectHeaderValue(descriptor, value, revision) {
        let key = descriptor.name.toLowerCase();
        if (this.#getRevision(key) !== revision)
            return;
        let stringValue = value.toString();
        if (stringValue === '') {
            Headers.prototype.delete.call(this, descriptor.name);
        }
        else {
            Headers.prototype.set.call(this, descriptor.name, stringValue);
        }
        let cached = this.#cache.get(key);
        if (cached?.revision === revision) {
            cached.raw = Headers.prototype.get.call(this, descriptor.name);
        }
    }
    #getStringHeaderValue(descriptor) {
        return Headers.prototype.get.call(this, descriptor.name);
    }
    #setStringHeaderValue(descriptor, value) {
        if (value == null) {
            Headers.prototype.delete.call(this, descriptor.name);
        }
        else {
            let stringValue = descriptor.list && Array.isArray(value) ? value.map(String).join(', ') : String(value);
            Headers.prototype.set.call(this, descriptor.name, descriptor.transform ? descriptor.transform(stringValue) : stringValue);
        }
        this.#invalidate(descriptor.name);
    }
    #getNumberHeaderValue(descriptor) {
        let value = Headers.prototype.get.call(this, descriptor.name);
        return value === null ? null : parseInt(value, 10);
    }
    #setNumberHeaderValue(descriptor, value) {
        if (value == null) {
            Headers.prototype.delete.call(this, descriptor.name);
        }
        else {
            Headers.prototype.set.call(this, descriptor.name, String(value));
        }
        this.#invalidate(descriptor.name);
    }
    #getDateHeaderValue(descriptor) {
        let value = Headers.prototype.get.call(this, descriptor.name);
        return value === null ? null : new Date(value);
    }
    #setDateHeaderValue(descriptor, value) {
        if (value == null) {
            Headers.prototype.delete.call(this, descriptor.name);
        }
        else if (typeof value === 'string') {
            Headers.prototype.set.call(this, descriptor.name, value);
        }
        else {
            let date = typeof value === 'number' ? new Date(value) : value;
            if (!(date instanceof Date)) {
                throw new TypeError(`${descriptor.property} must be a string, number, Date, null, or undefined`);
            }
            Headers.prototype.set.call(this, descriptor.name, date.toUTCString());
        }
        this.#invalidate(descriptor.name);
    }
    #getSetCookieHeaderValue() {
        let raw = getNativeSetCookie(this);
        let revision = this.#getRevision(SetCookieKey);
        let cached = this.#setCookieCache;
        if (cached && cached.revision === revision && arraysEqual(cached.raw, raw)) {
            return cached.value;
        }
        let values = raw.map((value) => SetCookie.from(value));
        let observed = observeMutations(values, new Set(), () => {
            this.#syncSetCookieHeaderValue(values, revision);
        });
        this.#setCookieCache = {
            raw,
            revision,
            value: observed,
        };
        return observed;
    }
    #setSetCookieHeaderValue(value) {
        if (value == null) {
            Headers.prototype.delete.call(this, SetCookieHeaderDescriptor.name);
        }
        else {
            let values = Array.isArray(value) ? value : [value];
            this.#replaceNativeSetCookie(values.map(stringifySetCookieValue));
        }
        this.#invalidate(SetCookieHeaderDescriptor.name);
    }
    #syncSetCookieHeaderValue(values, revision) {
        if (this.#getRevision(SetCookieKey) !== revision)
            return;
        normalizeSetCookieValues(values);
        this.#replaceNativeSetCookie(values.map(stringifySetCookieValue));
        if (this.#setCookieCache?.revision === revision) {
            this.#setCookieCache.raw = getNativeSetCookie(this);
        }
    }
    #replaceNativeSetCookie(values) {
        Headers.prototype.delete.call(this, SetCookieHeaderDescriptor.name);
        for (let value of values) {
            if (value !== '') {
                Headers.prototype.append.call(this, SetCookieHeaderDescriptor.name, value);
            }
        }
    }
    #invalidate(name) {
        let key = name.toLowerCase();
        this.#revisions.set(key, this.#getRevision(key) + 1);
        this.#cache.delete(key);
        if (key === SetCookieKey) {
            this.#setCookieCache = undefined;
        }
    }
    #getRevision(key) {
        return this.#revisions.get(key) ?? 0;
    }
    static {
        for (let descriptor of HeaderDescriptors) {
            Object.defineProperty(this.prototype, descriptor.property, {
                configurable: true,
                get() {
                    return this.#getHeaderDescriptorValue(descriptor);
                },
                set(value) {
                    this.#setHeaderDescriptorValue(descriptor, value);
                },
            });
        }
    }
}
function objectHeader(property, name, from, mutatingMethods = []) {
    return {
        kind: 'object',
        property,
        name,
        from(value) {
            return from(value);
        },
        mutatingMethods: new Set(mutatingMethods),
    };
}
function stringHeader(property, name, list = false, transform) {
    return {
        kind: 'string',
        property,
        name,
        list,
        transform,
    };
}
function numberHeader(property, name) {
    return {
        kind: 'number',
        property,
        name,
    };
}
function dateHeader(property, name) {
    return {
        kind: 'date',
        property,
        name,
    };
}
function observeMutations(value, mutatingMethods, onChange) {
    let proxies = new WeakMap();
    function observe(item) {
        if (item instanceof Date)
            return item;
        let cached = proxies.get(item);
        if (cached)
            return cached;
        let proxy = new Proxy(item, {
            get(target, property, receiver) {
                let member = Reflect.get(target, property, target);
                if (typeof member === 'function') {
                    if (typeof property === 'string' &&
                        (mutatingMethods.has(property) ||
                            (Array.isArray(target) && ArrayMutatingMethods.has(property)))) {
                        return (...args) => {
                            let result = member.apply(target, args);
                            onChange();
                            return result;
                        };
                    }
                    if (Array.isArray(target)) {
                        return (...args) => member.apply(receiver, args);
                    }
                    return member.bind(target);
                }
                if (member !== null && typeof member === 'object') {
                    return observe(member);
                }
                return member;
            },
            set(target, property, newValue) {
                let result = Reflect.set(target, property, newValue, target);
                onChange();
                return result;
            },
            defineProperty(target, property, descriptor) {
                let result = Reflect.defineProperty(target, property, descriptor);
                onChange();
                return result;
            },
            deleteProperty(target, property) {
                let result = Reflect.deleteProperty(target, property);
                onChange();
                return result;
            },
        });
        proxies.set(item, proxy);
        return proxy;
    }
    return observe(value);
}
function getNativeSetCookie(headers) {
    return Headers.prototype.getSetCookie.call(headers);
}
function stringifySetCookieValue(value) {
    return typeof value === 'string' ? value : SetCookie.from(value).toString();
}
function normalizeSetCookieValues(values) {
    for (let i = 0; i < values.length; i++) {
        let value = values[i];
        values[i] = typeof value === 'string' ? SetCookie.from(value) : SetCookie.from(value);
    }
}
function arraysEqual(left, right) {
    if (left.length !== right.length)
        return false;
    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i])
            return false;
    }
    return true;
}
