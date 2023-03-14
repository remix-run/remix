import * as fs from "node:fs";
import path from "node:path";
import * as url from "node:url";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import rehypeStringify from "remark-stringify";
import remarkFrontmatter from "remark-frontmatter";
import { unified } from "unified";
import parseFrontMatter from "front-matter";

// Wrote this quick and dirty, gets the job done, plz don't judge me. The idea
// is not to auto-generate release notes but to quickly compile all changesets
// into a single document from which we can easily reference changes to write
// the release notes. Much faster than going back and forth between files! The
// generated markdown file should be in .gitignore, as it's only there as a
// reference.

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const rootDir = path.join(__dirname, "..");
const changesetsDir = path.join(rootDir, ".changeset");
const releaseNotesPath = path.join(rootDir, "RELEASENOTES.md");

main();

async function main() {
  let changesets = getChangesetPaths();
  /** @type {ReleaseNotes[]} */
  let majorReleaseNotes = [];
  /** @type {ReleaseNotes[]} */
  let minorReleaseNotes = [];
  /** @type {ReleaseNotes[]} */
  let patchReleaseNotes = [];

  /** @type {import('unified').Processor} */
  let markdownProcessor = await unified()
    .use({
      settings: {
        fences: true,
        listItemIndent: "one",
        tightDefinitions: true,
      },
    })
    // We have multiple versions of remark-parse, TS resolves the wrong one
    // @ts-expect-error
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ["yaml", "toml"])
    // same problem
    // @ts-expect-error
    .use(rehypeStringify, {
      bullet: "-",
      emphasis: "_",
      listItemIndent: "one",
    });

  for (let changeset of changesets) {
    let fileContents = fs.readFileSync(changeset, "utf-8");
    let markdown = await markdownProcessor.process(fileContents);

    /** @type {{attributes: unknown; body: string}} */
    let { attributes, body } = parseFrontMatter(markdown.toString());
    if (!isPlainObject(attributes)) {
      // 🤷‍♀️
      continue;
    }

    let affectedPackages = Object.keys(attributes);
    let releaseTypes = Object.values(attributes);
    if (releaseTypes.includes("major")) {
      majorReleaseNotes.push({ affectedPackages, body });
    } else if (releaseTypes.includes("minor")) {
      minorReleaseNotes.push({ affectedPackages, body });
    } else {
      patchReleaseNotes.push({ affectedPackages, body });
    }
  }

  let i = 0;
  let fileContents = "";
  for (let releaseNotes of [
    majorReleaseNotes,
    minorReleaseNotes,
    patchReleaseNotes,
  ]) {
    if (releaseNotes.length === 0) {
      i++;
      continue;
    }

    let heading =
      "## " +
      (i === 0
        ? "Major Changes"
        : i === 1
        ? "Minor Changes"
        : "Patch Changes") +
      "\n";
    let body = "";
    /** @type {string[]} */
    let affectedPackages = [];
    for (let note of releaseNotes) {
      affectedPackages = uniq(affectedPackages, note.affectedPackages);
      body += `${note.body
        .split("\n")
        .filter(Boolean)
        .map(bulletize)
        .join("\n")}\n`;
    }
    body = `- Affected packages: \n  - ${affectedPackages
      .map((p) => "`" + p + "`")
      .join("\n  - ")}\n${body}`;
    fileContents += heading + "\n" + body + "\n";
    i++;
  }

  await fs.promises.writeFile(releaseNotesPath, fileContents.trim(), "utf-8");

  console.log("✅ Donezo");
}

/**
 * @param {string} fileName
 * @returns
 */
function isChangeset(fileName) {
  return fileName.endsWith(".md") && path.basename(fileName) !== "README.md";
}

function getChangesetPaths() {
  return fs
    .readdirSync(changesetsDir)
    .filter((fileName) => isChangeset(fileName))
    .map((fileName) => path.join(changesetsDir, fileName));
}

/**
 *
 * @param {unknown} obj
 * @returns {obj is Record<keyof any, unknown>}
 */
function isPlainObject(obj) {
  return !!obj && Object.prototype.toString.call(obj) === "[object Object]";
}

/** @typedef {{ affectedPackages: string[]; body: string }} ReleaseNotes */

/**
 * @param  {...any} arrays
 * @returns
 */
function uniq(...arrays) {
  return [...new Set(arrays.flat())];
}

/**
 * @param {string} str
 * @param {number} i
 */
function bulletize(str, i) {
  if (i === 0) {
    return "- " + str.trim().replace(/^- /, "");
  }
  if (str.startsWith("- ")) {
    return "    " + str.trim();
  }
  return "  - " + str.trim();
}
