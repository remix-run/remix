const alreadyWarned: { [message: string]: boolean } = {};

export function warnOnce(condition: boolean, message: string): void {
  if (!condition && !alreadyWarned[message]) {
    alreadyWarned[message] = true;
    console.warn(message);
  }
}

export function logDeprecationOnce(
  message: string,
  key: string = message
): void {
  if (process.env.NODE_ENV !== "production" && !alreadyWarned[key]) {
    alreadyWarned[key] = true;
    console.warn(message);
  }
}
