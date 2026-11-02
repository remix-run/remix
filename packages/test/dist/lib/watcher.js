import * as fs from 'node:fs';
function getFileModTime(file) {
    try {
        return fs.statSync(file).mtimeMs;
    }
    catch {
        return 0;
    }
}
export function createWatcher(onChange) {
    let watchers = new Set();
    let fileModTimes = new Map();
    function update(files) {
        for (let watcher of watchers) {
            watcher.close();
        }
        watchers.clear();
        for (let file of files) {
            fileModTimes.set(file, getFileModTime(file));
            watchers.add(fs.watch(file, () => {
                // macOS FSEvents can fire multiple callbacks per save (e.g. write +
                // metadata flush). Guard with mtime so only a real content change
                // triggers a rerun instead of every duplicate event.
                let mtime = getFileModTime(file);
                if (mtime !== fileModTimes.get(file)) {
                    fileModTimes.set(file, mtime);
                    onChange(file);
                }
            }));
        }
    }
    function close() {
        for (let watcher of watchers) {
            watcher.close();
        }
        watchers.clear();
    }
    return { update, close };
}
