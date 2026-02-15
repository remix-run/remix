const IRREGULAR_SINGULAR_FORMS = {
    people: 'person',
    men: 'man',
    women: 'woman',
    children: 'child',
    teeth: 'tooth',
    feet: 'foot',
    geese: 'goose',
    mice: 'mouse',
    data: 'datum',
    media: 'medium',
    indices: 'index',
    vertices: 'vertex',
    analyses: 'analysis',
    statuses: 'status',
    categories: 'category',
    companies: 'company',
    addresses: 'address',
};
const IRREGULAR_PLURAL_FORMS = {
    person: 'people',
    man: 'men',
    woman: 'women',
    child: 'children',
    tooth: 'teeth',
    foot: 'feet',
    goose: 'geese',
    mouse: 'mice',
    datum: 'data',
    medium: 'media',
    index: 'indices',
    vertex: 'vertices',
    analysis: 'analyses',
    status: 'statuses',
    category: 'categories',
    company: 'companies',
    address: 'addresses',
};
export function pluralize(word) {
    let lower = word.toLowerCase();
    if (IRREGULAR_PLURAL_FORMS[lower]) {
        return preserveCase(word, IRREGULAR_PLURAL_FORMS[lower]);
    }
    if (/[bcdfghjklmnpqrstvwxyz]y$/i.test(word)) {
        return preserveCase(word, word.slice(0, -1) + 'ies');
    }
    if (/s$|x$|z$|ch$|sh$/i.test(word)) {
        return preserveCase(word, word + 'es');
    }
    return preserveCase(word, word + 's');
}
export function singularize(word) {
    let lower = word.toLowerCase();
    if (IRREGULAR_SINGULAR_FORMS[lower]) {
        return preserveCase(word, IRREGULAR_SINGULAR_FORMS[lower]);
    }
    if (lower.endsWith('ies') && lower.length > 3) {
        return preserveCase(word, word.slice(0, -3) + 'y');
    }
    if (lower.endsWith('sses') || lower.endsWith('shes') || lower.endsWith('ches')) {
        return preserveCase(word, word.slice(0, -2));
    }
    if (lower.endsWith('xes') || lower.endsWith('zes')) {
        return preserveCase(word, word.slice(0, -2));
    }
    if (lower.endsWith('s') && !lower.endsWith('ss')) {
        return preserveCase(word, word.slice(0, -1));
    }
    return word;
}
export function inferTableName(singularName) {
    let snakeName = normalizeInflectionInput(singularName);
    let segments = snakeName.split('_');
    let tail = segments.pop() ?? snakeName;
    if (segments.length === 0) {
        return pluralize(tail);
    }
    return [...segments, pluralize(tail)].join('_');
}
export function inferForeignKey(tableName) {
    let snakeName = normalizeInflectionInput(tableName);
    let segments = snakeName.split('_');
    let tail = segments.pop() ?? snakeName;
    let singularTail = singularize(tail);
    if (segments.length === 0) {
        return singularTail + '_id';
    }
    return [...segments, singularTail + '_id'].join('_');
}
function normalizeInflectionInput(value) {
    return toSnakeCase(value);
}
function toSnakeCase(value) {
    return value
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/([a-z\d])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}
function preserveCase(source, replacement) {
    if (source.length === 0) {
        return replacement;
    }
    if (source[0] === source[0].toUpperCase()) {
        return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
}
