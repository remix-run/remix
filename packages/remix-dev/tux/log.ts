import {
  isColorSupported,
  blue,
  dim,
  green,
  inverse,
  red,
  yellow,
} from "picocolors";

type Level = "debug" | "info" | "warn" | "error";

type Log = (message: string) => void;

export type Logger = {
  debug: Log;
  info: Log;
  warn: Log;
  error: Log;
};

let { format: formatDate } = new Intl.DateTimeFormat([], {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export let logline = (level: Level, message: string) => {
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

export let create = (): Logger => {
  let log = (level: Level) => (message: string) => {
    let dest = level === "error" ? process.stderr : process.stdout;
    dest.write(logline(level, message));
  };
  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
  };
};

export let logOnce = (log: Log): Log => {
  let already = new Set();
  return (msg: string) => {
    if (already.has(msg)) return;
    already.add(msg);
    log(msg);
  };
};
