import chalk from "chalk";

export const detected = (message: string) =>
  chalk.gray("🕵️  I detected " + message);

export const because = (message: string) =>
  chalk.gray("   ...because " + message);
