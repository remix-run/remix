import * as fs from 'node:fs'

function getFileModTime(file: string): number {
  try {
    return fs.statSync(file).mtimeMs
  } catch {
    return 0
  }
}

export function createWatcher(onChange: (file: string) => void) {
  let watchers = new Set<fs.FSWatcher>()
  let fileModTimes = new Map<string, number>()

  function update(files: string[]) {
    for (let watcher of watchers) {
      watcher.close()
    }
    watchers.clear()

    for (let file of files) {
      fileModTimes.set(file, getFileModTime(file))
      watchers.add(
        fs.watch(file, () => {
          // macOS FSEvents can fire multiple callbacks per save (e.g. write +
          // metadata flush). Guard with mtime so only a real content change
          // triggers a rerun instead of every duplicate event.
          let mtime = getFileModTime(file)
          if (mtime !== fileModTimes.get(file)) {
            fileModTimes.set(file, mtime)
            onChange(file)
          }
        }),
      )
    }
  }

  function close() {
    for (let watcher of watchers) {
      watcher.close()
    }
    watchers.clear()
  }

  return { update, close }
}
