import { decodeHostname } from "./decode.js";
import { generateVariants } from "./variant.js";
import { unreachable } from "../unreachable.js";
export class Trie {
    ignoreCase;
    #root;
    constructor(options) {
        this.ignoreCase = options?.ignoreCase ?? false;
        this.#root = {
            http: createHostnameNode(),
            https: createHostnameNode(),
        };
    }
    insert(pattern, data) {
        for (let variant of generateVariants(pattern)) {
            let hostnameNode = this.#root[variant.protocol];
            let portNode;
            if (variant.hostname.type === 'any') {
                portNode = hostnameNode.any;
            }
            else if (variant.hostname.type === 'static') {
                let key = variant.hostname.value.toLowerCase();
                let existing = hostnameNode.static.get(key);
                if (existing === undefined) {
                    existing = new Map();
                    hostnameNode.static.set(key, existing);
                }
                portNode = existing;
            }
            else {
                portNode = new Map();
                hostnameNode.dynamic.push({
                    regexp: variant.hostname.regexp,
                    params: variant.hostname.params,
                    portNode,
                });
            }
            let pathnameRoot = portNode.get(variant.port);
            if (pathnameRoot === undefined) {
                pathnameRoot = createPathnameNode();
                portNode.set(variant.port, pathnameRoot);
            }
            let pathnameNode = pathnameRoot;
            for (let segment of variant.pathname) {
                if (segment.type === 'static') {
                    let key = this.ignoreCase ? segment.key.toLowerCase() : segment.key;
                    let next = pathnameNode.static.get(key);
                    if (next === undefined) {
                        next = createPathnameNode();
                        pathnameNode.static.set(key, next);
                    }
                    pathnameNode = next;
                    continue;
                }
                if (segment.type === 'variable') {
                    let next = pathnameNode.variable.get(segment.key);
                    if (next === undefined) {
                        next = { regexp: segment.regexp, pathnameNode: createPathnameNode() };
                        pathnameNode.variable.set(segment.key, next);
                    }
                    pathnameNode = next.pathnameNode;
                    continue;
                }
                if (segment.type === 'wildcard') {
                    let next = pathnameNode.wildcard.get(segment.key);
                    if (next === undefined) {
                        next = { regexp: segment.regexp, pathnameNode: createPathnameNode() };
                        pathnameNode.wildcard.set(segment.key, next);
                    }
                    pathnameNode = next.pathnameNode;
                    continue;
                }
                unreachable(segment);
            }
            let requiredParams = [];
            for (let segment of variant.pathname) {
                if (segment.type === 'variable' || segment.type === 'wildcard') {
                    for (let param of segment.params)
                        requiredParams.push(param);
                }
            }
            let undefinedParams = [];
            for (let param of pattern.pathname.tokens) {
                if (param.type !== ':' && param.type !== '*')
                    continue;
                if (requiredParams.some((p) => p.name === param.name))
                    continue;
                if (undefinedParams.some((p) => p.name === param.name))
                    continue;
                undefinedParams.push(param);
            }
            pathnameNode.values.push({ pattern, data, requiredParams, undefinedParams });
        }
    }
    search(url) {
        let protocol = url.protocol.slice(0, -1);
        if (protocol !== 'http' && protocol !== 'https')
            return [];
        let hostnameNode = this.#root[protocol];
        let decodedHostname = decodeHostname(url.hostname);
        let origins = [];
        // any hostname (no port allowed -- empty-port key)
        let anyPathname = hostnameNode.any.get('');
        if (anyPathname) {
            origins.push({
                hostnameMatch: [
                    { type: '*', name: '*', value: decodedHostname, begin: 0, end: decodedHostname.length },
                ],
                pathnameNode: anyPathname,
            });
        }
        // static hostname
        let staticPort = hostnameNode.static.get(decodedHostname.toLowerCase());
        if (staticPort) {
            let next = staticPort.get(url.port);
            if (next)
                origins.push({ hostnameMatch: [], pathnameNode: next });
        }
        // dynamic hostnames
        for (let entry of hostnameNode.dynamic) {
            let m = entry.regexp.exec(decodedHostname);
            if (!m)
                continue;
            let next = entry.portNode.get(url.port);
            if (!next)
                continue;
            let hostnameMatch = [];
            for (let i = 0; i < entry.params.length; i++) {
                let param = entry.params[i];
                let span = m.indices?.[i + 1];
                if (span === undefined)
                    continue;
                hostnameMatch.push({
                    type: param.type,
                    name: param.name,
                    value: m[i + 1],
                    begin: span[0],
                    end: span[1],
                });
            }
            origins.push({ hostnameMatch, pathnameNode: next });
        }
        let results = [];
        let urlSegments = url.pathname.slice(1).split('/').map(normalizePathnameText);
        for (let origin of origins) {
            let stack = [{ segmentIndex: 0, pathnameNode: origin.pathnameNode, charOffset: 0, captures: [] }];
            while (stack.length > 0) {
                let current = stack.pop();
                if (current.segmentIndex === urlSegments.length) {
                    for (let value of current.pathnameNode.values) {
                        if (!matchSearch(url.searchParams, value.pattern.search))
                            continue;
                        let pathnameMatch = [];
                        for (let i = 0; i < value.requiredParams.length; i++) {
                            let param = value.requiredParams[i];
                            let cap = current.captures[i];
                            pathnameMatch.push({
                                type: param.type,
                                name: param.name,
                                value: fastDecodeURIComponent(cap.value),
                                begin: cap.begin,
                                end: cap.end,
                            });
                        }
                        let params = {};
                        for (let token of value.pattern.hostname?.tokens ?? []) {
                            if ((token.type === ':' || token.type === '*') && token.name !== '*') {
                                params[token.name] = undefined;
                            }
                        }
                        for (let token of value.pattern.pathname.tokens) {
                            if ((token.type === ':' || token.type === '*') && token.name !== '*') {
                                params[token.name] = undefined;
                            }
                        }
                        for (let p of origin.hostnameMatch) {
                            if (p.name === '*')
                                continue;
                            params[p.name] = p.value;
                        }
                        for (let p of pathnameMatch) {
                            if (p.name === '*')
                                continue;
                            params[p.name] = p.value;
                        }
                        results.push({
                            url,
                            pattern: value.pattern,
                            data: value.data,
                            params,
                            paramsMeta: { hostname: origin.hostnameMatch, pathname: pathnameMatch },
                        });
                    }
                    continue;
                }
                let urlSegment = urlSegments[current.segmentIndex];
                let staticKey = this.ignoreCase ? urlSegment.toLowerCase() : urlSegment;
                let nextStatic = current.pathnameNode.static.get(staticKey);
                if (nextStatic) {
                    stack.push({
                        segmentIndex: current.segmentIndex + 1,
                        pathnameNode: nextStatic,
                        charOffset: current.charOffset + urlSegment.length + 1,
                        captures: current.captures,
                    });
                }
                for (let { regexp, pathnameNode } of current.pathnameNode.variable.values()) {
                    let m = regexp.exec(urlSegment);
                    if (!m)
                        continue;
                    let captures = current.captures.slice();
                    for (let i = 1; i < m.indices.length; i++) {
                        let span = m.indices[i];
                        if (span === undefined)
                            unreachable();
                        captures.push({
                            value: m[i],
                            begin: current.charOffset + span[0],
                            end: current.charOffset + span[1],
                        });
                    }
                    stack.push({
                        segmentIndex: current.segmentIndex + 1,
                        pathnameNode,
                        charOffset: current.charOffset + m.index + m[0].length + 1,
                        captures,
                    });
                }
                for (let { regexp, pathnameNode } of current.pathnameNode.wildcard.values()) {
                    let remaining = urlSegments.slice(current.segmentIndex).join('/');
                    let m = regexp.exec(remaining);
                    if (!m)
                        continue;
                    let captures = current.captures.slice();
                    for (let i = 1; i < m.indices.length; i++) {
                        let span = m.indices[i];
                        if (span === undefined)
                            continue;
                        captures.push({
                            value: m[i],
                            begin: current.charOffset + span[0],
                            end: current.charOffset + span[1],
                        });
                    }
                    stack.push({
                        segmentIndex: urlSegments.length,
                        pathnameNode,
                        charOffset: current.charOffset + remaining.length,
                        captures,
                    });
                }
            }
        }
        return results;
    }
}
// Pathname codec ----------------------------------------------------------------------------------
// Pathname matching uses canonical percent-encoded text. URL pathnames are split on structural
// "/" before normalization so encoded slashes like "%2F" remain data within a segment instead of
// becoming separators. Pattern static text is encoded the same way when variants are generated.
function normalizePathnameText(text) {
    return encodeURIComponent(fastDecodeURIComponent(text));
}
function fastDecodeURIComponent(text) {
    return text.includes('%') ? decodeURIComponent(text) : text;
}
// Search ------------------------------------------------------------------------------------------
function matchSearch(params, constraints) {
    for (let [name, requiredValues] of constraints) {
        if (requiredValues.size === 0) {
            if (!params.has(name))
                return false;
            continue;
        }
        let values = params.getAll(name);
        for (let requiredValue of requiredValues) {
            if (!values.includes(requiredValue))
                return false;
        }
    }
    return true;
}
function createHostnameNode() {
    return { static: new Map(), dynamic: [], any: new Map() };
}
function createPathnameNode() {
    return { static: new Map(), variable: new Map(), wildcard: new Map(), values: [] };
}
