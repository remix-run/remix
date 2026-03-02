export function parseParams(input, delimiter = ';') {
    // This parser splits on the delimiter and unquotes any quoted values
    // like `filename="the\\ filename.txt"`.
    let parser = delimiter === ';'
        ? /(?:^|;)\s*([^=;\s]+)(\s*=\s*(?:"((?:[^"\\]|\\.)*)"|((?:[^;]|\\\;)+))?)?/g
        : /(?:^|,)\s*([^=,\s]+)(\s*=\s*(?:"((?:[^"\\]|\\.)*)"|((?:[^,]|\\\,)+))?)?/g;
    let params = [];
    let match;
    while ((match = parser.exec(input)) !== null) {
        let key = match[1].trim();
        let value;
        if (match[2]) {
            value = (match[3] || match[4] || '').replace(/\\(.)/g, '$1').trim();
        }
        params.push([key, value]);
    }
    return params;
}
export function quote(value) {
    if (value.includes('"') || value.includes(';') || value.includes(' ')) {
        return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
}
