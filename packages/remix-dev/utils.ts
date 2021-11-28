import detect from "detect-port";
import isRoot from "is-root";
import prompts from "prompts";
import chalk from "chalk";

const isInteractive = process.stdout.isTTY;

export async function choosePort(defaultPort: number): Promise<number | null> {
  return detect(defaultPort).then(
    (port: number) =>
      new Promise(resolve => {
        if (port === defaultPort) {
          return resolve(port);
        }
        const message =
          process.platform !== "win32" && defaultPort < 1024 && !isRoot()
            ? `Admin permissions are required to run a server on a port below 1024.`
            : `Something is already running on port ${defaultPort}.`;
        if (isInteractive) {
          console.clear();
          const question: prompts.PromptObject<"shouldChangePort"> = {
            type: "confirm",
            name: "shouldChangePort",
            message:
              chalk.yellow(message) +
              "\n\nWould you like to run the app on another port instead?",
            initial: true
          };
          prompts(question).then(answer => {
            if (answer.shouldChangePort) {
              resolve(port);
            } else {
              resolve(null);
            }
          });
        } else {
          console.log(chalk.red(message));
          resolve(null);
        }
      }),
    err => {
      throw new Error(
        chalk.red(`Could not find an open port.`) +
          "\n" +
          ("Network error message: " + err.message || err) +
          "\n"
      );
    }
  );
}
