import esbuild from "esbuild";
import {
  isColorSupported,
  blue,
  dim,
  green,
  inverse,
  red,
  yellow,
} from "picocolors";

import { isEsbuildError, toError } from "../compiler/utils/error";

type Level = "debug" | "info" | "warn" | "error";

type Log = (message: string, key?: string) => void;

export type Logger = {
  debug: Log;
  info: Log;
  warn: Log;
  error: Log;
  thrown: (thrown: unknown) => void;
};

let log = (level: Level) => (message: string) => {
  let dest = level === "error" ? process.stderr : process.stdout;
  dest.write(logline(level, message));
};

let logline = (level: Level, message: string) => {
  let line = "";

  // timestamp
  let now = formatDate(new Date());
  line += dim(now) + " ";

  // level
  let color = {
    debug: green,
    info: blue,
    warn: yellow,
    error: red,
  }[level];
  line +=
    (isColorSupported ? inverse(color(` ${level} `)) : `[${level}]`) + " ";

  // message
  line += message + "\n";

  return line;
};

let once = (log: (msg: string) => void) => {
  let logged = new Set<string>();
  return (msg: string, key?: string) => {
    if (key === undefined) return log(msg);
    if (logged.has(key)) return;
    logged.add(key);
    log(msg);
  };
};

let debug = once(log("debug"));
let info = once(log("info"));
let warn = once(log("warn"));
let error = once(log("error"));
let thrown = (thrown: unknown) => {
  let err = toError(thrown);
  if (isEsbuildError(err)) {
    let warnings = esbuild.formatMessagesSync(err.warnings, {
      kind: "warning",
      color: isColorSupported,
    });
    let errors = esbuild.formatMessagesSync(err.errors, {
      kind: "error",
      color: isColorSupported,
    });
    warnings.forEach((w) => warn(w));
    errors.forEach((e) => error(e));
    return;
  }
  error(err.stack ?? err.message);
};

export let logger: Logger = {
  debug,
  info,
  warn,
  error,
  thrown,
};

let { format: formatDate } = new Intl.DateTimeFormat([], {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
