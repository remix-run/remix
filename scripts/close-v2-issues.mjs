import { execSync } from "node:child_process";

let getIssuesCmd = (q) => `gh issue list --search "${q}" --json number`;
let getCommentCmd = (n) =>
  `gh issue comment ${n} -F ./scripts/close-v2-issues-comment.md`;
let getCloseCmd = (n) => `gh issue close ${n} -r "not planned"`;

let issueCmd = getIssuesCmd("is:issue state:open updated:<2024-06-30");
console.log(`Executing command: ${issueCmd}`);
let result = execSync(issueCmd).toString();
console.log(`Result: ${result}`);

let issues = JSON.parse(result).map((i) => i.number);
console.log(`Parsed ${issues.length} issues`);

issues = [9526];
console.log("Overriding with single issue for testing:", issues);

for (let issue of issues) {
  console.log(`Commenting on issue #${issue}`);
  let commentCmd = getCommentCmd(issue);
  console.log(`Executing command: ${commentCmd}`);
  let commentResult = execSync(commentCmd).toString();
  console.log(`Commented on issue #${issue}: ${commentResult}`);

  console.log(`Closing issue #${issue}`);
  let closeCmd = getCloseCmd(issue);
  console.log(`Executing command: ${closeCmd}`);
  let closeResult = execSync(closeCmd).toString();
  console.log(`Closed issue #${issue}: ${closeResult}`);
}

console.log("Done!");
