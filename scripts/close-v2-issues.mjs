import { execSync } from "node:child_process";

let getIssuesCmd = (q) => `gh issue list --search "${q}" --json number`;
let issueCmd = getIssuesCmd("is:issue state:open updated:<2024-06-30");
console.log(`Executing command: ${issueCmd}`);
let result = execSync(issueCmd).toString();

console.log(`Result: ${result}`);
