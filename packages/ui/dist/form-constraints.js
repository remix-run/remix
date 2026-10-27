import { getSchemaMetadata } from '@remix-run/data-schema';
/**
 * Returns native HTML constraints represented by a schema's recognized checks.
 *
 * Checks without an equivalent native constraint are omitted. Requiredness may evaluate the
 * schema with `undefined` or `false` when metadata alone cannot determine it.
 *
 * @param schema The schema to inspect.
 * @param options The input control receiving the constraints.
 * @returns Constraint attributes that can be spread onto a native `input` element.
 */
export function getConstraints(schema, options) {
    let constraints = {};
    if (options.type === 'number') {
        constraints.step = 'any';
    }
    if (options.type === 'checkbox'
        ? !schemaAcceptsValue(schema, false)
        : !schemaAcceptsUndefined(schema)) {
        constraints.required = true;
    }
    for (let check of getSchemaMetadata(schema).checks) {
        switch (check.code) {
            case 'string.min_length': {
                let minLength = getConstraintValue(check.values, 'min');
                if (minLength !== undefined)
                    constraints.minLength = minLength;
                break;
            }
            case 'string.max_length': {
                let maxLength = getConstraintValue(check.values, 'max');
                if (maxLength !== undefined)
                    constraints.maxLength = maxLength;
                break;
            }
            case 'number.min': {
                let min = getConstraintValue(check.values, 'min');
                if (min !== undefined)
                    constraints.min = min;
                break;
            }
            case 'number.max': {
                let max = getConstraintValue(check.values, 'max');
                if (max !== undefined)
                    constraints.max = max;
                break;
            }
        }
    }
    return constraints;
}
function schemaAcceptsUndefined(schema) {
    let acceptsUndefined = getSchemaMetadata(schema).acceptsUndefined;
    if (acceptsUndefined !== undefined) {
        return acceptsUndefined;
    }
    return !schema['~run'](undefined, { path: [] }).issues;
}
function schemaAcceptsValue(schema, value) {
    return !schema['~run'](value, { path: [] }).issues;
}
function getConstraintValue(values, key) {
    let value = values?.[key];
    return typeof value === 'number' ? value : undefined;
}
//# sourceMappingURL=form-constraints.js.map