import * as path from "path";
import * as esbuild from "esbuild";

export const loaders: esbuild.BuildOptions["loader"] = {
  ".aac": "file",
  ".css": "file",
  ".eot": "file",
  ".flac": "file",
  ".gif": "file",
  ".jpeg": "file",
  ".jpg": "file",
  ".json": "json",
  ".md": "text",
  ".mdx": "text",
  ".mp3": "file",
  ".mp4": "file",
  ".ogg": "file",
  ".otf": "file",
  ".png": "file",
  ".svg": "file",
  ".ttf": "file",
  ".wav": "file",
  ".webm": "file",
  ".webp": "file",
  ".woff": "file",
  ".woff2": "file"
};

export function getLoaderForFile(file: string): esbuild.Loader {
  switch (path.extname(file)) {
    case ".js":
    case ".jsx":
      return "js";
    case ".ts":
      return "ts";
    case ".tsx":
      return "tsx";
    default:
      throw new Error(`Cannot get loader for file ${file}`);
  }
}
