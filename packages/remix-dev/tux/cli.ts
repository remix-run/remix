import * as pc from "picocolors";
import * as ansi from "sisteransi";
import * as ora from "ora";

const p = (msg: string) => process.stdout.write(msg);

let sleep = async (ms: number) =>
  await new Promise((resolve) => setTimeout(resolve, ms));

let version = "1.15.0";
let mode = "production";
p(`${pc.cyan(`remix v${version}`)} ${pc.green(`building for ${mode}...`)}`);

let captureCursor = async (
  cb: () => Promise<void>,
  shortcut?: (input: string) => void
) => {
  let onInput = async (input: string) => {
    // ctrl+c or ctrl+d
    if (input === "\x03" || input === "\x04") {
      process.exit(1);
    }
    shortcut?.(input);
  };

  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.on("data", onInput).setEncoding("utf8").resume();
  p(ansi.cursor.hide);
  try {
    await cb();
  } finally {
    process.stdin.off("data", onInput).pause();
    p(ansi.cursor.show);
  }
};

let main = async () => {
  let s1 = ora("first").start();
  let i = 0;
  while (i < 10) {
    // p(ansi.erase.line);
    // p(ansi.cursor.left);
    // p(`${i}`);
    i += 1;
    await sleep(500);
    if (i % 3 === 0) {
      s1.clear();
      console.log(i);
      s1.render();
    }
  }
  s1.succeed("first passed");
};
// captureCursor(main);

let text = [
  "1asdfasdfasdf\n",
  "2asdfasdfasdf\n",
  "3asdfasdfasdf\n",
  "4asdfasdfasdf\n",
].join("");

let lines = (text.match(/\n/g) ?? []).length;

let doit = async () => {
  p("blah\n");
  p(text);
  await sleep(1000);
  p(ansi.erase.lines(lines + 1));
  p(`wow:${lines}\n`);
  p(`yay:${lines}\n`);
  p(text);
};
doit();

console.log(pc.red("red"));
console.log(pc.blue("blue"));
console.log(pc.cyan("cyan"));
console.log(pc.gray("gray"));
console.log(pc.black("black"));
console.log(pc.green("green"));
console.log(pc.white("white"));
console.log(pc.yellow("yellow"));
console.log(pc.magenta("magenta"));
