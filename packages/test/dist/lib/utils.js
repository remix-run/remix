export const colors = {
    reset: '\x1b[0m',
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    yellow: (s) => `\x1b[2m\x1b[33m${s}\x1b[0m`,
};
function normalizeFilePath(path) {
    let locSuffix = path.match(/(:\d+:\d+)$/)?.[0] || '';
    let normalized = path
        .replace(/^\/scripts\/@pkg\/([^):]+)/g, (...args) => args[1])
        .replace(/^\/scripts\/@test\/([^):]+)/g, (...args) => args[1])
        .replace(/^\/scripts\/([^):]+)/g, (...args) => args[1])
        .replace(/^\s+/, '  ') + locSuffix;
    return path.includes('/@test/') ? `./${normalized}` : normalized;
}
export function normalizeLine(line) {
    let match = line.match(/ \(.*\)$/);
    if (match) {
        let filepath = match[0].slice(2, -1);
        filepath = filepath.replace(/https?:\/\/localhost:\d+\//g, '/');
        return line.slice(0, match.index) + ' (' + normalizeFilePath(filepath) + ')';
    }
    return line;
}
