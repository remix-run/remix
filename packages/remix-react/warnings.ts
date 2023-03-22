const alreadyWarned: { [message: string]: boolean } = {};

export function warnOnce(condition: boolean, message: string): void {
  if (
    !condition &&
    !alreadyWarned[message] &&
    process.env.NODE_ENV !== "production"
  ) {
    alreadyWarned[message] = true;
    console.warn(message);
  }
}
