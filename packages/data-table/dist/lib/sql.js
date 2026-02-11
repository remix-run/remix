export function sql(strings, ...values) {
    let text = '';
    let parameters = [];
    let index = 0;
    while (index < strings.length) {
        text += strings[index];
        if (index < values.length) {
            let value = values[index];
            if (isSqlStatement(value)) {
                text += value.text;
                parameters.push(...value.values);
            }
            else {
                text += '?';
                parameters.push(value);
            }
        }
        index += 1;
    }
    return {
        text,
        values: parameters,
    };
}
export function isSqlStatement(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    let statement = value;
    return typeof statement.text === 'string' && Array.isArray(statement.values);
}
export function rawSql(text, values = []) {
    return { text, values };
}
