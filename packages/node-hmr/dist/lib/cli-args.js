export function shouldIgnoreWatchPath(path) {
    let parts = path.split(/[\\/]/);
    return parts.some((part) => ['.git', '.next', '.turbo', 'build', 'coverage', 'dist', 'node_modules'].includes(part));
}
