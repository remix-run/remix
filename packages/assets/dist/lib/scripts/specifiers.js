export function isBareImportSpecifier(specifier) {
    return (!specifier.startsWith('./') &&
        !specifier.startsWith('../') &&
        !specifier.startsWith('/') &&
        !specifier.startsWith('file:') &&
        !specifier.startsWith('data:') &&
        !specifier.startsWith('http://') &&
        !specifier.startsWith('https://'));
}
