import path from "path";
import fse from "fs-extra";
import { test, expect } from "@playwright/test";

const contributorsPath = path.join(
  new URL("../contributors.yml", import.meta.url).pathname
);

test.describe("contributors.yml", () => {
  test("contributors are sorted alphabetically", async () => {
    let contributors = await fse.readFile(contributorsPath, "utf-8");
    let sortedContributors = contributors.split("\n").sort().join("\n");
    // Sorting moves the last blank line (aka trailing newline) to the top.
    // We don't want that. We want to leave it a the bottonm
    sortedContributors = sortedContributors.trimStart() + "\n";
    expect(contributors).toEqual(sortedContributors);
  });
});
