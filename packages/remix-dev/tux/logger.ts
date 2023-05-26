import pc from "picocolors";

type Level = "debug" | "info" | "warn" | "error";
type Log = (message: string, key?: string) => void;

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

let log = (level: Level) => (message: string) => {
  let dest = level === "error" ? process.stderr : process.stdout;
  dest.write(logline(level, message));
};

let logline = (level: Level, message: string) => {
  let line = "";

  // timestamp
  let now = formatDate(new Date());
  line += pc.dim(now) + " ";

  // level
  let color = {
    debug: pc.green,
    info: pc.blue,
    warn: pc.yellow,
    error: pc.red,
  }[level];
  line +=
    (pc.isColorSupported ? pc.inverse(color(` ${level} `)) : `[${level}]`) +
    " ";

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

export let logger: Logger = {
  debug,
  info,
  warn,
  error,
};
