type Log = (msg: string, key: string) => void;

export type Logger = {
  _error: Log; // most of the time, throwing an error is better
  warn: Log;
  info: Log;
  debug: Log;
};

let dedup = (log: (msg: string) => void): Log => {
  let already = new Set();
  return (msg, key = msg) => {
    if (already.has(key)) return;
    already.add(key);
    log(msg);
  };
};

export let create = (): Logger => {
  let _warn = dedup(console.warn);
  return {
    _error: dedup(console.error),
    warn: (msg, key) => {
      throw Error(msg);
      _warn(msg, key);
    },
    info: dedup(console.info),
    debug: dedup(console.debug),
  };
};
