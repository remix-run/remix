// This file is an optimization so that rollup won't try to bundle any of these
// modules, which greatly speeds up the browser tree-shaking
import builtins from "builtin-modules";

export let ignorePackages = builtins.concat([
  "@databases/mysql",
  "@databases/pg",
  "@databases/sqlite",
  "@prisma/client",
  // We SHOULD be able to treeshake this out of the build just like everything
  // else, but Rollup complains about syntax errors in
  // @remix-run/dev/compiler.js if we don't deliberately exclude it from the
  // browser builds. This is a bug we do not understand yet! :/ We have only
  // ever seen this problem when the build imports the built version of itself.
  //
  // Fortunately, we don't actually want any code from @remix-run/dev in the
  // browser builds, so we can exclude it for now.
  //
  // TODO: For some adventurous soul, try to figure out why Rollup can't parse
  // its own output...
  "@remix-run/architect",
  "@remix-run/express",
  "@remix-run/vercel",
  "apollo-server",
  "better-sqlite3",
  "bookshelf",
  "dynamodb",
  "firebase-admin",
  "mariadb",
  "mongoose",
  "mysql",
  "mysql2",
  "pg",
  "pg-hstore",
  "pg-native",
  "pg-pool",
  "postgres",
  "sequelize",
  "sqlite",
  "sqlite3",
  "tedious"
]);
