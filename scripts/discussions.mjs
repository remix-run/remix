import Stream from "stream";
import { promisify } from "util";
import path from "path";
import fse from "fs-extra";

import { Octokit as createOctokit } from "@octokit/core";
import gunzip from "gunzip-maybe";
import tar from "tar-stream";
import fetch from "node-fetch";
import undoc from "@mcansh/undoc";
import parseAttributes from "gray-matter";
import { throttling } from "@octokit/plugin-throttling";

const { findMatchingEntries, getPackage } = undoc;

const pipeline = promisify(Stream.pipeline);

if (!process.env.GITHUB_TOKEN) {
  throw new Error("GITHUB_TOKEN not set");
}

if (!process.env.GITHUB_REPOSITORY) {
  throw new Error("GITHUB_REPOSITORY not set");
}

if (!process.env.GITHUB_REPOSITORY_ID) {
  throw new Error("GITHUB_REPOSITORY_ID not set");
}

if (!process.env.GITHUB_CATEGORY_ID) {
  throw new Error("GITHUB_CATEGORY_ID not set");
}

if (!process.env.GITHUB_SHA) {
  throw new Error("GITHUB_SHA not set");
}

let [OWNER, REPO] = process.env.GITHUB_REPOSITORY.split("/");

let gql = String.raw;

let Octokit = createOctokit.plugin(throttling);

let octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  throttle: {
    onRateLimit(retryAfter, options, octokit) {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`
      );

      if (options.request.retryCount === 0) {
        // only retries once
        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onSecondaryRateLimit(retryAfter, options, octokit) {
      // does not retry, only logs a warning
      octokit.log.warn(
        `SecondaryRateLimit detected for request ${options.method} ${options.url}`
      );
    },
  },
});

async function updateDiscussions() {
  try {
    let renamedFiles = await getFilesRenamed(process.env.GITHUB_SHA);

    let stream = await getPackage(
      process.env.GITHUB_REPOSITORY,
      "refs/heads/main"
    );

    let existingDiscussions = await getExistingDiscussions();

    await findMatchingEntries(stream, "/docs", async (entry) => {
      if (!entry.path.endsWith(".md")) {
        console.log(`Skipping ${entry.path}`);
        return;
      }

      let file = parseAttributes(entry.content);
      let { data } = file;
      let docUrl = getDocUrl(entry.path);

      let fileRenamed = renamedFiles.find((doc) => {
        return doc.to === entry.path;
      });

      let title = data.title || entry.path.replace(/^\/docs/, "");

      let exists = existingDiscussions.find(
        (discussion) => discussion.node.url === data.discussionUrl
      );
      if (exists) {
        if (exists.node.title === data.title && !fileRenamed) {
          return;
        }

        console.log(exists.node.title + "is different");
        let newBody = exists.node.body.replace(
          `Doc URL: ${getDocUrl(fileRenamed.from)}`,
          `Doc URL: ${getDocUrl(fileRenamed.to)}`
        );
        await updateDiscussion(exists.node.id, title, newBody);
        return;
      }

      let discussionUrl = await createDiscussion(title, docUrl);

      let filepath = path.join(process.cwd(), entry.path);

      fse.writeFileSync(
        filepath,
        file.stringify({
          ...data,
          discussionUrl,
        })
      );
    });
  } catch (error) {
    throw new Error(
      "🚨 There was a problem fetching the file from GitHub. Please try again later."
    );
  }
}

function getDocUrl(filePath) {
  return new URL(
    "docs/en/v1" + filePath.replace(/^\/docs/, "");.replace(/.md$/, ""),
    "https://remix.run"
  ).toString();
}

async function getFilesRenamed(commitSha) {
  let res = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
    owner: OWNER,
    repo: REPO,
    ref: commitSha,
  });

  return res.data.files.map((file) => {
    return {
      from: file.previous_filename.startsWith("/")
        ? file.previous_filename
        : `/${file.previous_filename}`,
      to: file.filename.startsWith("/") ? file.filename : `/${file.filename}`,
    };
  });
}

async function fetchDiscussions(results = [], cursor) {
  let result = await octokit.graphql(
    gql`
      query LIST_DISCUSSIONS(
        $name: String!
        $owner: String!
        $categoryId: ID!
        $cursor: String
      ) {
        repository(name: $name, owner: $owner) {
          discussions(categoryId: $categoryId, first: 20, after: $cursor) {
            pageInfo {
              endCursor
              hasNextPage
            }
            edges {
              node {
                title
                url
                id
                body
              }
            }
          }
        }
      }
    `,
    {
      name: REPO,
      owner: OWNER,
      categoryId: process.env.GITHUB_CATEGORY_ID,
      cursor,
    }
  );

  results.push(...result.repository.discussions.edges);

  if (result.repository.discussions.pageInfo.hasNextPage) {
    await fetchDiscussions(
      results,
      result.repository.discussions.pageInfo.endCursor
    );
  }

  return results;
}

async function getExistingDiscussions() {
  try {
    return fetchDiscussions();
  } catch (error) {
    throw new Error(
      "🚨 There was a problem fetching the discussions. Please try again later."
    );
  }
}

// for now we only update the discussion title,
// but we should be able to take in the current
// discussion body and just replace the doc url
async function updateDiscussion(discussionId, title, newBody) {
  console.log(`Updating discussion ${discussionId}`);

  let result = await octokit.graphql(
    gql`
      mutation UPDATE_DISCUSSION(
        $title: String!
        $categoryId: ID!
        $discussionId: ID!
        $body: String!
      ) {
        updateDiscussion(
          input: {
            title: $title
            categoryId: $categoryId
            discussionId: $discussionId
            body: $body
          }
        ) {
          discussion {
            url
          }
        }
      }
    `,
    {
      categoryId: process.env.GITHUB_CATEGORY_ID,
      title,
      discussionId,
      body: newBody,
    }
  );

  console.log(`Updated discussion for ${title}`);
}

async function createDiscussion(title, url) {
  console.log(`Creating discussion for ${title}`);
  let result = await octokit.graphql(
    gql`
      mutation CREATE_DISCUSSION(
        $repositoryId: ID!
        $title: String!
        $body: String!
        $categoryId: ID!
      ) {
        createDiscussion(
          input: {
            repositoryId: $repositoryId
            title: $title
            body: $body
            categoryId: $categoryId
          }
        ) {
          discussion {
            url
          }
        }
      }
    `,
    {
      repositoryId: process.env.GITHUB_REPOSITORY_ID,
      categoryId: process.env.GITHUB_CATEGORY_ID,
      title,
      body: `Doc URL: ${url}`,
    }
  );

  console.log(`Created discussion for ${title}`);

  return result.createDiscussion.discussion.url;
}

updateDiscussions();
