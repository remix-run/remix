import * as path from 'node:path';
import * as process from 'node:process';
export function getDisplayPath(filePath, cwd = process.cwd()) {
    let relativePath = path.relative(path.resolve(cwd), path.resolve(filePath));
    if (relativePath.length === 0) {
        return '.';
    }
    if (path.isAbsolute(relativePath)) {
        return filePath;
    }
    return relativePath;
}
