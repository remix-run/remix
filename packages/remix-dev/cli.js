#!/usr/bin/env node
// This is a compatibility shim for Remix < v1.6.4,
// since the "bin" field used to point to this path.
module.exports = require('./dist/cli');
