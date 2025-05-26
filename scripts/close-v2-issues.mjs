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
    type: {
      type: "string",
      short: "t",
      default: "issues", // issues | prs
    },
  },
  strict: true,
});

console.log(args);

if (!args.type || !["issues", "prs"].includes(args.type)) {
  console.error("Missing or invalid date - expected YYYY-MM-DD.");
  process.exit(1);
} else if (!args.date || !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
  console.error("Missing or invalid date - expected YYYY-MM-DD.");
  process.exit(1);
} else {
  run();
}

async function run() {
  /** @type {(ms: number) => Promise<void>} */
  let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  let isPullRequests = args.type === "prs";

  /** @type {(q: string) => string} */
  let getQueryCmd = (q) =>
    isPullRequests
      ? `gh pr list --search "${q}" --json number`
      : `gh issue list --search "${q}" --json number`;

  /** @type {(n: number) => string} */
  let getCommentCmd = (n) =>
    isPullRequests
      ? `gh pr comment ${n} -F ./scripts/close-v2-prs-comment.md`
      : `gh issue comment ${n} -F ./scripts/close-v2-issues-comment.md`;

  /** @type {(n: number) => string} */
  let getCloseCmd = (n) =>
    isPullRequests
      ? `gh pr close ${n}`
      : `gh issue close ${n} -r "not planned"`;

  let query = isPullRequests
    ? `is:pr is:open updated:<${args.date}`
    : `is:issue state:open updated:<${args.date}`;
  let issueCmd = getQueryCmd(query);
  console.log(`Executing command: ${issueCmd}`);

  let result = execSync(issueCmd).toString();
  console.log(`Result: ${result}`);

  let issues = JSON.parse(result).map((i) => i.number);
  if (issues.length > 50) {
    console.log(
      "❌ Refusing to close more than 50 issues/PRs at once, exiting."
    );
    process.exit(1);
  }

  let label = isPullRequests ? "PR" : "issue";

  console.log(`Parsed ${issues.length} ${label}s`);

  for (let issue of issues) {
    console.log(`--- Processing ${label} #${issue} ---`);
    let commentResult = runCmdIfTokenExists(getCommentCmd(issue));
    console.log(`Commented on ${label} #${issue}: ${commentResult}`);
    await sleep(250);

    runCmdIfTokenExists(getCloseCmd(issue));
    // No log here since the GH CLI already logs for issue close
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
