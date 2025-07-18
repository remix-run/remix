import * as readline from "readline";
import crossSpawn from "cross-spawn";

export async function createRemix(argv: string[]) {
  return new Promise<void>((resolve, reject) => {
    let rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\nDid you mean `npx create-react-router@latest`?\n");

    rl.question("Would you like to run this command? (y/n): ", (answer) => {
      if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
        console.log("\nRunning: npx create-react-router@latest\n");

        // Use cross-spawn for better cross-platform support
        let child = crossSpawn("npx", ["create-react-router@latest", ...argv], {
          stdio: "inherit",
          env: process.env,
        });

        child.on("error", (error) => {
          reject(error);
          rl.close();
        });

        child.on("exit", (code) => {
          rl.close();
          if (code !== 0) {
            reject(new Error(`Command failed with exit code ${code}`));
          } else {
            resolve();
          }
        });
      } else {
        console.log("\nCommand not executed.");
        rl.close();
        resolve();
      }
    });

    rl.on("close", () => {
      reject(new Error("User did not confirm command execution"));
    });
  });
}
