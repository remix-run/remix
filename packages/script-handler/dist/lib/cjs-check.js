import { parseSync } from '@swc/core';
let suspiciousCommonJSPattern = /\brequire\s*(?:\(|\.|\[)|\bmodule\s*(?:\.\s*exports|\[\s*['"`]exports['"`]\s*\])|\bexports\s*(?:\.|=|\[)/;
export function mayContainCommonJSModuleGlobals(source) {
    return suspiciousCommonJSPattern.test(source);
}
// Detects CommonJS module globals that cannot be served as ES modules.
export function isCommonJS(source) {
    try {
        let ast = parseSync(source, { syntax: 'ecmascript' });
        return containsCommonJSModuleGlobals(ast);
    }
    catch {
        return suspiciousCommonJSPattern.test(source);
    }
}
function containsCommonJSModuleGlobals(node) {
    if (isRequireCall(node) || isRequireMemberAccess(node) || isExportsAssignment(node))
        return true;
    if (isExportsMemberAccess(node) || isModuleExportsAccess(node))
        return true;
    if (Array.isArray(node)) {
        for (let child of node) {
            if (containsCommonJSModuleGlobals(child))
                return true;
        }
        return false;
    }
    if (!isAstNode(node))
        return false;
    for (let value of Object.values(node)) {
        if (containsCommonJSModuleGlobals(value))
            return true;
    }
    return false;
}
function isRequireCall(node) {
    return (isAstNode(node) && node.type === 'CallExpression' && isGlobalIdentifier(node.callee, 'require'));
}
function isRequireMemberAccess(node) {
    return isMemberAccessOnGlobal(node, 'require');
}
function isExportsMemberAccess(node) {
    return isMemberAccessOnGlobal(node, 'exports');
}
function isModuleExportsAccess(node) {
    return (isAstNode(node) &&
        node.type === 'MemberExpression' &&
        isGlobalIdentifier(node.object, 'module') &&
        isMemberPropertyNamed(node.property, 'exports'));
}
function isExportsAssignment(node) {
    return (isAstNode(node) &&
        node.type === 'AssignmentExpression' &&
        isGlobalIdentifier(node.left, 'exports'));
}
function isMemberAccessOnGlobal(node, name) {
    return (isAstNode(node) && node.type === 'MemberExpression' && isGlobalIdentifier(node.object, name));
}
function isGlobalIdentifier(node, name) {
    return isAstNode(node) && node.type === 'Identifier' && node.value === name && node.ctxt === 1;
}
function isMemberPropertyNamed(node, name) {
    if (!isAstNode(node))
        return false;
    if (node.type === 'Identifier')
        return node.value === name;
    if (node.type !== 'Computed')
        return false;
    return isStaticStringValue(node.expression, name);
}
function isStaticStringValue(node, value) {
    if (!isAstNode(node))
        return false;
    if (node.type === 'StringLiteral')
        return node.value === value;
    return (node.type === 'TemplateLiteral' &&
        Array.isArray(node.expressions) &&
        node.expressions.length === 0 &&
        Array.isArray(node.quasis) &&
        node.quasis.length === 1 &&
        isAstNode(node.quasis[0]) &&
        node.quasis[0].raw === value);
}
function isAstNode(node) {
    return !!node && typeof node === 'object' && 'type' in node && typeof node.type === 'string';
}
