/**
 * @remix-run/dev v1.4.3
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });
var path = require('path');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function(k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function() { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return Object.freeze(n);
}

var path__namespace = /*#__PURE__*/_interopNamespace(path);

function nativeNodeModulesPlugin() {
  return {
    name: "native-node-modules",

    setup(build) {
      // If a ".node" file is imported within a module in the "file" namespace, resolve
      // it to an absolute path and put it into the "node-file" virtual namespace.
      build.onResolve({
        filter: /\.node$/,
        namespace: "file"
      }, args => {
        // Let's convert the path to an absolute path.
        let resolved = path__namespace.resolve(args.resolveDir, args.path)
        return (
          {
            path: resolved,
            namespace: "node-file"
          }
        )
      }); // Files in the "node-file" virtual namespace call "require()" on the
      // path from esbuild of the ".node" file in the output directory.

      build.onLoad({
        filter: /.*/,
        namespace: "node-file"
      }, args => {
        return ({
          contents: `
         import * as path from "path";
         import modulePath from ${JSON.stringify(args.path)}
 
         let projectRoot = "${path__namespace.resolve()}";
         let absolutePath = path.join(projectRoot, modulePath);
 
         try { module.exports = require(absolutePath); 
     }
         catch (error) {
             console.error(error)
         }
       `
        })
      }); // If a ".node" file is imported within a module in the "node-file" namespace, put
      // it in the "file" namespace where esbuild's default loading behavior will handle
      // it. It is already an absolute path since we resolved it to one above.

      build.onResolve({
        filter: /\.node$/,
        namespace: "node-file"
      }, args => ({
        path: args.path,
        namespace: "file"
      })); // Tell esbuild's default loading behavior to use the "file" loader for
      // these ".node" files.

      let opts = build.initialOptions;
      opts.loader = opts.loader || {};
      opts.loader[".node"] = "file";
    }

  };
}
exports.nativeNodeModulesPlugin = nativeNodeModulesPlugin; 
