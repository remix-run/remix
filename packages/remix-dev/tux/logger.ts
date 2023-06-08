import pc from "picocolors";

type Level = "debug" | "info" | "warn" | "error";
type Log = (message: string, details?: string[]) => void;
type LogOnce = (
  message: string,
  options?: { details?: string[]; key?: string }
) => void;

export type Logger = {
  debug: LogOnce;
  info: LogOnce;
  warn: LogOnce;
  error: LogOnce;
};

// let { format: formatDate } = new Intl.DateTimeFormat([], {
//   hour: "2-digit",
//   minute: "2-digit",
//   second: "2-digit",
// });

let log =
  (level: Level): Log =>
  (message, details) => {
    let dest = level === "error" ? process.stderr : process.stdout;
    dest.write(logline(level, message, details));
  };

let logline = (level: Level, message: string, details: string[] = []) => {
  let line = "";

  // timestamp
  // let now = formatDate(new Date());
  // line += pc.dim(now) + " ";

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

  details.forEach((detail, i) => {
    // let symbol = i === details?.length - 1 ? "┗" : "┃";
    // line += color(symbol) + " " + pc.gray(detail) + "\n";
    line += color("┃") + " " + pc.gray(detail) + "\n";
  });
  if (details.length > 0) line += color("┗") + "\n";

  return line;
};

let once = (log: Log) => {
  let logged = new Set<string>();
  let logOnce: LogOnce = (msg, { details, key } = {}) => {
    if (key === undefined) return log(msg, details);
    if (logged.has(key)) return;
    logged.add(key);
    log(msg, details);
  };
  return logOnce;
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
