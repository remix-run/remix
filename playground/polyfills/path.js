/**
 * Minimal browser-compatible `path` shim.
 *
 * enhanced-resolve relies on `path.posix.normalize`, `path.posix.dirname`,
 * `path.win32.normalize`, `path.win32.dirname` and `path.basename` to collapse
 * `//`, `.` and `..` segments while resolving modules. The previous no-op
 * `normalize` left paths like `//node_modules/./remix/./dist/ui.js` untouched,
 * which broke resolution — so we implement real POSIX semantics here.
 */

/**
 * Normalize an array of path segments, resolving "." and "..".
 * @param {string[]} parts
 * @param {boolean} allowAboveRoot keep leading ".." segments (relative paths)
 * @returns {string[]}
 */
function normalizeArray(parts, allowAboveRoot) {
  let res = []
  for (let part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (res.length && res[res.length - 1] !== '..') {
        res.pop()
      } else if (allowAboveRoot) {
        res.push('..')
      }
    } else {
      res.push(part)
    }
  }
  return res
}

function posixNormalize(path) {
  if (typeof path !== 'string') path = String(path)
  if (path.length === 0) return '.'

  let isAbsolute = path.charCodeAt(0) === 47 /* / */
  let trailingSlash = path.charCodeAt(path.length - 1) === 47

  let parts = normalizeArray(path.split('/'), !isAbsolute)
  let result = parts.join('/')

  if (!result && !isAbsolute) result = '.'
  if (result && trailingSlash) result += '/'

  return (isAbsolute ? '/' : '') + result
}

function posixDirname(path) {
  if (typeof path !== 'string') path = String(path)
  if (path.length === 0) return '.'

  let isAbsolute = path.charCodeAt(0) === 47 /* / */
  let end = -1
  let matchedSlash = true
  for (let i = path.length - 1; i >= 1; i--) {
    if (path.charCodeAt(i) === 47) {
      if (!matchedSlash) {
        end = i
        break
      }
    } else {
      matchedSlash = false
    }
  }

  if (end === -1) return isAbsolute ? '/' : '.'
  if (isAbsolute && end === 1) return '//'
  return path.slice(0, end)
}

function posixBasename(path, ext) {
  if (typeof path !== 'string') path = String(path)
  let start = 0
  let end = -1
  let matchedSlash = true
  for (let i = path.length - 1; i >= 0; i--) {
    if (path.charCodeAt(i) === 47) {
      if (!matchedSlash) {
        start = i + 1
        break
      }
    } else if (end === -1) {
      matchedSlash = false
      end = i + 1
    }
  }

  let base = end === -1 ? '' : path.slice(start, end)
  if (ext && base.endsWith(ext) && base !== ext) {
    base = base.slice(0, base.length - ext.length)
  }
  return base
}

const posix = {
  sep: '/',
  delimiter: ':',
  normalize: posixNormalize,
  dirname: posixDirname,
  basename: posixBasename,
}

// This playground only deals with POSIX-style paths; map win32 onto posix so
// the rare win32.* calls in enhanced-resolve still behave sensibly.
const win32 = {
  sep: '\\',
  delimiter: ';',
  normalize: posixNormalize,
  dirname: posixDirname,
  basename: posixBasename,
}

module.exports = {
  ...posix,
  posix,
  win32,
}
module.exports.default = module.exports
