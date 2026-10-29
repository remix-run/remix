const fs = require('node:fs')
const path = require('node:path')
const { optionalDependencies } = require('../package.json')

const platform = `${process.platform}-${process.arch}${process.platform === 'linux' ? '-gnu' : ''}`
const packageName = `@remix-run/uwebsockets-js-${platform}`

if (
  !Object.hasOwn(optionalDependencies, packageName) ||
  (process.platform === 'linux' && !process.report.getReport().header.glibcVersionRuntime)
) {
  throw new Error(
    `uWebSockets.js does not support ${platform} on this runtime. Linux requires glibc. Use remix/node-fetch-server instead.`,
  )
}

let entry
try {
  entry = require.resolve(packageName)
} catch (cause) {
  throw new Error(
    `Missing ${packageName}. Reinstall with optional dependencies enabled (npm install --include=optional), or install ${packageName} directly.`,
    { cause },
  )
}

const binary = `uws_${process.platform}_${process.arch}_${process.versions.modules}.node`
if (!fs.existsSync(path.join(path.dirname(entry), binary))) {
  throw new Error(
    `uWebSockets.js has no binary for Node ABI ${process.versions.modules} (${process.version}) on ${platform}. Use a supported Node.js version or remix/node-fetch-server.`,
  )
}

try {
  module.exports = require(entry)
} catch (cause) {
  throw new Error(`Unable to load ${packageName} for Node ABI ${process.versions.modules}.`, {
    cause,
  })
}
