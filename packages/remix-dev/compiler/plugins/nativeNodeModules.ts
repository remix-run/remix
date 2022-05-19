import type esbuild from "esbuild";
import * as path from "path";
// See https://github.com/evanw/esbuild/issues/1051#issuecomment-806325487
export function nativeNodeModulesPlugin(): esbuild.Plugin {
  return {
    name: 'native-node-modules',
    setup(build) {
      // If a ".node" file is imported within a module in the "file" namespace, resolve
      // it to an absolute path and put it into the "node-file" virtual namespace.
      build.onResolve({ filter: /\.node$/, namespace: 'file' }, args => ({
        path: require.resolve(args.path, { paths: [args.resolveDir] }),
        namespace: 'node-file',
      }))

      // Files in the "node-file" virtual namespace call "require()" on the
      // path from esbuild of the ".node" file in the output directory.
      build.onLoad({ filter: /.*/, namespace: 'node-file' }, args => ({
        contents: `
        import * as path from "path";
        import modulePath from ${JSON.stringify(args.path)}
        
        // Esbuild gives a package path, so we want to convert to an absolute one
        let projectRoot = "${path.resolve()}";
        let absolutePath = path.join(projectRoot, modulePath)
        
        try { module.exports = require(absolutePath) }
        catch (error){
          console.error(error)
        }
      `,
      }))

      // If a ".node" file is imported within a module in the "node-file" namespace, put
      // it in the "file" namespace where esbuild's default loading behavior will handle
      // it. It is already an absolute path since we resolved it to one above.
      build.onResolve({ filter: /\.node$/, namespace: 'node-file' }, args => ({
        path: args.path,
        namespace: 'file',
      }))
    },
  }
}
