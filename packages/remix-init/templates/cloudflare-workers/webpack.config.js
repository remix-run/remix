let path = require("path");

module.exports = {
  target: "webworker",
  entry: "./worker/entry",
  devtool: "cheap-module-source-map",
  node: false,
  output: {
    filename: "worker.js",
    path: path.join(__dirname, "dist")
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"]
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: "esbuild-loader",
        options: { loader: "js" }
      },
      {
        test: /\.jsx$/,
        loader: "esbuild-loader",
        options: { loader: "jsx" }
      },
      {
        test: /\.ts$/,
        loader: "esbuild-loader",
        options: { loader: "ts" }
      },
      {
        test: /\.tsx$/,
        loader: "esbuild-loader",
        options: { loader: "tsx" }
      }
    ]
  }
};
