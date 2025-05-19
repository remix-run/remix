import { execSync } from "node:child_process";
import { parseArgs } from "node:util";

const CI = process.env.CI === "true";

let oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

const { values: args } = parseArgs({
  options: {
    date: {
      type: "string",
      short: "d",
      default: new Date(oneYearAgo).toISOString().substring(0, 10),
    },
  },
  strict: true,
});

if (!args.date || !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
  console.error("Missing or invalid date - expected YYYY-MM-DD.");
  process.exit(1);
} else {
  run();
}

async function run() {
  /** @type {(ms: number) => Promise<void>} */
  let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** @type {(q: string) => string} */
  let getIssuesCmd = (q) => `gh issue list --search "${q}" --json number`;

  /** @type {(n: number) => string} */
  let getCommentCmd = (n) =>
    `gh issue comment ${n} -F ./scripts/close-v2-issues-comment.md`;

  /** @type {(n: number) => string} */
  let getCloseCmd = (n) => `gh issue close ${n} -r "not planned"`;

  let issueCmd = getIssuesCmd(`is:issue state:open updated:<${args.date}`);
  console.log(`Executing command: ${issueCmd}`);
  let result = execSync(issueCmd).toString();
  console.log(`Result: ${result}`);

  let issues = JSON.parse(result).map((i) => i.number);
  if (issues.length > 50) {
    console.log("❌ Refusing to close more than 50 issues at once, exiting.");
    process.exit(1);
  }

  console.log(`Parsed ${issues.length} issues`);

  for (let issue of issues) {
    console.log(`Commenting on issue #${issue}`);
    let commentResult = runCmdIfTokenExists(getCommentCmd(issue));
    console.log(`Commented on issue #${issue}: ${commentResult}`);
    await sleep(250);

    console.log(`Closing issue #${issue}`);
    let closeResult = runCmdIfTokenExists(getCloseCmd(issue));
    console.log(`Closed issue #${issue}: ${closeResult}`);
    await sleep(250);
  }

  console.log("Done!");
}

/**
 * @param {string} cmd
 * @return {string}
 */
function runCmdIfTokenExists(cmd) {
  if (CI) {
    console.log();
    return execSync(cmd).toString();
  } else {
    console.log(`⚠️ Local run, skipping command: ${cmd}`);
    return "<skipped>";
  }
}
