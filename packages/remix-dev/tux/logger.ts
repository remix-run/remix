import prettyMs from 'pretty-ms';
import pc from "picocolors";
import type { Formatter } from "picocolors/types";

import { format } from "./format";

const DEBUG_MODE = !!process.env.DEBUG;

type Log = (
  message: string,
  options?: { details?: string[]; key?: string }
) => void;

export type Logger = {
  debug: Log;
  info: Log;
  warn: Log;
  error: Log;
  time<T>(label: string): (result: T) => T;
};

type LogArgs = {
  label: string;
  color: Formatter;
  dest: NodeJS.WriteStream;
};

let log = ({ label, color, dest }: LogArgs): Log => {
  let _format = format({ label, color });
  let already = new Set<string>();

  return (message, { details, key } = {}) => {
    let formatted = _format(message, details) + "\n";

    if (key === undefined) return dest.write(formatted);
    if (already.has(key)) return;
    already.add(key);

    dest.write(formatted);
  };
};

export let logger: Logger = {
  debug: log({
    label: "debug",
    color: pc.green,
    dest: process.stdout,
  }),
  info: log({
    label: "info",
    color: pc.blue,
    dest: process.stdout,
  }),
  warn: log({
    label: "warn",
    color: pc.yellow,
    dest: process.stderr,
  }),
  error: log({
    label: "error",
    color: pc.red,
    dest: process.stderr,
  }),
  time: (label) => {
    let start = Date.now();
    return (result) => {
      if (DEBUG_MODE) logger.debug(`${label} (${prettyMs(Date.now() - start)})`);
      return result;
    };
  },
};
